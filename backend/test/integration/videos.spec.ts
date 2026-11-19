import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, pool, registerUser, type TestSession } from '../helpers/api.js';
import { useSeededDatabase, uuid } from '../helpers/admin.js';
import { createReferenceId, postGeneration, settle } from '../helpers/pipeline.js';
import { awaitVideoQueueIdle } from '../../src/video/queue.js';

useSeededDatabase();

/**
 * Endpoints and the job state machine. The renderer itself is a stand-in script in tests
 * (test/fixtures/fakeRender.mjs, wired through VIDEO_RENDER_COMMAND in testEnv): what has to be true
 * here is that a request becomes a queued row, the worker turns it into a stored mp4, the DTO exposes
 * only safe fields, and the quota/ownership rules hold.
 */

let creator: TestSession;
let other: TestSession;
let generationId: string;
let noTextGenerationId: string;

const video = (session: TestSession, id: string) => api().get(`/api/v1/videos/${id}`).set(bearer(session.accessToken));
const createVideo = (session: TestSession, id: string, body: Record<string, unknown> = {}) =>
  api().post(`/api/v1/generations/${id}/video`).set(bearer(session.accessToken)).send(body);

let referenceId: string;

/** Runs a real (mock-provider) generation so the poster asset and text zones exist. */
async function makePoster(
  session: TestSession,
  template = 'poster-promo-produk',
  slotValues: Record<string, string> = { title: 'Promo Keripik', product: 'keripik tempe', cta: 'Pesan sekarang' },
): Promise<string> {
  const res = await postGeneration(session, {
    template_slug: template,
    reference_ids: [referenceId],
    slot_values: slotValues,
  });
  expect(res.status).toBe(202);
  const settled = await settle(session, res.body.data.id);
  expect(settled.status).toBe('done');
  await awaitVideoQueueIdle();
  return res.body.data.id as string;
}

beforeAll(async () => {
  creator = await registerUser();
  other = await registerUser();
  referenceId = await createReferenceId(creator, 'product', '#cc8844');
  generationId = await makePoster(creator);

  // A product shot has no overlay slot at all (only defaults), so it never gets `composited_text`.
  noTextGenerationId = await makePoster(creator, 'foto-produk-latar-putih', {});
});

afterAll(async () => {
  await awaitVideoQueueIdle();
});

