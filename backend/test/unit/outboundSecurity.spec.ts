import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../src/config/env.js';
import { assertPublicHost, isDisallowedHost, isPrivateAddress } from '../../src/lib/outboundUrl.js';
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

describe('outbound host guard', () => {
  it('classifies private and public addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '172.15.255.255', '93.184.216.34', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('rejects literal private hosts by name or address', () => {
    for (const host of ['localhost', 'api.localhost', 'db.internal', 'printer.local', '[::1]', '10.0.0.1', '169.254.169.254', 'LOCALHOST']) {
      expect(isDisallowedHost(host), host).toBe(true);
    }
    for (const host of ['example.com', 'api.openai.com', '8.8.8.8']) {
      expect(isDisallowedHost(host), host).toBe(false);
    }
  });

  describe('assertPublicHost', () => {
    it('rejects a public-looking name that resolves to a private address', async () => {
      await expect(assertPublicHost('https://api.example.test/v1', async () => [{ address: '10.0.0.5' }])).rejects.toThrow();
    });

    it('rejects when any resolved address is private', async () => {
      await expect(
        assertPublicHost('https://api.example.test/v1', async () => [{ address: '93.184.216.34' }, { address: '169.254.169.254' }]),
      ).rejects.toThrow();
    });

    it('accepts a name that resolves to public addresses only', async () => {
      await expect(assertPublicHost('https://api.example.test/v1', async () => [{ address: '93.184.216.34' }])).resolves.toBeUndefined();
    });

    it('rejects literal private hosts without resolving anything', async () => {
      const resolve = vi.fn(async () => [{ address: '93.184.216.34' }]);
      await expect(assertPublicHost('http://127.0.0.1:6379/', resolve)).rejects.toThrow();
      await expect(assertPublicHost('http://localhost/', resolve)).rejects.toThrow();
      expect(resolve).not.toHaveBeenCalled();
    });

    it('lets an unresolvable name through, so the request reports its own error', async () => {
      await expect(
        assertPublicHost('https://nope.example.test/', async () => {
          throw new Error('ENOTFOUND');
        }),
      ).resolves.toBeUndefined();
    });
  });
});

describe('defaultFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is only meaningful while private hosts are disallowed (the default, and the test setting)', () => {
    expect(env.ALLOW_PRIVATE_PROVIDER_HOSTS).toBe(false);
  });

  it('refuses an internal address with a sanitised provider error and makes no request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const err = await defaultFetch('http://169.254.169.254/latest/meta-data', { headers: { Authorization: 'Bearer secret' } }).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).code).toBe('PROVIDER_BAD_REQUEST');
    expect(String((err as Error).message)).not.toContain('169.254');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses redirects so credentials cannot be bounced to another host', async () => {
    const fetchMock = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await defaultFetch('https://93.184.216.34/v1/images', { method: 'POST' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].redirect).toBe('error');
  });
});
