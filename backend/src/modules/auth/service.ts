import { randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { env } from '../../config/env.js';
import { queryOne } from '../../db/pool.js';
import { withTx } from '../../db/tx.js';
import { sha256Hex } from '../../lib/crypto.js';
import { AppError, unauthorized } from '../../lib/errors.js';
import { ACCESS_TTL_SECONDS, signAccessToken, signRefreshToken, verifyRefreshToken, type Role } from '../../lib/jwt.js';
import { logger } from '../../lib/logger.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../../lib/password.js';
import { sendMail } from '../../mail/index.js';
import { invalidateUserCache } from '../../middleware/auth.js';
import { toUserDTO, type SessionDTO, type UserRow } from './dto.js';

interface UserAuthRow extends UserRow {
  password_hash: string;
  deleted_at: Date | null;
}

export interface SessionResult {
  session: SessionDTO;
  refreshToken: string;
}

const USER_COLUMNS = 'id, email, name, role, is_active, last_login_at, created_at';

async function issueRefreshToken(client: PoolClient, userId: string, familyId: string): Promise<string> {
  const { token, jti, expiresAt } = signRefreshToken({ sub: userId, fam: familyId });
  await client.query(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at) VALUES ($1, $2, $3, $4, $5)',
    [jti, userId, sha256Hex(token), familyId, expiresAt],
  );
  return token;
}

const buildSession = (user: UserRow, refreshToken: string): SessionResult => ({
  session: {
    user: toUserDTO(user),
    access_token: signAccessToken({ sub: user.id, role: user.role }),
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_SECONDS,
  },
  refreshToken,
});

/** Opens a brand-new refresh-token family for the user (new login / registration). */
export async function startSession(client: PoolClient, user: UserRow): Promise<SessionResult> {
  const refreshToken = await issueRefreshToken(client, user.id, randomUUID());
  return buildSession(user, refreshToken);
}

export async function register(input: { email: string; password: string; name: string }): Promise<SessionResult> {
  const passwordHash = await hashPassword(input.password);
  try {
    return await withTx(async (client) => {
      // The role is never taken from the request: public registration always creates a creator.
      const { rows } = await client.query<UserRow>(
        `INSERT INTO users (email, password_hash, name, role, last_login_at)
         VALUES ($1, $2, $3, 'creator', now())
         RETURNING ${USER_COLUMNS}`,
        [input.email, passwordHash, input.name],
      );
      return startSession(client, rows[0] as UserRow);
    });
  } catch (err) {
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
      throw new AppError('EMAIL_EXISTS', 'Email sudah terdaftar');
    }
    throw err;
  }
}

export async function login(input: { email: string; password: string }): Promise<SessionResult> {
  const user = await queryOne<UserAuthRow>(
    `SELECT ${USER_COLUMNS}, password_hash, deleted_at FROM users WHERE email = $1`,
    [input.email],
  );
  if (!user || user.deleted_at) {
    await verifyAgainstDummy(input.password);
    throw new AppError('INVALID_CREDENTIALS', 'Email atau kata sandi salah');
  }
  if (!(await verifyPassword(input.password, user.password_hash))) {
    throw new AppError('INVALID_CREDENTIALS', 'Email atau kata sandi salah');
  }
  if (!user.is_active) throw new AppError('ACCOUNT_INACTIVE', 'Akun Anda dinonaktifkan');

  return withTx(async (client) => {
    await client.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    return startSession(client, user);
  });
}

type RefreshOutcome =
  | { kind: 'ok'; user: UserRow; refreshToken: string }
  | { kind: 'invalid' }
  | { kind: 'reuse' }
  | { kind: 'inactive' };

interface RefreshRow {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
}

/**
 * Rotates a refresh token. Presenting an already-rotated (revoked) token means it was stolen or
 * replayed, so the whole family is revoked. The revocation is committed before the error is thrown.
 */
