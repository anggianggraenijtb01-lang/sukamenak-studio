import type { Router } from 'express';
import { describe, expect, it } from 'vitest';
import { requireAuth } from '../../src/middleware/auth.js';
import { ADMIN_MOUNTS, adminRouter } from '../../src/modules/admin/routes.js';
import { createApiRouter } from '../../src/modules/index.js';
import { api, bearer, login, pool, registerUser, PASSWORD, uniqueEmail } from '../helpers/api.js';
import { as, createAdminSession, loginSeedAdmin, uuid, useSeededDatabase } from '../helpers/admin.js';

useSeededDatabase();

// --- route table, derived from the live Express stack -------------------------------------

interface LayerLike {
  name?: string;
  slash?: boolean;
  handle: unknown;
  matchers?: ((path: string) => unknown)[];
  route?: { path: string; methods: Record<string, boolean>; stack: unknown[] };
}

const stackOf = (router: unknown): LayerLike[] => ((router as { stack?: LayerLike[] }).stack ?? []) as LayerLike[];
const isRouter = (handle: unknown): handle is Router => typeof handle === 'function' && Array.isArray((handle as { stack?: unknown }).stack);
const matches = (layer: LayerLike, path: string): boolean => (layer.matchers ?? []).some((m) => Boolean(m(path)));

export interface AdminRoute {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  /** Path relative to `/api/v1/admin`, with `:param` placeholders. */
  path: string;
}

/** Every route of the admin router and its mounted sub-routers, read from the registered stack. */
export function collectAdminRoutes(): { routes: AdminRoute[]; problems: string[] } {
  const routes: AdminRoute[] = [];
  const problems: string[] = [];
  const known = new Map<unknown, string>(ADMIN_MOUNTS.map(([prefix, router]) => [router, prefix]));

  const addRoutes = (layers: LayerLike[], prefix: string) => {
    for (const layer of layers) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods)) {
          routes.push({ method: method as AdminRoute['method'], path: `${prefix}${layer.route.path === '/' && prefix ? '' : layer.route.path}` || '/' });
        }
      } else if (isRouter(layer.handle)) {
        problems.push(`router nested inside a sub-router at "${prefix}" (the test cannot see its mount path)`);
      }
    }
  };

  const top = stackOf(adminRouter);
  const mounted = new Set<unknown>();
  for (const layer of top) {
    if (layer.route) {
      addRoutes([layer], '');
    } else if (isRouter(layer.handle)) {
      const prefix = known.get(layer.handle);
      if (prefix === undefined) {
        problems.push('a router is mounted on the admin router but is not listed in ADMIN_MOUNTS');
        continue;
      }
      mounted.add(layer.handle);
      // The registered mount must really match the documented prefix.
      if (prefix && !matches(layer, `${prefix}/probe`)) problems.push(`mount layer does not match its documented prefix "${prefix}"`);
      addRoutes(stackOf(layer.handle), prefix);
    }
  }
  for (const [prefix, router] of ADMIN_MOUNTS) if (!mounted.has(router)) problems.push(`ADMIN_MOUNTS entry "${prefix}" is not mounted`);
  return { routes, problems };
}

const concrete = (path: string): string => path.replace(/:[A-Za-z]+/g, () => uuid());

const { routes: ROUTES, problems: PROBLEMS } = collectAdminRoutes();

describe('admin route table', () => {
  it('is complete, every admin route is reachable under /api/v1/admin, and nothing else lives under /admin', () => {
    expect(PROBLEMS).toEqual([]);
    expect(ROUTES.length).toBeGreaterThanOrEqual(60);
    const signatures = ROUTES.map((r) => `${r.method.toUpperCase()} ${r.path}`);
    expect(new Set(signatures).size).toBe(signatures.length);
    // Spot-check the routes that matter most.
    for (const must of [
      'GET /users', 'POST /users/:id/reset-password', 'POST /models/:id/set-default', 'POST /models/:id/test', 'GET /core-prompts', 'POST /core-prompts/test-render',
      'POST /core-prompts/:id/activate', 'POST /templates/:id/publish', 'GET /generations/export.csv', 'POST /generations/:id/flag', 'POST /gallery', 'GET /audit', 'GET /dashboard',
      'GET /settings', 'PATCH /policy', 'GET /brand-identity', 'POST /references',
    ]) expect(signatures, must).toContain(must);

    // The audit log is read-only.
    expect(signatures.filter((s) => s.includes(' /audit') && !s.startsWith('GET '))).toEqual([]);
    // The core prompt resource has no way to read a body.
    expect(signatures.filter((s) => s.startsWith('GET /core-prompts'))).toEqual(['GET /core-prompts', 'GET /core-prompts/versions', 'GET /core-prompts/:id']);

    // The guard is registered before every route, at the router level.
    const top = stackOf(adminRouter);
    expect(top[0]?.handle).toBe(requireAuth);
    expect(typeof top[1]?.handle).toBe('function');

    // Exactly one path-mounted router answers /admin/* in the API router: the admin router.
    const apiLayers = stackOf(createApiRouter());
    const adminLayers = apiLayers.filter((l) => !l.slash && matches(l, '/admin/probe'));
    expect(adminLayers).toHaveLength(1);
    expect(adminLayers[0]?.handle).toBe(adminRouter);
    expect(apiLayers.filter((l) => l.route && l.route.path.startsWith('/admin'))).toEqual([]);
  });
});

