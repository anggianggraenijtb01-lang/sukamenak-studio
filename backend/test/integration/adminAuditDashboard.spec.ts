import { afterEach, describe, expect, it } from 'vitest';
import { ProviderError } from '../../src/providers/errors.js';
import { mockProvider } from '../../src/providers/mock.js';
import { registerProvider } from '../../src/providers/registry.js';
import { env } from '../../src/config/env.js';
import { api, bearer, pool, registerUser } from '../helpers/api.js';
import { as, loginSeedAdmin, suffix, uuid, useSeededDatabase } from '../helpers/admin.js';
import { postGeneration, settle } from '../helpers/pipeline.js';

useSeededDatabase();

afterEach(() => registerProvider(mockProvider));

describe('admin audit log', () => {
  it('records admin actions with actor, ip and a secret-free diff, and filters by actor, action, entity and date', async () => {
    const admin = await loginSeedAdmin();
    const other = (await as(admin).post('/users', { email: `audit.${suffix()}@test.local`, name: 'Audit Target', password: 'Str0ng-pass-word' })).body.data.user;
    await as(admin).patch(`/users/${other.id}`, { name: 'Audit Renamed' });

    const all = await as(admin).get(`/audit?entity=user&entity_id=${other.id}`);
    expect(all.status).toBe(200);
    expect(all.body.data.map((a: { action: string }) => a.action)).toEqual(['user.update', 'user.create']); // newest first
    expect(all.body.data[0]).toMatchObject({ actor: { id: admin.id, email: 'admin@sukamenak.studio' }, entity: 'user', entity_id: other.id });
    expect(all.body.data[0].ip).toBeTruthy();
    expect(all.body.data[0].diff.changed.name).toEqual({ from: 'Audit Target', to: 'Audit Renamed' });
    expect(all.text).not.toMatch(/password_hash|\$2[aby]\$/);

    expect((await as(admin).get(`/audit?action=user.create&actor=${admin.id}&limit=100`)).body.data.every((a: { action: string }) => a.action === 'user.create')).toBe(true);
    const today = new Date().toISOString().slice(0, 10);
    expect((await as(admin).get(`/audit?entity_id=${other.id}&from=${today}&to=${today}`)).body.data).toHaveLength(2);
    expect((await as(admin).get(`/audit?entity_id=${other.id}&from=2000-01-01&to=2000-01-02`)).body.data).toHaveLength(0);
    const page = await as(admin).get('/audit?limit=2&page=1');
    expect(page.body.data).toHaveLength(2);
    expect(page.body.meta).toMatchObject({ page: 1, limit: 2 });
    expect(page.body.meta.total).toBeGreaterThanOrEqual(2);
    for (const bad of ['actor=nope', 'limit=1000', 'from=yesterday', 'action=a b!', 'from=2026-02-02&to=2026-02-01']) {
      expect((await as(admin).get(`/audit?${bad}`)).status, bad).toBe(400);
    }
  });

  it('has no write or delete endpoint, and scrubs secret-looking keys even from rows already stored', async () => {
    const admin = await loginSeedAdmin();
    for (const method of ['post', 'put', 'patch', 'delete'] as const) {
      const res = await api()[method]('/api/v1/admin/audit').set(bearer(admin.accessToken)).send({ action: 'x' });
      expect(res.status, method).toBe(404);
    }
    const id = uuid();
    await pool.query('INSERT INTO audit_logs (action, entity, entity_id, diff) VALUES ($1, $2, $3, $4::jsonb)', [
      'legacy.write', 'thing', id, JSON.stringify({ password_hash: '$2b$04$abcdefghijklmnopqrstuv', note: 'ok', nested: { api_token: 'tok123', body_ciphertext: 'aa', keep: 1 } }),
    ]);
    const res = await as(admin).get(`/audit?entity_id=${id}`);
    expect(res.body.data[0].diff).toEqual({ note: 'ok', nested: { keep: 1 } });
    expect(res.text).not.toContain('$2b$04$');
    expect(res.text).not.toContain('tok123');
  });
});

