import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

const VERSION = 'v1';

function mac(key: string, exp: number, secret: string): Buffer {
  return createHmac('sha256', secret).update(`${VERSION}\n${key}\n${exp}`).digest();
}

/** Short-lived token binding one storage key to an expiry (unix seconds). Format: `<exp>.<base64url hmac>`. */
export function signFileToken(key: string, ttlSeconds: number = env.FILE_URL_TTL_SECONDS, nowMs: number = Date.now(), secret: string = env.FILE_SIGNING_KEY): string {
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  return `${exp}.${mac(key, exp, secret).toString('base64url')}`;
}

export function verifyFileToken(key: string, token: unknown, nowMs: number = Date.now(), secret: string = env.FILE_SIGNING_KEY): boolean {
  if (typeof token !== 'string' || token.length > 200) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  if (!Number.isInteger(exp) || exp * 1000 < nowMs) return false;
  const given = Buffer.from(token.slice(dot + 1), 'base64url');
  const expected = mac(key, exp, secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
