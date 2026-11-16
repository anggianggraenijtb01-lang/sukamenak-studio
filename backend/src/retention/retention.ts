import { env } from '../config/env.js';
import { pool, query } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { purgeDeletedAssetFiles, softDeleteAssets } from '../storage/assets.js';

export interface RetentionResult {
  /** Human-model reference photos past `expires_at` (7 days), removed from storage. */
  expiredReferences: number;
  /** Generations whose prompt, remarks, slot values and reference list were wiped (older than 90 days). */
  purgedGenerations: number;
  /** Files of already soft-deleted assets that were still in storage. */
  orphanFiles: number;
}

export interface RetentionOptions {
  now?: Date;
  generationDays?: number;
  batchSize?: number;
}

const LOCK_KEY = 'retention:purge';

/**
 * Daily retention: deletes expired human-model reference photos and wipes prompt-bearing fields of old
 * generations. Idempotent, safe to run from several processes (a transaction-scoped advisory lock makes
 * a concurrent run a no-op), and never touches seed/preview assets or generated result images.
 * Returns null when another process holds the lock.
 */
export async function runRetention(opts: RetentionOptions = {}): Promise<RetentionResult | null> {
  const now = opts.now ?? new Date();
  const generationDays = opts.generationDays ?? env.RETENTION_GENERATION_DAYS;
  const batch = opts.batchSize ?? 500;

  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked', [LOCK_KEY]);
    if (!rows[0]?.locked) return null;
    try {
      const result: RetentionResult = { expiredReferences: 0, purgedGenerations: 0, orphanFiles: 0 };

      for (;;) {
        const expired = await query<{ id: string; asset_id: string }>(
          `UPDATE reference_assets SET deleted_at = $1
            WHERE id IN (
              SELECT id FROM reference_assets
               WHERE expires_at IS NOT NULL AND expires_at < $1 AND deleted_at IS NULL
               ORDER BY expires_at LIMIT $2)
            RETURNING id, asset_id`,
          [now, batch],
        );
        if (expired.length === 0) break;
        await softDeleteAssets(expired.map((r) => r.asset_id));
        result.expiredReferences += expired.length;
      }

      for (;;) {
        const purged = await query<{ id: string }>(
          `UPDATE generations
              SET remarks = NULL, slot_values = '{}'::jsonb, reference_inputs = '[]'::jsonb,
                  final_prompt_ciphertext = NULL, final_prompt_iv = NULL, final_prompt_auth_tag = NULL,
                  purged_at = $1
            WHERE id IN (
              SELECT id FROM generations
               WHERE purged_at IS NULL AND created_at < $1::timestamptz - make_interval(days => $2)
               ORDER BY created_at LIMIT $3)
            RETURNING id`,
          [now, generationDays, batch],
        );
        if (purged.length === 0) break;
        result.purgedGenerations += purged.length;
      }

      for (;;) {
        const removed = await purgeDeletedAssetFiles(batch);
        result.orphanFiles += removed;
        if (removed < batch) break;
      }

      logger.info({ ...result }, 'retention run finished');
      return result;
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

/** Runs retention now and then every `intervalMinutes` (0 disables). Returns a stop function. */
export function startRetentionSchedule(intervalMinutes: number = env.RETENTION_INTERVAL_MINUTES): () => void {
  if (intervalMinutes <= 0) return () => undefined;
  const run = () => {
    runRetention().catch((err: unknown) => logger.error({ err_name: (err as Error)?.name }, 'retention run failed'));
  };
  const first = setTimeout(run, 30_000);
  const timer = setInterval(run, intervalMinutes * 60_000);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
