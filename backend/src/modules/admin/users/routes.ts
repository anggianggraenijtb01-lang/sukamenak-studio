import { Router } from 'express';
import { ok, pageMeta } from '../../../lib/response.js';
import { getValid, validate } from '../../../middleware/validate.js';
import { adminCtx } from '../common.js';
import { createUserSchemas, listUsersSchemas, updateUserSchemas, userIdSchemas } from './schemas.js';
import * as service from './service.js';

export const usersRouter = Router();

usersRouter.get('/', validate(listUsersSchemas), async (req, res) => {
  const { query } = getValid(req, listUsersSchemas);
  const { items, total } = await service.listUsers(query);
  ok(res, items, 'Daftar pengguna', { ...pageMeta(query.page, query.limit, total), ...(await service.adminMeta()) });
});

usersRouter.post('/', validate(createUserSchemas), async (req, res) => {
  const { body } = getValid(req, createUserSchemas);
  const result = await service.createUser(adminCtx(req), body);
  ok(res, result, 'Pengguna dibuat', await service.adminMeta(), 201);
});

usersRouter.get('/:id', validate(userIdSchemas), async (req, res) => {
  const { params } = getValid(req, userIdSchemas);
  ok(res, await service.getUser(params.id), 'Detail pengguna');
});

usersRouter.patch('/:id', validate(updateUserSchemas), async (req, res) => {
  const { params, body } = getValid(req, updateUserSchemas);
  ok(res, await service.updateUser(adminCtx(req), params.id, body), 'Pengguna diperbarui', await service.adminMeta());
});

usersRouter.post('/:id/reset-password', validate(userIdSchemas), async (req, res) => {
  const { params } = getValid(req, userIdSchemas);
  ok(res, await service.resetPassword(adminCtx(req), params.id), 'Kata sandi sementara dibuat. Tampil sekali saja.');
});

usersRouter.post('/:id/revoke-sessions', validate(userIdSchemas), async (req, res) => {
  const { params } = getValid(req, userIdSchemas);
  ok(res, await service.revokeSessions(adminCtx(req), params.id), 'Sesi dicabut');
});

usersRouter.delete('/:id', validate(userIdSchemas), async (req, res) => {
  const { params } = getValid(req, userIdSchemas);
  await service.deleteUser(adminCtx(req), params.id);
  ok(res, { id: params.id }, 'Pengguna dihapus', await service.adminMeta());
});
