import { env } from '../config/env.js';
import { query, queryOne } from '../db/pool.js';
import { withTx } from '../db/tx.js';
import { AppError, notFound } from '../lib/errors.js';
import { getSettings } from '../modules/shared/settings.js';
import { softDeleteAssets } from '../storage/assets.js';
import { VIDEO_JOB_SELECT, toVideoJobDTO, type VideoJobRow } from './dto.js';
import { buildVideoJobProps, type ZoneRow } from './props.js';
import { getVideoQueue } from './queue.js';

/** Columns needed to answer "does this job belong to the caller?" without selecting `props`. */
const VIDEO_JOB_SELECT_WITH_OWNER = VIDEO_JOB_SELECT.replace('SELECT v.id,', 'SELECT v.user_id, v.id,');

/** Daily renders per creator. 0 disables the feature for everyone (the admin panel keeps working). */
export interface VideoQuota {
  limit: number;
  used: number;
}

export const DEFAULT_VIDEO_DURATION = 15;

/**
 * The lower bound lives here so the route schema cannot disagree with the service; the upper bound is
 * the deploy-time `VIDEO_MAX_DURATION_SECONDS` and is checked below.
 */
export const MIN_VIDEO_DURATION = 3;

const invalid = (field: string, message: string) =>
  new AppError('VALIDATION_ERROR', message, { errors: [{ field, message }] });

const assertEnabled = (): void => {
  if (!env.VIDEO_ENABLED) throw new AppError('VIDEO_DISABLED', 'Pembuatan video sedang dinonaktifkan');
};

/** Today's renders for one user, counted like `usage_counters`: only successful ones use up quota. */
export async function getVideoQuota(userId: string): Promise<VideoQuota> {
  const used =
    (
      await queryOne<{ n: number }>(
        `SELECT count(*)::int AS n FROM video_jobs
          WHERE user_id = $1 AND deleted_at IS NULL AND status IN ('queued', 'rendering', 'done')
            AND created_at >= date_trunc('day', now())`,
        [userId],
      )
    )?.n ?? 0;
  return { limit: env.VIDEO_DAILY_LIMIT, used };
}

interface GenerationRow {
  id: string;
  user_id: string;
  status: string;
  composited_text: boolean;
  slot_values: Record<string, string> | null;
  template_id: string | null;
  result_key: string | null;
}

/**
 * Starts a render for one of the caller's own finished posters. Eligibility is deliberately narrow:
 * the generation must be `done` and already carry composited text, because the reel reuses the exact
 * poster the creator approved. The unique index on video_jobs is what actually prevents a double
 * enqueue; the check here is only for a clean error message.
 */