describe('video jobs', () => {
  it('turns a finished poster into a stored mp4 and reports it only when done', async () => {
    const res = await createVideo(creator, generationId, { duration_seconds: 8 });
    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe('queued');

    await awaitVideoQueueIdle();
    const detail = await video(creator, res.body.data.id);
    expect(detail.status).toBe(200);
    const d = detail.body.data;
    expect(d).toMatchObject({ status: 'done', duration_seconds: 8, width: 1080, height: 1920, fps: 30, progress: 100 });
    expect(d.video_url).toMatch(/\/api\/v1\/files\/videos\//);
    expect(d.error_code).toBeNull();
    expect(d.render_ms).toBeGreaterThanOrEqual(0);

    // The file itself is a real stored object with the mp4 mime.
    const stored = await pool.query<{ mime: string; kind: string; bytes: number }>(
      `SELECT a.mime, a.kind, a.bytes FROM video_jobs v JOIN assets a ON a.id = v.result_asset_id WHERE v.id = $1`,
      [res.body.data.id],
    );
    expect(stored.rows[0]).toMatchObject({ mime: 'video/mp4', kind: 'video' });
    expect(stored.rows[0]!.bytes).toBeGreaterThan(0);
  });

  it('exposes no prompt, props or layout fields', async () => {
    const list = await api().get('/api/v1/videos').set(bearer(creator.accessToken));
    expect(list.status).toBe(200);
    const text = JSON.stringify(list.body);
    expect(text).not.toMatch(/prompt|cipher|poster_key|zones|brand_name/i);
    for (const item of list.body.data as Record<string, unknown>[]) {
      expect(Object.keys(item).sort()).toEqual(
        ['bytes', 'composition', 'created_at', 'duration_seconds', 'error_code', 'finished_at', 'fps', 'generation_id', 'height', 'id', 'progress', 'render_ms', 'status', 'thumbnail_url', 'video_url', 'width'].sort(),
      );
    }
  });

  it("is invisible to another user: 404, never 403", async () => {
    const mine = (await api().get('/api/v1/videos').set(bearer(creator.accessToken))).body.data as { id: string }[];
    const theirs = await video(other, mine[0]!.id);
    expect(theirs.status).toBe(404);

    const list = await api().get('/api/v1/videos').set(bearer(other.accessToken));
    expect(list.body.data).toEqual([]);

    const steal = await api().delete(`/api/v1/videos/${mine[0]!.id}`).set(bearer(other.accessToken));
    expect(steal.status).toBe(404);
  });

  it('refuses a generation that is not finished, or has no composited text', async () => {
    const queued = await postGeneration(creator, { template_slug: 'poster-kegiatan-organisasi', slot_values: { title: 'Bazar', date_venue: 'Balai' } });
    const early = await createVideo(creator, queued.body.data.id);
    expect(early.status).toBe(422);
    expect(early.body.error_code).toBe('VIDEO_NOT_ELIGIBLE');
    await settle(creator, queued.body.data.id);

    const noText = await createVideo(creator, noTextGenerationId);
    expect(noText.status).toBe(422);
    expect(noText.body.error_code).toBe('VIDEO_NOT_ELIGIBLE');
  });

  it('refuses a second render of the same poster while one is queued or running', async () => {
    const poster = await makePoster(creator, 'konten-feed-produk-4-5');
    const first = await createVideo(creator, poster);
    expect(first.status).toBe(202);
    const second = await createVideo(creator, poster);
    expect(second.status).toBe(409);
    expect(second.body.error_code).toBe('VIDEO_ALREADY_RUNNING');
    await awaitVideoQueueIdle();
  });

  it('enforces the daily limit and the maximum duration', async () => {
    const quota = await api().get('/api/v1/videos/quota').set(bearer(creator.accessToken));
    expect(quota.status).toBe(200);
    expect(quota.body.data.limit).toBe(3);

    const tooLong = await createVideo(creator, generationId, { duration_seconds: 30 });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error_code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed ids before touching the queue', async () => {
    const bad = await api().post(`/api/v1/generations/${uuid()}/video`).set(bearer(creator.accessToken)).send({});
    expect(bad.status).toBe(404);
    const notAUuid = await api().post('/api/v1/generations/nope/video').set(bearer(creator.accessToken)).send({});
    expect(notAUuid.status).toBe(400);
  });

  it('serves the mp4 with Range support so a player can seek', async () => {
    const list = (await api().get('/api/v1/videos').set(bearer(creator.accessToken))).body.data as { id: string; video_url: string }[];
    const target = list.find((v) => v.video_url);
    expect(target).toBeTruthy();

    const url = new URL(target!.video_url);
    const full = await api().get(`${url.pathname}${url.search}`);
    expect(full.status).toBe(200);
    expect(full.headers['accept-ranges']).toBe('bytes');
    expect(full.headers['content-type']).toContain('video/mp4');

    const partial = await api().get(`${url.pathname}${url.search}`).set('Range', 'bytes=0-9');
    expect(partial.status).toBe(206);
    expect(partial.headers['content-range']).toMatch(/^bytes 0-9\/\d+$/);
  });

  it('deletes the job and its file, and it disappears from the list', async () => {
    const poster = await makePoster(creator, 'poster-promo-produk');
    const created = await createVideo(creator, poster);
    expect(created.status).toBe(202);
    await awaitVideoQueueIdle();
    const id = created.body.data.id as string;

    const assetBefore = await pool.query<{ result_asset_id: string }>('SELECT result_asset_id FROM video_jobs WHERE id = $1', [id]);
    expect(assetBefore.rows[0]?.result_asset_id).toBeTruthy();

    const del = await api().delete(`/api/v1/videos/${id}`).set(bearer(creator.accessToken));
    expect(del.status).toBe(200);
    expect((await video(creator, id)).status).toBe(404);

    const assetAfter = await pool.query<{ deleted_at: Date | null }>('SELECT deleted_at FROM assets WHERE id = $1', [assetBefore.rows[0]!.result_asset_id]);
    expect(assetAfter.rows[0]?.deleted_at).toBeTruthy();
  });
});
