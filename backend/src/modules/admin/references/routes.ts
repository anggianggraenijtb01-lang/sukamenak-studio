import { Router } from 'express';
import { AppError } from '../../../lib/errors.js';
import { created, ok, pageMeta } from '../../../lib/response.js';
import { receiveAdminFile } from '../../../middleware/upload.js';
import { getValid, validate } from '../../../middleware/validate.js';
import { adminCtx } from '../common.js';
import { createReferenceSchemas, listReferencesSchemas, referenceIdSchemas, updateReferenceSchemas } from './schemas.js';
import * as service from './service.js';

export const referencesAdminRouter = Router();

referencesAdminRouter.get('/', validate(listReferencesSchemas), async (req, res) => {
  const { query } = getValid(req, listReferencesSchemas);
  const { items, total } = await service.listReferences(query);
  ok(res, items, 'Pustaka referensi', pageMeta(query.page, query.limit, total));
});

referencesAdminRouter.post('/', receiveAdminFile, validate(createReferenceSchemas), async (req, res) => {
  const { body } = getValid(req, createReferenceSchemas);
  if (!req.file) {
    throw new AppError('VALIDATION_ERROR', 'File gambar wajib diunggah pada field "file"', { errors: [{ field: 'file', message: 'Wajib diisi' }] });
  }
  created(res, await service.createReference(adminCtx(req), { ...body, buffer: req.file.buffer }), 'Referensi pustaka diunggah');
});

referencesAdminRouter.get('/:id', validate(referenceIdSchemas), async (req, res) => {
  const { params } = getValid(req, referenceIdSchemas);
  ok(res, await service.getReference(params.id), 'Detail referensi');
});

referencesAdminRouter.patch('/:id', validate(updateReferenceSchemas), async (req, res) => {
  const { params, body } = getValid(req, updateReferenceSchemas);
  ok(res, await service.updateReference(adminCtx(req), params.id, body), 'Referensi diperbarui');
});

referencesAdminRouter.delete('/:id', validate(referenceIdSchemas), async (req, res) => {
  const { params } = getValid(req, referenceIdSchemas);
  await service.deleteReference(adminCtx(req), params.id);
  ok(res, { id: params.id }, 'Referensi dihapus');
});
