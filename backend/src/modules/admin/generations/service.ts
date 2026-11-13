import type { Response } from 'express';
import { env } from '../../../config/env.js';
import { pool, query, queryOne } from '../../../db/pool.js';
import { withTx } from '../../../db/tx.js';
import { csvRow } from '../../../lib/csv.js';
import { notFound } from '../../../lib/errors.js';
import { assetUrl } from '../../../storage/urls.js';
import { recordAudit } from '../auditLog.js';
import { offsetOf, Where, type AdminCtx } from '../common.js';
import type { GenerationFilters } from './schemas.js';

/** Hard cap for one CSV export; narrow the filters to export more. */
export const EXPORT_MAX_ROWS = 100_000;
const EXPORT_BATCH = 500;

// NOTE for maintainers: none of these queries may select slot_values, remarks, reference_inputs,
// final_prompt_*, or any analysis text. The admin log is about operations, not user content.
const LIST_COLUMNS = `
  SELECT g.id, g.user_id, u.name AS user_name, u.email AS user_email, g.template_id, t.slug AS template_slug, t.name AS template_name,
         g.mode, g.subject, g.publication, g.status, g.progress_step, g.used_reference_image, g.reference_count_used,
         g.composited_text, g.degraded, g.error_code, g.total_cost_usd::text AS total_cost_usd, g.duration_ms,
         g.model_vision_id, mv.name AS model_vision_name, g.model_image_id, mi.name AS model_image_name,
         g.flagged_at, g.created_at
    FROM generations g
    JOIN users u ON u.id = g.user_id
    LEFT JOIN templates t ON t.id = g.template_id
    LEFT JOIN model_configs mv ON mv.id = g.model_vision_id
    LEFT JOIN model_configs mi ON mi.id = g.model_image_id`;

interface ListRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  template_id: string | null;
  template_slug: string | null;
  template_name: string | null;
  mode: string;
  subject: string;
  publication: string;
  status: string;
  progress_step: string | null;
  used_reference_image: boolean;
  reference_count_used: number;
  composited_text: boolean;
  degraded: boolean;
  error_code: string | null;
  total_cost_usd: string;
  duration_ms: number | null;
  model_vision_id: string | null;
  model_vision_name: string | null;
  model_image_id: string | null;
  model_image_name: string | null;
  flagged_at: Date | null;
  created_at: Date;
}

const toListDTO = (g: ListRow) => ({
  id: g.id,
  status: g.status,
  progress_step: g.progress_step,
  user: { id: g.user_id, name: g.user_name, email: g.user_email },
  template: g.template_id ? { id: g.template_id, slug: g.template_slug, name: g.template_name } : null,
  mode: g.mode,
  subject: g.subject,
  publication: g.publication,
  used_reference_image: g.used_reference_image,
  reference_count_used: g.reference_count_used,
  composited_text: g.composited_text,
  degraded: g.degraded,
  error_code: g.error_code,
  total_cost_usd: Number(g.total_cost_usd),
  duration_ms: g.duration_ms,
  models: {
    vision: g.model_vision_id ? { id: g.model_vision_id, name: g.model_vision_name } : null,
    image: g.model_image_id ? { id: g.model_image_id, name: g.model_image_name } : null,
  },
  flagged: g.flagged_at !== null,
  created_at: g.created_at,
});

function buildWhere(f: GenerationFilters): Where {
  const where = new Where();
  if (f.status) where.add((p) => `g.status = ${p}`, f.status);
  if (f.user) where.add((p) => `g.user_id = ${p}`, f.user);
  if (f.template) where.add((p) => `g.template_id = ${p}`, f.template);
  if (f.model) where.add((p) => `(g.model_vision_id = ${p} OR g.model_image_id = ${p})`, f.model);
  if (f.mode) where.add((p) => `g.mode = ${p}`, f.mode);
  if (f.degraded !== undefined) where.add((p) => `g.degraded = ${p}`, f.degraded);
  if (f.flagged !== undefined) where.raw(f.flagged ? 'g.flagged_at IS NOT NULL' : 'g.flagged_at IS NULL');
  if (f.from) {
    const tz = where.param(env.APP_TIMEZONE);
    where.add((p) => `g.created_at >= (${p}::date::timestamp AT TIME ZONE ${tz})`, f.from);
  }
  if (f.to) {
    const tz = where.param(env.APP_TIMEZONE);
    where.add((p) => `g.created_at < ((${p}::date + 1)::timestamp AT TIME ZONE ${tz})`, f.to);
  }
  return where;
}

