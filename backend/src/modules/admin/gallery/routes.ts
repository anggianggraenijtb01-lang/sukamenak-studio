import { Router } from 'express';
import { created, ok, pageMeta } from '../../../lib/response.js';
import { receiveAdminFileIfMultipart } from '../../../middleware/upload.js';
import { getValid, validate } from '../../../middleware/validate.js';
import { adminCtx } from '../common.js';
import { createGallerySchemas, galleryIdSchemas, listGallerySchemas, updateGallerySchemas } from './schemas.js';
import * as service from './service.js';

export const galleryAdminRouter = Router();

galleryAdminRouter.get('/', validate(listGallerySchemas), async (req, res) => {
  const { query } = getValid(req, listGallerySchemas);
  const { items, total } = await service.listGallery(query);
  ok(res, items, 'Galeri (termasuk tersembunyi)', pageMeta(query.page, query.limit, total));
});

// JSON ({ generation_id, title }) or multipart (file + template + slot_values + title).
galleryAdminRouter.post('/', receiveAdminFileIfMultipart, validate(createGallerySchemas), async (req, res) => {
  const { body } = getValid(req, createGallerySchemas);
  created(res, await service.createGalleryItem(adminCtx(req), { ...body, file: req.file?.buffer }), 'Item galeri dibuat');
});

galleryAdminRouter.patch('/:id', validate(updateGallerySchemas), async (req, res) => {
  const { params, body } = getValid(req, updateGallerySchemas);
  ok(res, await service.updateGalleryItem(adminCtx(req), params.id, body), 'Item galeri diperbarui');
});

galleryAdminRouter.delete('/:id', validate(galleryIdSchemas), async (req, res) => {
  const { params } = getValid(req, galleryIdSchemas);
  await service.deleteGalleryItem(adminCtx(req), params.id);
  ok(res, { id: params.id }, 'Item galeri dihapus');
});
