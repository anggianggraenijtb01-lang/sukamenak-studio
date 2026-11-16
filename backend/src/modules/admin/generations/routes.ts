import { Router } from 'express';
import { ok, pageMeta } from '../../../lib/response.js';
import { getValid, validate } from '../../../middleware/validate.js';
import { adminCtx } from '../common.js';
import { exportGenerationsSchemas, flagGenerationSchemas, generationIdSchemas, listGenerationsSchemas } from './schemas.js';
import * as service from './service.js';

export const generationsAdminRouter = Router();

generationsAdminRouter.get('/', validate(listGenerationsSchemas), async (req, res) => {
  const { query } = getValid(req, listGenerationsSchemas);
  const { items, total } = await service.listGenerations(query);
  ok(res, items, 'Log pembuatan gambar', pageMeta(query.page, query.limit, total));
});

// Registered before `/:id` so "export.csv" is never parsed as an id.
generationsAdminRouter.get('/export.csv', validate(exportGenerationsSchemas), async (req, res) => {
  const { query } = getValid(req, exportGenerationsSchemas);
  await service.streamGenerationsCsv(adminCtx(req), query, res);
});

generationsAdminRouter.get('/:id', validate(generationIdSchemas), async (req, res) => {
  const { params } = getValid(req, generationIdSchemas);
  ok(res, await service.getGeneration(params.id), 'Detail pembuatan gambar');
});

generationsAdminRouter.post('/:id/flag', validate(flagGenerationSchemas), async (req, res) => {
  const { params, body } = getValid(req, flagGenerationSchemas);
  ok(res, await service.flagGeneration(adminCtx(req), params.id, body), body.flagged ? 'Ditandai' : 'Tanda dihapus');
});
