import { pool, type Queryable } from '../../db/pool.js';
import type { AdminCtx } from './common.js';

/**
 * Field NAMES that may never appear in an audit diff, whatever the caller passes. This is a second
 * line of defence behind the per-entity allowlists: passwords and hashes, tokens, key material,
 * ciphertext, core prompt bodies and final prompts.
 */
const SECRET_KEY = /pass(word)?|hash|token|secret|cipher|auth_?tag|^iv$|(^|_)body(_|$)|final_prompt|(^|_)api_?key$|credential|authorization|cookie/i;
const MAX_STRING = 200;
const MAX_DEPTH = 4;

export type AuditDiff = Record<string, unknown>;

function normalise(value: unknown, depth = 0): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}...` : value;
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Buffer.isBuffer(value)) return '[binary]';
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => normalise(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!SECRET_KEY.test(k)) out[k] = normalise(v, depth + 1);
    }
    return out;
  }
  return null;
}

/** Recursively drops secret-looking keys and truncates long strings. Used on write and on read. */
export function scrubDiff(diff: unknown): AuditDiff {
  const out = normalise(diff);
  return out && typeof out === 'object' && !Array.isArray(out) ? (out as AuditDiff) : {};
}

/**
 * Builds `{ changed: { field: { from, to } } }` for the ALLOWLISTED fields whose value differs.
 * `before` null means creation. Fields outside `allow` are never read, so a column added to a table
 * later cannot leak into the audit log by accident. `context` carries extra non-secret facts.
 */
export function buildDiff(
  allow: readonly string[],
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  context: Record<string, unknown> = {},
): AuditDiff {
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of allow) {
    const from = normalise(before?.[field]);
    const to = normalise(after?.[field]);
    if (JSON.stringify(from) !== JSON.stringify(to)) changed[field] = { from, to };
  }
  return scrubDiff({ ...context, changed });
}

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  diff?: AuditDiff;
}

/** Writes one audit row. Pass the transaction client so the row commits atomically with the change. */
export async function recordAudit(ctx: AdminCtx, entry: AuditEntry, db: Queryable = pool): Promise<void> {
  await db.query('INSERT INTO audit_logs (actor_id, action, entity, entity_id, diff, ip) VALUES ($1, $2, $3, $4, $5::jsonb, $6)', [
    ctx.actorId,
    entry.action,
    entry.entity,
    entry.entityId ?? null,
    JSON.stringify(scrubDiff(entry.diff ?? {})),
    ctx.ip,
  ]);
}
