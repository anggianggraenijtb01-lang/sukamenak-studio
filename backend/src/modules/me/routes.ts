import { Router } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';
import { receiveAvatar } from '../../middleware/upload.js';
import { getValid, validate } from '../../middleware/validate.js';
import { clearRefreshCookie, setRefreshCookie } from '../auth/cookies.js';
import { deleteMeSchemas, updateMeSchemas } from './schemas.js';
import * as service from './service.js';

export const meRouter = Router();

meRouter.use(requireAuth);

// Same per-user budget as reference uploads: both write image files to storage.
const avatarLimiter = createRateLimiter({ limit: env.REFERENCE_UPLOAD_RATE_LIMIT_PER_MINUTE, keyBy: 'user' });

meRouter.get('/', async (req, res) => {
  ok(res, await service.getMe(req.user!.id), 'Profil');
});

meRouter.patch('/', validate(updateMeSchemas), async (req, res) => {
  const { body } = getValid(req, updateMeSchemas);
  const { user, session } = await service.updateMe(req.user!.id, body);
  if (session) {
    setRefreshCookie(res, session.refreshToken);
    ok(res, { user, session: session.dto }, 'Profil diperbarui; sesi lain telah dikeluarkan');
    return;
  }
  ok(res, { user }, 'Profil diperbarui');
});

meRouter.put('/avatar', avatarLimiter, receiveAvatar, async (req, res) => {
  if (!req.file) {
    throw new AppError('VALIDATION_ERROR', 'File gambar wajib diunggah pada field "avatar"', {
      errors: [{ field: 'avatar', message: 'Wajib diisi' }],
    });
  }
  ok(res, await service.setAvatar(req.user!.id, req.file.buffer), 'Foto profil diperbarui');
});

meRouter.delete('/avatar', async (req, res) => {
  ok(res, await service.clearAvatar(req.user!.id), 'Foto profil dihapus');
});

meRouter.get('/export', async (req, res) => {
  const data = await service.exportMyData(req.user!.id);
  res.setHeader('Content-Disposition', 'attachment; filename="sukamenak-data-saya.json"');
  ok(res, data, 'Ekspor data');
});

meRouter.delete('/', validate(deleteMeSchemas), async (req, res) => {
  const { body } = getValid(req, deleteMeSchemas);
  await service.deleteMe(req.user!.id, body.password);
  clearRefreshCookie(res);
  ok(res, { deleted: true }, 'Akun dihapus dan dianonimkan');
});
