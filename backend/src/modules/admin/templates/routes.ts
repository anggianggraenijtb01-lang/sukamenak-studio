import { Router } from 'express';
import { AppError } from '../../../lib/errors.js';
import { created, ok, pageMeta } from '../../../lib/response.js';
import { receiveAdminFile } from '../../../middleware/upload.js';
import { getValid, validate } from '../../../middleware/validate.js';
import { adminCtx } from '../common.js';
import {
  createSlotSchemas,
  createTemplateSchemas,
  createZoneSchemas,
  listTemplatesSchemas,
  slotParams,
  templateIdSchemas,
  updateSlotSchemas,
  updateTemplateSchemas,
  updateZoneSchemas,
  zoneParams,
} from './schemas.js';
import * as service from './service.js';

export const templatesAdminRouter = Router();

templatesAdminRouter.get('/', validate(listTemplatesSchemas), async (req, res) => {
  const { query } = getValid(req, listTemplatesSchemas);
  const { items, total } = await service.listTemplates(query);
  ok(res, items, 'Daftar template', pageMeta(query.page, query.limit, total));
});

templatesAdminRouter.post('/', validate(createTemplateSchemas), async (req, res) => {
  const { body } = getValid(req, createTemplateSchemas);
  created(res, await service.createTemplate(adminCtx(req), body), 'Template dibuat');
});

templatesAdminRouter.get('/:id', validate(templateIdSchemas), async (req, res) => {
  const { params } = getValid(req, templateIdSchemas);
  ok(res, await service.getTemplate(params.id), 'Detail template');
});

templatesAdminRouter.patch('/:id', validate(updateTemplateSchemas), async (req, res) => {
  const { params, body } = getValid(req, updateTemplateSchemas);
  ok(res, await service.updateTemplate(adminCtx(req), params.id, body), 'Template diperbarui');
});

templatesAdminRouter.delete('/:id', validate(templateIdSchemas), async (req, res) => {
  const { params } = getValid(req, templateIdSchemas);
  await service.deleteTemplate(adminCtx(req), params.id);
  ok(res, { id: params.id }, 'Template dihapus');
});

templatesAdminRouter.post('/:id/publish', validate(templateIdSchemas), async (req, res) => {
  const { params } = getValid(req, templateIdSchemas);
  ok(res, await service.publishTemplate(adminCtx(req), params.id), 'Template diterbitkan');
});

templatesAdminRouter.post('/:id/unpublish', validate(templateIdSchemas), async (req, res) => {
  const { params } = getValid(req, templateIdSchemas);
  ok(res, await service.unpublishTemplate(adminCtx(req), params.id), 'Penerbitan template dibatalkan');
});

templatesAdminRouter.post('/:id/archive', validate(templateIdSchemas), async (req, res) => {
  const { params } = getValid(req, templateIdSchemas);
  ok(res, await service.archiveTemplate(adminCtx(req), params.id), 'Template diarsipkan');
});

templatesAdminRouter.post('/:id/preview', receiveAdminFile, validate(templateIdSchemas), async (req, res) => {
  const { params } = getValid(req, templateIdSchemas);
  if (!req.file) {
    throw new AppError('VALIDATION_ERROR', 'File gambar wajib diunggah pada field "file"', { errors: [{ field: 'file', message: 'Wajib diisi' }] });
  }
  ok(res, await service.uploadPreview(adminCtx(req), params.id, req.file.buffer), 'Gambar pratinjau diunggah');
});

// --- slots -----------------------------------------------------------------------------------

templatesAdminRouter.post('/:id/slots', validate(createSlotSchemas), async (req, res) => {
  const { params, body } = getValid(req, createSlotSchemas);
  created(res, await service.createSlot(adminCtx(req), params.id, body), 'Slot dibuat');
});

templatesAdminRouter.patch('/:id/slots/:slotId', validate(updateSlotSchemas), async (req, res) => {
  const { params, body } = getValid(req, updateSlotSchemas);
  ok(res, await service.updateSlot(adminCtx(req), params.id, params.slotId, body), 'Slot diperbarui');
});

templatesAdminRouter.delete('/:id/slots/:slotId', validate(slotParams), async (req, res) => {
  const { params } = getValid(req, slotParams);
  await service.deleteSlot(adminCtx(req), params.id, params.slotId);
  ok(res, { id: params.slotId }, 'Slot dihapus');
});

// --- text zones ------------------------------------------------------------------------------

templatesAdminRouter.post('/:id/text-zones', validate(createZoneSchemas), async (req, res) => {
  const { params, body } = getValid(req, createZoneSchemas);
  created(res, await service.createZone(adminCtx(req), params.id, body), 'Text zone dibuat');
});

templatesAdminRouter.patch('/:id/text-zones/:zoneId', validate(updateZoneSchemas), async (req, res) => {
  const { params, body } = getValid(req, updateZoneSchemas);
  ok(res, await service.updateZone(adminCtx(req), params.id, params.zoneId, body), 'Text zone diperbarui');
});

templatesAdminRouter.delete('/:id/text-zones/:zoneId', validate(zoneParams), async (req, res) => {
  const { params } = getValid(req, zoneParams);
  await service.deleteZone(adminCtx(req), params.id, params.zoneId);
  ok(res, { id: params.zoneId }, 'Text zone dihapus');
});