export async function listGenerations(f: GenerationFilters & { page: number; limit: number }) {
  const where = buildWhere(f);
  const total = (await queryOne<{ n: number }>(`SELECT count(*) AS n FROM generations g ${where.sql}`, where.params))?.n ?? 0;
  const limitP = where.next();
  const offsetP = `$${where.params.length + 2}`;
  const rows = await query<ListRow>(`${LIST_COLUMNS} ${where.sql} ORDER BY g.created_at DESC, g.id DESC LIMIT ${limitP} OFFSET ${offsetP}`, [
    ...where.params,
    f.limit,
    offsetOf(f),
  ]);
  return { items: rows.map(toListDTO), total };
}

interface DetailRow extends ListRow {
  consent_confirmed: boolean;
  flag_note: string | null;
  flagged_by: string | null;
  archived_at: Date | null;
  purged_at: Date | null;
  deleted_at: Date | null;
  reference_roles: string[] | null;
  result_key: string | null;
  thumbnail_key: string | null;
  result_width: number | null;
  result_height: number | null;
  updated_at: Date;
}

interface EventRow {
  id: string;
  stage: string;
  status: string;
  duration_ms: number | null;
  cost_usd: string;
  model_config_id: string | null;
  model_name: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: Date;
}

/** Stage messages are sanitised when written; this is defence in depth against anything long or multi-line. */
const cleanMessage = (m: string | null): string | null => (m === null ? null : m.replace(/\s+/g, ' ').trim().slice(0, 300));

export async function getGeneration(id: string) {
  const g = await queryOne<DetailRow>(
    `SELECT g.id, g.user_id, u.name AS user_name, u.email AS user_email, g.template_id, t.slug AS template_slug, t.name AS template_name,
            g.mode, g.subject, g.publication, g.status, g.progress_step, g.used_reference_image, g.reference_count_used,
            g.composited_text, g.degraded, g.error_code, g.total_cost_usd::text AS total_cost_usd, g.duration_ms,
            g.model_vision_id, mv.name AS model_vision_name, g.model_image_id, mi.name AS model_image_name,
            g.flagged_at, g.created_at, g.updated_at, g.consent_confirmed, g.flag_note, g.flagged_by, g.archived_at, g.purged_at, g.deleted_at,
            (SELECT array_agg(r->>'role') FROM jsonb_array_elements(g.reference_inputs) r) AS reference_roles,
            ra.storage_key AS result_key, ta.storage_key AS thumbnail_key, ra.width AS result_width, ra.height AS result_height
       FROM generations g
       JOIN users u ON u.id = g.user_id
       LEFT JOIN templates t ON t.id = g.template_id
       LEFT JOIN model_configs mv ON mv.id = g.model_vision_id
       LEFT JOIN model_configs mi ON mi.id = g.model_image_id
       LEFT JOIN assets ra ON ra.id = g.result_asset_id AND ra.deleted_at IS NULL
       LEFT JOIN assets ta ON ta.id = g.thumbnail_asset_id AND ta.deleted_at IS NULL
      WHERE g.id = $1`,
    [id],
  );
  if (!g) throw notFound('Pembuatan gambar');
  const events = await query<EventRow>(
    `SELECT e.id, e.stage, e.status, e.duration_ms, e.cost_usd::text AS cost_usd, e.model_config_id, m.name AS model_name,
            e.error_code, e.error_message, e.created_at
       FROM generation_events e LEFT JOIN model_configs m ON m.id = e.model_config_id
      WHERE e.generation_id = $1 ORDER BY e.created_at, e.id`,
    [id],
  );
  const done = g.status === 'done';
  return {
    ...toListDTO(g),
    consent_confirmed: g.consent_confirmed,
    reference_roles: g.reference_roles ?? [],
    flag_note: g.flag_note,
    flagged_at: g.flagged_at,
    archived: g.archived_at !== null,
    purged: g.purged_at !== null,
    deleted_by_user: g.deleted_at !== null,
    result_url: done ? assetUrl(g.result_key) : null,
    thumbnail_url: done ? assetUrl(g.thumbnail_key) : null,
    width: done ? g.result_width : null,
    height: done ? g.result_height : null,
    updated_at: g.updated_at,
    timeline: events.map((e) => ({
      stage: e.stage,
      status: e.status,
      duration_ms: e.duration_ms,
      cost_usd: Number(e.cost_usd),
      model: e.model_config_id ? { id: e.model_config_id, name: e.model_name } : null,
      error_code: e.error_code,
      error_message: cleanMessage(e.error_message),
      at: e.created_at,
    })),
  };
}

