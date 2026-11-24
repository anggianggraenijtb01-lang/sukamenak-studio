import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, pool, registerUser, type TestSession } from '../helpers/api.js';
import { useSeededDatabase, uuid } from '../helpers/admin.js';
import { createReferenceId, postGeneration, settle } from '../helpers/pipeline.js';
import { awaitVideoQueueIdle } from '../../src/video/queue.js';
import { recordProgress } from '../../src/video/runVideoJob.js';

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

/**
 * Deleting must not be a way around the render guards or a way to keep a video the creator thought was
 * gone. A fresh user keeps these tests clear of the shared account's daily quota.
 */
describe('video deletion rules', () => {
  let owner: TestSession;
  let poster: string;
  let doneJobId: string;

  /** A job the worker will never touch: a copy of a finished one, forced into `rendering`. */
  async function insertRenderingCopy(): Promise<string> {
    const copy = await pool.query<{ id: string }>(
      `INSERT INTO video_jobs (generation_id, user_id, props, duration_seconds, status)
       SELECT generation_id, user_id, props, duration_seconds, 'rendering' FROM video_jobs WHERE id = $1
       RETURNING id`,
      [doneJobId],
    );
    return copy.rows[0]!.id;
  }

  beforeAll(async () => {
    owner = await registerUser();
    const ref = await createReferenceId(owner, 'product', '#448844');
    const gen = await postGeneration(owner, {
      template_slug: 'poster-promo-produk',
      reference_ids: [ref],
      slot_values: { title: 'Promo Keripik', product: 'keripik tempe', cta: 'Pesan sekarang' },
    });
    expect(gen.status).toBe(202);
    expect((await settle(owner, gen.body.data.id)).status).toBe('done');
    poster = gen.body.data.id as string;

    const created = await createVideo(owner, poster);
    expect(created.status).toBe(202);
    await awaitVideoQueueIdle();
    doneJobId = created.body.data.id as string;
    expect((await video(owner, doneJobId)).body.data.status).toBe('done');
  });

  it('a progress write that arrives late never touches a finished job or moves progress backwards', async () => {
    // Progress is written fire-and-forget while the renderer prints; the last one can still be in flight
    // when the job is marked done (seen as progress 99 on a done job in CI).
    const activeId = await insertRenderingCopy();
    await recordProgress(activeId, 40);
    await recordProgress(activeId, 20);
    expect((await pool.query('SELECT progress FROM video_jobs WHERE id = $1', [activeId])).rows[0]?.progress).toBe(40);

    await pool.query("UPDATE video_jobs SET status = 'done', progress = 100 WHERE id = $1", [activeId]);
    await recordProgress(activeId, 99);
    expect((await pool.query('SELECT progress FROM video_jobs WHERE id = $1', [activeId])).rows[0]?.progress).toBe(100);
  });

  it('refuses to delete a job that is queued or rendering, so the quota and the one-render guard hold', async () => {
    const activeId = await insertRenderingCopy();

    const del = await api().delete(`/api/v1/videos/${activeId}`).set(bearer(owner.accessToken));
    expect(del.status).toBe(409);
    expect(del.body.error_code).toBe('VIDEO_STILL_RENDERING');
    const row = await pool.query<{ deleted_at: Date | null }>('SELECT deleted_at FROM video_jobs WHERE id = $1', [activeId]);
    expect(row.rows[0]?.deleted_at).toBeNull();

    // Once the render has ended, the same job can be deleted.
    await pool.query("UPDATE video_jobs SET status = 'failed' WHERE id = $1", [activeId]);
    const retry = await api().delete(`/api/v1/videos/${activeId}`).set(bearer(owner.accessToken));
    expect(retry.status).toBe(200);
  });

  it('refuses to delete a generation while one of its videos is queued or rendering', async () => {
    const activeId = await insertRenderingCopy();

    const del = await api().delete(`/api/v1/generations/${poster}`).set(bearer(owner.accessToken));
    expect(del.status).toBe(409);
    expect(del.body.error_code).toBe('VIDEO_STILL_RENDERING');

    // Nothing was touched: the poster and both jobs are still there.
    const gen = await pool.query<{ deleted_at: Date | null }>('SELECT deleted_at FROM generations WHERE id = $1', [poster]);
    expect(gen.rows[0]?.deleted_at).toBeNull();
    const jobs = await pool.query<{ deleted_at: Date | null }>('SELECT deleted_at FROM video_jobs WHERE id = ANY($1::uuid[])', [[doneJobId, activeId]]);
    expect(jobs.rows.every((j) => j.deleted_at === null)).toBe(true);

    // Once the render has ended the poster can go.
    await pool.query("UPDATE video_jobs SET status = 'failed' WHERE id = $1", [activeId]);
  });

  it("takes the poster's videos down with it when the generation is deleted", async () => {
    const assetId = (await pool.query<{ result_asset_id: string }>('SELECT result_asset_id FROM video_jobs WHERE id = $1', [doneJobId])).rows[0]!
      .result_asset_id;

    const del = await api().delete(`/api/v1/generations/${poster}`).set(bearer(owner.accessToken));
    expect(del.status).toBe(200);

    expect((await video(owner, doneJobId)).status).toBe(404);
    const list = await api().get(`/api/v1/videos?generation_id=${poster}`).set(bearer(owner.accessToken));
    expect(list.body.data).toEqual([]);
    const asset = await pool.query<{ deleted_at: Date | null }>('SELECT deleted_at FROM assets WHERE id = $1', [assetId]);
    expect(asset.rows[0]?.deleted_at).toBeTruthy();
  });
});

