import { query, queryOne } from '../db/pool.js';

export type Stage = 'analysis' | 'compose' | 'generate' | 'composite';
export type EventStatus = 'started' | 'ok' | 'degraded' | 'failed';

export const STAGES: readonly Stage[] = ['analysis', 'compose', 'generate', 'composite'];

/** Opens a stage: one `generation_events` row (status `started`) that finishStage later completes. */
export async function startStage(generationId: string, stage: Stage): Promise<string> {
  await query('UPDATE generations SET progress_step = $2 WHERE id = $1', [generationId, stage]);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO generation_events (generation_id, stage, status) VALUES ($1, $2, 'started') RETURNING id`,
    [generationId, stage],
  );
  return (row as { id: string }).id;
}

export interface FinishStage {
  status: Exclude<EventStatus, 'started'>;
  durationMs: number;
  costUsd?: number;
  modelConfigId?: string | null;
  errorCode?: string | null;
  /** Must already be sanitised. */
  errorMessage?: string | null;
}

export async function finishStage(eventId: string, f: FinishStage): Promise<void> {
  await query(
    `UPDATE generation_events
        SET status = $2, duration_ms = $3, cost_usd = $4, model_config_id = $5, error_code = $6, error_message = $7
      WHERE id = $1`,
    [eventId, f.status, Math.round(f.durationMs), f.costUsd ?? 0, f.modelConfigId ?? null, f.errorCode ?? null, f.errorMessage ?? null],
  );
}