export async function flagGeneration(ctx: AdminCtx, id: string, input: { flagged: boolean; note?: string }) {
  await withTx(async (client) => {
    const before = await queryOne<{ flagged_at: Date | null }>('SELECT flagged_at FROM generations WHERE id = $1 FOR UPDATE', [id], client);
    if (!before) throw notFound('Pembuatan gambar');
    const note = input.flagged && input.note ? input.note : null;
    if (input.flagged) {
      await client.query('UPDATE generations SET flagged_at = COALESCE(flagged_at, now()), flagged_by = $2, flag_note = $3 WHERE id = $1', [id, ctx.actorId, note]);
    } else {
      await client.query('UPDATE generations SET flagged_at = NULL, flagged_by = NULL, flag_note = NULL WHERE id = $1', [id]);
    }
    await recordAudit(
      ctx,
      {
        action: 'generation.flag',
        entity: 'generation',
        entityId: id,
        diff: { flagged: { from: before.flagged_at !== null, to: input.flagged }, note_provided: note !== null },
      },
      client,
    );
  });
  return getGeneration(id);
}

// --- CSV export -----------------------------------------------------------------------------

export const CSV_COLUMNS = [
  'id', 'created_at', 'user_id', 'template_slug', 'mode', 'subject', 'publication', 'status', 'progress_step', 'error_code',
  'degraded', 'used_reference_image', 'reference_count_used', 'composited_text', 'total_cost_usd', 'duration_ms',
  'model_vision', 'model_image', 'flagged',
] as const;

const toCsvCells = (g: ListRow): unknown[] => [
  g.id, g.created_at, g.user_id, g.template_slug, g.mode, g.subject, g.publication, g.status, g.progress_step, g.error_code,
  g.degraded, g.used_reference_image, g.reference_count_used, g.composited_text, g.total_cost_usd, g.duration_ms,
  g.model_vision_name, g.model_image_name, g.flagged_at !== null,
];

/**
 * Streams the filtered log as CSV. Rows come from a read-only repeatable-read cursor in batches, so memory
 * stays flat and the export is a consistent snapshot. Columns exclude prompts, remarks and slot values,
 * and every cell is formula-injection guarded (see lib/csv.ts).
 */
export async function streamGenerationsCsv(ctx: AdminCtx, f: GenerationFilters, res: Response): Promise<void> {
  const where = buildWhere(f);
  const client = await pool.connect();
  let rows = 0;
  let audited = false;
  // Written before the response ends, so the row exists by the time the client sees the last byte.
  const audit = async () => {
    if (audited) return;
    audited = true;
    await recordAudit(ctx, {
      action: 'generation.export',
      entity: 'generation',
      entityId: null,
      diff: { rows, truncated: rows >= EXPORT_MAX_ROWS, filters: f as Record<string, unknown> },
    }).catch(() => undefined);
  };
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query(`DECLARE gen_export NO SCROLL CURSOR FOR ${LIST_COLUMNS} ${where.sql} ORDER BY g.created_at ASC, g.id ASC`, where.params);

    // Fetch the first batch before sending headers so a database error is still a normal JSON error response.
    let batch = (await client.query<ListRow>(`FETCH ${EXPORT_BATCH} FROM gen_export`)).rows;
    const stamp = new Date().toISOString().slice(0, 10);
    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="generations-${stamp}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.write(csvRow(CSV_COLUMNS));

    while (batch.length > 0 && rows < EXPORT_MAX_ROWS && !res.destroyed) {
      let chunk = '';
      for (const g of batch) {
        if (rows >= EXPORT_MAX_ROWS) break;
        chunk += csvRow(toCsvCells(g));
        rows += 1;
      }
      if (!res.write(chunk)) await new Promise<void>((resolve) => { res.once('drain', resolve); res.once('close', resolve); });
      batch = (await client.query<ListRow>(`FETCH ${EXPORT_BATCH} FROM gen_export`)).rows;
    }
    await audit();
    res.end();
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
    await audit();
  }
}
