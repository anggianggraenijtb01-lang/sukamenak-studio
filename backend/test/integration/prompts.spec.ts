import { afterEach, describe, expect, it } from 'vitest';
import { registerProvider } from '../../src/providers/registry.js';
import { mockProvider } from '../../src/providers/mock.js';
import { api, bearer, pool, registerUser, useDatabase } from '../helpers/api.js';

useDatabase();

const COMPACT =
  'Keripik tempe renyah dalam kemasan standing pouch, latar meja kayu, cahaya jendela lembut, warna oranye hangat, gaya minimalis bersih, sudut 45 derajat.';
const RAMBLING = 'tolong buatkan gambar yang sangat sangat bagus dan keren banget gitu, pokoknya bagus, bagus, keren';

describe('POST /prompts/analyze', () => {
  it('requires authentication and a body', async () => {
    expect((await api().post('/api/v1/prompts/analyze').send({ text: COMPACT })).status).toBe(401);
    const user = await registerUser();
    expect((await api().post('/api/v1/prompts/analyze').set(bearer(user.accessToken)).send({})).status).toBe(400);
    expect((await api().post('/api/v1/prompts/analyze').set(bearer(user.accessToken)).send({ text: 'x'.repeat(4001) })).status).toBe(400);
  });

  it('returns a deterministic compactness score with a breakdown', async () => {
    const user = await registerUser();
    const call = (text: string) => api().post('/api/v1/prompts/analyze').set(bearer(user.accessToken)).send({ text });
    const a = await call(COMPACT);
    const b = await call(COMPACT);
    expect(a.status).toBe(200);
    expect(a.body.data).toEqual(b.body.data);
    expect(a.body.data.score).toBeGreaterThanOrEqual(70);
    expect(a.body.data.breakdown).toEqual({
      length: expect.any(Number),
      conciseness: expect.any(Number),
      uniqueness: expect.any(Number),
      coverage: expect.any(Number),
    });
    const bad = await call(RAMBLING);
    expect(bad.body.data.score).toBeLessThan(a.body.data.score);
    expect(bad.body.data.filler_words.length).toBeGreaterThan(0);
  });
});

describe('POST /prompts/improve', () => {
  afterEach(() => registerProvider(mockProvider));

  it('uses the active text model (mock) and stores the improvement', async () => {
    const user = await registerUser();
    const res = await api().post('/api/v1/prompts/improve').set(bearer(user.accessToken)).send({ text: RAMBLING });
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('heuristic');
    expect(res.body.data.improved_text).not.toMatch(/\b(sangat|banget|keren|gitu|pokoknya)\b/i);
    expect(res.body.data.score_after).toBeGreaterThanOrEqual(res.body.data.score_before);
    const { rows } = await pool.query(
      `SELECT pi.input_text, pi.output_text, m.provider FROM prompt_improvements pi
         LEFT JOIN model_configs m ON m.id = pi.model_config_id WHERE pi.user_id = $1`,
      [user.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ input_text: RAMBLING, provider: 'mock' });
  });

  it('uses a registered model adapter when it produces output', async () => {
    registerProvider({
      name: 'mock',
      async improveText(_config, { text }) {
        return { text: `MODEL:${text.length}`, source: 'model', costUsd: 0.001 };
      },
    });
    const user = await registerUser();
    const res = await api().post('/api/v1/prompts/improve').set(bearer(user.accessToken)).send({ text: COMPACT });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ source: 'model', improved_text: `MODEL:${COMPACT.length}` });
  });

  it('falls back to the deterministic heuristic when the model fails or returns blocked content', async () => {
    const user = await registerUser();
    registerProvider({
      name: 'mock',
      async improveText() {
        throw new Error('provider down');
      },
    });
    const failed = await api().post('/api/v1/prompts/improve').set(bearer(user.accessToken)).send({ text: RAMBLING });
    expect(failed.status).toBe(200);
    expect(failed.body.data.source).toBe('heuristic');
    expect(JSON.stringify(failed.body)).not.toContain('provider down');

    registerProvider({
      name: 'mock',
      async improveText() {
        return { text: 'iklan judi online murah', source: 'model', costUsd: 0 };
      },
    });
    const blocked = await api().post('/api/v1/prompts/improve').set(bearer(user.accessToken)).send({ text: RAMBLING });
    expect(blocked.body.data.source).toBe('heuristic');
    expect(blocked.body.data.improved_text).not.toMatch(/judi/i);
  });

  it('falls back to the heuristic when no text model is active', async () => {
    const user = await registerUser();
    await pool.query("UPDATE model_configs SET is_default = false, is_active = false WHERE capability = 'text' AND provider = 'mock'");
    try {
      const res = await api().post('/api/v1/prompts/improve').set(bearer(user.accessToken)).send({ text: RAMBLING });
      expect(res.status).toBe(200);
      expect(res.body.data.source).toBe('heuristic');
      const { rows } = await pool.query('SELECT model_config_id FROM prompt_improvements WHERE user_id = $1', [user.id]);
      expect(rows[0].model_config_id).toBeNull();
    } finally {
      await pool.query("UPDATE model_configs SET is_active = true, is_default = true WHERE capability = 'text' AND provider = 'mock'");
    }
  });

  it('rejects input that violates the content policy, without echoing the term', async () => {
    const user = await registerUser();
    const res = await api().post('/api/v1/prompts/improve').set(bearer(user.accessToken)).send({ text: 'promosi judi online besar-besaran' });
    expect(res.status).toBe(422);
    expect(res.body.error_code).toBe('CONTENT_POLICY_VIOLATION');
    expect(JSON.stringify(res.body)).not.toMatch(/judi/i);
  });
});

