import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from './errors.js';

export type Role = 'creator' | 'admin';

const ISSUER = 'sukamenak-studio';
const ALGORITHMS: jwt.Algorithm[] = ['HS256'];

export interface AccessClaims {
  sub: string;
  role: Role;
}

export interface VerifiedAccessClaims extends AccessClaims {
  /** Issue time in milliseconds (JWT `iat` only has second resolution; see `iam`). */
  issuedAtMs: number;
}

export interface RefreshClaims {
  sub: string;
  fam: string;
  jti: string;
}

export const ACCESS_TTL_SECONDS = env.ACCESS_TOKEN_TTL_MINUTES * 60;
export const REFRESH_TTL_SECONDS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;

export function signAccessToken(claims: AccessClaims): string {
  // `iam` = issued-at in ms: lets "revoke all sessions" cut off tokens precisely, not just to the second.
  return jwt.sign({ role: claims.role, iam: Date.now() }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: claims.sub,
    issuer: ISSUER,
    expiresIn: ACCESS_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): VerifiedAccessClaims {
  try {
    const p = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ALGORITHMS, issuer: ISSUER });
    if (typeof p === 'string' || typeof p.sub !== 'string' || (p.role !== 'creator' && p.role !== 'admin')) {
      throw new Error('bad claims');
    }
    const issuedAtMs = typeof p.iam === 'number' ? p.iam : (typeof p.iat === 'number' ? p.iat : 0) * 1000;
    return { sub: p.sub, role: p.role as Role, issuedAtMs };
  } catch {
    throw unauthorized('Token tidak valid atau kedaluwarsa');
  }
}

export function signRefreshToken(claims: { sub: string; fam: string }): { token: string; jti: string; expiresAt: Date } {
  const jti = randomUUID();
  const token = jwt.sign({ fam: claims.fam }, env.JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    subject: claims.sub,
    issuer: ISSUER,
    jwtid: jti,
    expiresIn: REFRESH_TTL_SECONDS,
  });
  return { token, jti, expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000) };
}

/** Returns null for any malformed, forged or expired token. */
export function verifyRefreshToken(token: string): RefreshClaims | null {
  try {
    const p = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ALGORITHMS, issuer: ISSUER });
    if (typeof p === 'string' || typeof p.sub !== 'string' || typeof p.fam !== 'string' || typeof p.jti !== 'string') {
      return null;
    }
    return { sub: p.sub, fam: p.fam, jti: p.jti };
  } catch {
    return null;
  }
}
