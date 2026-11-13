import { env } from '../config/env.js';
import { query, queryOne } from '../db/pool.js';
import { withTx } from '../db/tx.js';
import { logger } from '../lib/logger.js';
import { softDeleteAssets } from '../storage/assets.js';
import {
  GENERATION_COLUMNS,
  loadSharedContext,
  loadTemplateData,
  type GenerationRow,
  type PipelineContext,
} from './context.js';
import { JobTimeoutError, PipelineError, TransientJobError, describeFailure } from './errors.js';
import { finishStage, startStage, type EventStatus, type Stage } from './events.js';
import { loadReferences, runAnalysis, type LoadedReference } from './stages/analysis.js';
import { runCompose } from './stages/compose.js';
import { runComposite } from './stages/composite.js';
import { runGenerate } from './stages/generate.js';

export interface RunOptions {
  /** 1-based attempt number of this run (BullMQ passes attemptsMade + 1). */
  attempt?: number;
  /** Total attempts allowed. A transient provider failure rethrows as TransientJobError while attempts remain. */
  maxAttempts?: number;
  timeoutMs?: number;
}

export type RunResult = 'done' | 'failed' | 'skipped';

interface StageOutcome<T> {
  value: T;
  status?: Exclude<EventStatus, 'started' | 'failed'>;
  costUsd?: number;
  modelConfigId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

async function stage<T>(ctx: PipelineContext, timedOut: () => boolean, name: Stage, fn: () => Promise<StageOutcome<T>>): Promise<T> {
  if (ctx.signal.aborted) throw new JobTimeoutError();
  const eventId = await startStage(ctx.gen.id, name);
  const startedAt = Date.now();
  try {
    const outcome = await fn();
    const durationMs = Date.now() - startedAt;
    const status = outcome.status ?? 'ok';
    await finishStage(eventId, {
      status,
      durationMs,
      costUsd: outcome.costUsd,
      modelConfigId: outcome.modelConfigId,
      errorCode: outcome.errorCode,
      errorMessage: outcome.errorMessage,
    });
    logger.info({ generation_id: ctx.gen.id, stage: name, status, duration_ms: durationMs }, 'generation stage finished');
    return outcome.value;
  } catch (err) {
    const info = describeFailure(err, timedOut());
    await finishStage(eventId, {
      status: 'failed',
      durationMs: Date.now() - startedAt,
      errorCode: info.code,
      errorMessage: info.message,
    }).catch(() => undefined);
    throw err;
  }
}

/**
 * Runs one generation end to end: analysis -> compose -> generate -> composite -> done. Every stage
 * writes a `generation_events` row and updates `progress_step`. Failures are recorded on the row
 * (`status=failed`, `error_code`) and never increment the daily counter; a transient provider
 * failure with attempts left throws TransientJobError so the queue retries.
 */
export async function runGeneration(generationId: string, opts: RunOptions = {}): Promise<RunResult> {
  const attempt = opts.attempt ?? 1;
  const maxAttempts = opts.maxAttempts ?? 1;
  const startedAt = Date.now();

  const gen = await queryOne<GenerationRow>(
    `UPDATE generations SET status = 'running', error_code = NULL
      WHERE id = $1 AND status IN ('queued', 'running') AND deleted_at IS NULL
      RETURNING ${GENERATION_COLUMNS}`,
    [generationId],
  );
  if (!gen) {
    logger.info({ generation_id: generationId }, 'generation skipped (not runnable)');
    return 'skipped';
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? env.JOB_TIMEOUT_MS);
  timer.unref();

  const created: string[] = [];
  try {
    const template = gen.template_id ? await loadTemplateData(gen.template_id) : null;
    if (!template) throw new PipelineError('TEMPLATE_UNAVAILABLE', 'Template sudah tidak tersedia');
    const ctx: PipelineContext = {
      gen,
      template,
      ...(await loadSharedContext()),
      signal: controller.signal,
      modelVisionId: null,
      modelImageId: null,
      degraded: false,
    };

    let references: LoadedReference[] = [];
    const analysis = await stage(ctx, () => timedOut, 'analysis', async () => {
      references = gen.mode === 'i2i' ? await loadReferences(gen.user_id, gen.reference_inputs) : [];
      if (references.length === 0) return { value: {} as Record<string, string> };
      const out = await runAnalysis(ctx, references);
      ctx.modelVisionId = out.modelConfigId;
      ctx.degraded = out.degraded;
      if (out.degraded) await query('UPDATE generations SET degraded = true WHERE id = $1', [gen.id]);
      if (out.modelConfigId) await query('UPDATE generations SET model_vision_id = $2 WHERE id = $1', [gen.id, out.modelConfigId]);
      return {
        value: out.analysis,
        status: out.degraded ? 'degraded' : 'ok',
        costUsd: out.costUsd,
        modelConfigId: out.modelConfigId,
        errorCode: out.failureCode,
        errorMessage: out.degraded ? 'Analisis referensi gagal sebagian; nilai bawaan slot dipakai' : null,
      };
    });

    const { prompt } = await stage(ctx, () => timedOut, 'compose', async () => ({ value: await runCompose(ctx, analysis) }));

    const generated = await stage(ctx, () => timedOut, 'generate', async () => {
      const out = await runGenerate(ctx, prompt, references);
      return { value: out, costUsd: out.costUsd, modelConfigId: out.modelConfigId };
    });

    const composed = await stage(ctx, () => timedOut, 'composite', async () => {
      const out = await runComposite(ctx, generated.image);
      created.push(out.result.id, out.thumbnail.id);
      return { value: out };
    });

    const finished = await withTx(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `UPDATE generations
            SET status = 'done', progress_step = 'done', error_code = NULL, duration_ms = $2,
                total_cost_usd = (SELECT COALESCE(sum(cost_usd), 0) FROM generation_events WHERE generation_id = $1)
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id`,
        [gen.id, Date.now() - startedAt],
      );
      if (rows.length === 0) return false;
      await client.query(
        `INSERT INTO usage_counters (user_id, date, success_count)
         VALUES ($1, (now() AT TIME ZONE $2)::date, 1)
         ON CONFLICT (user_id, date) DO UPDATE SET success_count = usage_counters.success_count + 1, updated_at = now()`,
        [gen.user_id, env.APP_TIMEZONE],
      );
      return true;
    });
    if (!finished) {
      // The creator deleted the generation while it was running: drop what was just produced.
      await softDeleteAssets([composed.result.id, composed.thumbnail.id]);
      return 'skipped';
    }
    logger.info({ generation_id: gen.id, duration_ms: Date.now() - startedAt }, 'generation done');
    return 'done';
  } catch (err) {
    const info = describeFailure(err, timedOut);
    if (info.unexpected) // Name and driver code only: error messages can quote data, and nothing prompt-related may reach the logs.
      logger.error({ generation_id: gen.id, err_name: (err as Error)?.name, err_code: (err as { code?: unknown })?.code }, 'generation failed unexpectedly');
    if (created.length > 0) await softDeleteAssets(created).catch(() => undefined);

    if (info.transient && attempt < maxAttempts) {
      await query(`UPDATE generations SET status = 'queued', progress_step = NULL WHERE id = $1 AND status = 'running'`, [gen.id]);
      logger.warn({ generation_id: gen.id, code: info.code, attempt, max_attempts: maxAttempts }, 'generation will be retried');
      throw new TransientJobError(info.code);
    }

    await query(
      `UPDATE generations
          SET status = 'failed', error_code = $2, duration_ms = $3,
              total_cost_usd = (SELECT COALESCE(sum(cost_usd), 0) FROM generation_events WHERE generation_id = $1)
        WHERE id = $1`,
      [gen.id, info.code, Date.now() - startedAt],
    );
    logger.warn({ generation_id: gen.id, code: info.code }, 'generation failed');
    return 'failed';
  } finally {
    clearTimeout(timer);
  }
}
