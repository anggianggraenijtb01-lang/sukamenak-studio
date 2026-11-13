import { Router } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { created, ok, pageMeta } from '../../lib/response.js';
import { requireAuth } from '../../middleware/auth.js';
import { receiveFile } from '../../middleware/upload.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';
import { getValid, validate } from '../../middleware/validate.js';
import { createReferenceSchemas, listLibrarySchemas, listMineSchemas, referenceIdParams } from './schemas.js';
import * as service from './service.js';

export const referencesRouter = Router();

referencesRouter.use(requireAuth);

const uploadLimiter = createRateLimiter({ limit: env.REFERENCE_UPLOAD_RATE_LIMIT_PER_MINUTE, keyBy: 'user' });

referencesRouter.post('/', uploadLimiter, receiveFile, validate(createReferenceSchemas), async (req, res) => {
  const { body } = getValid(req, createReferenceSchemas);
  if (!req.file) {
    throw new AppError('VALIDATION_ERROR', 'File gambar wajib diunggah pada field "file"', {
      errors: [{ field: 'file', message: 'Wajib diisi' }],
    });
  }
  created(res, await service.createReference(req.user!.id, { ...body, buffer: req.file.buffer }), 'Referensi diunggah');
});

// Static paths are registered before `/:id`.
referencesRouter.get('/mine', validate(listMineSchemas), async (req, res) => {
  const { query } = getValid(req, listMineSchemas);
  const { items, total } = await service.listMyReferences(req.user!.id, query);
  ok(res, items, 'Referensi saya', pageMeta(query.page, query.limit, total));
});

referencesRouter.get('/library', validate(listLibrarySchemas), async (req, res) => {
  const { query } = getValid(req, listLibrarySchemas);
  ok(res, await service.listLibraryReferences(query), 'Pustaka referensi');
});

referencesRouter.delete('/:id', validate(referenceIdParams), async (req, res) => {
  const { params } = getValid(req, referenceIdParams);
  await service.deleteReference(req.user!.id, params.id);
  ok(res, { id: params.id }, 'Referensi dihapus');
});