describe('RBAC on every /api/v1/admin route', () => {
  it('rejects anonymous callers (401) and creators (403), whatever the method or payload', async () => {
    const creator = await registerUser();
    const failures: string[] = [];
    for (const route of ROUTES) {
      const url = `/api/v1/admin${concrete(route.path)}`;
      const label = `${route.method.toUpperCase()} ${route.path}`;
      const anonymous = await api()[route.method](url).send({});
      if (anonymous.status !== 401) failures.push(`${label}: anonymous got ${anonymous.status}`);
      const forged = await api()[route.method](url).set(bearer('not.a.jwt')).send({});
      if (forged.status !== 401) failures.push(`${label}: garbage token got ${forged.status}`);
      const asCreator = await api()[route.method](url).set(bearer(creator.accessToken)).send({});
      if (asCreator.status !== 403) failures.push(`${label}: creator got ${asCreator.status}`);
      if (asCreator.body?.error_code !== 'FORBIDDEN') failures.push(`${label}: creator error_code ${String(asCreator.body?.error_code)}`);
    }
    expect(failures).toEqual([]);
  });

  it('rejects a deactivated admin (their token is still cryptographically valid)', async () => {
    const boss = await loginSeedAdmin();
    const victim = await createAdminSession(boss);
    expect((await as(victim).get('/ping')).status).toBe(200);
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [victim.id]);
    const failures: string[] = [];
    for (const route of ROUTES) {
      const res = await api()[route.method](`/api/v1/admin${concrete(route.path)}`).set(bearer(victim.accessToken)).send({});
      if (![401, 403].includes(res.status)) failures.push(`${route.method.toUpperCase()} ${route.path}: ${res.status}`);
    }
    expect(failures).toEqual([]);
    // A soft-deleted admin is rejected as well.
    const gone = await createAdminSession(boss);
    expect((await as(boss).del(`/users/${gone.id}`)).status).toBe(200);
    expect([401, 403]).toContain((await as(gone).get('/ping')).status);
  });

  it('lets an active admin through every route (never 401 or 403)', async () => {
    const admin = await createAdminSession();
    const failures: string[] = [];
    for (const route of ROUTES) {
      const res = await api()[route.method](`/api/v1/admin${concrete(route.path)}`).set(bearer(admin.accessToken)).send({});
      if (res.status === 401 || res.status === 403) failures.push(`${route.method.toUpperCase()} ${route.path}: ${res.status}`);
      if (res.status >= 500) failures.push(`${route.method.toUpperCase()} ${route.path}: server error ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  it('a creator cannot reach admin data through the creator endpoints either', async () => {
    const creator = await registerUser();
    for (const path of ['/api/v1/admin', '/api/v1/admin/', '/api/v1/ADMIN/users', '/api/v1/admin/users/', '//api/v1/admin/users']) {
      const res = await api().get(path).set(bearer(creator.accessToken));
      expect([401, 403, 404], path).toContain(res.status);
      expect(JSON.stringify(res.body), path).not.toContain('password_hash');
    }
    // Role in the JWT is never trusted: it comes from the database.
    const forged = await login(creator.email, PASSWORD);
    await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [forged.id]);
    expect((await as(forged).get('/ping')).status).toBe(200);
    await pool.query("UPDATE users SET role = 'creator' WHERE id = $1", [forged.id]);
    expect((await as(forged).get('/ping')).status).toBe(403);
  });
});

describe('privilege escalation through public endpoints', () => {
  it('public registration can never create an admin, whatever the body says', async () => {
    for (const extra of [{ role: 'admin' }, { role: 'ADMIN' }, { is_admin: true }, { roles: ['admin'], isAdmin: true, admin: true }]) {
      const email = uniqueEmail('escalate');
      const res = await api().post('/api/v1/auth/register').send({ email, password: PASSWORD, name: 'Escalator', ...extra });
      expect(res.status, JSON.stringify(extra)).toBe(201);
      expect(res.body.data.user.role).toBe('creator');
      const row = await pool.query<{ role: string }>('SELECT role FROM users WHERE email = $1', [email]);
      expect(row.rows[0]?.role).toBe('creator');
      expect((await api().get('/api/v1/admin/ping').set(bearer(res.body.data.access_token))).status).toBe(403);
    }
  });

  it('a creator cannot promote themselves with /me, nor create or edit users through the admin API', async () => {
    const creator = await registerUser();
    const res = await api().patch('/api/v1/me').set(bearer(creator.accessToken)).send({ name: 'Still Creator', role: 'admin' });
    expect([200, 400]).toContain(res.status);
    expect((await pool.query<{ role: string }>('SELECT role FROM users WHERE id = $1', [creator.id])).rows[0]?.role).toBe('creator');
    expect((await as(creator).post('/users', { email: uniqueEmail(), name: 'Sneaky Admin', role: 'admin', password: PASSWORD })).status).toBe(403);
    expect((await as(creator).patch(`/users/${creator.id}`, { role: 'admin' })).status).toBe(403);
    expect((await pool.query<{ role: string }>('SELECT role FROM users WHERE id = $1', [creator.id])).rows[0]?.role).toBe('creator');
  });
});
