import { afterEach, describe, expect, it } from 'vitest';
import { createFalProvider } from '../../src/providers/fal.js';
import { ProviderError } from '../../src/providers/errors.js';
import { registerProvider } from '../../src/providers/registry.js';
import { collectKeys, pool, registerUser } from '../helpers/api.js';
import { as, auditFor, expectNoSecretsInAudit, loginSeedAdmin, suffix, uuid, useSeededDatabase } from '../helpers/admin.js';
import { eventsOf, postGeneration, settle } from '../helpers/pipeline.js';

useSeededDatabase();

const mockModel = (capability: string, extra: Record<string, unknown> = {}) => ({
  name: `Test ${capability} ${suffix()}`,
  provider: 'mock',
  capability,
  model_id: `mock-${capability}-test`,
  ...extra,
});

async function defaultOf(capability: string): Promise<{ id: string; name: string }> {
  const { rows } = await pool.query<{ id: string; name: string }>(
    'SELECT id, name FROM model_configs WHERE capability = $1 AND is_default AND deleted_at IS NULL',
    [capability],
  );
  expect(rows).toHaveLength(1);
  return rows[0] as { id: string; name: string };
}

afterEach(() => {
  registerProvider(createFalProvider());
  delete process.env.PROVIDER_KEY_TEST_ADMIN_FAL;
});

