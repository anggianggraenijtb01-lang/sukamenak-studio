import { pool, query, queryOne, type Queryable } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { getStorage } from './index.js';
import { newStorageKey } from './keys.js';

export type AssetKind = 'reference' | 'result' | 'thumbnail' | 'preview' | 'gallery' | 'logo' | 'video' | 'other';

export interface AssetRecord {
  id: string;
  storage_key: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  owner_id: string | null;
  kind: AssetKind;
  created_at: Date;
}

const COLUMNS = 'id, storage_key, mime, bytes, width, height, owner_id, kind, created_at';

export interface CreateAssetInput {
  buffer: Buffer;
  mime: string;
  kind: AssetKind;
  ownerId: string | null;
  /** Key prefix, for example `refs` or `results`. */
  prefix: string;
  width?: number | null;
  height?: number | null;
}

/** Writes the file first, then the row; the file is removed again when the insert fails. */
export async function createAsset(input: CreateAssetInput, db: Queryable = pool): Promise<AssetRecord> {
  const storage = getStorage();
  const key = newStorageKey(input.prefix, input.mime);
  await storage.put(key, input.buffer, input.mime);
  try {
    const row = await queryOne<AssetRecord>(
      `INSERT INTO assets (storage_key, mime, bytes, width, height, owner_id, kind)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNS}`,
      [key, input.mime, input.buffer.length, input.width ?? null, input.height ?? null, input.ownerId, input.kind],
      db,
    );
    return row as AssetRecord;
  } catch (err) {
    await storage.delete(key).catch(() => undefined);
    throw err;
  }
}

export const getAsset = (id: string, db: Queryable = pool): Promise<AssetRecord | null> =>
  queryOne<AssetRecord>(`SELECT ${COLUMNS} FROM assets WHERE id = $1 AND deleted_at IS NULL`, [id], db);

/** Seed and preview files are managed by the seed script and are never deleted by user flows or retention. */
const isManagedKey = (key: string): boolean => key.startsWith('seed/');

async function removeFiles(rows: { id: string; storage_key: string }[], db: Queryable): Promise<void> {
  const storage = getStorage();
  const removed: string[] = [];
  for (const row of rows) {
    if (isManagedKey(row.storage_key)) continue;
    try {
      await storage.delete(row.storage_key);
      removed.push(row.id);
    } catch {
      logger.warn({ asset_id: row.id }, 'asset file could not be removed; retention will retry');
    }
  }
  if (removed.length > 0) await db.query('UPDATE assets SET file_deleted_at = now() WHERE id = ANY($1::uuid[])', [removed]);
}

/**
 * Soft-deletes the rows, then removes the stored files. Files that could not be removed keep
 * `file_deleted_at` NULL and are retried by the retention job.
 */
export async function softDeleteAssets(ids: (string | null | undefined)[], db: Queryable = pool): Promise<number> {
  const list = ids.filter((id): id is string => Boolean(id));
  if (list.length === 0) return 0;
  const rows = await query<{ id: string; storage_key: string }>(
    'UPDATE assets SET deleted_at = COALESCE(deleted_at, now()) WHERE id = ANY($1::uuid[]) RETURNING id, storage_key',
    [list],
    db,
  );
  await removeFiles(rows, db);
  return rows.length;
}

/** Removes files of soft-deleted assets that still have one on disk or in the bucket (retention job). */
export async function purgeDeletedAssetFiles(limit = 500, db: Queryable = pool): Promise<number> {
  const rows = await query<{ id: string; storage_key: string }>(
    `SELECT id, storage_key FROM assets
      WHERE deleted_at IS NOT NULL AND file_deleted_at IS NULL AND storage_key NOT LIKE 'seed/%'
      ORDER BY deleted_at LIMIT $1`,
    [limit],
    db,
  );
  await removeFiles(rows, db);
  return rows.length;
}
