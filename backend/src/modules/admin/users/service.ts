import { randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query, queryOne } from '../../../db/pool.js';
import { withTx } from '../../../db/tx.js';
import { AppError, notFound } from '../../../lib/errors.js';
import { hashPassword } from '../../../lib/password.js';
import { invalidateUserCache } from '../../../middleware/auth.js';
import { revokeAllSessions } from '../../auth/service.js';
import { anonymizeUser } from '../../me/service.js';
import { getUsage } from '../../me/usage.js';
import { buildDiff, recordAudit } from '../auditLog.js';
import { escapeLike, offsetOf, uniqueViolation, Where, type AdminCtx } from '../common.js';
import { toAdminUserDTO, USER_AUDIT_FIELDS, USER_COLUMNS, type AdminUserRow } from './dto.js';

/** Serialises every change that can reduce the number of active admins. */
const ADMIN_LOCK_KEY = 7_340_017;

const generateTempPassword = (): string => randomBytes(12).toString('base64url');

export interface ListUsersFilters {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  active?: boolean;
}

export async function listUsers(f: ListUsersFilters) {
  const where = new Where('deleted_at IS NULL');
  if (f.role) where.add((p) => `role = ${p}`, f.role);
  if (f.active !== undefined) where.add((p) => `is_active = ${p}`, f.active);
  if (f.search) where.add((p) => `(email ILIKE ${p} OR name ILIKE ${p})`, `%${escapeLike(f.search as string)}%`);

  const total = (await queryOne<{ n: number }>(`SELECT count(*) AS n FROM users ${where.sql}`, where.params))?.n ?? 0;
  const limitP = where.next();
  const offsetP = `$${where.params.length + 2}`;
  const rows = await query<AdminUserRow>(
    `SELECT ${USER_COLUMNS} FROM users ${where.sql} ORDER BY created_at DESC, id LIMIT ${limitP} OFFSET ${offsetP}`,
    [...where.params, f.limit, offsetOf(f)],
  );
  return { items: rows.map(toAdminUserDTO), total };
}

async function loadUser(id: string, client?: PoolClient, lock = false): Promise<AdminUserRow> {
  const row = await queryOne<AdminUserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 AND deleted_at IS NULL${lock ? ' FOR UPDATE' : ''}`,
    [id],
    client,
  );
  if (!row) throw notFound('Pengguna');
  return row;
}

export async function getUser(id: string) {
  const user = await loadUser(id);
  return { ...toAdminUserDTO(user), usage: await getUsage(id) };
}

export async function activeAdminCount(db?: PoolClient, excludeId?: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT count(*) AS n FROM users WHERE role = 'admin' AND is_active AND deleted_at IS NULL AND ($1::uuid IS NULL OR id <> $1)`,
    [excludeId ?? null],
    db,
  );
  return row?.n ?? 0;
}

/** Meta block that warns when fewer than two active admins remain (undefined when all is well). */
export async function adminMeta(): Promise<Record<string, unknown> | undefined> {
  const n = await activeAdminCount();
  return n < 2
    ? { active_admins: n, warnings: [`Hanya tersisa ${n} admin aktif. Tambahkan admin lain agar tidak terkunci.`] }
    : undefined;
}

const lastAdmin = () =>
  new AppError('LAST_ADMIN', 'Admin aktif terakhir tidak dapat dihapus, dinonaktifkan, atau diturunkan perannya');
const selfGuard = () =>
  new AppError('CANNOT_MODIFY_SELF', 'Anda tidak dapat menonaktifkan, menurunkan, atau menghapus akun Anda sendiri');

/** Throws LAST_ADMIN when `target` is an active admin and no other active admin exists. Call under the admin lock. */
async function assertNotLastAdmin(client: PoolClient, target: AdminUserRow): Promise<void> {
  if (target.role !== 'admin' || !target.is_active) return;
  if ((await activeAdminCount(client, target.id)) === 0) throw lastAdmin();
}

const lockAdmins = (client: PoolClient) => client.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_LOCK_KEY]);

export interface CreateUserInput {
  email: string;
  name: string;
  role: 'creator' | 'admin';
  password?: string;
  daily_limit_override?: number | null;
}

