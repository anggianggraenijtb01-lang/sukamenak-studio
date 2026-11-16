import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { defaultStaleAfterMs, reapStaleGenerations } from '../../src/retention/reaper.js';
import { pool, registerUser, useDatabase } from '../helpers/api.js';

useDatabase();

type Status = 'queued' | 'running' | 'done' | 'failed';

/** Inserts a bare generation row; `updated_at` is set explicitly (the trigger only fires on UPDATE). */
async function insertGeneration(userId: string, status: Status, idleMs: number, opts: { deleted?: boolean } = {}): Promise<string> {
  const id = randomUUID();
  const template = (await pool.query<{ id: string }>("SELECT id FROM templates WHERE slug = 'poster-kegiatan-organisasi'")).rows[0]!;
  await pool.query(
    `INSERT INTO generations (id, user_id, template_id, mode, subject, publication, status, slot_values, updated_at, deleted_at)
     VALUES ($1, $2, $3, 't2i', 'product', 'poster', $4, '{"title":"Halo"}'::jsonb,
             now() - ($5::double precision * interval '1 millisecond'), CASE WHEN $6::boolean THEN now() ELSE NULL END)`,
    [id, userId, template.id, status, idleMs, opts.deleted ?? false],
  );
  return id;
}

const stateOf = async (id: string) =>
  (await pool.query<{ status: string; error_code: string | null }>('SELECT status, error_code FROM generations WHERE id = $1', [id])).rows[0]!;

describe('stale generation reaper', () => {
  const stale = () => defaultStaleAfterMs() + 60_000;

  it('fails orphaned queued and running generations and leaves everything else alone', async () => {
    const user = await registerUser();
    const orphanRunning = await insertGeneration(user.id, 'running', stale());
    const orphanQueued = await insertGeneration(user.id, 'queued', stale());
    const healthy = await insertGeneration(user.id, 'running', 1000);
    const finished = await insertGeneration(user.id, 'done', stale());
    const alreadyFailed = await insertGeneration(user.id, 'failed', stale());
    const deleted = await insertGeneration(user.id, 'running', stale(), { deleted: true });

    const reaped = await reapStaleGenerations();
    expect(reaped).toBeGreaterThanOrEqual(2);

    expect(await stateOf(orphanRunning)).toEqual({ status: 'failed', error_code: 'JOB_TIMEOUT' });
    expect(await stateOf(orphanQueued)).toEqual({ status: 'failed', error_code: 'JOB_TIMEOUT' });
    expect((await stateOf(healthy)).status).toBe('running');
    expect((await stateOf(finished)).status).toBe('done');
    expect(await stateOf(alreadyFailed)).toEqual({ status: 'failed', error_code: null });
    expect((await stateOf(deleted)).status).toBe('running'); // soft-deleted rows are not touched
  });

  it('frees the creator from a permanently stuck in-flight job', async () => {
    const user = await registerUser();
    await insertGeneration(user.id, 'running', stale());
    const inFlight = async () =>
      Number((await pool.query<{ n: string }>("SELECT count(*) AS n FROM generations WHERE user_id = $1 AND status IN ('queued', 'running') AND deleted_at IS NULL", [user.id])).rows[0]!.n);
    expect(await inFlight()).toBe(1);
    await reapStaleGenerations();
    expect(await inFlight()).toBe(0);
  });

  it('is idempotent', async () => {
    const user = await registerUser();
    const id = await insertGeneration(user.id, 'running', stale());
    await reapStaleGenerations();
    const again = await reapStaleGenerations();
    expect(again).toBe(0);
    expect((await stateOf(id)).status).toBe('failed');
  });

  it('with staleAfterMs 0 (inline-driver boot sweep) also fails jobs that are only seconds old', async () => {
    const user = await registerUser();
    const fresh = await insertGeneration(user.id, 'running', 2000);
    await reapStaleGenerations();
    expect((await stateOf(fresh)).status).toBe('running'); // default threshold: not yet considered orphaned
    await reapStaleGenerations({ staleAfterMs: 0 });
    expect(await stateOf(fresh)).toEqual({ status: 'failed', error_code: 'JOB_TIMEOUT' });
  });

  it('waits at least as long as a job with all its attempts can legitimately take', () => {
    // Timeout per attempt x attempts, plus backoff and slack: a job on its last attempt must never be reaped.
    expect(defaultStaleAfterMs()).toBeGreaterThan(20_000 * 3);
  });
});
