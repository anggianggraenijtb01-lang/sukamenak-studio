import { Router } from 'express';
import { adminRouter } from './admin/routes.js';
import { authRouter } from './auth/routes.js';
import { filesRouter } from './files/routes.js';
import { galleryRouter } from './gallery/routes.js';
import { generationsRouter } from './generations/routes.js';
import { healthRouter } from './health/routes.js';
import { meRouter } from './me/routes.js';
import { promptsRouter } from './prompts/routes.js';
import { referencesRouter } from './references/routes.js';
import { templatesRouter } from './templates/routes.js';
import { tutorialsRouter } from './tutorials/routes.js';

/**
 * /api/v1 router. Phase C extends adminRouter.
 */
export function createApiRouter(): Router {
  const api = Router();
  api.use(healthRouter);
  api.use('/auth', authRouter);
  api.use('/me', meRouter);
  api.use('/templates', templatesRouter);
  api.use('/gallery', galleryRouter);
  api.use('/tutorials', tutorialsRouter);
  api.use('/prompts', promptsRouter);
  api.use('/references', referencesRouter);
  api.use('/generations', generationsRouter);
  api.use('/files', filesRouter);
  api.use('/admin', adminRouter);
  return api;
}
