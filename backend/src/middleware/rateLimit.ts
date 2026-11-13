import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../lib/errors.js';

export interface RateLimiterOptions {
  limit: number;
  windowMs?: number;
  /** `user` keys by authenticated user id (falls back to IP); use after `requireAuth`. */
  keyBy?: 'ip' | 'user';
}

export function createRateLimiter({ limit, windowMs = 60_000, keyBy = 'ip' }: RateLimiterOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => (keyBy === 'user' && req.user ? `user:${req.user.id}` : (req.ip ?? 'unknown')),
    handler: (_req, _res, next) => {
      next(new AppError('RATE_LIMIT_EXCEEDED', 'Terlalu banyak permintaan, coba lagi sebentar lagi'));
    },
  });
}
