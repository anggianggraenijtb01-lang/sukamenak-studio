import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../lib/errors.js';
import type { Role } from '../lib/jwt.js';

/** Must run after `requireAuth`. Role comes from the database, not from the token. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
