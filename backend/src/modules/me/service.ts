import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { queryOne, query } from '../../db/pool.js';
import { withTx } from '../../db/tx.js';
import { AppError, forbidden, notFound } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { invalidateUserCache } from '../../middleware/auth.js';
import { toUserDTO, type SessionDTO, type UserRow } from '../auth/dto.js';
import { revokeAllSessions, startSession } from '../auth/service.js';
import { getUsage, type UsageSummary } from './usage.js';

const USER_COLUMNS = 'id, email, name, role, is_active, last_login_at, created_at';

async function loadUser(userId: string): Promise<UserRow> {
  const row = await queryOne<UserRow & { deleted_at: Date | null }>(
    `SELECT ${USER_COLUMNS}, deleted_at FROM users WHERE id = $1`,
    [userId],
  );
  if (!row || row.deleted_at) throw notFound('Pengguna');
  return row;
}

export async function getMe(userId: string): Promise<{ user: ReturnType<typeof toUserDTO>; usage: UsageSummary }> {
  const [user, usage] = await Promise.all([loadUser(userId), getUsage(userId)]);
  return { user: toUserDTO(user), usage };
}

export interface UpdateMeInput {
  name?: string;
  current_password?: string;
  new_password?: string;
}

/** Returns a fresh session when the password changed (all older sessions are revoked). */
export async function updateMe(
  userId: string,
  input: UpdateMeInput,
): Promise<{ user: ReturnType<typeof toUserDTO>; session?: { dto: SessionDTO; refreshToken: string } }> {
  if (input.new_password !== undefined) {
    const current = await queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (!current || !(await verifyPassword(input.current_password ?? '', current.password_hash))) {
      throw new AppError('INVALID_CREDENTIALS', 'Kata sandi saat ini salah');
    }
  }
  const newHash = input.new_password !== undefined ? await hashPassword(input.new_password) : null;

  const result = await withTx(async (client) => {
    const { rows } = await client.query<UserRow>(
      `UPDATE users
          SET name = COALESCE($2, name),
              password_hash = COALESCE($3, password_hash),
              updated_by = id
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING ${USER_COLUMNS}`,
      [userId, input.name ?? null, newHash],
    );
    const user = rows[0];
    if (!user) throw notFound('Pengguna');
    if (newHash) {
      await revokeAllSessions(client, userId);
      const { session, refreshToken } = await startSession(client, user);
      return { user, session: { dto: session, refreshToken } };
    }
    return { user, session: undefined };
  });

  invalidateUserCache(userId);
  return { user: toUserDTO(result.user), session: result.session };
}

/** Everything we hold about the user (UU PDP data portability). Contains no final prompts or secrets. */
export async function exportMyData(userId: string): Promise<Record<string, unknown>> {
  const user = await loadUser(userId);
  const [generations, savedPrompts, improvements, usage] = await Promise.all([
    query(
      `SELECT id, template_id, mode, subject, publication, status, slot_values, remarks,
              used_reference_image, reference_count_used, composited_text, degraded, error_code,
              consent_confirmed, archived_at, created_at
         FROM generations WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [userId],
    ),
    query('SELECT id, title, body, source, created_at, updated_at FROM user_prompts WHERE user_id = $1 ORDER BY created_at', [
      userId,
    ]),
    query(
      `SELECT id, input_text, output_text, score_before, score_after, created_at
         FROM prompt_improvements WHERE user_id = $1 ORDER BY created_at`,
      [userId],
    ),
    query('SELECT date, success_count FROM usage_counters WHERE user_id = $1 ORDER BY date', [userId]),
  ]);
  return {
    exported_at: new Date().toISOString(),
    profile: toUserDTO(user),
    generations,
    saved_prompts: savedPrompts,
    prompt_improvements: improvements,
    daily_usage: usage,
  };
}

/**
 * Right to erasure: anonymises the account in place and removes personal content. Rows that other
 * tables point at (generations, assets) are kept but stripped of personal data so statistics survive.
 */
export async function deleteMe(userId: string, password: string): Promise<void> {
  const row = await queryOne<{ password_hash: string; role: string }>(
    'SELECT password_hash, role FROM users WHERE id = $1 AND deleted_at IS NULL',
    [userId],
  );
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    throw new AppError('INVALID_CREDENTIALS', 'Kata sandi salah');
  }
  if (row.role === 'admin') throw forbidden('Akun admin tidak dapat dihapus lewat endpoint ini');
  const unusableHash = await hashPassword(randomUUID() + randomUUID());

  await withTx((client) => anonymizeUser(client, userId, unusableHash));
  invalidateUserCache(userId);
}

/**
 * Anonymises an account in place and removes its personal content (right to erasure). Rows other
 * tables point at (generations, assets) are kept but stripped of personal data so statistics survive.
 * Shared by the self-service `DELETE /me` and the admin soft delete.
 */
export async function anonymizeUser(client: PoolClient, userId: string, unusableHash: string): Promise<void> {
  await client.query(
    `UPDATE users
        SET email = 'deleted-' || id::text || '@deleted.invalid',
            name = 'Pengguna Terhapus',
            password_hash = $2,
            is_active = false,
            daily_limit_override = NULL,
            deleted_at = now()
      WHERE id = $1`,
    [userId, unusableHash],
  );
  await revokeAllSessions(client, userId);
  await client.query('DELETE FROM user_prompts WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM prompt_improvements WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM reference_assets WHERE owner_id = $1', [userId]);
  await client.query(
    `UPDATE generations
        SET remarks = NULL, slot_values = '{}'::jsonb, reference_inputs = '[]'::jsonb,
            final_prompt_ciphertext = NULL, final_prompt_iv = NULL, final_prompt_auth_tag = NULL,
            deleted_at = COALESCE(deleted_at, now())
      WHERE user_id = $1`,
    [userId],
  );
  await client.query('UPDATE gallery_items SET is_hidden = true WHERE generation_id IN (SELECT id FROM generations WHERE user_id = $1)', [
    userId,
  ]);
  // File cleanup is done by the Phase B retention job, which collects assets with deleted_at set.
  await client.query('UPDATE assets SET deleted_at = COALESCE(deleted_at, now()) WHERE owner_id = $1', [userId]);
}
