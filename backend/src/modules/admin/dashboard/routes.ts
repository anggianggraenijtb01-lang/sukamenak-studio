import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../../config/env.js';
import { query, queryOne } from '../../../db/pool.js';
import { ok } from '../../../lib/response.js';
import { getValid, validate } from '../../../middleware/validate.js';

export const dashboardRouter = Router();

const schemas = { query: z.object({ days: z.coerce.number().int().min(1).max(90).default(30) }) };

const rate = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 10_000) / 10_000 : null);
const usd = (value: string | number | null): number => Math.round(Number(value ?? 0) * 1_000_000) / 1_000_000;

/** First instant of the window: local midnight (APP_TIMEZONE) `days - 1` days ago. */
const WINDOW_START = `(((now() AT TIME ZONE $1)::date - ($2::int - 1)) ::timestamp AT TIME ZONE $1)`;

interface TotalsRow {
  total: number;
  done: number;
  failed: number;
  in_progress: number;
  total_cost: string;
  avg_duration_ms: string | null;
  done_with_reference: number;
  degraded: number;
  active_users: number;
}

interface SeriesRow {
  date: string;
  total: number;
  done: number;
  failed: number;
  cost: string;
  avg_duration_ms: string | null;
  active_users: number;
}

dashboardRouter.get('/', validate(schemas), async (req, res) => {
  const { query: q } = getValid(req, schemas);
  const params = [env.APP_TIMEZONE, q.days];

  // Independent aggregates, each one SQL statement over the window.
  const [totals, series, failures, models, counts] = await Promise.all([
    queryOne<TotalsRow>(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE status = 'done') AS done,
              count(*) FILTER (WHERE status = 'failed') AS failed,
              count(*) FILTER (WHERE status IN ('queued', 'running')) AS in_progress,
              COALESCE(sum(total_cost_usd), 0)::text AS total_cost,
              avg(duration_ms) FILTER (WHERE status = 'done') AS avg_duration_ms,
              count(*) FILTER (WHERE status = 'done' AND used_reference_image) AS done_with_reference,
              count(*) FILTER (WHERE degraded) AS degraded,
              count(DISTINCT user_id) AS active_users
         FROM generations WHERE created_at >= ${WINDOW_START}`,
      params,
    ),
    query<SeriesRow>(
      `WITH days AS (
         SELECT generate_series(((now() AT TIME ZONE $1)::date - ($2::int - 1))::timestamp, (now() AT TIME ZONE $1)::date::timestamp, interval '1 day')::date AS d
       )
       SELECT days.d::text AS date,
              count(g.id) AS total,
              count(g.id) FILTER (WHERE g.status = 'done') AS done,
              count(g.id) FILTER (WHERE g.status = 'failed') AS failed,
              COALESCE(sum(g.total_cost_usd), 0)::text AS cost,
              avg(g.duration_ms) FILTER (WHERE g.status = 'done') AS avg_duration_ms,
              count(DISTINCT g.user_id) AS active_users
         FROM days
         LEFT JOIN generations g ON g.created_at >= ${WINDOW_START} AND (g.created_at AT TIME ZONE $1)::date = days.d
        GROUP BY days.d ORDER BY days.d`,
      params,
    ),
    query<{ error_code: string | null; n: number }>(
      `SELECT error_code, count(*) AS n FROM generations
        WHERE status = 'failed' AND created_at >= ${WINDOW_START}
        GROUP BY error_code ORDER BY n DESC, error_code LIMIT 20`,
      params,
    ),
    query<{ capability: string; id: string | null; name: string | null; provider: string | null; model_id: string | null; last_test_at: Date | null; last_test_ok: boolean | null; active_count: number }>(
      `SELECT c.capability, d.id, d.name, d.provider, d.model_id, d.last_test_at, d.last_test_ok,
              (SELECT count(*) FROM model_configs m WHERE m.capability = c.capability AND m.is_active AND m.deleted_at IS NULL) AS active_count
         FROM (VALUES ('vision'), ('text'), ('t2i'), ('i2i')) AS c(capability)
         LEFT JOIN model_configs d ON d.capability = c.capability AND d.is_default AND d.deleted_at IS NULL
        ORDER BY c.capability`,
    ),
    queryOne<{ published_templates: number; published_tutorials: number; active_admins: number; active_creators: number }>(
      `SELECT (SELECT count(*) FROM templates WHERE status = 'published' AND deleted_at IS NULL) AS published_templates,
              (SELECT count(*) FROM tutorials WHERE status = 'published' AND deleted_at IS NULL) AS published_tutorials,
              (SELECT count(*) FROM users WHERE role = 'admin' AND is_active AND deleted_at IS NULL) AS active_admins,
              (SELECT count(*) FROM users WHERE role = 'creator' AND is_active AND deleted_at IS NULL) AS active_creators`,
    ),
  ]);

  const t = totals as TotalsRow;
  const finished = t.done + t.failed;
  ok(
    res,
    {
      window: { days: q.days, timezone: env.APP_TIMEZONE },
      totals: {
        generations: t.total,
        done: t.done,
        failed: t.failed,
        in_progress: t.in_progress,
        success_rate: rate(t.done, finished),
        total_cost_usd: usd(t.total_cost),
        avg_cost_usd: t.total > 0 ? usd(Number(t.total_cost) / t.total) : 0,
        avg_duration_ms: t.avg_duration_ms === null ? null : Math.round(Number(t.avg_duration_ms)),
        used_reference_image_rate: rate(t.done_with_reference, t.done),
        degraded_rate: rate(t.degraded, t.total),
        active_users: t.active_users,
      },
      failures_by_error_code: failures.map((f) => ({ error_code: f.error_code ?? 'UNKNOWN', count: f.n })),
      daily: series.map((d) => ({
        date: d.date,
        generations: d.total,
        done: d.done,
        failed: d.failed,
        success_rate: rate(d.done, d.done + d.failed),
        cost_usd: usd(d.cost),
        avg_duration_ms: d.avg_duration_ms === null ? null : Math.round(Number(d.avg_duration_ms)),
        active_users: d.active_users,
      })),
      models: models.map((m) => ({
        capability: m.capability,
        active_count: m.active_count,
        default: m.id
          ? { id: m.id, name: m.name, provider: m.provider, model_id: m.model_id, last_test_at: m.last_test_at, last_test_ok: m.last_test_ok }
          : null,
      })),
      counts,
    },
    'Ringkasan dashboard',
  );
});
