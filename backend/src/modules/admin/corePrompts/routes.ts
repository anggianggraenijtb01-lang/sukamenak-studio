import { Router } from 'express';
import { env } from '../../../config/env.js';
import { created, ok, pageMeta } from '../../../lib/response.js';
import { createRateLimiter } from '../../../middleware/rateLimit.js';
import { getValid, validate } from '../../../middleware/validate.js';
import { adminCtx } from '../common.js';
import {
  corePromptIdSchemas,
  createCorePromptSchemas,
  listCorePromptsSchemas,
  testRenderSchemas,
  versionsSchemas,
} from './schemas.js';
import * as service from './service.js';

/**
 * WRITE-ONLY resource. No endpoint, here or anywhere else, returns a core prompt body, a fragment of
 * it, its ciphertext or a composed prompt; responses are built from metadata columns only (dto.ts).
 */
export const corePromptsRouter = Router();

const renderLimiter = createRateLimiter({ limit: env.ADMIN_TEST_RATE_LIMIT_PER_MINUTE, keyBy: 'user' });

corePromptsRouter.get('/', validate(listCorePromptsSchemas), async (req, res) => {
  const { query } = getValid(req, listCorePromptsSchemas);
  const { items, total } = await service.listCorePrompts(query);
  ok(res, items, 'Daftar core prompt (metadata)', pageMeta(query.page, query.limit, total));
});

// Static paths before `/:id`.
corePromptsRouter.get('/versions', validate(versionsSchemas), async (req, res) => {
  const { query } = getValid(req, versionsSchemas);
  ok(res, await service.listVersions(query.key), 'Versi core prompt (metadata)');
});

corePromptsRouter.post('/test-render', renderLimiter, validate(testRenderSchemas), async (req, res) => {
  const { body } = getValid(req, testRenderSchemas);
  ok(res, await service.testRender(adminCtx(req), body), 'Hasil uji render (core prompt disembunyikan)');
});

corePromptsRouter.post('/', validate(createCorePromptSchemas), async (req, res) => {
  const { body } = getValid(req, createCorePromptSchemas);
  created(res, await service.createCorePrompt(adminCtx(req), body), 'Versi core prompt dibuat');
});

corePromptsRouter.get('/:id', validate(corePromptIdSchemas), async (req, res) => {
  const { params } = getValid(req, corePromptIdSchemas);
  ok(res, await service.getCorePromptMeta(params.id), 'Detail core prompt (metadata)');
});

corePromptsRouter.post('/:id/activate', validate(corePromptIdSchemas), async (req, res) => {
  const { params } = getValid(req, corePromptIdSchemas);
  ok(res, await service.activateCorePrompt(adminCtx(req), params.id), 'Versi core prompt diaktifkan');
});
