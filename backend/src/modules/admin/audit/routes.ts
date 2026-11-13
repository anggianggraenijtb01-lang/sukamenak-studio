import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../../config/env.js';
import { query, queryOne } from '../../../db/pool.js';
import { ok, pageMeta } from '../../../lib/response.js';
import { getValid, validate } from '../../../middleware/validate.js';
import { scrubDiff } from '../auditLog.js';
import { dateOnly, offsetOf, pageFields, Where } from '../common.js';

/**
 * READ-ONLY. There is deliberately no POST/PATCH/PUT/DELETE here or anywhere else: audit rows are written
 * only by the admin services (inside the transaction of the action they record).
 */
export const auditRouter = Router();

const ident = z.string().trim().max(80).regex(/^[a-z0-9_.:-]+$/i);

const listSchemas = {
  query: z
    .object({
      ...pageFields(30, 100),
      actor: z.string().uuid().optional(),
      action: ident.optional(),
      entity: ident.optional(),
      entity_id: z.string().trim().max(80).optional(),
      from: dateOnly.optional(),
      to: dateOnly.optional(),
    })
    .superRefine((v, ctx) => {
      if (v.from && v.to && v.from > v.to) ctx.addIssue({ code: 'custom', path: ['to'], message: 'Harus sama atau setelah from' });
    }),
};

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  diff: unknown;
  ip: string | null;
  created_at: Date;
}

auditRouter.get('/', validate(listSchemas), async (req, res) => {
  const { query: f } = getValid(req, listSchemas);
  const where = new Where();
  if (f.actor) where.add((p) => `a.actor_id = ${p}`, f.actor);
  if (f.action) where.add((p) => `a.action = ${p}`, f.action);
  if (f.entity) where.add((p) => `a.entity = ${p}`, f.entity);
  if (f.entity_id) where.add((p) => `a.entity_id = ${p}`, f.entity_id);
  if (f.from) {
    const tz = where.param(env.APP_TIMEZONE);
    where.add((p) => `a.created_at >= (${p}::date::timestamp AT TIME ZONE ${tz})`, f.from);
  }
  if (f.to) {
    const tz = where.param(env.APP_TIMEZONE);
    where.add((p) => `a.created_at < ((${p}::date + 1)::timestamp AT TIME ZONE ${tz})`, f.to);
  }

  const total = (await queryOne<{ n: number }>(`SELECT count(*) AS n FROM audit_logs a ${where.sql}`, where.params))?.n ?? 0;
  const limitP = where.next();
  const offsetP = `$${where.params.length + 2}`;
  const rows = await query<AuditRow>(
    `SELECT a.id, a.actor_id, u.name AS actor_name, u.email AS actor_email, a.action, a.entity, a.entity_id, a.diff, a.ip, a.created_at
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
       ${where.sql} ORDER BY a.created_at DESC, a.id DESC LIMIT ${limitP} OFFSET ${offsetP}`,
    [...where.params, f.limit, offsetOf(f)],
  );
  ok(
    res,
    rows.map((r) => ({
      id: r.id,
      actor: r.actor_id ? { id: r.actor_id, name: r.actor_name, email: r.actor_email } : null,
      action: r.action,
      entity: r.entity,
      entity_id: r.entity_id,
      // Scrubbed again on the way out: a row written by an older or buggy writer cannot leak a secret field.
      diff: scrubDiff(r.diff),
      ip: r.ip,
      created_at: r.created_at,
    })),
    'Log audit',
    pageMeta(f.page, f.limit, total),
  );
});
