import { Router } from 'express';
import { env } from '../../config/env.js';
import { created, ok, pageMeta } from '../../lib/response.js';
import { requireAuth } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';
import { getValid, validate } from '../../middleware/validate.js';
import {
  analyzeSchemas,
  createPromptSchemas,
  idParams,
  improveSchemas,
  listPromptsSchemas,
  updatePromptSchemas,
} from './schemas.js';
import * as service from './service.js';

export const promptsRouter = Router();

promptsRouter.use(requireAuth);

const improveLimiter = createRateLimiter({ limit: env.IMPROVE_RATE_LIMIT_PER_MINUTE, keyBy: 'user' });

// Registered before `/:id` so "analyze" / "improve" are never parsed as ids.
promptsRouter.post('/analyze', validate(analyzeSchemas), (req, res) => {
  const { body } = getValid(req, analyzeSchemas);
  ok(res, service.analyze(body.text), 'Analisis prompt');
});

promptsRouter.post('/improve', improveLimiter, validate(improveSchemas), async (req, res) => {
  const { body } = getValid(req, improveSchemas);
  ok(res, await service.improve(req.user!.id, body.text), 'Prompt diperbaiki');
});

promptsRouter.get('/', validate(listPromptsSchemas), async (req, res) => {
  const { query } = getValid(req, listPromptsSchemas);
  const { items, total } = await service.listUserPrompts(req.user!.id, query.page, query.limit);
  ok(res, items, 'Prompt tersimpan', pageMeta(query.page, query.limit, total));
});

promptsRouter.post('/', validate(createPromptSchemas), async (req, res) => {
  const { body } = getValid(req, createPromptSchemas);
  created(res, await service.createUserPrompt(req.user!.id, body), 'Prompt disimpan');
});

promptsRouter.get('/:id', validate(idParams), async (req, res) => {
  const { params } = getValid(req, idParams);
  ok(res, await service.getUserPrompt(req.user!.id, params.id), 'Detail prompt');
});

promptsRouter.patch('/:id', validate(updatePromptSchemas), async (req, res) => {
  const { params, body } = getValid(req, updatePromptSchemas);
  ok(res, await service.updateUserPrompt(req.user!.id, params.id, body), 'Prompt diperbarui');
});

promptsRouter.delete('/:id', validate(idParams), async (req, res) => {
  const { params } = getValid(req, idParams);
  await service.deleteUserPrompt(req.user!.id, params.id);
  ok(res, { deleted: true }, 'Prompt dihapus');
});