export async function createVideoJob(
  userId: string,
  generationId: string,
  opts: { durationSeconds?: number } = {},
): Promise<{ id: string; status: string }> {
  assertEnabled();

  const gen = await queryOne<GenerationRow>(
    `SELECT g.id, g.user_id, g.status, g.composited_text, g.slot_values, g.template_id,
            a.storage_key AS result_key
       FROM generations g
       LEFT JOIN assets a ON a.id = g.result_asset_id AND a.deleted_at IS NULL
      WHERE g.id = $1 AND g.deleted_at IS NULL`,
    [generationId],
  );
  // Someone else's generation is a 404, never a 403 (same rule as GET /generations/:id).
  if (!gen || gen.user_id !== userId) throw notFound('Pembuatan gambar');
  if (gen.status !== 'done') throw new AppError('VIDEO_NOT_ELIGIBLE', 'Video hanya bisa dibuat dari pembuatan gambar yang sudah selesai');
  if (!gen.composited_text) throw new AppError('VIDEO_NOT_ELIGIBLE', 'Pembuatan gambar ini tidak memiliki teks yang bisa dianimasikan');
  if (!gen.result_key) throw new AppError('VIDEO_NOT_ELIGIBLE', 'Hasil gambar tidak tersedia');

  const duration = opts.durationSeconds ?? DEFAULT_VIDEO_DURATION;
  if (duration > env.VIDEO_MAX_DURATION_SECONDS) {
    throw invalid('duration_seconds', `Durasi maksimal ${env.VIDEO_MAX_DURATION_SECONDS} detik`);
  }
  if (duration < MIN_VIDEO_DURATION) {
    throw invalid('duration_seconds', `Durasi minimal ${MIN_VIDEO_DURATION} detik`);
  }

  const zones = gen.template_id
    ? await query<ZoneRow>(
        `SELECT slot_key, x, y, w, h, align, font_weight, font_size_ratio, color, max_lines
           FROM text_zones WHERE template_id = $1 ORDER BY slot_key`,
        [gen.template_id],
      )
    : [];
  if (zones.length === 0) throw new AppError('VIDEO_NOT_ELIGIBLE', 'Template tidak memiliki zona teks untuk dianimasikan');

  const settings = await getSettings();
  const brand = await queryOne<{ name: string; palette: unknown }>(
    'SELECT name, palette FROM brand_identities WHERE is_default ORDER BY created_at LIMIT 1',
  );
  const palette = Array.isArray(brand?.palette) ? (brand.palette as unknown[]).filter((c): c is string => typeof c === 'string') : [];

  const props = buildVideoJobProps({
    posterKey: gen.result_key,
    zones,
    values: gen.slot_values ?? {},
    palette,
    durationSeconds: duration,
    watermark: settings.watermark_enabled,
    brandName: brand?.name ?? 'Sukamenak Studio',
  });

  const id = await withTx(async (client) => {
    // Serialise per user so two clicks cannot both pass the quota check.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`video:${userId}`]);

    const running = await client.query<{ id: string; status: string }>(
      `SELECT id, status FROM video_jobs
        WHERE generation_id = $1 AND status IN ('queued', 'rendering') AND deleted_at IS NULL`,
      [generationId],
    );
    if (running.rows[0]) throw new AppError('VIDEO_ALREADY_RUNNING', 'Video untuk gambar ini sedang dibuat');

    const used =
      (
        await client.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM video_jobs
            WHERE user_id = $1 AND deleted_at IS NULL AND status IN ('queued', 'rendering', 'done')
              AND created_at >= date_trunc('day', now())`,
          [userId],
        )
      ).rows[0]?.n ?? 0;
    if (used >= env.VIDEO_DAILY_LIMIT) {
      throw new AppError('VIDEO_DAILY_LIMIT_REACHED', `Batas ${env.VIDEO_DAILY_LIMIT} video per hari tercapai. Coba lagi besok.`);
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO video_jobs (generation_id, user_id, props, duration_seconds)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [generationId, userId, JSON.stringify(props), duration],
    );
    return (inserted.rows[0] as { id: string }).id;
  });

  await getVideoQueue().enqueue(id);
  return { id, status: 'queued' };
}

export async function getMyVideoJob(userId: string, id: string): Promise<ReturnType<typeof toVideoJobDTO>> {
  const row = await queryOne<VideoJobRow & { user_id: string }>(
    `${VIDEO_JOB_SELECT_WITH_OWNER} WHERE v.id = $1 AND v.deleted_at IS NULL`,
    [id],
  );
  if (!row || row.user_id !== userId) throw notFound('Video');
  return toVideoJobDTO(row);
}

export async function listMyVideoJobs(userId: string, q: { page: number; limit: number; generation_id?: string }) {
  const params: unknown[] = [userId];
  let where = 'v.user_id = $1 AND v.deleted_at IS NULL';
  if (q.generation_id) {
    params.push(q.generation_id);
    where += ` AND v.generation_id = $${params.length}`;
  }
  const total =
    (await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM video_jobs v WHERE ${where}`, params))?.n ?? 0;
  const rows = await query<VideoJobRow>(
    `${VIDEO_JOB_SELECT} WHERE ${where} ORDER BY v.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, q.limit, (q.page - 1) * q.limit],
  );
  return { items: rows.map(toVideoJobDTO), total };
}

/**
 * Soft-deletes the job and frees its file. A job that is still queued or rendering is refused: deleting
 * it would drop it from the daily quota and from the one-active-render-per-poster index while the
 * render keeps using the CPU, so a creator could stack renders by deleting and re-creating.
 */
export async function deleteMyVideoJob(userId: string, id: string): Promise<void> {
  const row = await queryOne<{ id: string; status: string; result_asset_id: string | null }>(
    'SELECT id, status, result_asset_id FROM video_jobs WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
    [id, userId],
  );
  if (!row) throw notFound('Video');
  if (row.status === 'queued' || row.status === 'rendering') {
    throw new AppError('VIDEO_STILL_RENDERING', 'Video masih dibuat. Tunggu sampai selesai sebelum menghapusnya');
  }
  await query('UPDATE video_jobs SET deleted_at = now() WHERE id = $1', [id]);
  if (row.result_asset_id) {
    await softDeleteAssets([row.result_asset_id]).catch(() => undefined);
  }
}
