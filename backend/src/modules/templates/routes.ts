import { Router } from 'express';
import { ok } from '../../lib/response.js';
import { getValid, validate } from '../../middleware/validate.js';
import { listTemplatesSchemas, templateSlugSchemas } from './schemas.js';
import * as service from './service.js';

export const templatesRouter = Router();

templatesRouter.get('/', validate(listTemplatesSchemas), async (req, res) => {
  const { query } = getValid(req, listTemplatesSchemas);
  ok(res, await service.listPublishedTemplates(query), 'Daftar template');
});

templatesRouter.get('/:slug', validate(templateSlugSchemas), async (req, res) => {
  const { params } = getValid(req, templateSlugSchemas);
  ok(res, await service.getPublishedTemplate(params.slug), 'Detail template');
});
