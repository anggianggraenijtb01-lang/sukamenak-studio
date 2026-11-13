import { Router } from 'express';
import { AppError } from '../../../lib/errors.js';
import { ok } from '../../../lib/response.js';
import { receiveAdminFile } from '../../../middleware/upload.js';
import { getValid, validate } from '../../../middleware/validate.js';
import { adminCtx } from '../common.js';
import { updateBrandSchemas, updatePolicySchemas, updateSettingsSchemas } from './schemas.js';
import * as service from './service.js';

/** `/admin/settings`, `/admin/brand-identity` and `/admin/policy`. Mounted at the admin router root. */
export const settingsRouter = Router();

settingsRouter.get('/settings', async (_req, res) => {
  ok(res, await service.readSettings(), 'Pengaturan aplikasi');
});

settingsRouter.patch('/settings', validate(updateSettingsSchemas), async (req, res) => {
  const { body } = getValid(req, updateSettingsSchemas);
  ok(res, await service.updateSettings(adminCtx(req), body), 'Pengaturan diperbarui');
});

settingsRouter.get('/brand-identity', async (_req, res) => {
  ok(res, await service.getBrand(), 'Identitas brand');
});

settingsRouter.patch('/brand-identity', validate(updateBrandSchemas), async (req, res) => {
  const { body } = getValid(req, updateBrandSchemas);
  ok(res, await service.updateBrand(adminCtx(req), body), 'Identitas brand diperbarui');
});

settingsRouter.post('/brand-identity/logo', receiveAdminFile, async (req, res) => {
  if (!req.file) {
    throw new AppError('VALIDATION_ERROR', 'File gambar wajib diunggah pada field "file"', { errors: [{ field: 'file', message: 'Wajib diisi' }] });
  }
  ok(res, await service.uploadBrandLogo(adminCtx(req), req.file.buffer), 'Logo diunggah');
});

settingsRouter.get('/policy', async (_req, res) => {
  ok(res, await service.getPolicy(), 'Kebijakan konten');
});

settingsRouter.patch('/policy', validate(updatePolicySchemas), async (req, res) => {
  const { body } = getValid(req, updatePolicySchemas);
  ok(res, await service.updatePolicy(adminCtx(req), body), 'Kebijakan konten diperbarui');
});
