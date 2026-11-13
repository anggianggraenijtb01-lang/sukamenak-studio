import { z } from 'zod';
import { emailRules, passwordRules } from '../../auth/schemas.js';
import { boolQuery, idParams, pageFields, requireAnyKey } from '../common.js';

const role = z.enum(['creator', 'admin']);

export const listUsersSchemas = {
  query: z.object({
    ...pageFields(20, 100),
    search: z.string().trim().max(80).optional(),
    role: role.optional(),
    active: boolQuery.optional(),
  }),
};

export const userIdSchemas = idParams;

export const createUserSchemas = {
  body: z
    .object({
      email: emailRules,
      name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80),
      role: role.default('creator'),
      /** Omitted: a random temporary password is generated and returned once. */
      password: passwordRules.optional(),
      daily_limit_override: z.number().int().min(0).max(10_000).nullable().optional(),
    })
    .strict(),
};

export const updateUserSchemas = {
  params: idParams.params,
  body: requireAnyKey(
    z
      .object({
        name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80).optional(),
        role: role.optional(),
        is_active: z.boolean().optional(),
        daily_limit_override: z.number().int().min(0).max(10_000).nullable().optional(),
      })
      .strict(),
  ),
};
