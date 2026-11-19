import { Router } from 'express';
import { z } from 'zod';
import { accepted, ok, pageMeta } from '../../lib/response.js';
import { requireAuth } from '../../middleware/auth.js';
import { getValid, validate } from '../../middleware/validate.js';
import { createVideoJob, DEFAULT_VIDEO_DURATION, MIN_VIDEO_DURATION } from '../../video/service.js';
import { createGenerationSchemas, generationIdParams, listGenerationsSchemas } from './schemas.js';
import * as service from './service.js';

export const generationsRouter = Router();

/** Video render of this poster; kept on the generation URL so the two stay linked. */
export const generationVideoSchemas = {
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      // Same constants the service enforces. The upper bound is deploy-time (VIDEO_MAX_DURATION_SECONDS)
      // and is checked there, so it is deliberately not duplicated here.
      duration_seconds: z.number().int().min(MIN_VIDEO_DURATION).default(DEFAULT_VIDEO_DURATION),
    })
    .strict()
    .default({}),
};

generationsRouter.use(requireAuth);
// Generation state changes while a job runs; clients poll, so nothing here may be cached.
generationsRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

generationsRouter.post('/:id/video', validate(generationVideoSchemas), async (req, res) => {
  const { params, body } = getValid(req, generationVideoSchemas);
  const job = await createVideoJob(req.user!.id, params.id, { durationSeconds: body.duration_seconds });
  accepted(res, job, 'Video sedang dibuat');
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