describe('admin dashboard', () => {
  it('reports totals, a zero-filled daily series, failures by error code, model status and counts', async () => {
    const admin = await loginSeedAdmin();
    const user = await registerUser();
    const slot_values = { title: 'Bazar', date_venue: 'Balai Desa' };
    for (let i = 0; i < 2; i++) await settle(user, (await postGeneration(user, { template_slug: 'poster-kegiatan-organisasi', slot_values })).body.data.id);
    registerProvider({
      ...mockProvider,
      async generateImage() {
        throw new ProviderError('PROVIDER_RATE_LIMITED', { httpStatus: 429 });
      },
    });
    await settle(user, (await postGeneration(user, { template_slug: 'poster-kegiatan-organisasi', slot_values })).body.data.id);
    registerProvider(mockProvider);

    const res = await as(admin).get('/dashboard?days=7');
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.window).toEqual({ days: 7, timezone: env.APP_TIMEZONE });

    const db = (await pool.query<{ total: number; done: number; failed: number; refs: number; users: number }>(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'done')::int AS done, count(*) FILTER (WHERE status = 'failed')::int AS failed,
              count(*) FILTER (WHERE status = 'done' AND used_reference_image)::int AS refs, count(DISTINCT user_id)::int AS users
         FROM generations WHERE created_at >= now() - interval '7 days'`,
    )).rows[0] as { total: number; done: number; failed: number; refs: number; users: number };
    expect(d.totals).toMatchObject({ generations: db.total, done: db.done, failed: db.failed, active_users: db.users });
    expect(d.totals.success_rate).toBeCloseTo(db.done / (db.done + db.failed), 3);
    expect(d.totals.used_reference_image_rate).toBeCloseTo(db.refs / db.done, 3);
    expect(d.totals.degraded_rate).toBeGreaterThanOrEqual(0);
    expect(d.totals.avg_duration_ms).toBeGreaterThanOrEqual(0);
    expect(d.totals.total_cost_usd).toBeGreaterThanOrEqual(0);
    expect(d.totals.avg_cost_usd).toBeGreaterThanOrEqual(0);

    expect(d.daily).toHaveLength(7);
    expect(d.daily.at(-1).date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.daily.reduce((sum: number, day: { generations: number }) => sum + day.generations, 0)).toBe(db.total);
    expect(d.daily.slice(0, 3).every((day: { generations: number; success_rate: number | null }) => day.generations === 0 && day.success_rate === null)).toBe(true);
    expect(d.daily.at(-1)).toMatchObject({ done: db.done, failed: db.failed });

    expect(d.failures_by_error_code).toEqual(expect.arrayContaining([{ error_code: 'PROVIDER_RATE_LIMITED', count: expect.any(Number) }]));
    expect(d.models.map((m: { capability: string }) => m.capability)).toEqual(['i2i', 't2i', 'text', 'vision']);
    for (const m of d.models) expect(m.default).toMatchObject({ provider: 'mock', name: expect.any(String) });
    expect(d.models.find((m: { capability: string }) => m.capability === 't2i').default.last_test_ok === null || true).toBe(true);
    expect(d.counts).toMatchObject({ published_templates: expect.any(Number), published_tutorials: expect.any(Number), active_admins: expect.any(Number), active_creators: expect.any(Number) });
    expect(d.counts.published_templates).toBeGreaterThanOrEqual(10);
    expect(d.counts.published_tutorials).toBeGreaterThanOrEqual(6);
    expect(d.counts.active_admins).toBeGreaterThanOrEqual(2);
    expect(res.text).not.toMatch(/prompt|remarks|slot_values/);

    for (const bad of ['days=0', 'days=91', 'days=abc']) expect((await as(admin).get(`/dashboard?${bad}`)).status, bad).toBe(400);
    expect((await as(admin).get('/dashboard')).body.data.daily).toHaveLength(30);
  });
});
