import { Router } from 'express';
import { z } from 'zod';
import { accepted, ok, pageMeta } from '../../lib/response.js';
import { requireAuth } from '../../middleware/auth.js';
import { getValid, validate } from '../../middleware/validate.js';
import * as service from '../../video/service.js';

const idParams = { params: z.object({ id: z.string().uuid() }) };

/** An edit re-renders the existing job, so the body is the new cut length and nothing else. */
const updateSchemas = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ duration_seconds: z.number().int().min(service.MIN_VIDEO_DURATION) }),
};

const listSchemas = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    generation_id: z.string().uuid().optional(),
  }),
};

export const videoRouter = Router();

videoRouter.use(requireAuth);
// Render state changes while a job runs; clients poll, so nothing here may be cached.
videoRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

videoRouter.get('/', validate(listSchemas), async (req, res) => {
  const { query } = getValid(req, listSchemas);
  const { items, total } = await service.listMyVideoJobs(req.user!.id, query);
  ok(res, items, 'Daftar video', pageMeta(query.page, query.limit, total));
});

videoRouter.get('/quota', async (req, res) => {
  ok(res, await service.getVideoQuota(req.user!.id), 'Kuota video hari ini');
});

videoRouter.get('/:id', validate(idParams), async (req, res) => {
  const { params } = getValid(req, idParams);
  ok(res, await service.getMyVideoJob(req.user!.id, params.id), 'Detail video');
});

videoRouter.patch('/:id', validate(updateSchemas), async (req, res) => {
  const { params, body } = getValid(req, updateSchemas);
  const job = await service.updateMyVideoJob(req.user!.id, params.id, { durationSeconds: body.duration_seconds });
  accepted(res, job, 'Video sedang dibuat ulang');
});

videoRouter.delete('/:id', validate(idParams), async (req, res) => {
  const { params } = getValid(req, idParams);
  await service.deleteMyVideoJob(req.user!.id, params.id);
  ok(res, { id: params.id }, 'Dihapus');
});