describe('admin models', () => {
  it('lists models with the key NAME and a configured flag, never a key value', async () => {
    const admin = await loginSeedAdmin();
    process.env.PROVIDER_KEY_TEST_ADMIN = 'super-secret-value-123';
    try {
      const created = await as(admin).post('/models', {
        name: `Keyed ${suffix()}`,
        provider: 'fal',
        capability: 't2i',
        model_id: 'fal-ai/test',
        api_key_env: 'PROVIDER_KEY_TEST_ADMIN',
      });
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({ api_key_env: 'PROVIDER_KEY_TEST_ADMIN', api_key_configured: true, requires_api_key: true, is_active: false, usable: false });

      const list = await as(admin).get('/models?limit=100');
      expect(list.status).toBe(200);
      expect(list.body.meta).toMatchObject({ page: 1, limit: 100 });
      expect(JSON.stringify(list.body)).not.toContain('super-secret-value-123');
      const keys = collectKeys(list.body);
      expect(keys.has('api_key')).toBe(false);
      const seededCandidate = (list.body.data as { name: string; api_key_configured: boolean }[]).find((m) => m.name === 'Gemini Flash (text)');
      expect(seededCandidate?.api_key_configured).toBe(false);
      const mock = (list.body.data as { provider: string; requires_api_key: boolean; api_key_configured: boolean }[]).find((m) => m.provider === 'mock');
      expect(mock).toMatchObject({ requires_api_key: false, api_key_configured: true });

      expect((await as(admin).get('/models?capability=vision&active=true')).body.data.every((m: { capability: string }) => m.capability === 'vision')).toBe(true);
      expect(created.body.data.cost_per_call_usd).toBe(0);
    } finally {
      delete process.env.PROVIDER_KEY_TEST_ADMIN;
    }
  });

  it('validates create and update input, mirroring the api_key_env CHECK constraint', async () => {
    const admin = await loginSeedAdmin();
    const base = { name: `Bad ${suffix()}`, provider: 'fal', capability: 't2i', model_id: 'x/y' };
    for (const [why, body] of Object.entries({
      'key value instead of a variable name': { ...base, api_key_env: 'sk-live-abc123' },
      'lowercase variable name': { ...base, api_key_env: 'gemini_api_key' },
      'real provider without key variable': { ...base },
      'mock with a key variable': { ...base, provider: 'mock', api_key_env: 'GEMINI_API_KEY' },
      'openai_compat without base_url': { ...base, provider: 'openai_compat', api_key_env: 'OPENAI_API_KEY' },
      'base_url with credentials': { ...base, provider: 'openai_compat', api_key_env: 'OPENAI_API_KEY', base_url: 'https://user:pw@example.com/v1' },
      'base_url with a query string': { ...base, provider: 'openai_compat', api_key_env: 'OPENAI_API_KEY', base_url: 'https://example.com/v1?key=abc' },
      'base_url not http': { ...base, provider: 'openai_compat', api_key_env: 'OPENAI_API_KEY', base_url: 'ftp://example.com' },
      // An admin must not be able to make the platform send an internal secret to a server they control.
      'internal secret as key variable (core prompt key)': { ...base, api_key_env: 'CORE_PROMPT_KEY' },
      'internal secret as key variable (jwt secret)': { ...base, api_key_env: 'JWT_ACCESS_SECRET' },
      'internal secret as key variable (database url)': { ...base, api_key_env: 'DATABASE_URL' },
      'base_url at cloud metadata': { ...base, provider: 'openai_compat', api_key_env: 'OPENAI_API_KEY', base_url: 'http://169.254.169.254/latest' },
      'base_url at localhost': { ...base, provider: 'openai_compat', api_key_env: 'OPENAI_API_KEY', base_url: 'http://localhost:6379' },
      'base_url at a private address': { ...base, provider: 'openai_compat', api_key_env: 'OPENAI_API_KEY', base_url: 'https://10.0.0.5/v1' },
      'unknown capability': { ...base, capability: 'audio', api_key_env: 'FAL_KEY' },
      'negative cost': { ...base, api_key_env: 'FAL_KEY', cost_per_call_usd: -1 },
      'unknown field': { ...base, api_key_env: 'FAL_KEY', api_key: 'sk-123' },
    })) {
      const res = await as(admin).post('/models', body);
      expect(res.status, why).toBe(400);
      expect(res.body.error_code, why).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(res.body), why).not.toContain('sk-live-abc123');
    }
    const model = (await as(admin).post('/models', mockModel('text'))).body.data;
    expect((await as(admin).patch(`/models/${model.id}`, { api_key_env: 'not valid!' })).status).toBe(400);
    expect((await as(admin).patch(`/models/${model.id}`, { provider: 'fal' })).status).toBe(400); // immutable
    expect((await as(admin).patch(`/models/${model.id}`, { api_key_env: 'FAL_KEY' })).status).toBe(400); // mock takes no key
    expect((await as(admin).patch(`/models/${model.id}`, {})).status).toBe(400);
    const dup = await as(admin).post('/models', { ...mockModel('text'), name: model.name });
    expect(dup.status).toBe(400);
    expect(dup.body.errors[0].field).toBe('name');
    expect((await as(admin).get(`/models/${uuid()}`)).status).toBe(404);
  });

  it('updates, deletes and audits without secrets; refuses to delete a default', async () => {
    const admin = await loginSeedAdmin();
    const model = (await as(admin).post('/models', mockModel('text'))).body.data;
    const patched = await as(admin).patch(`/models/${model.id}`, { priority: 7, notes: 'checked', timeout_ms: 30000 });
    expect(patched.status).toBe(200);
    expect(patched.body.data).toMatchObject({ priority: 7, notes: 'checked', timeout_ms: 30000 });
    const audit = await auditFor(model.id);
    expect(audit.map((a) => a.action)).toEqual(['model.create', 'model.update']);
    expect(audit[1]?.diff).toMatchObject({ changed: { priority: { from: 100, to: 7 } } });
    expectNoSecretsInAudit(audit);

    const textDefault = await defaultOf('text');
    const refuse = await as(admin).del(`/models/${textDefault.id}`);
    expect(refuse.status).toBe(409);
    expect(refuse.body.error_code).toBe('NO_MODEL_AVAILABLE');

    expect((await as(admin).del(`/models/${model.id}`)).status).toBe(200);
    expect((await as(admin).get(`/models/${model.id}`)).status).toBe(404);
  });

  it('set-default needs an active target and leaves exactly one default per capability', async () => {
    const admin = await loginSeedAdmin();
    const original = await defaultOf('i2i');
    const inactive = (await as(admin).post('/models', mockModel('i2i'))).body.data;
    const refused = await as(admin).post(`/models/${inactive.id}/set-default`);
    expect(refused.status).toBe(400);
    expect(refused.body.error_code).toBe('VALIDATION_ERROR');
    expect((await defaultOf('i2i')).id).toBe(original.id);

    expect((await as(admin).post(`/models/${inactive.id}/activate`)).body.data.is_active).toBe(true);
    const ok = await as(admin).post(`/models/${inactive.id}/set-default`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.is_default).toBe(true);
    expect((await defaultOf('i2i')).id).toBe(inactive.id);
    const { rows } = await pool.query('SELECT 1 FROM model_configs WHERE capability = $1 AND is_default AND deleted_at IS NULL', ['i2i']);
    expect(rows).toHaveLength(1);

    const audit = await auditFor(inactive.id, 'model.set_default');
    expect(audit[0]?.diff).toMatchObject({ capability: 'i2i', previous_default_id: original.id });
    await as(admin).post(`/models/${original.id}/set-default`);
    expect((await defaultOf('i2i')).id).toBe(original.id);
    expect((await as(admin).post(`/models/${uuid()}/set-default`)).status).toBe(404);
  });

  it('set-default is atomic under concurrency: always exactly one default, every call succeeds', async () => {
    const admin = await loginSeedAdmin();
    const original = await defaultOf('t2i');
    const extras: string[] = [];
    for (let i = 0; i < 3; i++) {
      const m = (await as(admin).post('/models', mockModel('t2i', { is_active: true }))).body.data;
      extras.push(m.id);
    }
    const targets = [original.id, ...extras];
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => as(admin).post(`/models/${targets[i % targets.length]}/set-default`)));
    expect(results.map((r) => r.status)).toEqual(Array(12).fill(200));
    const { rows } = await pool.query<{ id: string }>('SELECT id FROM model_configs WHERE capability = $1 AND is_default AND deleted_at IS NULL', ['t2i']);
    expect(rows).toHaveLength(1);
    expect(targets).toContain(rows[0]?.id);
    await as(admin).post(`/models/${original.id}/set-default`);
    expect((await defaultOf('t2i')).id).toBe(original.id);
  });

  it('deactivating a default needs a chosen replacement, and never the only active model (NO_MODEL_AVAILABLE)', async () => {
    const admin = await loginSeedAdmin();
    const original = await defaultOf('vision');
    // Seeded: the mock vision model is the only active vision model.
    const only = await as(admin).post(`/models/${original.id}/deactivate`);
    expect(only.status).toBe(409);
    expect(only.body.error_code).toBe('NO_MODEL_AVAILABLE');
    expect((await defaultOf('vision')).id).toBe(original.id);

    const second = (await as(admin).post('/models', mockModel('vision', { is_active: true }))).body.data;
    const missing = await as(admin).post(`/models/${original.id}/deactivate`);
    expect(missing.status).toBe(400);
    expect(missing.body.errors[0].field).toBe('new_default_id');
    const wrong = await as(admin).post(`/models/${original.id}/deactivate`, { new_default_id: uuid() });
    expect(wrong.status).toBe(400);

    const done = await as(admin).post(`/models/${original.id}/deactivate`, { new_default_id: second.id });
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ is_active: false, is_default: false });
    expect((await defaultOf('vision')).id).toBe(second.id);

    // A non-default model deactivates freely; restore the original afterwards.
    expect((await as(admin).post(`/models/${original.id}/activate`)).body.data.is_active).toBe(true);
    expect((await as(admin).post(`/models/${original.id}/set-default`)).status).toBe(200);
    expect((await as(admin).post(`/models/${second.id}/deactivate`)).status).toBe(200);
    expect((await defaultOf('vision')).id).toBe(original.id);
  });

  it('refuses to activate a real provider whose key variable is not set', async () => {
    const admin = await loginSeedAdmin();
    const seeded = (await pool.query<{ id: string }>("SELECT id FROM model_configs WHERE name = 'Gemini Flash (text)'")).rows[0] as { id: string };
    const res = await as(admin).post(`/models/${seeded.id}/activate`);
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('api_key_env');
  });

  it('test passes for the mock provider and records last_test_at / last_test_ok', async () => {
    const admin = await loginSeedAdmin();
    for (const capability of ['text', 'vision', 't2i', 'i2i']) {
      const model = (await as(admin).post('/models', mockModel(capability))).body.data;
      const res = await as(admin).post(`/models/${model.id}/test`);
      expect(res.status, capability).toBe(200);
      expect(res.body.data).toMatchObject({ ok: true, error: null, error_code: null });
      expect(res.body.data.latency_ms).toBeGreaterThanOrEqual(0);
      expect(res.body.data.model.last_test_ok).toBe(true);
      expect(res.body.data.model.last_test_at).toBeTruthy();
    }
    const audit = await auditFor(null, 'model.test');
    expect(audit.length).toBeGreaterThanOrEqual(4);
    expectNoSecretsInAudit(audit);
    expect((await as(admin).post(`/models/${uuid()}/test`)).status).toBe(404);
  });

  it('test reports a missing key variable without calling out, and sanitises provider failures', async () => {
    const admin = await loginSeedAdmin();
    const seeded = (await pool.query<{ id: string }>("SELECT id FROM model_configs WHERE name = 'Gemini Flash (text)'")).rows[0] as { id: string };
    const noKey = await as(admin).post(`/models/${seeded.id}/test`);
    expect(noKey.status).toBe(200);
    expect(noKey.body.data).toMatchObject({ ok: false, error_code: 'PROVIDER_AUTH' });
    expect(noKey.body.data.model.last_test_ok).toBe(false);

    process.env.PROVIDER_KEY_TEST_ADMIN_FAL = 'sk-test-secret-key-987';
    const model = (await as(admin).post('/models', { name: `Fal ${suffix()}`, provider: 'fal', capability: 't2i', model_id: 'fal-ai/x', api_key_env: 'PROVIDER_KEY_TEST_ADMIN_FAL', is_active: true })).body.data;
    expect(model.api_key_configured).toBe(true);

    registerProvider({
      ...createFalProvider(),
      async generateImage() {
        throw new Error('boom: leaked sk-test-secret-key-987 and prompt text https://api.example/v1?key=sk-test-secret-key-987');
      },
    });
    const crashed = await as(admin).post(`/models/${model.id}/test`);
    expect(crashed.body.data).toMatchObject({ ok: false, error_code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(crashed.body)).not.toContain('sk-test-secret-key-987');

    registerProvider({
      ...createFalProvider(),
      async generateImage() {
        throw new ProviderError('PROVIDER_RATE_LIMITED', { httpStatus: 429 });
      },
    });
    const limited = await as(admin).post(`/models/${model.id}/test`);
    expect(limited.body.data).toMatchObject({ ok: false, error_code: 'PROVIDER_RATE_LIMITED', error: 'Model provider rate limit reached (HTTP 429)' });
    expect(JSON.stringify(await auditFor(model.id))).not.toContain('sk-test-secret-key-987');
  });

  it('changing the default takes effect for the very next generation, without a restart', async () => {
    const admin = await loginSeedAdmin();
    const user = await registerUser();
    const original = await defaultOf('i2i');
    const alt = (await as(admin).post('/models', mockModel('t2i', { is_active: true }))).body.data;
    const originalT2i = await defaultOf('t2i');
    expect((await as(admin).post(`/models/${alt.id}/set-default`)).status).toBe(200);
    try {
      const created = await postGeneration(user, { template_slug: 'poster-kegiatan-organisasi', mode: 't2i', slot_values: { title: 'Bazar', date_venue: 'Balai Desa' } });
      expect(created.status).toBe(202);
      const state = await settle(user, created.body.data.id);
      expect(state.status).toBe('done');
      const row = await pool.query<{ model_image_id: string }>('SELECT model_image_id FROM generations WHERE id = $1', [created.body.data.id]);
      expect(row.rows[0]?.model_image_id).toBe(alt.id);
      expect((await eventsOf(created.body.data.id)).find((e) => e.stage === 'generate')?.model_config_id).toBe(alt.id);

      // Back to the original: the next generation uses it again.
      expect((await as(admin).post(`/models/${originalT2i.id}/set-default`)).status).toBe(200);
      const again = await postGeneration(user, { template_slug: 'poster-kegiatan-organisasi', mode: 't2i', slot_values: { title: 'Bazar', date_venue: 'Balai Desa' } });
      await settle(user, again.body.data.id);
      const row2 = await pool.query<{ model_image_id: string }>('SELECT model_image_id FROM generations WHERE id = $1', [again.body.data.id]);
      expect(row2.rows[0]?.model_image_id).toBe(originalT2i.id);
    } finally {
      await as(admin).post(`/models/${originalT2i.id}/set-default`);
    }
    expect((await defaultOf('i2i')).id).toBe(original.id);
  });
});
