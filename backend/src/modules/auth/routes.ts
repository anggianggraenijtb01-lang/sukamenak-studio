import { Router } from 'express';
import { env } from '../../config/env.js';
import { created, ok } from '../../lib/response.js';
import { unauthorized } from '../../lib/errors.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';
import { getValid, validate } from '../../middleware/validate.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './cookies.js';
import { loginSchemas, registerSchemas } from './schemas.js';
import * as service from './service.js';

export const authRouter = Router();

const authLimiter = createRateLimiter({ limit: env.AUTH_RATE_LIMIT_PER_MINUTE });

authRouter.post('/register', authLimiter, validate(registerSchemas), async (req, res) => {
  const { body } = getValid(req, registerSchemas);
  const { session, refreshToken } = await service.register(body);
  setRefreshCookie(res, refreshToken);
  created(res, session, 'Registrasi berhasil');
});

authRouter.post('/login', authLimiter, validate(loginSchemas), async (req, res) => {
  const { body } = getValid(req, loginSchemas);
  const { session, refreshToken } = await service.login(body);
  setRefreshCookie(res, refreshToken);
  ok(res, session, 'Login berhasil');
});

authRouter.post('/refresh', async (req, res) => {
  const presented = readRefreshCookie(req);
  if (!presented) throw unauthorized('Sesi tidak ditemukan, silakan masuk kembali');
  try {
    const { session, refreshToken } = await service.refresh(presented);
    setRefreshCookie(res, refreshToken);
    ok(res, session, 'Token diperbarui');
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
});

authRouter.post('/logout', async (req, res) => {
  await service.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  ok(res, { logged_out: true }, 'Logout berhasil');
});