export async function refresh(presentedToken: string): Promise<SessionResult> {
  const claims = verifyRefreshToken(presentedToken);
  if (!claims) throw unauthorized('Sesi tidak valid, silakan masuk kembali');

  const outcome = await withTx<RefreshOutcome>(async (client) => {
    const { rows } = await client.query<RefreshRow>(
      'SELECT id, user_id, family_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE',
      [sha256Hex(presentedToken)],
    );
    const row = rows[0];
    if (!row || row.id !== claims.jti || row.user_id !== claims.sub || row.family_id !== claims.fam) {
      return { kind: 'invalid' };
    }
    if (row.revoked_at) {
      await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL', [
        row.family_id,
      ]);
      return { kind: 'reuse' };
    }
    if (row.expires_at.getTime() <= Date.now()) return { kind: 'invalid' };

    const { rows: users } = await client.query<UserRow & { deleted_at: Date | null }>(
      `SELECT ${USER_COLUMNS}, deleted_at FROM users WHERE id = $1`,
      [row.user_id],
    );
    const user = users[0];
    if (!user || user.deleted_at) {
      await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL', [
        row.family_id,
      ]);
      return { kind: 'invalid' };
    }
    if (!user.is_active) return { kind: 'inactive' };

    const next = signRefreshToken({ sub: user.id, fam: row.family_id });
    await client.query(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [next.jti, user.id, sha256Hex(next.token), row.family_id, next.expiresAt],
    );
    await client.query('UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1', [row.id, next.jti]);
    return { kind: 'ok', user, refreshToken: next.token };
  });

  switch (outcome.kind) {
    case 'ok':
      return buildSession(outcome.user, outcome.refreshToken);
    case 'inactive':
      throw new AppError('ACCOUNT_INACTIVE', 'Akun Anda dinonaktifkan');
    case 'reuse':
    case 'invalid':
      throw unauthorized('Sesi tidak valid, silakan masuk kembali');
  }
}

/** Revokes the whole token family behind `presentedToken`. Silent for unknown or malformed tokens. */
export async function logout(presentedToken: string | undefined): Promise<void> {
  if (!presentedToken) return;
  const claims = verifyRefreshToken(presentedToken);
  if (!claims) return;
  await withTx(async (client) => {
    await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL', [
      claims.fam,
    ]);
  });
}

export async function revokeAllSessions(client: PoolClient, userId: string): Promise<void> {
  await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}

/**
 * "Lupa sandi": emails a one-time link to an active account. Unknown, inactive or deleted emails
 * return silently, and the mail is sent in the background, so neither the response nor its timing
 * reveals whether the account exists. A new request supersedes the user's earlier unused links.
 */
export async function requestPasswordReset(email: string, requestedIp?: string): Promise<void> {
  const user = await queryOne<{ id: string; email: string; name: string }>(
    'SELECT id, email, name FROM users WHERE email = $1 AND is_active AND deleted_at IS NULL',
    [email],
  );
  if (!user) return;

  const token = randomBytes(32).toString('base64url');
  await withTx(async (client) => {
    await client.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
    await client.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at, requested_ip)
       VALUES ($1, $2, now() + make_interval(mins => $3), $4)`,
      [user.id, sha256Hex(token), env.PASSWORD_RESET_TTL_MINUTES, requestedIp ?? null],
    );
  });

  const link = `${env.APP_PUBLIC_URL}/reset-password?token=${token}`;
  void sendMail({
    to: user.email,
    subject: 'Atur ulang kata sandi Sukamenak Studio',
    text: [
      `Halo ${user.name},`,
      '',
      'Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda. Buka tautan berikut untuk membuat kata sandi baru:',
      '',
      link,
      '',
      `Tautan ini hanya bisa dipakai sekali dan berlaku ${env.PASSWORD_RESET_TTL_MINUTES} menit.`,
      'Jika Anda tidak meminta ini, abaikan email ini. Kata sandi Anda tidak akan berubah.',
    ].join('\n'),
  }).catch((err: unknown) => logger.error({ err, userId: user.id }, 'Password reset mail failed'));
}

/**
 * Sets a new password from an emailed token. The token must be unused and unexpired; using it
 * also voids the user's other open links and signs out every existing session.
 */
export async function consumePasswordReset(token: string, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  const userId = await withTx(async (client) => {
    const { rows } = await client.query<{ user_id: string }>(
      `UPDATE password_resets SET used_at = now()
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
        RETURNING user_id`,
      [sha256Hex(token)],
    );
    const row = rows[0];
    if (!row) return null;
    const updated = await client.query(
      `UPDATE users SET password_hash = $2, sessions_valid_after = $3, updated_by = id
        WHERE id = $1 AND is_active AND deleted_at IS NULL`,
      [row.user_id, passwordHash, new Date()],
    );
    if (updated.rowCount === 0) return null;
    await client.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [row.user_id]);
    await revokeAllSessions(client, row.user_id);
    return row.user_id;
  });
  if (!userId) throw new AppError('INVALID_RESET_TOKEN', 'Tautan atur ulang kata sandi tidak valid atau sudah kedaluwarsa');
  invalidateUserCache(userId);
}

export type { Role };
