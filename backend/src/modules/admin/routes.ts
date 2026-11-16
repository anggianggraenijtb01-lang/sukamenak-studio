import { Router } from 'express';
import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { auditRouter } from './audit/routes.js';
import { corePromptsRouter } from './corePrompts/routes.js';
import { dashboardRouter } from './dashboard/routes.js';
import { galleryAdminRouter } from './gallery/routes.js';
import { generationsAdminRouter } from './generations/routes.js';
import { modelsRouter } from './models/routes.js';
import { referencesAdminRouter } from './references/routes.js';
import { settingsRouter } from './settings/routes.js';
import { templatesAdminRouter } from './templates/routes.js';
import { usersRouter } from './users/routes.js';

/**
 * Every /admin route sits behind authentication AND the admin role, enforced here once at the router level
 * so a route added to any sub-router below cannot forget it. Mounts are listed in ADMIN_MOUNTS so the RBAC
 * test can verify that nothing is attached to this router outside of them.
 */
export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('admin'));
// Admin data is live operational data: never cache it in the browser or a proxy.
adminRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

adminRouter.get('/ping', (req, res) => {
  ok(res, { pong: true, actor_id: req.user!.id }, 'Admin OK');
});

/** Path prefix -> sub-router. An empty prefix means the router defines its own absolute sub-paths. */
export const ADMIN_MOUNTS: ReadonlyArray<readonly [prefix: string, router: Router]> = [
  ['/users', usersRouter],
  ['/models', modelsRouter],
  ['/core-prompts', corePromptsRouter],
  ['/templates', templatesAdminRouter],
  ['/references', referencesAdminRouter],
  ['', settingsRouter], // /settings, /brand-identity, /policy
  ['/generations', generationsAdminRouter],
  ['/gallery', galleryAdminRouter],
  ['/audit', auditRouter],
  ['/dashboard', dashboardRouter],
];

for (const [prefix, router] of ADMIN_MOUNTS) {
  if (prefix) adminRouter.use(prefix, router);
  else adminRouter.use(router);
}
