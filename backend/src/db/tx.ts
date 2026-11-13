import type { PoolClient } from 'pg';
import { pool } from './pool.js';

/** Runs `fn` inside a transaction; commits on success, rolls back and rethrows on any error. */
export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The original error is the one that matters.
    }
    throw err;
  } finally {
    client.release();
  }
}