describe('/prompts CRUD', () => {
  it('requires authentication', async () => {
    expect((await api().get('/api/v1/prompts')).status).toBe(401);
    expect((await api().post('/api/v1/prompts').send({ title: 'x', body: 'y' })).status).toBe(401);
  });

  it('creates, lists, reads, updates and deletes the owner\'s prompts', async () => {
    const user = await registerUser();
    const create = await api().post('/api/v1/prompts').set(bearer(user.accessToken)).send({ title: 'Resep promo', body: 'keripik renyah, latar kayu' });
    expect(create.status).toBe(201);
    const id = create.body.data.id;
    expect(create.body.data).toMatchObject({ title: 'Resep promo', body: 'keripik renyah, latar kayu', source: 'manual' });
    expect(create.body.data).not.toHaveProperty('user_id');

    const list = await api().get('/api/v1/prompts').set(bearer(user.accessToken));
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta).toMatchObject({ page: 1, total: 1 });

    expect((await api().get(`/api/v1/prompts/${id}`).set(bearer(user.accessToken))).body.data.id).toBe(id);

    const patch = await api().patch(`/api/v1/prompts/${id}`).set(bearer(user.accessToken)).send({ title: 'Judul baru' });
    expect(patch.status).toBe(200);
    expect(patch.body.data).toMatchObject({ title: 'Judul baru', body: 'keripik renyah, latar kayu' });

    expect((await api().delete(`/api/v1/prompts/${id}`).set(bearer(user.accessToken))).status).toBe(200);
    expect((await api().get(`/api/v1/prompts/${id}`).set(bearer(user.accessToken))).status).toBe(404);
  });

  it('isolates users: someone else\'s prompt is a 404 for read, update and delete', async () => {
    const owner = await registerUser();
    const intruder = await registerUser();
    const { body } = await api().post('/api/v1/prompts').set(bearer(owner.accessToken)).send({ title: 'Milik A', body: 'rahasia A' });
    const id = body.data.id;
    expect((await api().get(`/api/v1/prompts/${id}`).set(bearer(intruder.accessToken))).status).toBe(404);
    expect((await api().patch(`/api/v1/prompts/${id}`).set(bearer(intruder.accessToken)).send({ title: 'x' })).status).toBe(404);
    expect((await api().delete(`/api/v1/prompts/${id}`).set(bearer(intruder.accessToken))).status).toBe(404);
    expect((await api().get('/api/v1/prompts').set(bearer(intruder.accessToken))).body.data).toEqual([]);
    expect((await api().get(`/api/v1/prompts/${id}`).set(bearer(owner.accessToken))).status).toBe(200);
  });

  it('validates input, ids and policy', async () => {
    const user = await registerUser();
    const auth = bearer(user.accessToken);
    const missing = await api().post('/api/v1/prompts').set(auth).send({ title: '', body: '' });
    expect(missing.status).toBe(400);
    expect(missing.body.error_code).toBe('VALIDATION_ERROR');
    expect((await api().get('/api/v1/prompts/not-a-uuid').set(auth)).status).toBe(400);
    expect((await api().patch('/api/v1/prompts/5b2c9f64-7a0e-4f55-9d33-7d1c0b6a8e11').set(auth).send({})).status).toBe(400);
    const blocked = await api().post('/api/v1/prompts').set(auth).send({ title: 'Iklan', body: 'jual narkoba murah' });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error_code).toBe('CONTENT_POLICY_VIOLATION');
  });
});