export async function createUser(ctx: AdminCtx, input: CreateUserInput) {
  const generated = input.password === undefined;
  const password = input.password ?? generateTempPassword();
  const hash = await hashPassword(password);
  try {
    const user = await withTx(async (client) => {
      const created = (await queryOne<AdminUserRow>(
        `INSERT INTO users (email, password_hash, name, role, daily_limit_override, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING ${USER_COLUMNS}`,
        [input.email, hash, input.name, input.role, input.daily_limit_override ?? null, ctx.actorId],
        client,
      )) as AdminUserRow;
      await recordAudit(
        ctx,
        {
          action: 'user.create',
          entity: 'user',
          entityId: created.id,
          diff: buildDiff(USER_AUDIT_FIELDS, null, created as unknown as Record<string, unknown>, { password_generated: generated }),
        },
        client,
      );
      return created;
    });
    return { user: toAdminUserDTO(user), ...(generated ? { temporary_password: password } : {}) };
  } catch (err) {
    if (uniqueViolation(err) !== null) throw new AppError('EMAIL_EXISTS', 'Email sudah terdaftar');
    throw err;
  }
}

export interface UpdateUserInput {
  name?: string;
  role?: 'creator' | 'admin';
  is_active?: boolean;
  daily_limit_override?: number | null;
}

export async function updateUser(ctx: AdminCtx, id: string, patch: UpdateUserInput) {
  const demotes = patch.role !== undefined && patch.role !== 'admin';
  const deactivates = patch.is_active === false;
  if (id === ctx.actorId && (demotes || deactivates)) throw selfGuard();

  const after = await withTx(async (client) => {
    await lockAdmins(client);
    const before = await loadUser(id, client, true);
    if (demotes || deactivates) await assertNotLastAdmin(client, before);

    const row = (await queryOne<AdminUserRow>(
      `UPDATE users SET name = $2, role = $3, is_active = $4, daily_limit_override = $5, updated_by = $6
        WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [
        id,
        patch.name ?? before.name,
        patch.role ?? before.role,
        patch.is_active ?? before.is_active,
        patch.daily_limit_override === undefined ? before.daily_limit_override : patch.daily_limit_override,
        ctx.actorId,
      ],
      client,
    )) as AdminUserRow;
    // A deactivated account loses its refresh tokens as well; requireAuth already rejects it immediately.
    if (before.is_active && !row.is_active) await revokeAllSessions(client, id);
    await recordAudit(
      ctx,
      {
        action: 'user.update',
        entity: 'user',
        entityId: id,
        diff: buildDiff(USER_AUDIT_FIELDS, before as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>),
      },
      client,
    );
    return row;
  });
  invalidateUserCache(id);
  return toAdminUserDTO(after);
}

export async function resetPassword(ctx: AdminCtx, id: string) {
  if (id === ctx.actorId) throw new AppError('CANNOT_MODIFY_SELF', 'Ubah kata sandi Anda sendiri lewat PATCH /me');
  const temporary = generateTempPassword();
  const hash = await hashPassword(temporary);
  const user = await withTx(async (client) => {
    await loadUser(id, client, true);
    const row = (await queryOne<AdminUserRow>(
      `UPDATE users SET password_hash = $2, sessions_valid_after = $4, updated_by = $3 WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [id, hash, ctx.actorId, new Date()],
      client,
    )) as AdminUserRow;
    await revokeAllSessions(client, id);
    await recordAudit(ctx, { action: 'user.reset_password', entity: 'user', entityId: id, diff: { sessions_revoked: true } }, client);
    return row;
  });
  invalidateUserCache(id);
  return { user: toAdminUserDTO(user), temporary_password: temporary };
}

export async function revokeSessions(ctx: AdminCtx, id: string) {
  const revoked = await withTx(async (client) => {
    await loadUser(id, client, true);
    const res = await client.query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()',
      [id],
    );
    await client.query('UPDATE users SET sessions_valid_after = $2 WHERE id = $1', [id, new Date()]);
    await recordAudit(
      ctx,
      { action: 'user.revoke_sessions', entity: 'user', entityId: id, diff: { refresh_tokens_revoked: res.rowCount ?? 0 } },
      client,
    );
    return res.rowCount ?? 0;
  });
  invalidateUserCache(id);
  return { id, revoked_sessions: revoked };
}

export async function deleteUser(ctx: AdminCtx, id: string): Promise<void> {
  if (id === ctx.actorId) throw selfGuard();
  const unusableHash = await hashPassword(randomUUID() + randomUUID());
  await withTx(async (client) => {
    await lockAdmins(client);
    const before = await loadUser(id, client, true);
    await assertNotLastAdmin(client, before);
    await anonymizeUser(client, id, unusableHash);
    await recordAudit(
      ctx,
      { action: 'user.delete', entity: 'user', entityId: id, diff: { role: before.role, was_active: before.is_active } },
      client,
    );
  });
  invalidateUserCache(id);
}
