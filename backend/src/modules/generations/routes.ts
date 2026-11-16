import { Router } from 'express';
import { accepted, ok, pageMeta } from '../../lib/response.js';
import { requireAuth } from '../../middleware/auth.js';
import { getValid, validate } from '../../middleware/validate.js';
import { createGenerationSchemas, generationIdParams, listGenerationsSchemas } from './schemas.js';
import * as service from './service.js';

export const generationsRouter = Router();

generationsRouter.use(requireAuth);
// Generation state changes while a job runs; clients poll, so nothing here may be cached.
generationsRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

generationsRouter.post('/', validate(createGenerationSchemas), async (req, res) => {
  const { body } = getValid(req, createGenerationSchemas);
  accepted(res, await service.createGeneration(req.user!.id, body), 'Permintaan diterima, gambar sedang dibuat');
});

generationsRouter.get('/', validate(listGenerationsSchemas), async (req, res) => {
  const { query } = getValid(req, listGenerationsSchemas);
  const { items, total } = await service.listMyGenerations(req.user!.id, query);
  ok(res, items, 'Daftar pembuatan gambar', pageMeta(query.page, query.limit, total));
});

generationsRouter.get('/:id', validate(generationIdParams), async (req, res) => {
  const { params } = getValid(req, generationIdParams);
  ok(res, await service.getMyGeneration(req.user!.id, params.id), 'Detail pembuatan gambar');
});

generationsRouter.post('/:id/archive', validate(generationIdParams), async (req, res) => {
  const { params } = getValid(req, generationIdParams);
  ok(res, await service.archiveMyGeneration(req.user!.id, params.id), 'Diarsipkan');
});

generationsRouter.delete('/:id', validate(generationIdParams), async (req, res) => {
  const { params } = getValid(req, generationIdParams);
  await service.deleteMyGeneration(req.user!.id, params.id);
  ok(res, { id: params.id }, 'Dihapus');
});
