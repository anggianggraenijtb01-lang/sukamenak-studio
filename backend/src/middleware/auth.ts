import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { queryOne } from '../db/pool.js';
import { AppError, unauthorized } from '../lib/errors.js';
import { verifyAccessToken, type Role } from '../lib/jwt.js';
import type { AuthUser } from '../types/express.js';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  is_active: boolean;
  deleted_at: Date | null;
  sessions_valid_after: Date | null;
}

type CachedUser = {
  user: AuthUser | null;
  inactive: boolean;
  /** Access tokens issued before this instant (epoch ms) are rejected. */
  validAfterMs: number;
  expiresAt: number;
};

const cache = new Map<string, CachedUser>();

export function invalidateUserCache(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

async function loadUser(id: string): Promise<CachedUser> {
  const ttl = env.AUTH_USER_CACHE_TTL_MS;
  const now = Date.now();
  const hit = ttl > 0 ? cache.get(id) : undefined;
  if (hit && hit.expiresAt > now) return hit;

  const row = await queryOne<UserRow>(
    'SELECT id, email, name, role, is_active, deleted_at, sessions_valid_after FROM users WHERE id = $1',
    [id],
  );
  const entry: CachedUser =
    !row || row.deleted_at
      ? { user: null, inactive: false, validAfterMs: 0, expiresAt: now + ttl }
      : {
          user: { id: row.id, email: row.email, name: row.name, role: row.role },
          inactive: !row.is_active,
          validAfterMs: row.sessions_valid_after ? row.sessions_valid_after.getTime() : 0,
          expiresAt: now + ttl,
        };
  if (ttl > 0) cache.set(id, entry);
  return entry;
}

/** Verifies the Bearer access token and re-checks the user against the database (role + active flag). */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header('authorization');
    const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
    if (!match?.[1]) throw unauthorized();

    const claims = verifyAccessToken(match[1]);
    const { user, inactive, validAfterMs } = await loadUser(claims.sub);
    if (!user) throw unauthorized('Token tidak valid atau kedaluwarsa');
    if (inactive) throw new AppError('ACCOUNT_INACTIVE', 'Akun Anda dinonaktifkan');
    if (claims.issuedAtMs < validAfterMs) throw unauthorized('Sesi telah dicabut, silakan masuk kembali');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
