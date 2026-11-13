import sharp from 'sharp';
import { expect } from 'vitest';
import { setQueue, awaitQueueIdle, type GenerationQueue } from '../../src/queue/index.js';
import { api, bearer, pool, type TestSession } from './api.js';

export const solidImage = (color: string, width = 320, height = 240, format: 'png' | 'jpeg' | 'webp' = 'png'): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: color } })
    .toFormat(format)
    .toBuffer();

export async function uploadReference(
  session: TestSession,
  fields: { role: string; consent_confirmed?: boolean; consent_note?: string; label?: string },
  file?: { buffer: Buffer; filename?: string; contentType?: string },
) {
  const buffer = file?.buffer ?? (await solidImage('#cc3333'));
  let req = api()
    .post('/api/v1/references')
    .set(bearer(session.accessToken))
    .field('role', fields.role)
    .attach('file', buffer, { filename: file?.filename ?? 'ref.png', contentType: file?.contentType ?? 'image/png' });
  if (fields.consent_confirmed !== undefined) req = req.field('consent_confirmed', String(fields.consent_confirmed));
  if (fields.consent_note) req = req.field('consent_note', fields.consent_note);
  if (fields.label) req = req.field('label', fields.label);
  return req;
}

export async function createReferenceId(session: TestSession, role: string, color = '#cc3333', extra: { consent_confirmed?: boolean } = {}): Promise<string> {
  const res = await uploadReference(session, { role, ...extra }, { buffer: await solidImage(color) });
  if (res.status !== 201) throw new Error(`upload failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.id as string;
}

export const postGeneration = (session: TestSession, body: Record<string, unknown>) =>
  api().post('/api/v1/generations').set(bearer(session.accessToken)).send(body);

/** Waits for locally running (inline) jobs, then returns the generation as the owner sees it. */
export async function settle(session: TestSession, id: string) {
  await awaitQueueIdle();
  const res = await api().get(`/api/v1/generations/${id}`).set(bearer(session.accessToken));
  expect(res.status).toBe(200);
  return res.body.data as Record<string, any>;
}

/** Downloads a signed file URL returned by the API (relative to the test app). */
export async function download(url: string): Promise<{ status: number; body: Buffer; type: string }> {
  const u = new URL(url);
  const res = await api().get(`${u.pathname}${u.search}`).buffer(true).parse((r, cb) => {
    const chunks: Buffer[] = [];
    r.on('data', (c: Buffer) => chunks.push(c));
    r.on('end', () => cb(null, Buffer.concat(chunks)));
  });
  return { status: res.status, body: res.body as Buffer, type: String(res.headers['content-type'] ?? '') };
}

export const eventsOf = async (generationId: string) =>
  (
    await pool.query<{ stage: string; status: string; duration_ms: number | null; cost_usd: string; model_config_id: string | null; error_code: string | null; error_message: string | null }>(
      'SELECT stage, status, duration_ms, cost_usd, model_config_id, error_code, error_message FROM generation_events WHERE generation_id = $1 ORDER BY created_at, id',
      [generationId],
    )
  ).rows;

export const successCountToday = async (userId: string): Promise<number> =>
  (await pool.query<{ success_count: number }>("SELECT success_count FROM usage_counters WHERE user_id = $1 AND date = (now() AT TIME ZONE 'Asia/Jakarta')::date", [userId])).rows[0]?.success_count ?? 0;

/** A queue that accepts jobs and never runs them: lets a test drive runGeneration() by hand. */
export function installHoldingQueue(): { enqueued: string[]; restore: () => void } {
  const enqueued: string[] = [];
  const queue: GenerationQueue = {
    driver: 'inline',
    async enqueue(id) {
      enqueued.push(id);
    },
    async onIdle() {},
    async close() {},
  };
  setQueue(queue);
  return { enqueued, restore: () => setQueue(undefined) };
}

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