/**
 * Editing an existing video: the job is re-queued with a new cut length, keeps its id and its place in
 * today's quota, and the replaced file is freed.
 */
describe('video editing rules', () => {
  let owner: TestSession;
  let stranger: TestSession;
  let poster: string;
  let jobId: string;
  let firstAssetId: string;

  const edit = (session: TestSession, id: string, body: Record<string, unknown>) =>
    api().patch(`/api/v1/videos/${id}`).set(bearer(session.accessToken)).send(body);

  beforeAll(async () => {
    owner = await registerUser();
    stranger = await registerUser();
    const ref = await createReferenceId(owner, 'product', '#2255aa');
    const gen = await postGeneration(owner, {
      template_slug: 'poster-promo-produk',
      reference_ids: [ref],
      slot_values: { title: 'Promo Kopi', product: 'kopi arabika', cta: 'Pesan sekarang' },
    });
    expect(gen.status).toBe(202);
    expect((await settle(owner, gen.body.data.id)).status).toBe('done');
    poster = gen.body.data.id as string;

    const created = await createVideo(owner, poster, { duration_seconds: 6 });
    expect(created.status).toBe(202);
    await awaitVideoQueueIdle();
    jobId = created.body.data.id as string;
    const row = await pool.query<{ result_asset_id: string; duration_seconds: number }>(
      'SELECT result_asset_id, duration_seconds FROM video_jobs WHERE id = $1',
      [jobId],
    );
    firstAssetId = row.rows[0]!.result_asset_id;
    expect(row.rows[0]!.duration_seconds).toBe(6);
  });

  it("re-renders the same job with a new duration and frees the replaced file", async () => {
    const res = await edit(owner, jobId, { duration_seconds: 12 });
    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ id: jobId, status: 'queued', duration_seconds: 12 });

    await awaitVideoQueueIdle();
    const detail = await video(owner, jobId);
    expect(detail.body.data).toMatchObject({ status: 'done', duration_seconds: 12, progress: 100 });
    expect(detail.body.data.video_url).toMatch(/\/api\/v1\/files\/videos\//);

    const row = await pool.query<{ result_asset_id: string }>(
      'SELECT result_asset_id FROM video_jobs WHERE id = $1',
      [jobId],
    );
    expect(row.rows[0]!.result_asset_id).not.toBe(firstAssetId);
    const oldAsset = await pool.query<{ deleted_at: Date | null }>(
      'SELECT deleted_at FROM assets WHERE id = $1',
      [firstAssetId],
    );
    expect(oldAsset.rows[0]?.deleted_at).toBeTruthy();

    // One job is one slot in the daily quota, however many times it is re-rendered.
    const quota = await api().get('/api/v1/videos/quota').set(bearer(owner.accessToken));
    expect(quota.body.data.used).toBe(1);
  });

  it("is invisible to another user: 404, and nothing changes", async () => {
    const res = await edit(stranger, jobId, { duration_seconds: 10 });
    expect(res.status).toBe(404);
    const row = await pool.query<{ duration_seconds: number }>(
      'SELECT duration_seconds FROM video_jobs WHERE id = $1',
      [jobId],
    );
    expect(row.rows[0]?.duration_seconds).toBe(12);
  });

  it("refuses a duration outside the allowed range", async () => {
    const tooLong = await edit(owner, jobId, { duration_seconds: 30 });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error_code).toBe('VALIDATION_ERROR');
    expect((await edit(owner, jobId, { duration_seconds: 1 })).status).toBe(400);
    expect((await edit(owner, jobId, {})).status).toBe(400);
  });

  it("refuses to edit a job that is queued or rendering", async () => {
    const active = await pool.query<{ id: string }>(
      `INSERT INTO video_jobs (generation_id, user_id, props, duration_seconds, status)
       SELECT generation_id, user_id, props, duration_seconds, 'rendering' FROM video_jobs WHERE id = $1
       RETURNING id`,
      [jobId],
    );
    const res = await edit(owner, active.rows[0]!.id, { duration_seconds: 9 });
    expect(res.status).toBe(409);
    expect(res.body.error_code).toBe('VIDEO_STILL_RENDERING');
  });

  it("rejects malformed ids and unknown jobs", async () => {
    expect((await edit(owner, 'nope', { duration_seconds: 9 })).status).toBe(400);
    expect((await edit(owner, uuid(), { duration_seconds: 9 })).status).toBe(404);
  });
});
