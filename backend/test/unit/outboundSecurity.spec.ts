import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Agent } from 'undici';
import { env } from '../../src/config/env.js';
import { createGuardedLookup, isDisallowedHost, isPrivateAddress, type LookupFn } from '../../src/lib/outboundUrl.js';
import { isAllowedProviderKeyEnv, KNOWN_PROVIDER_KEY_ENVS, readProviderKey } from '../../src/lib/providerKeyEnv.js';
import { ProviderError } from '../../src/providers/errors.js';
import { defaultFetch } from '../../src/providers/http.js';

describe('provider key variable allowlist', () => {
  it('accepts the known provider names and the PROVIDER_KEY_ prefix', () => {
    for (const name of [...KNOWN_PROVIDER_KEY_ENVS, 'PROVIDER_KEY_ACME', 'PROVIDER_KEY_SECOND_ACCOUNT_2']) {
      expect(isAllowedProviderKeyEnv(name), name).toBe(true);
    }
  });

  it('rejects the application secrets and malformed names', () => {
    for (const name of [
      'CORE_PROMPT_KEY',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'DATABASE_URL',
      'REDIS_URL',
      'S3_SECRET_ACCESS_KEY',
      'S3_ACCESS_KEY_ID',
      'FILE_SIGNING_SECRET',
      'PATH',
      'PROVIDER_KEY_',
      'XPROVIDER_KEY_A',
      'provider_key_a',
      'PROVIDER_KEY_A B',
    ]) {
      expect(isAllowedProviderKeyEnv(name), name).toBe(false);
    }
  });

  it('never allows a variable the application itself is configured with (apart from the provider keys)', () => {
    for (const name of Object.keys(env)) {
      if (KNOWN_PROVIDER_KEY_ENVS.includes(name)) continue;
      expect(isAllowedProviderKeyEnv(name), name).toBe(false);
    }
  });

  describe('readProviderKey', () => {
    afterEach(() => {
      delete process.env.PROVIDER_KEY_UNIT_TEST;
    });

    it('returns the value of an allowed, set variable', () => {
      process.env.PROVIDER_KEY_UNIT_TEST = 'value-123';
      expect(readProviderKey('PROVIDER_KEY_UNIT_TEST')).toBe('value-123');
    });

    it('returns undefined for unset, empty, null or missing names', () => {
      expect(readProviderKey('PROVIDER_KEY_UNIT_TEST')).toBeUndefined();
      process.env.PROVIDER_KEY_UNIT_TEST = '';
      expect(readProviderKey('PROVIDER_KEY_UNIT_TEST')).toBeUndefined();
      expect(readProviderKey(null)).toBeUndefined();
      expect(readProviderKey(undefined)).toBeUndefined();
    });

    it('refuses to read an internal secret even though it is set', () => {
      expect(process.env.CORE_PROMPT_KEY, 'test setup must define the core prompt key').toBeTruthy();
      expect(readProviderKey('CORE_PROMPT_KEY')).toBeUndefined();
      expect(readProviderKey('JWT_ACCESS_SECRET')).toBeUndefined();
    });
  });
});

