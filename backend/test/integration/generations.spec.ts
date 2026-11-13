import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { finalPromptAad, decryptWithCoreKey } from '../../src/lib/coreCipher.js';
import { invalidateSettingsCache } from '../../src/modules/shared/settings.js';
import { TransientJobError } from '../../src/pipeline/errors.js';
import { runGeneration } from '../../src/pipeline/runGeneration.js';
import { ProviderError } from '../../src/providers/errors.js';
import { mockProvider } from '../../src/providers/mock.js';
import { registerProvider } from '../../src/providers/registry.js';
import type { GenerateImageInput } from '../../src/providers/types.js';
import { setQueue } from '../../src/queue/index.js';
import { api, bearer, collectKeys, pool, registerUser, useDatabase, type TestSession } from '../helpers/api.js';
import {
  PNG_SIGNATURE,
  createReferenceId,
  download,
  eventsOf,
  installHoldingQueue,
  postGeneration,
  settle,
  solidImage,
  successCountToday,
  uploadReference,
} from '../helpers/pipeline.js';

useDatabase();

const POSTER = 'poster-promo-produk'; // i2i only: title (required), subtitle, cta overlays
const EVENT = 'poster-kegiatan-organisasi'; // both modes: title + date_venue required
const HUMAN = 'model-manusia-studio';

const posterBody = (refs: string[], over: Record<string, unknown> = {}) => ({
  template_slug: POSTER,
  reference_ids: refs,
  slot_values: { title: 'Promo Keripik Tempe Renyah', cta: 'Pesan via WhatsApp', product: 'keripik tempe pouch' },
  remarks: 'suasana hangat di meja kayu',
  ...over,
});

const eventBody = (over: Record<string, unknown> = {}) => ({
  template_slug: EVENT,
  slot_values: { title: 'Bazar Desa Sukamenak', date_venue: 'Sabtu 20 Des, Balai Desa' },
  ...over,
});

async function userWithLimit(limit: number | null = null): Promise<TestSession> {
  const user = await registerUser();
  if (limit !== null) await pool.query('UPDATE users SET daily_limit_override = $2 WHERE id = $1', [user.id, limit]);
  return user;
}

/** Wraps the mock provider so a test can see what the pipeline sent to it and what it produced. */
function spyOnMock() {
  const state = { analyzeCalls: [] as { role: string }[], generateInputs: [] as GenerateImageInput[], bases: [] as Buffer[] };
  registerProvider({
    ...mockProvider,
    async analyzeReference(config, input, opts) {
      state.analyzeCalls.push({ role: input.role });
      return mockProvider.analyzeReference!(config, input, opts);
    },
    async generateImage(config, input, opts) {
      state.generateInputs.push(input);
      const result = await mockProvider.generateImage!(config, input, opts);
      state.bases.push(result.image);
      return result;
    },
  });
  return state;
}

async function decryptedPrompt(generationId: string): Promise<string> {
  const row = (await pool.query<{ c: Buffer; i: Buffer; t: Buffer }>(
    'SELECT final_prompt_ciphertext AS c, final_prompt_iv AS i, final_prompt_auth_tag AS t FROM generations WHERE id = $1',
    [generationId],
  )).rows[0];
  expect(row?.c).toBeTruthy();
  return decryptWithCoreKey({ ciphertext: row!.c, iv: row!.i, authTag: row!.t }, finalPromptAad(generationId));
}

async function zonesOf(slug: string) {
  const res = await api().get(`/api/v1/templates/${slug}`);
  return res.body.data.text_zones as { slot_key: string; x: number; y: number; w: number; h: number }[];
}

async function rawPixels(buf: Buffer) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

beforeEach(() => {
  registerProvider(mockProvider);
  setQueue(undefined);
  invalidateSettingsCache();
});

afterEach(async () => {
  registerProvider(mockProvider);
  setQueue(undefined);
  await pool.query("UPDATE app_settings SET value = '10'::jsonb WHERE key = 'default_daily_limit'");
  await pool.query("UPDATE app_settings SET value = 'false'::jsonb WHERE key = 'watermark_enabled'");
  await pool.query("UPDATE model_configs SET is_active = true, is_default = true WHERE provider = 'mock' AND priority = 100");
  await pool.query("DELETE FROM model_configs WHERE name LIKE 'Test backup%'");
  invalidateSettingsCache();
});

