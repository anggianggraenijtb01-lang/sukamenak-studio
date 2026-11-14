import { describe, expect, it, vi } from 'vitest';
import { ApiError, ERROR_MESSAGES } from './errors';
import { buildQueryString, createApiClient, resolveFileUrl, type AuthEvent } from './client';
import type { Session } from './types';

const BASE = 'http://api.test/api/v1';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ok = (data: unknown, meta?: unknown) => json(200, { status: 'success', message: 'ok', data, ...(meta ? { meta } : {}) });
const fail = (status: number, error_code: string, extra: Record<string, unknown> = {}) =>
  json(status, { status: 'error', message: 'server text', error_code, ...extra });

const session = (token: string): Session => ({
  user: { id: 'u1', email: 'a@b.c', name: 'A', role: 'creator', last_login_at: null, created_at: '2026-01-01T00:00:00Z' },
  access_token: token,
  token_type: 'Bearer',
  expires_in: 3600,
});

const authHeader = (init?: RequestInit) => (init?.headers as Record<string, string> | undefined)?.Authorization;
const urlOf = (input: RequestInfo | URL) => String(input).replace(BASE, '');
type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const mockFetch = (impl: FetchImpl) => vi.fn<FetchImpl>(impl);

describe('envelope handling', () => {
  it('unwraps data and exposes meta for pages', async () => {
    const fetchMock = mockFetch(async () => ok([{ id: 1 }], { page: 1, limit: 20, total: 1, total_pages: 1 }));
    const client = createApiClient({ baseUrl: BASE, fetch: fetchMock as unknown as typeof fetch });
    const page = await client.requestPage<{ id: number }>('/things', { query: { page: 1, search: 'x y', empty: '', skip: undefined } });
    expect(page.items).toEqual([{ id: 1 }]);
    expect(page.meta).toEqual({ page: 1, limit: 20, total: 1, total_pages: 1 });
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(`${BASE}/things?page=1&search=x+y`);
    expect(init.credentials).toBe('include');
  });

  it('throws a typed ApiError for the error envelope, keeping field errors', async () => {
    const fetchMock = vi.fn(async () =>
      fail(400, 'VALIDATION_ERROR', { errors: [{ field: 'name', message: 'Wajib diisi' }] }),
    );
    const client = createApiClient({ baseUrl: BASE, fetch: fetchMock as unknown as typeof fetch });
    const err = await client.get('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.status).toBe(400);
    expect(apiErr.code).toBe('VALIDATION_ERROR');
    expect(apiErr.message).toBe(ERROR_MESSAGES.VALIDATION_ERROR);
    expect(apiErr.fieldErrors).toEqual({ name: 'Wajib diisi' });
  });

  it('never surfaces raw server text for a 5xx or a non-JSON body', async () => {
    const client = createApiClient({
      baseUrl: BASE,
      fetch: (async () => new Response('<html>stack trace at db.js:1</html>', { status: 502 })) as unknown as typeof fetch,
    });
    const err = (await client.get('/x').catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(502);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.message).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
  });

  it('maps a network failure to NETWORK_ERROR and lets AbortError through', async () => {
    const down = createApiClient({
      baseUrl: BASE,
      fetch: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
    });
    const err = (await down.get('/x').catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.status).toBe(0);

    const ctrl = new AbortController();
    const slow = createApiClient({
      baseUrl: BASE,
      fetch: ((_url: string, init: RequestInit) =>
        new Promise((_res, rej) => {
          init.signal?.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')));
        })) as unknown as typeof fetch,
    });
    const pending = slow.get('/x', undefined, ctrl.signal).catch((e: unknown) => e);
    ctrl.abort();
    const aborted = (await pending) as Error;
    expect(aborted).not.toBeInstanceOf(ApiError);
    expect(aborted.name).toBe('AbortError');
  });

  it('sends JSON with a Content-Type, and multipart without one', async () => {
    const fetchMock = mockFetch(async () => ok({}));
    const client = createApiClient({ baseUrl: BASE, fetch: fetchMock as unknown as typeof fetch });
    await client.post('/p', { a: 1 });
    const jsonInit = fetchMock.mock.calls[0][1]!;
    expect((jsonInit.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(jsonInit.body).toBe('{"a":1}');

    const form = new FormData();
    form.append('role', 'product');
    await client.upload('/references', form);
    const formInit = fetchMock.mock.calls[1][1]!;
    expect((formInit.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect(formInit.body).toBe(form);
  });
});

describe('access token', () => {
  it('sends the in-memory token as a Bearer header and never touches web storage', async () => {
    const fetchMock = mockFetch(async () => ok({}));
    const client = createApiClient({ baseUrl: BASE, fetch: fetchMock as unknown as typeof fetch });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    await client.get('/me');
    expect(authHeader(fetchMock.mock.calls[0][1])).toBeUndefined();
    client.setSession(session('tok-1'));
    await client.get('/me');
    expect(authHeader(fetchMock.mock.calls[1][1])).toBe('Bearer tok-1');
    client.clearSession();
    await client.get('/me');
    expect(authHeader(fetchMock.mock.calls[2][1])).toBeUndefined();
    expect(setItem).not.toHaveBeenCalled();
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain('tok-1');
  });

  it('omits the token and never refreshes for auth:false calls', async () => {
    const calls: string[] = [];
    const client = createApiClient({
      baseUrl: BASE,
      fetch: (async (input: RequestInfo | URL) => {
        calls.push(urlOf(input));
        return fail(401, 'INVALID_CREDENTIALS');
      }) as unknown as typeof fetch,
    });
    client.setSession(session('tok'));
    const err = (await client.request('/auth/login', { method: 'POST', body: {}, auth: false }).catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe('INVALID_CREDENTIALS');
    expect(calls).toEqual(['/auth/login']);
  });
});

describe('single-flight refresh', () => {
  /** Backend double: `/auth/refresh` rotates the token, protected paths accept only the newest token. */
  function backend() {
    let current = 'rotated-away'; // the server no longer accepts 'old'; only the token issued by a refresh
    let refreshCalls = 0;
    const seen: Array<{ path: string; token?: string }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = urlOf(input);
      if (path === '/auth/refresh') {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 10)); // keep it in flight while the other 401s arrive
        current = `new-${refreshCalls}`;
        return ok(session(current));
      }
      const token = authHeader(init)?.replace('Bearer ', '');
      seen.push({ path, token });
      return token === current ? ok({ path }) : fail(401, 'UNAUTHORIZED');
    });
    return { fetchMock, seen, refreshCount: () => refreshCalls };
  }

  it('refreshes exactly once when many requests fail together, then retries each one once', async () => {
    const be = backend();
    const client = createApiClient({ baseUrl: BASE, fetch: be.fetchMock as unknown as typeof fetch });
    client.setSession(session('old'));
    const events: AuthEvent[] = [];
    client.subscribe((e) => events.push(e));

    const results = await Promise.all(['/a', '/b', '/c', '/d', '/e', '/f'].map((p) => client.get<{ path: string }>(p)));
    expect(results.map((r) => r.path)).toEqual(['/a', '/b', '/c', '/d', '/e', '/f']);
    expect(be.refreshCount()).toBe(1);
    for (const p of ['/a', '/b', '/c', '/d', '/e', '/f']) {
      const tries = be.seen.filter((s) => s.path === p);
      expect(tries.map((t) => t.token)).toEqual(['old', 'new-1']); // original + one retry
    }
    expect(client.getAccessToken()).toBe('new-1');
    expect(events.filter((e) => e.type === 'session')).toHaveLength(1);
    expect(events.some((e) => e.type === 'expired')).toBe(false);
  });

  it('retries a request that failed with an already replaced token without refreshing again', async () => {
    let current = 'rotated-away';
    let refreshCalls = 0;
    let releaseSlow: (() => void) | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = urlOf(input);
      if (path === '/auth/refresh') {
        refreshCalls += 1;
        current = 'new';
        return ok(session('new'));
      }
      const token = authHeader(init)?.replace('Bearer ', '');
      if (path === '/slow' && token === 'old') {
        // The 401 for this request only arrives after the refresh is complete.
        return new Promise<Response>((resolve) => {
          releaseSlow = () => resolve(fail(401, 'UNAUTHORIZED'));
        });
      }
      return token === current ? ok({ path }) : fail(401, 'UNAUTHORIZED');
    });
    const client = createApiClient({ baseUrl: BASE, fetch: fetchMock as unknown as typeof fetch });
    client.setSession(session('old'));

    const slow = client.get('/slow');
    await client.get('/fast'); // 401 -> refresh -> retry
    expect(refreshCalls).toBe(1);
    releaseSlow?.();
    await expect(slow).resolves.toEqual({ path: '/slow' });
    expect(refreshCalls).toBe(1);
  });

  it('retries only once: a second 401 after a good refresh is returned as an error', async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (urlOf(input) === '/auth/refresh') {
        refreshCalls += 1;
        return ok(session(`t${refreshCalls}`));
      }
      return fail(401, 'UNAUTHORIZED');
    });
    const client = createApiClient({ baseUrl: BASE, fetch: fetchMock as unknown as typeof fetch });
    client.setSession(session('old'));
    const err = (await client.get('/always-401').catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(401);
    expect(refreshCalls).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(3); // request, refresh, retry
  });

  it('clears the session and notifies once when the refresh is refused', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      urlOf(input) === '/auth/refresh' ? fail(401, 'UNAUTHORIZED') : fail(401, 'UNAUTHORIZED'),
    );
    const client = createApiClient({ baseUrl: BASE, fetch: fetchMock as unknown as typeof fetch });
    client.setSession(session('old'));
    const events: AuthEvent[] = [];
    client.subscribe((e) => events.push(e));

    const results = await Promise.all([
      client.get('/a').catch((e: unknown) => e),
      client.get('/b').catch((e: unknown) => e),
      client.get('/c').catch((e: unknown) => e),
    ]);
    for (const r of results) {
      expect(r).toBeInstanceOf(ApiError);
      expect((r as ApiError).status).toBe(401);
    }
    const refreshes = fetchMock.mock.calls.filter((c) => urlOf(c[0] as string) === '/auth/refresh');
    expect(refreshes).toHaveLength(1);
    expect(client.getAccessToken()).toBeNull();
    expect(events).toEqual([{ type: 'expired', reason: 'session' }]);
  });

  it('does not log anyone out when the refresh itself fails transiently (5xx)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      urlOf(input) === '/auth/refresh' ? fail(503, 'INTERNAL_ERROR') : fail(401, 'UNAUTHORIZED'),
    );
    const client = createApiClient({ baseUrl: BASE, fetch: fetchMock as unknown as typeof fetch });
    client.setSession(session('old'));
    const events: AuthEvent[] = [];
    client.subscribe((e) => events.push(e));
    await expect(client.get('/a')).rejects.toBeInstanceOf(ApiError);
    expect(client.getAccessToken()).toBe('old');
    expect(events).toEqual([]);
  });

  it('shares one refresh between the start-up silent refresh and a failing request', async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (urlOf(input) === '/auth/refresh') {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 5));
        return ok(session('fresh'));
      }
      return ok({});
    });
    const client = createApiClient({ baseUrl: BASE, fetch: fetchMock as unknown as typeof fetch });
    const [a, b] = await Promise.all([client.restoreSession(), client.restoreSession()]);
    expect(refreshCalls).toBe(1);
    expect(a?.access_token).toBe('fresh');
    expect(b?.access_token).toBe('fresh');
  });

  it('restoreSession resolves to null without a notification when there is no session', async () => {
    const client = createApiClient({
      baseUrl: BASE,
      fetch: (async () => fail(401, 'UNAUTHORIZED')) as unknown as typeof fetch,
    });
    const events: AuthEvent[] = [];
    client.subscribe((e) => events.push(e));
    await expect(client.restoreSession()).resolves.toBeNull();
    expect(events).toEqual([]);
  });

  it('ends the session when the account is deactivated (403 ACCOUNT_INACTIVE)', async () => {
    const client = createApiClient({
      baseUrl: BASE,
      fetch: (async () => fail(403, 'ACCOUNT_INACTIVE')) as unknown as typeof fetch,
    });
    client.setSession(session('tok'));
    const events: AuthEvent[] = [];
    client.subscribe((e) => events.push(e));
    const err = (await client.get('/me').catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe('ACCOUNT_INACTIVE');
    expect(client.getAccessToken()).toBeNull();
    expect(events).toEqual([{ type: 'expired', reason: 'inactive' }]);
  });
});

describe('URL helpers', () => {
  it('builds query strings', () => {
    expect(buildQueryString({ a: 1, b: true, c: false, d: '', e: null, f: undefined, g: ['x', 'y'] })).toBe('?a=1&b=true&c=false&g=x&g=y');
    expect(buildQueryString(undefined)).toBe('');
  });

  it('leaves signed absolute URLs alone and resolves root-relative ones against an absolute API base', () => {
    const signed = 'http://localhost:3000/api/v1/files/a/b.png?token=1.abc';
    expect(resolveFileUrl(signed, 'http://localhost:3000/api/v1')).toBe(signed);
    expect(resolveFileUrl('https://bucket.s3.example/key?X-Amz-Signature=z', '/api/v1')).toContain('X-Amz-Signature=z');
    expect(resolveFileUrl('/api/v1/files/a.png?token=1.abc', 'https://api.example.org/api/v1')).toBe(
      'https://api.example.org/api/v1/files/a.png?token=1.abc',
    );
    // Same-origin setup (dev proxy): a root-relative URL already works.
    expect(resolveFileUrl('/api/v1/files/a.png?token=1.abc', '/api/v1')).toBe('/api/v1/files/a.png?token=1.abc');
  });
});
