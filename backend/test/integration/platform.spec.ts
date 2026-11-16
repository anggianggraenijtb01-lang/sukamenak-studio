import { describe, expect, it } from 'vitest';
import { runSeed } from '../../src/seed/index.js';
import { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_EMAIL, DEMO_PASSWORD, api, bearer, login, pool, registerUser, useDatabase } from '../helpers/api.js';

useDatabase();

describe('health and meta', () => {
  it('GET /health checks the database', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'ok', checks: { database: 'up', redis: 'skipped' } });
  });

  it('GET /meta/version reports name and version only', async () => {
    const res = await api().get('/api/v1/meta/version');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'sukamenak-studio-backend', api: 'v1' });
    expect(res.body.data.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('HTTP hygiene', () => {
  it('sends security headers and a request id, and hides the framework', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('answers unknown routes with the error envelope', async () => {
    const res = await api().get('/api/v1/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ status: 'error', message: expect.any(String), error_code: 'NOT_FOUND' });
  });

  it('answers malformed JSON with VALIDATION_ERROR rather than a stack trace', async () => {
    const res = await api().post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body)).not.toMatch(/SyntaxError|at \w+ \(/);
  });

  it('allows credentialed CORS only for configured origins', async () => {
    const allowed = await api().get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const denied = await api().get('/api/v1/health').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    const preflight = await api()
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    expect(preflight.status).toBe(204);
  });
});

describe('requireRole("admin") via the /admin/ping stub', () => {
  it('401 without a token', async () => {
    const res = await api().get('/api/v1/admin/ping');
    expect(res.status).toBe(401);
    expect(res.body.error_code).toBe('UNAUTHORIZED');
  });

  it('403 FORBIDDEN for a creator', async () => {
    const creator = await registerUser();
    const res = await api().get('/api/v1/admin/ping').set(bearer(creator.accessToken));
    expect(res.status).toBe(403);
    expect(res.body.error_code).toBe('FORBIDDEN');
    const demo = await login(DEMO_EMAIL, DEMO_PASSWORD);
    expect((await api().get('/api/v1/admin/ping').set(bearer(demo.accessToken))).status).toBe(403);
  });

  it('200 for a seeded admin', async () => {
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await api().get('/api/v1/admin/ping').set(bearer(admin.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ pong: true, actor_id: admin.id });
  });

  it('applies to every path under /admin, even ones that do not exist yet', async () => {
    const creator = await registerUser();
    const res = await api().get('/api/v1/admin/users').set(bearer(creator.accessToken));
    expect(res.status).toBe(403);
  });

  it('403/ACCOUNT_INACTIVE for an admin deactivated after login', async () => {
    const admin = await login('admin2@sukamenak.studio', ADMIN_PASSWORD);
    await pool.query("UPDATE users SET is_active = false WHERE email = 'admin2@sukamenak.studio'");
    try {
      const res = await api().get('/api/v1/admin/ping').set(bearer(admin.accessToken));
      expect(res.status).toBe(403);
      expect(res.body.error_code).toBe('ACCOUNT_INACTIVE');
    } finally {
      await pool.query("UPDATE users SET is_active = true WHERE email = 'admin2@sukamenak.studio'");
    }
  });
});

describe('seed', () => {
  it('created 2 admins, 1 demo creator, settings, policy, brand and models', async () => {
    const users = await pool.query("SELECT email, role FROM users WHERE email IN ('admin@sukamenak.studio','admin2@sukamenak.studio','demo@sukamenak.studio') ORDER BY email");
    expect(users.rows).toEqual([
      { email: 'admin2@sukamenak.studio', role: 'admin' },
      { email: 'admin@sukamenak.studio', role: 'admin' },
      { email: 'demo@sukamenak.studio', role: 'creator' },
    ]);
    const settings = Object.fromEntries((await pool.query('SELECT key, value FROM app_settings')).rows.map((r) => [r.key, r.value]));
    expect(settings).toMatchObject({ language: 'id', default_daily_limit: 10, watermark_enabled: false, max_references: 4 });

    const policy = await pool.query('SELECT blocked_terms, disclaimers FROM content_policies WHERE is_active');
    expect(policy.rows[0].blocked_terms.length).toBeGreaterThan(5);
    expect(policy.rows[0].disclaimers.psa).toEqual(expect.any(String));
    expect((await pool.query('SELECT 1 FROM brand_identities WHERE is_default')).rowCount).toBe(1);

    const defaults = await pool.query('SELECT capability, provider FROM model_configs WHERE is_default AND is_active ORDER BY capability');
    expect(defaults.rows).toEqual([
      { capability: 'i2i', provider: 'mock' },
      { capability: 't2i', provider: 'mock' },
      { capability: 'text', provider: 'mock' },
      { capability: 'vision', provider: 'mock' },
    ]);
    const inactive = await pool.query("SELECT count(*)::int AS n FROM model_configs WHERE provider <> 'mock' AND NOT is_active");
    expect(inactive.rows[0].n).toBeGreaterThanOrEqual(12);
    // Only variable NAMES are stored, never keys.
    const bad = await pool.query("SELECT 1 FROM model_configs WHERE api_key_env IS NOT NULL AND api_key_env !~ '^[A-Z][A-Z0-9_]*$'");
    expect(bad.rowCount).toBe(0);
  });

  it('is idempotent: a second run creates nothing and changes no counts', async () => {
    const count = async (t: string) => (await pool.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n as number;
    const tables = ['users', 'templates', 'template_slots', 'text_zones', 'core_prompts', 'model_configs', 'tutorials', 'tutorial_sections', 'visual_breakdowns', 'gallery_items', 'app_settings', 'assets'];
    const before = await Promise.all(tables.map(count));
    const result = await runSeed({ quiet: true, copyAssets: false });
    const after = await Promise.all(tables.map(count));
    expect(after).toEqual(before);
    expect(result.generatedPasswords).toEqual([]);
    expect(Object.values(result.created).reduce((a, b) => a + b, 0)).toBe(0);
  });
});