describe('POST /generations: happy paths', () => {
  it('i2i with 2 references: 202 immediately, then a PNG with text pasted into the zones', async () => {
    const spy = spyOnMock();
    const user = await userWithLimit();
    const red = await createReferenceId(user, 'product', '#e01010');
    const blue = await createReferenceId(user, 'color', '#1010e0');

    const created = await postGeneration(user, posterBody([red, blue]));
    expect(created.status).toBe(202);
    expect(created.body.data).toEqual({ id: expect.any(String), status: 'queued' });
    const id = created.body.data.id as string;

    const g = await settle(user, id);
    expect(g).toMatchObject({
      id,
      status: 'done',
      progress_step: 'done',
      mode: 'i2i',
      used_reference_image: true,
      reference_count_used: 2,
      composited_text: true,
      degraded: false,
      error_code: null,
      template: { slug: POSTER },
      archived: false,
    });
    expect(g.references).toEqual([{ id: red, role: 'product' }, { id: blue, role: 'color' }]);

    // Both references went to the image model as images, and each got its own vision call.
    expect(spy.generateInputs).toHaveLength(1);
    expect(spy.generateInputs[0]!.references).toHaveLength(2);
    expect(spy.generateInputs[0]!.mode).toBe('i2i');
    expect(spy.analyzeCalls.map((c) => c.role)).toEqual(['product', 'color']);

    // Result and thumbnail are real files behind signed URLs.
    const result = await download(g.result_url);
    expect(result.status).toBe(200);
    expect(result.body.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    const meta = await sharp(result.body).metadata();
    expect([meta.width, meta.height]).toEqual([816, 1024]);
    expect(meta.exif).toBeUndefined();
    expect([g.width, g.height]).toEqual([816, 1024]);
    const thumb = await download(g.thumbnail_url);
    expect(thumb.status).toBe(200);
    expect((await sharp(thumb.body).metadata()).format).toBe('webp');

    // Text rendering: pixels differ from the base INSIDE the title/cta zones and nowhere else.
    const zones = await zonesOf(POSTER);
    const out = await rawPixels(result.body);
    const base = await rawPixels(spy.bases[0]!);
    expect([out.width, out.height]).toEqual([base.width, base.height]);
    const inZone = (x: number, y: number, key: string) => {
      const z = zones.find((s) => s.slot_key === key)!;
      return x >= Math.floor(z.x * out.width) && x < Math.ceil((z.x + z.w) * out.width) && y >= Math.floor(z.y * out.height) && y < Math.ceil((z.y + z.h) * out.height);
    };
    const changed: Record<string, number> = { title: 0, cta: 0, subtitle: 0, elsewhere: 0 };
    for (let y = 0; y < out.height; y++) {
      for (let x = 0; x < out.width; x++) {
        const i = (y * out.width + x) * 3;
        if (out.data[i] === base.data[i] && out.data[i + 1] === base.data[i + 1] && out.data[i + 2] === base.data[i + 2]) continue;
        const key = ['title', 'cta', 'subtitle'].find((k) => inZone(x, y, k));
        changed[key ?? 'elsewhere'] = (changed[key ?? 'elsewhere'] ?? 0) + 1;
      }
    }
    expect(changed.title).toBeGreaterThan(1500);
    expect(changed.cta).toBeGreaterThan(300);
    expect(changed.subtitle).toBe(0); // no value was supplied for it
    expect(changed.elsewhere).toBe(0);

    // Both reference colours are visible in the generated image.
    let reds = 0;
    let blues = 0;
    for (let i = 0; i < out.data.length; i += 3) {
      if (out.data[i]! > 200 && out.data[i + 1]! < 50 && out.data[i + 2]! < 50) reds++;
      if (out.data[i + 2]! > 200 && out.data[i]! < 50 && out.data[i + 1]! < 50) blues++;
    }
    expect(reds).toBeGreaterThan(2000);
    expect(blues).toBeGreaterThan(2000);

    // One event per stage, in order, all ok, with model ids where a model ran.
    const events = await eventsOf(id);
    expect(events.map((e) => [e.stage, e.status])).toEqual([
      ['analysis', 'ok'],
      ['compose', 'ok'],
      ['generate', 'ok'],
      ['composite', 'ok'],
    ]);
    for (const e of events) expect(e.duration_ms).not.toBeNull();
    expect(events[0]!.model_config_id).toBeTruthy();
    expect(events[1]!.model_config_id).toBeNull();
    expect(events[2]!.model_config_id).toBeTruthy();

    const row = (await pool.query<{ model_vision_id: string | null; model_image_id: string | null; duration_ms: number; total_cost_usd: string }>(
      'SELECT model_vision_id, model_image_id, duration_ms, total_cost_usd FROM generations WHERE id = $1',
      [id],
    )).rows[0]!;
    expect(row.model_vision_id).toBe(events[0]!.model_config_id);
    expect(row.model_image_id).toBe(events[2]!.model_config_id);
    expect(row.duration_ms).toBeGreaterThanOrEqual(0);
    expect(Number(row.total_cost_usd)).toBe(0);
    expect(await successCountToday(user.id)).toBe(1);

    // The composed prompt exists only as ciphertext, reflects the analysis, and never contains overlay text.
    const prompt = await decryptedPrompt(id);
    expect(prompt).toContain('keripik tempe pouch');
    expect(prompt).toMatch(/colour taken from the colour reference/);
    expect(prompt).not.toContain('Promo Keripik');
    expect(prompt).not.toContain('Pesan via WhatsApp');
    expect(prompt).not.toMatch(/\b(text|typography|headline)\b/i);
    expect(spy.generateInputs[0]!.prompt).toBe(prompt);
  });

  it('t2i without references (template that allows both modes)', async () => {
    const spy = spyOnMock();
    const user = await userWithLimit();
    const created = await postGeneration(user, eventBody());
    expect(created.status).toBe(202);
    const g = await settle(user, created.body.data.id);
    expect(g).toMatchObject({ status: 'done', mode: 't2i', used_reference_image: false, reference_count_used: 0, composited_text: true, references: [] });
    expect(spy.generateInputs[0]).toMatchObject({ mode: 't2i', references: [] });
    expect(spy.analyzeCalls).toHaveLength(0);
    const events = await eventsOf(created.body.data.id);
    expect(events.map((e) => e.stage)).toEqual(['analysis', 'compose', 'generate', 'composite']);
    expect(events.every((e) => e.status === 'ok')).toBe(true);
    expect((await download(g.result_url)).status).toBe(200);
    expect(await successCountToday(user.id)).toBe(1);
  });

  it('applies the watermark only when app_settings.watermark_enabled is true', async () => {
    const spy = spyOnMock();
    await pool.query("UPDATE app_settings SET value = 'true'::jsonb WHERE key = 'watermark_enabled'");
    invalidateSettingsCache();
    const user = await userWithLimit();
    const created = await postGeneration(user, eventBody());
    const g = await settle(user, created.body.data.id);
    const out = await rawPixels((await download(g.result_url)).body);
    const base = await rawPixels(spy.bases[0]!);
    let cornerDiff = 0;
    for (let y = Math.floor(out.height * 0.9); y < out.height; y++) {
      for (let x = Math.floor(out.width * 0.55); x < out.width; x++) {
        const i = (y * out.width + x) * 3;
        if (out.data[i] !== base.data[i] || out.data[i + 1] !== base.data[i + 1]) cornerDiff++;
      }
    }
    expect(cornerDiff).toBeGreaterThan(100);
  });

  it('lets a creator use an admin library reference without uploading', async () => {
    const spy = spyOnMock();
    const user = await userWithLimit();
    const lib = (await pool.query<{ id: string }>("SELECT id FROM reference_assets WHERE is_library AND role = 'product' LIMIT 1")).rows[0]!;
    // The seed copies no files in tests; put one in place under the library asset's key.
    const key = (await pool.query<{ storage_key: string }>('SELECT a.storage_key FROM reference_assets r JOIN assets a ON a.id = r.asset_id WHERE r.id = $1', [lib.id])).rows[0]!.storage_key;
    const { getStorage } = await import('../../src/storage/index.js');
    await getStorage().put(key, await solidImage('#228833'), 'image/jpeg');

    const created = await postGeneration(user, posterBody([lib.id]));
    expect(created.status).toBe(202);
    const g = await settle(user, created.body.data.id);
    expect(g).toMatchObject({ status: 'done', used_reference_image: true, reference_count_used: 1 });
    expect(spy.generateInputs[0]!.references).toHaveLength(1);
    await getStorage().delete(key);
  });
});

describe('POST /generations: degradation, failure and fallback', () => {
  it('vision failure degrades to slot defaults but still succeeds', async () => {
    registerProvider({
      ...mockProvider,
      async analyzeReference() {
        throw new ProviderError('PROVIDER_UNAVAILABLE');
      },
    });
    const user = await userWithLimit();
    const ref = await createReferenceId(user, 'color', '#1010e0');
    const created = await postGeneration(user, posterBody([ref]));
    const id = created.body.data.id as string;
    const g = await settle(user, id);
    expect(g).toMatchObject({ status: 'done', degraded: true, used_reference_image: true, reference_count_used: 1 });
    const events = await eventsOf(id);
    expect(events[0]).toMatchObject({ stage: 'analysis', status: 'degraded', error_code: 'PROVIDER_UNAVAILABLE' });
    expect(events.slice(1).map((e) => e.status)).toEqual(['ok', 'ok', 'ok']);
    expect((await decryptedPrompt(id))).toContain('warm orange (#EA580C)'); // the colour slot default
    expect(await successCountToday(user.id)).toBe(1);
    const flagged = (await pool.query<{ degraded: boolean }>('SELECT degraded FROM generations WHERE id = $1', [id])).rows[0];
    expect(flagged?.degraded).toBe(true);
  });

  it('failed image provider: status failed, error_code set, sanitised event, usage NOT incremented', async () => {
    registerProvider({
      ...mockProvider,
      async generateImage() {
        throw new ProviderError('PROVIDER_UNAVAILABLE', { httpStatus: 503 });
      },
    });
    const user = await userWithLimit();
    const created = await postGeneration(user, eventBody());
    const id = created.body.data.id as string;
    const g = await settle(user, id);
    expect(g).toMatchObject({ status: 'failed', error_code: 'PROVIDER_UNAVAILABLE', progress_step: 'generate', result_url: null, thumbnail_url: null });
    const events = await eventsOf(id);
    expect(events.map((e) => [e.stage, e.status])).toEqual([['analysis', 'ok'], ['compose', 'ok'], ['generate', 'failed']]);
    expect(events[2]).toMatchObject({ error_code: 'PROVIDER_UNAVAILABLE' });
    expect(events[2]!.error_message).toBe('Model provider is temporarily unavailable (HTTP 503)');
    expect(await successCountToday(user.id)).toBe(0);
  });

  it('a failed generation does not use up the daily allowance', async () => {
    registerProvider({
      ...mockProvider,
      async generateImage() {
        throw new ProviderError('PROVIDER_AUTH');
      },
    });
    const user = await userWithLimit(1);
    const first = await postGeneration(user, eventBody());
    expect((await settle(user, first.body.data.id)).status).toBe('failed');
    registerProvider(mockProvider);
    const second = await postGeneration(user, eventBody());
    expect(second.status).toBe(202);
    expect((await settle(user, second.body.data.id)).status).toBe('done');
    expect(await successCountToday(user.id)).toBe(1);
  });

  it('falls back to the next active model by priority when the default fails', async () => {
    const backup = (await pool.query<{ id: string }>(
      `INSERT INTO model_configs (name, provider, capability, model_id, is_active, is_default, priority)
       VALUES ('Test backup i2i', 'mock', 'i2i', 'mock-i2i-backup', true, false, 500) RETURNING id`,
    )).rows[0]!;
    registerProvider({
      ...mockProvider,
      async generateImage(config, input, opts) {
        if (config.is_default) throw new ProviderError('PROVIDER_RATE_LIMITED');
        return mockProvider.generateImage!(config, input, opts);
      },
    });
    const user = await userWithLimit();
    const ref = await createReferenceId(user, 'product');
    const created = await postGeneration(user, posterBody([ref]));
    const id = created.body.data.id as string;
    const g = await settle(user, id);
    expect(g.status).toBe('done');
    const row = (await pool.query<{ model_image_id: string }>('SELECT model_image_id FROM generations WHERE id = $1', [id])).rows[0]!;
    expect(row.model_image_id).toBe(backup.id);
  });

  it('NO_MODEL_AVAILABLE when no active model can serve the capability', async () => {
    await pool.query("UPDATE model_configs SET is_default = false, is_active = false WHERE capability = 't2i'");
    try {
      const user = await userWithLimit();
      const created = await postGeneration(user, eventBody());
      const g = await settle(user, created.body.data.id);
      expect(g).toMatchObject({ status: 'failed', error_code: 'NO_MODEL_AVAILABLE', progress_step: 'generate' });
      expect(await successCountToday(user.id)).toBe(0);
    } finally {
      await pool.query("UPDATE model_configs SET is_active = true, is_default = true WHERE provider = 'mock' AND capability = 't2i'");
    }
  });

  it('job timeout: JOB_TIMEOUT, no usage', async () => {
    const queue = installHoldingQueue();
    registerProvider({
      ...mockProvider,
      generateImage: (_config, _input, opts) =>
        new Promise((_, reject) => {
          opts?.signal?.addEventListener('abort', () => reject(new ProviderError('PROVIDER_ABORTED')));
        }),
    });
    const user = await userWithLimit();
    const created = await postGeneration(user, eventBody());
    expect(queue.enqueued).toEqual([created.body.data.id]);
    const outcome = await runGeneration(created.body.data.id, { timeoutMs: 150 });
    expect(outcome).toBe('failed');
    const g = (await api().get(`/api/v1/generations/${created.body.data.id}`).set(bearer(user.accessToken))).body.data;
    expect(g).toMatchObject({ status: 'failed', error_code: 'JOB_TIMEOUT' });
    expect(await successCountToday(user.id)).toBe(0);
  });

  it('transient provider errors are retried only while attempts remain; others fail immediately', async () => {
    installHoldingQueue();
    let calls = 0;
    registerProvider({
      ...mockProvider,
      async generateImage() {
        calls++;
        throw new ProviderError('PROVIDER_RATE_LIMITED');
      },
    });
    const user = await userWithLimit();
    const created = await postGeneration(user, eventBody());
    const id = created.body.data.id as string;

    await expect(runGeneration(id, { attempt: 1, maxAttempts: 3 })).rejects.toBeInstanceOf(TransientJobError);
    let row = (await pool.query<{ status: string; error_code: string | null }>('SELECT status, error_code FROM generations WHERE id = $1', [id])).rows[0]!;
    expect(row.status).toBe('queued');
    await expect(runGeneration(id, { attempt: 2, maxAttempts: 3 })).rejects.toBeInstanceOf(TransientJobError);
    expect(await runGeneration(id, { attempt: 3, maxAttempts: 3 })).toBe('failed');
    row = (await pool.query<{ status: string; error_code: string | null }>('SELECT status, error_code FROM generations WHERE id = $1', [id])).rows[0]!;
    expect(row).toEqual({ status: 'failed', error_code: 'PROVIDER_RATE_LIMITED' });
    expect(calls).toBe(3);

    // A permanent error is never retried, even with attempts left.
    registerProvider({
      ...mockProvider,
      async generateImage() {
        throw new ProviderError('PROVIDER_CONTENT_BLOCKED');
      },
    });
    const second = await postGeneration(user, eventBody());
    expect(await runGeneration(second.body.data.id, { attempt: 1, maxAttempts: 3 })).toBe('failed');
    expect(await successCountToday(user.id)).toBe(0);
  });

  it('a generation that is not queued/running is skipped (no double processing)', async () => {
    const user = await userWithLimit();
    const created = await postGeneration(user, eventBody());
    const id = created.body.data.id as string;
    expect((await settle(user, id)).status).toBe('done');
    expect(await runGeneration(id)).toBe('skipped');
    expect(await successCountToday(user.id)).toBe(1);
  });
});

describe('POST /generations: validation order and rules', () => {
  it('rejects an i2i-only template without reference images, and a mode the template does not support', async () => {
    const user = await userWithLimit();
    const noRef = await postGeneration(user, posterBody([]));
    expect(noRef.status).toBe(400);
    expect(noRef.body.error_code).toBe('VALIDATION_ERROR');
    expect(noRef.body.errors[0].field).toBe('reference_ids');

    const wrongMode = await postGeneration(user, posterBody([], { mode: 't2i' }));
    expect(wrongMode.status).toBe(400);
    expect(wrongMode.body.errors[0].field).toBe('mode');

    const ref = await createReferenceId(user, 'product');
    const t2iWithRefs = await postGeneration(user, eventBody({ mode: 't2i', reference_ids: [ref] }));
    expect(t2iWithRefs.status).toBe(400);
    expect(t2iWithRefs.body.errors[0].field).toBe('reference_ids');
  });

  it('validates the body and slot values against template_slots', async () => {
    const user = await userWithLimit();
    const cases: [Record<string, unknown>, string][] = [
      [{ template_slug: EVENT }, 'slot_values.title'], // required slots missing
      [eventBody({ slot_values: { title: 'x'.repeat(61), date_venue: 'ok' } }), 'slot_values.title'], // max_length 60
      [eventBody({ slot_values: { title: 'ok', date_venue: 'ok', nonsense: 'x' } }), 'slot_values.nonsense'], // unknown slot
      [eventBody({ slot_values: { title: 'ok', date_venue: 'ok', lighting: 'neon green' } }), 'slot_values.lighting'], // select option
      [eventBody({ slot_values: { title: 'ok\u0000', date_venue: 'ok' } }), 'slot_values.title'],
    ];
    for (const [body, field] of cases) {
      const res = await postGeneration(user, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error_code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.map((e: { field: string }) => e.field)).toContain(field);
    }
    for (const body of [
      { ...eventBody(), unexpected_key: 1 },
      { ...eventBody(), template_id: '0e5c0f2e-1111-4111-8111-111111111111' },
      { slot_values: {} },
      eventBody({ reference_ids: ['not-a-uuid'] }),
      eventBody({ consent_confirmed: 'yes' }),
      eventBody({ slot_values: { title: 5 } }),
    ]) {
      const res = await postGeneration(user, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect((await postGeneration(user, { template_slug: 'tidak-ada', slot_values: {} })).status).toBe(404);
    expect((await api().post('/api/v1/generations').send(eventBody())).status).toBe(401);
  });

  it('only published templates can be used', async () => {
    const user = await userWithLimit();
    await pool.query("UPDATE templates SET status = 'draft' WHERE slug = $1", [EVENT]);
    try {
      expect((await postGeneration(user, eventBody())).status).toBe(404);
    } finally {
      await pool.query("UPDATE templates SET status = 'published' WHERE slug = $1", [EVENT]);
    }
  });

  it('accepts a template by id as well as by slug', async () => {
    const user = await userWithLimit();
    const tpl = (await pool.query<{ id: string }>('SELECT id FROM templates WHERE slug = $1', [EVENT])).rows[0]!;
    const { template_slug: _slug, ...rest } = eventBody();
    const res = await postGeneration(user, { ...rest, template_id: tpl.id });
    expect(res.status).toBe(202);
    await settle(user, res.body.data.id);
  });

  it('blocks content-policy terms in slot values and remarks without echoing the term', async () => {
    const user = await userWithLimit();
    const slot = await postGeneration(user, eventBody({ slot_values: { title: 'Taruhan judi online besar', date_venue: 'Balai Desa' } }));
    expect(slot.status).toBe(422);
    expect(slot.body.error_code).toBe('CONTENT_POLICY_VIOLATION');
    expect(slot.body.errors).toEqual([{ field: 'slot_values.title', message: expect.any(String) }]);
    expect(JSON.stringify(slot.body)).not.toMatch(/judi/i);

    const remarks = await postGeneration(user, eventBody({ remarks: 'gambar tentang narkoba' }));
    expect(remarks.status).toBe(422);
    expect(remarks.body.errors[0].field).toBe('remarks');
    expect(JSON.stringify(remarks.body)).not.toMatch(/narkoba/i);
    expect(await successCountToday(user.id)).toBe(0);
    expect((await pool.query('SELECT 1 FROM generations WHERE user_id = $1', [user.id])).rowCount).toBe(0);
  });

  it('enforces the maximum number of references (TOO_MANY_REFERENCES)', async () => {
    const user = await userWithLimit();
    const refs: string[] = [];
    for (let i = 0; i < 5; i++) refs.push(await createReferenceId(user, 'product', `#10${i}000`));
    const res = await postGeneration(user, posterBody(refs));
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('TOO_MANY_REFERENCES');
    const four = await postGeneration(user, posterBody(refs.slice(0, 4)));
    expect(four.status).toBe(202);
    const g = await settle(user, four.body.data.id);
    expect(g.reference_count_used).toBe(4);
  });

  it('only references owned by the caller (or library ones) can be used; others look like 404', async () => {
    const owner = await userWithLimit();
    const thief = await userWithLimit();
    const ref = await createReferenceId(owner, 'product');
    const res = await postGeneration(thief, posterBody([ref]));
    expect(res.status).toBe(404);
    expect(res.body.error_code).toBe('NOT_FOUND');
    expect((await postGeneration(thief, posterBody(['0e5c0f2e-1111-4111-8111-111111111111']))).status).toBe(404);
  });

  it('does not accept expired or deleted references', async () => {
    const user = await userWithLimit();
    const expired = (await uploadReference(user, { role: 'human_model', consent_confirmed: true })).body.data.id as string;
    await pool.query("UPDATE reference_assets SET expires_at = now() - interval '1 second' WHERE id = $1", [expired]);
    expect((await postGeneration(user, posterBody([expired], { consent_confirmed: true }))).status).toBe(404);
    const gone = await createReferenceId(user, 'product');
    await api().delete(`/api/v1/references/${gone}`).set(bearer(user.accessToken));
    expect((await postGeneration(user, posterBody([gone]))).status).toBe(404);
  });

  it('requires consent for human_model templates and for human_model references (CONSENT_REQUIRED)', async () => {
    const user = await userWithLimit();
    const human = (await uploadReference(user, { role: 'human_model', consent_confirmed: true })).body.data.id as string;
    const product = await createReferenceId(user, 'product');

    const humanTemplate = await postGeneration(user, { template_slug: HUMAN, reference_ids: [product], slot_values: {} });
    expect(humanTemplate.status).toBe(422);
    expect(humanTemplate.body.error_code).toBe('CONSENT_REQUIRED');

    const humanRef = await postGeneration(user, posterBody([human]));
    expect(humanRef.status).toBe(422);
    expect(humanRef.body.error_code).toBe('CONSENT_REQUIRED');

    const withConsent = await postGeneration(user, posterBody([human], { consent_confirmed: true }));
    expect(withConsent.status).toBe(202);
    const g = await settle(user, withConsent.body.data.id);
    expect(g.status).toBe('done');
    const stored = (await pool.query<{ consent_confirmed: boolean }>('SELECT consent_confirmed FROM generations WHERE id = $1', [withConsent.body.data.id])).rows[0];
    expect(stored?.consent_confirmed).toBe(true);

    const humanTemplateOk = await postGeneration(user, { template_slug: HUMAN, reference_ids: [product], slot_values: {}, consent_confirmed: true });
    expect(humanTemplateOk.status).toBe(202);
    await settle(user, humanTemplateOk.body.data.id);
  });
});

describe('daily limit and rate limit', () => {
  it('stops at the per-user override and reports DAILY_LIMIT_REACHED', async () => {
    const user = await userWithLimit(2);
    for (let i = 0; i < 2; i++) {
      const res = await postGeneration(user, eventBody());
      expect(res.status).toBe(202);
      expect((await settle(user, res.body.data.id)).status).toBe('done');
    }
    const blocked = await postGeneration(user, eventBody());
    expect(blocked.status).toBe(429);
    expect(blocked.body.error_code).toBe('DAILY_LIMIT_REACHED');
    const me = await api().get('/api/v1/me').set(bearer(user.accessToken));
    expect(me.body.data.usage).toMatchObject({ daily_limit: 2, used_today: 2, remaining_today: 0 });
  });

  it('counts jobs in flight against the limit and is race-safe under concurrency', async () => {
    const queue = installHoldingQueue();
    const user = await userWithLimit(1);
    const results = await Promise.all(Array.from({ length: 5 }, () => postGeneration(user, eventBody())));
    expect(results.filter((r) => r.status === 202)).toHaveLength(1);
    expect(results.filter((r) => r.status === 429).every((r) => r.body.error_code === 'DAILY_LIMIT_REACHED')).toBe(true);
    expect(queue.enqueued).toHaveLength(1);
  });

  it('uses app_settings.default_daily_limit when the user has no override, and 0 blocks everything', async () => {
    await pool.query("UPDATE app_settings SET value = '1'::jsonb WHERE key = 'default_daily_limit'");
    invalidateSettingsCache();
    const user = await userWithLimit();
    const first = await postGeneration(user, eventBody());
    expect(first.status).toBe(202);
    await settle(user, first.body.data.id);
    expect((await postGeneration(user, eventBody())).body.error_code).toBe('DAILY_LIMIT_REACHED');
    const zero = await userWithLimit(0);
    expect((await postGeneration(zero, eventBody())).body.error_code).toBe('DAILY_LIMIT_REACHED');
  });

  it('allows at most 10 new jobs per minute per user (RATE_LIMIT_EXCEEDED)', async () => {
    installHoldingQueue();
    const user = await userWithLimit(1000);
    for (let i = 0; i < 10; i++) expect((await postGeneration(user, eventBody())).status).toBe(202);
    const eleventh = await postGeneration(user, eventBody());
    expect(eleventh.status).toBe(429);
    expect(eleventh.body.error_code).toBe('RATE_LIMIT_EXCEEDED');
    // Another user is not affected.
    const other = await userWithLimit(1000);
    expect((await postGeneration(other, eventBody())).status).toBe(202);
  });

  it('answers 503 and marks the generation failed when the queue cannot accept the job', async () => {
    setQueue({
      driver: 'bullmq',
      async enqueue() {
        throw new Error('redis down');
      },
      async onIdle() {},
      async close() {},
    });
    const user = await userWithLimit();
    const res = await postGeneration(user, eventBody());
    expect(res.status).toBe(503);
    expect(res.body.error_code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('redis');
    const row = (await pool.query<{ status: string; error_code: string }>('SELECT status, error_code FROM generations WHERE user_id = $1', [user.id])).rows[0];
    expect(row).toEqual({ status: 'failed', error_code: 'INTERNAL_ERROR' });
  });
});

describe('reading generations', () => {
  it('returns an explicit allowlist: no prompt, analysis, ciphertext, cost or model fields', async () => {
    const user = await userWithLimit();
    const ref = await createReferenceId(user, 'product');
    const created = await postGeneration(user, posterBody([ref]));
    const detail = await settle(user, created.body.data.id);
    expect(Object.keys(detail).sort()).toEqual(
      [
        'archived', 'composited_text', 'created_at', 'degraded', 'duration_ms', 'error_code', 'height', 'id', 'mode', 'progress_step',
        'publication', 'reference_count_used', 'references', 'remarks', 'result_url', 'slot_values', 'status', 'subject', 'template',
        'thumbnail_url', 'updated_at', 'used_reference_image', 'width',
      ].sort(),
    );
    const list = await api().get('/api/v1/generations').set(bearer(user.accessToken));
    expect(list.status).toBe(200);
    expect(Object.keys(list.body.data[0]).sort()).toEqual(Object.keys(detail).sort());
    const banned = /prompt|cipher|auth_tag|iv$|analysis|cost|model_|core|blank|placeholder|storage_key/i;
    expect([...collectKeys(detail)].filter((k) => banned.test(k) && k !== 'used_reference_image')).toEqual([]);
    expect([...collectKeys(list.body)].filter((k) => banned.test(k))).toEqual([]);
  });

  it('polling shows queued then a result, with no-store caching', async () => {
    installHoldingQueue();
    const user = await userWithLimit();
    const created = await postGeneration(user, eventBody());
    const id = created.body.data.id as string;
    const poll = await api().get(`/api/v1/generations/${id}`).set(bearer(user.accessToken));
    expect(poll.headers['cache-control']).toBe('no-store');
    expect(poll.body.data).toMatchObject({ status: 'queued', progress_step: null, result_url: null, thumbnail_url: null, used_reference_image: false });
    await runGeneration(id);
    const done = await api().get(`/api/v1/generations/${id}`).set(bearer(user.accessToken));
    expect(done.body.data.status).toBe('done');
    expect(done.body.data.result_url).toMatch(/token=/);
  });

  it('another creator (and an admin) gets 404, never 403, for reads, deletes and archives', async () => {
    const owner = await userWithLimit();
    const other = await userWithLimit();
    const created = await postGeneration(owner, eventBody());
    const id = created.body.data.id as string;
    await settle(owner, id);
    for (const session of [other]) {
      expect((await api().get(`/api/v1/generations/${id}`).set(bearer(session.accessToken))).status).toBe(404);
      expect((await api().delete(`/api/v1/generations/${id}`).set(bearer(session.accessToken))).status).toBe(404);
      expect((await api().post(`/api/v1/generations/${id}/archive`).set(bearer(session.accessToken))).status).toBe(404);
    }
    const lookalike = await api().get('/api/v1/generations/0e5c0f2e-1111-4111-8111-111111111111').set(bearer(other.accessToken));
    const foreign = await api().get(`/api/v1/generations/${id}`).set(bearer(other.accessToken));
    expect(foreign.body).toEqual(lookalike.body); // indistinguishable from a missing one
    expect((await api().get('/api/v1/generations').set(bearer(other.accessToken))).body.data).toEqual([]);
    expect((await api().get(`/api/v1/generations/${id}`)).status).toBe(401);
    expect((await api().get(`/api/v1/generations/${id}`).set(bearer(owner.accessToken))).status).toBe(200);
  });

  it('lists paginated, filterable by status and archive state', async () => {
    const user = await userWithLimit();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await postGeneration(user, eventBody());
      ids.push(res.body.data.id);
      await settle(user, res.body.data.id);
    }
    await api().post(`/api/v1/generations/${ids[0]}/archive`).set(bearer(user.accessToken));

    const page1 = await api().get('/api/v1/generations?limit=2').set(bearer(user.accessToken));
    expect(page1.body.data.map((g: { id: string }) => g.id)).toEqual([ids[2], ids[1]]);
    expect(page1.body.meta).toMatchObject({ page: 1, limit: 2, total: 2 });

    const archived = await api().get('/api/v1/generations?archived=true').set(bearer(user.accessToken));
    expect(archived.body.data.map((g: { id: string }) => g.id)).toEqual([ids[0]]);
    expect(archived.body.data[0].archived).toBe(true);
    const all = await api().get('/api/v1/generations?archived=all&limit=50').set(bearer(user.accessToken));
    expect(all.body.data).toHaveLength(3);
    expect((await api().get('/api/v1/generations?status=failed').set(bearer(user.accessToken))).body.data).toEqual([]);
    expect((await api().get('/api/v1/generations?status=bogus').set(bearer(user.accessToken))).status).toBe(400);
    expect((await api().get('/api/v1/generations?limit=500').set(bearer(user.accessToken))).status).toBe(400);
  });

  it('DELETE soft-deletes, removes the files, hides gallery entries and wipes the stored prompt', async () => {
    const user = await userWithLimit();
    const created = await postGeneration(user, eventBody());
    const id = created.body.data.id as string;
    const g = await settle(user, id);
    expect((await download(g.result_url)).status).toBe(200);
    const assetIds = (await pool.query<{ result_asset_id: string; thumbnail_asset_id: string }>('SELECT result_asset_id, thumbnail_asset_id FROM generations WHERE id = $1', [id])).rows[0]!;
    await pool.query(
      `INSERT INTO gallery_items (generation_id, image_asset_id, title) VALUES ($1, $2, 'dari generasi')`,
      [id, assetIds.result_asset_id],
    );

    const del = await api().delete(`/api/v1/generations/${id}`).set(bearer(user.accessToken));
    expect(del.status).toBe(200);
    expect((await api().get(`/api/v1/generations/${id}`).set(bearer(user.accessToken))).status).toBe(404);
    expect((await download(g.result_url)).status).toBe(404);
    expect((await download(g.thumbnail_url)).status).toBe(404);
    expect((await api().get('/api/v1/generations').set(bearer(user.accessToken))).body.data).toEqual([]);
    expect((await api().delete(`/api/v1/generations/${id}`).set(bearer(user.accessToken))).status).toBe(404);

    const row = (await pool.query<{ deleted_at: Date | null; final_prompt_ciphertext: Buffer | null }>('SELECT deleted_at, final_prompt_ciphertext FROM generations WHERE id = $1', [id])).rows[0]!;
    expect(row.deleted_at).not.toBeNull();
    expect(row.final_prompt_ciphertext).toBeNull();
    const assets = (await pool.query<{ deleted_at: Date | null }>('SELECT deleted_at FROM assets WHERE id = ANY($1)', [[assetIds.result_asset_id, assetIds.thumbnail_asset_id]])).rows;
    expect(assets.every((a) => a.deleted_at !== null)).toBe(true);
    expect((await pool.query<{ is_hidden: boolean }>('SELECT is_hidden FROM gallery_items WHERE generation_id = $1', [id])).rows[0]?.is_hidden).toBe(true);
    // Deleting does not hand the allowance back.
    expect(await successCountToday(user.id)).toBe(1);
  });

  it('POST /:id/archive is idempotent', async () => {
    const user = await userWithLimit();
    const created = await postGeneration(user, eventBody());
    await settle(user, created.body.data.id);
    const first = await api().post(`/api/v1/generations/${created.body.data.id}/archive`).set(bearer(user.accessToken));
    const second = await api().post(`/api/v1/generations/${created.body.data.id}/archive`).set(bearer(user.accessToken));
    expect(first.status).toBe(200);
    expect(first.body.data.archived).toBe(true);
    expect(second.body.data.archived).toBe(true);
  });

  it('deleting a running generation discards what the job produces and does not count it', async () => {
    const queue = installHoldingQueue();
    const user = await userWithLimit();
    const created = await postGeneration(user, eventBody());
    const id = created.body.data.id as string;
    expect(queue.enqueued).toContain(id);
    await api().delete(`/api/v1/generations/${id}`).set(bearer(user.accessToken));
    expect(await runGeneration(id)).toBe('skipped');
    expect(await successCountToday(user.id)).toBe(0);
  });
});
