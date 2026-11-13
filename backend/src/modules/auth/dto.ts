import type { Role } from '../../lib/jwt.js';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
}

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
  last_login_at: Date | null;
  created_at: Date;
}

/** Explicit allowlist: password_hash and internal columns never leave the server. */
export const toUserDTO = (row: UserRow): UserDTO => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  last_login_at: row.last_login_at,
  created_at: row.created_at,
});

export interface SessionDTO {
  user: UserDTO;
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
}
