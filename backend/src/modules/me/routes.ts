import { Router } from 'express';
import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/auth.js';
import { getValid, validate } from '../../middleware/validate.js';
import { clearRefreshCookie, setRefreshCookie } from '../auth/cookies.js';
import { deleteMeSchemas, updateMeSchemas } from './schemas.js';
import * as service from './service.js';

export const meRouter = Router();

meRouter.use(requireAuth);

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
