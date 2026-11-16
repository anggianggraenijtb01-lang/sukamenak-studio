import { env } from '../../config/env.js';
import { query, queryOne, type Queryable, pool } from '../../db/pool.js';
import { getSettings } from '../shared/settings.js';

export interface UsageSummary {
  /** Local calendar date (APP_TIMEZONE) the counters refer to. */
  date: string;
  daily_limit: number;
  used_today: number;
  in_flight: number;
  remaining_today: number;
}

/**
 * Daily generation allowance. `remaining = limit - successes today - jobs in flight`, the same rule
 * Phase B enforces when enqueueing, so the number shown to the user matches what the API will accept.
 */
export async function getUsage(userId: string, db: Queryable = pool): Promise<UsageSummary> {
  // Sequential on purpose: `db` may be a single transaction client, which must not run queries concurrently.
  const settings = await getSettings();
  const user = await queryOne<{ daily_limit_override: number | null }>('SELECT daily_limit_override FROM users WHERE id = $1', [userId], db);
  const counter = await queryOne<{ success_count: number }>(
    'SELECT success_count FROM usage_counters WHERE user_id = $1 AND date = (now() AT TIME ZONE $2)::date',
    [userId, env.APP_TIMEZONE],
    db,
  );
  const flight = await queryOne<{ n: number }>(
    `SELECT count(*) AS n FROM generations
      WHERE user_id = $1 AND status IN ('queued', 'running') AND deleted_at IS NULL`,
    [userId],
    db,
  );
  const today = await query<{ d: string }>('SELECT (now() AT TIME ZONE $1)::date AS d', [env.APP_TIMEZONE], db);

  const limit = user?.daily_limit_override ?? settings.default_daily_limit;
  const used = counter?.success_count ?? 0;
  const inFlight = flight?.n ?? 0;
  return {
    date: today[0]?.d ?? '',
    daily_limit: limit,
    used_today: used,
    in_flight: inFlight,
    remaining_today: Math.max(0, limit - used - inFlight),
  };
}
