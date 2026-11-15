import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { logger } from '../lib/logger.js';

export interface ReapOptions {
  /** Rows untouched for longer than this are considered orphaned. Defaults to what a legitimate job can take. */
  staleAfterMs?: number;
}

/**
 * Longest a job can legitimately go without any update: every attempt may use the full timeout, with its
 * backoff in between, plus a minute of slack. Every stage writes to the row (and a trigger bumps
 * `updated_at`), so a healthy job never gets near this.
 */
export const defaultStaleAfterMs = (): number => (env.JOB_TIMEOUT_MS + env.JOB_BACKOFF_MS) * env.JOB_MAX_ATTEMPTS + 60_000;

/**
 * Marks generations that were queued or running but never finished (the process died or was forcibly
 * stopped mid-job) as failed with JOB_TIMEOUT. Without this such a row stays `running` forever, keeps
 * counting towards the creator's in-flight limit and its job can never complete. Idempotent and safe to run
 * from several processes. A job that the queue later retries cannot be resurrected: the pipeline only
 * advances rows that are still queued or running.
 */
export async function reapStaleGenerations(opts: ReapOptions = {}): Promise<number> {
  const staleAfterMs = opts.staleAfterMs ?? defaultStaleAfterMs();
  const rows = await query<{ id: string }>(
    `UPDATE generations
        SET status = 'failed', error_code = 'JOB_TIMEOUT'
      WHERE status IN ('queued', 'running') AND deleted_at IS NULL
        AND updated_at < now() - ($1::double precision * interval '1 millisecond')
      RETURNING id`,
    [staleAfterMs],
  );
  if (rows.length > 0) logger.warn({ count: rows.length }, 'marked stale generations as failed');
  return rows.length;
}

/** Runs the reaper every `intervalMs`. Returns a stop function. */
export function startStaleGenerationReaper(intervalMs = 5 * 60_000): () => void {
  const timer = setInterval(() => {
    reapStaleGenerations().catch((err: unknown) => logger.error({ err_name: (err as Error)?.name }, 'stale generation reaper failed'));
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
