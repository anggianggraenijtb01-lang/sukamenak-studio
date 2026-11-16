import type { Role } from '../../../lib/jwt.js';

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  is_active: boolean;
  daily_limit_override: number | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const USER_COLUMNS = 'id, email, name, role, is_active, daily_limit_override, last_login_at, created_at, updated_at';

/** Explicit allowlist: password_hash, token hashes and session columns never leave the server. */
export const toAdminUserDTO = (u: AdminUserRow) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  is_active: u.is_active,
  daily_limit_override: u.daily_limit_override,
  last_login_at: u.last_login_at,
  created_at: u.created_at,
  updated_at: u.updated_at,
});

/** Audit allowlist for users. Passwords and hashes are not on it by construction. */
export const USER_AUDIT_FIELDS = ['email', 'name', 'role', 'is_active', 'daily_limit_override'] as const;