describe('outbound address classification', () => {
  it('flags private, special-purpose and transition-mechanism addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
      '::',
      '::1',
      'fe80::1',
      'fc00::1',
      'fd12:3456::1',
      'ff02::1',
      // IPv4-mapped, dotted and hex notation
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '::ffff:10.0.0.1',
      '::ffff:a9fe:a9fe',
      // IPv4-compatible, NAT64, 6to4, Teredo: all embed an IPv4 address
      '::7f00:1',
      '64:ff9b::a00:1',
      '2002:7f00:1::',
      '2001:0:4136:e378:8000:63bf:3fff:fdd2',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('lets ordinary public addresses through', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '172.15.255.255', '93.184.216.34', '2606:4700:4700::1111', '::ffff:8.8.8.8', '::ffff:808:808']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('does not treat a hostname as an address', () => {
    expect(isPrivateAddress('example.com')).toBe(false);
  });

  describe('isDisallowedHost on the hostname the URL parser produces', () => {
    const host = (url: string) => new URL(url).hostname;

    it('rejects every notation of an internal address', () => {
      for (const url of [
        'http://localhost:6379/',
        'http://api.localhost/',
        'http://db.internal/',
        'http://printer.local/',
        'http://LOCALHOST/',
        'http://10.0.0.1/',
        'http://169.254.169.254/latest/meta-data',
        'http://[::1]/',
        'http://[fd00::1]/',
        // the URL parser rewrites these to a normalised form, and that is what gets checked
        'http://[::ffff:127.0.0.1]/',
        'http://[::ffff:169.254.169.254]/',
        'http://[::ffff:10.0.0.1]/',
        'http://[::127.0.0.1]/',
        'http://[64:ff9b::a00:1]/',
        'http://[2002:7f00:1::]/',
        'http://2130706433/',
        'http://0x7f.1/',
        'http://0177.0.0.1/',
      ]) {
        expect(isDisallowedHost(host(url)), `${url} -> ${host(url)}`).toBe(true);
      }
    });

    it('accepts ordinary public hosts', () => {
      for (const url of ['https://api.openai.com/v1', 'https://example.com', 'https://8.8.8.8/', 'https://[2606:4700:4700::1111]/', 'https://[::ffff:8.8.8.8]/']) {
        expect(isDisallowedHost(host(url)), `${url} -> ${host(url)}`).toBe(false);
      }
    });
  });
});

describe('guarded connection lookup', () => {
  type Answer = { address: string; family: number };
  const resolverFor =
    (...answers: Answer[]): LookupFn =>
    (_hostname, options, callback) => {
      if ((options as { all?: boolean }).all) callback(null, answers);
      else callback(null, answers[0]!.address, answers[0]!.family);
    };
  const run = (lookup: LookupFn, all: boolean) =>
    new Promise<{ err: NodeJS.ErrnoException | null; address?: unknown }>((resolve) => {
      lookup('api.example.test', { all } as never, (err, address) => resolve({ err, address }));
    });

  it('refuses a name that resolves to a private address, in both callback forms', async () => {
    const lookup = createGuardedLookup(resolverFor({ address: '10.0.0.5', family: 4 }));
    for (const all of [false, true]) {
      const { err } = await run(lookup, all);
      expect(err?.code, `all=${all}`).toBe('EBLOCKEDHOST');
    }
  });

  it('refuses when any resolved address is private, including the IPv4-mapped hex form', async () => {
    for (const bad of ['169.254.169.254', '::ffff:7f00:1']) {
      const lookup = createGuardedLookup(resolverFor({ address: '93.184.216.34', family: 4 }, { address: bad, family: bad.includes(':') ? 6 : 4 }));
      expect((await run(lookup, true)).err?.code, bad).toBe('EBLOCKEDHOST');
    }
  });

  it('passes public answers through unchanged', async () => {
    const lookup = createGuardedLookup(resolverFor({ address: '93.184.216.34', family: 4 }));
    expect(await run(lookup, false)).toEqual({ err: null, address: '93.184.216.34' });
    const all = await run(lookup, true);
    expect(all.err).toBeNull();
    expect(all.address).toEqual([{ address: '93.184.216.34', family: 4 }]);
  });

  it('propagates resolver errors untouched', async () => {
    const failing: LookupFn = (_h, _o, callback) => callback(Object.assign(new Error('nope'), { code: 'ENOTFOUND' }), '', 4);
    expect((await run(createGuardedLookup(failing), false)).err?.code).toBe('ENOTFOUND');
  });

  describe('on a real connection', () => {
    let server: Server | undefined;
    afterEach(async () => {
      await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
      server = undefined;
    });

    // "pinned.test" is mapped to 127.0.0.1 by a stub resolver, so no real DNS is involved. The unguarded
    // agent proves the server is reachable that way; the guarded one proves the connection is refused
    // and no request ever reaches the server.
    it('blocks a hostname that resolves to loopback, while the same route is reachable without the guard', async () => {
      let hits = 0;
      server = createServer((_req, res) => {
        hits += 1;
        res.end('ok');
      });
      await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
      const { port } = server.address() as AddressInfo;
      const toLoopback = resolverFor({ address: '127.0.0.1', family: 4 });
      const url = `http://pinned.test:${port}/`;

      const open = new Agent({ connect: { lookup: toLoopback as never } });
      const reached = await fetch(url, { dispatcher: open } as unknown as RequestInit);
      expect(await reached.text()).toBe('ok');
      expect(hits).toBe(1);

      const guarded = new Agent({ connect: { lookup: createGuardedLookup(toLoopback) as never } });
      const refused = await fetch(url, { dispatcher: guarded } as unknown as RequestInit).catch((e) => e);
      expect(refused).toBeInstanceOf(Error);
      expect((refused as { cause?: { code?: string } }).cause?.code).toBe('EBLOCKEDHOST');
      expect(hits).toBe(1);

      await Promise.all([open.close(), guarded.close()]);
    });
  });
});

describe('defaultFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is only meaningful while private hosts are disallowed (the default, and the test setting)', () => {
    expect(env.ALLOW_PRIVATE_PROVIDER_HOSTS).toBe(false);
  });

  it('refuses internal literal hosts, in every notation, with a sanitised error and no request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const url of [
      'http://169.254.169.254/latest/meta-data',
      'http://[::ffff:127.0.0.1]/',
      'http://[::ffff:7f00:1]/',
      'http://[::127.0.0.1]/',
      'http://2130706433/',
      'http://localhost:6379/',
    ]) {
      const err = await defaultFetch(url, { headers: { Authorization: 'Bearer secret' } }).catch((e) => e);
      expect(err, url).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code, url).toBe('PROVIDER_BAD_REQUEST');
      expect(String((err as Error).message), url).not.toMatch(/169\.254|127\.0|secret/);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a malformed URL', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const err = await defaultFetch('not a url').catch((e) => e);
    expect((err as ProviderError).code).toBe('PROVIDER_BAD_REQUEST');
  });

  it('refuses redirects and connects through the guarded dispatcher', async () => {
    const fetchMock = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await defaultFetch('https://93.184.216.34/v1/images', { method: 'POST' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit & { dispatcher?: unknown }])[1];
    expect(init.redirect).toBe('error');
    expect(init.dispatcher).toBeDefined();
    expect(init.method).toBe('POST');
  });

  it('reports a connection refused by the lookup guard as a non-transient configuration error', async () => {
    const blocked = Object.assign(new TypeError('fetch failed'), { cause: { code: 'EBLOCKEDHOST' } });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(blocked));
    const err = await defaultFetch('https://api.example.test/v1').catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).code).toBe('PROVIDER_BAD_REQUEST');
    expect((err as ProviderError).transient).toBe(false);
  });

  it('rethrows other network failures unchanged', async () => {
    const boom = new TypeError('fetch failed');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(boom));
    await expect(defaultFetch('https://api.example.test/v1')).rejects.toBe(boom);
  });
});
