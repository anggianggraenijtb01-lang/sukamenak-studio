import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { REFRESH_TTL_SECONDS } from '../../lib/jwt.js';

export const REFRESH_COOKIE = 'refresh_token';

const base: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax',
  // Scoped so the browser only attaches it to auth endpoints.
  path: '/api/v1/auth',
};

export const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_COOKIE, token, { ...base, maxAge: REFRESH_TTL_SECONDS * 1000 });
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE, base);
};

export const readRefreshCookie = (req: Request): string | undefined => {
  const v: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
};
