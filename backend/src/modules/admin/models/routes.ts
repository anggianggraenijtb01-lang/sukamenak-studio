import { Router } from 'express';
import { env } from '../../../config/env.js';
import { created, ok, pageMeta } from '../../../lib/response.js';
import { createRateLimiter } from '../../../middleware/rateLimit.js';
import { getValid, validate } from '../../../middleware/validate.js';
import { adminCtx } from '../common.js';
import { createModelSchemas, deactivateModelSchemas, listModelsSchemas, modelIdSchemas, updateModelSchemas } from './schemas.js';
import * as service from './service.js';

export const modelsRouter = Router();

// A test may call a paid provider, so it is rate limited per admin.
const testLimiter = createRateLimiter({ limit: env.ADMIN_TEST_RATE_LIMIT_PER_MINUTE, keyBy: 'user' });

modelsRouter.get('/', validate(listModelsSchemas), async (req, res) => {
  const { query } = getValid(req, listModelsSchemas);
  const { items, total } = await service.listModels(query);
  ok(res, items, 'Daftar model', pageMeta(query.page, query.limit, total));
});

modelsRouter.post('/', validate(createModelSchemas), async (req, res) => {
  const { body } = getValid(req, createModelSchemas);
  created(res, await service.createModel(adminCtx(req), body), 'Model dibuat');
});

modelsRouter.get('/:id', validate(modelIdSchemas), async (req, res) => {
  const { params } = getValid(req, modelIdSchemas);
  ok(res, await service.getModel(params.id), 'Detail model');
});

modelsRouter.patch('/:id', validate(updateModelSchemas), async (req, res) => {
  const { params, body } = getValid(req, updateModelSchemas);
  ok(res, await service.updateModel(adminCtx(req), params.id, body), 'Model diperbarui');
});

modelsRouter.delete('/:id', validate(modelIdSchemas), async (req, res) => {
  const { params } = getValid(req, modelIdSchemas);
  await service.deleteModel(adminCtx(req), params.id);
  ok(res, { id: params.id }, 'Model dihapus');
});

modelsRouter.post('/:id/set-default', validate(modelIdSchemas), async (req, res) => {
  const { params } = getValid(req, modelIdSchemas);
  ok(res, await service.setDefault(adminCtx(req), params.id), 'Model default diubah');
});

modelsRouter.post('/:id/activate', validate(modelIdSchemas), async (req, res) => {
  const { params } = getValid(req, modelIdSchemas);
  ok(res, await service.activateModel(adminCtx(req), params.id), 'Model diaktifkan');
});

modelsRouter.post('/:id/deactivate', validate(deactivateModelSchemas), async (req, res) => {
  const { params, body } = getValid(req, deactivateModelSchemas);
  ok(res, await service.deactivateModel(adminCtx(req), params.id, body.new_default_id), 'Model dinonaktifkan');
});

modelsRouter.post('/:id/test', testLimiter, validate(modelIdSchemas), async (req, res) => {
  const { params } = getValid(req, modelIdSchemas);
  const result = await service.testModel(adminCtx(req), params.id);
  ok(res, result, result.ok ? 'Uji model berhasil' : 'Uji model gagal');
});
