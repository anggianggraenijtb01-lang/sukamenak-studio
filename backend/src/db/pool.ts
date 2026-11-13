import pg from 'pg';
import { env } from '../config/env.js';

// Return `bigint` columns (COUNT) as JS numbers; our counts never approach 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
// Return `date` columns as plain YYYY-MM-DD strings instead of timezone-shifted Dates.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.isTest ? 5 : 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', () => {
  // Idle-client errors (for example the server restarting) must not crash the process;
  // the next query will surface a real failure to the caller.
});

export type Queryable = Pick<pg.Pool, 'query'> | Pick<pg.PoolClient, 'query'>;

export async function query<R extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Queryable = pool,
): Promise<R[]> {
  const res = await db.query<R>(text, params);
  return res.rows;
}

export async function queryOne<R extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Queryable = pool,
): Promise<R | null> {
  const rows = await query<R>(text, params, db);
  return rows[0] ?? null;
}

export async function closePool(): Promise<void> {
  await pool.end();
}
