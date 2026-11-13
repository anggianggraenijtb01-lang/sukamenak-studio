import { z } from 'zod';
import { boolQuery, idParams, pageFields, requireAnyKey } from '../common.js';

export const PROVIDERS = ['mock', 'openai_compat', 'gemini', 'fal'] as const;
export const CAPABILITIES = ['vision', 'text', 't2i', 'i2i'] as const;

/** Mirrors the CHECK on model_configs.api_key_env: the NAME of an environment variable, never a key. */
export const apiKeyEnvName = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Harus berupa nama variabel lingkungan (huruf besar, angka, garis bawah), bukan nilai API key')
  .max(80);

/** http(s) URL without embedded credentials or a query string (keys must never ride along in a URL). */
const baseUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => {
    try {
      const u = new URL(v);
      return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password && !u.search && !u.hash;
    } catch {
      return false;
    }
  }, 'Gunakan URL http(s) tanpa kredensial, query, atau fragment');

const fields = {
  name: z.string().trim().min(2).max(80),
  model_id: z.string().trim().min(1).max(160),
  base_url: baseUrl.nullable(),
  api_key_env: apiKeyEnvName.nullable(),
  priority: z.number().int().min(0).max(10_000),
  cost_per_call_usd: z.number().min(0).max(1000),
  timeout_ms: z.number().int().min(1000).max(600_000),
  notes: z.string().trim().max(500).nullable(),
};

export const listModelsSchemas = {
  query: z.object({
    ...pageFields(50, 100),
    capability: z.enum(CAPABILITIES).optional(),
    provider: z.enum(PROVIDERS).optional(),
    active: boolQuery.optional(),
  }),
};

export const modelIdSchemas = idParams;

export const createModelSchemas = {
  body: z
    .object({
      name: fields.name,
      provider: z.enum(PROVIDERS),
      capability: z.enum(CAPABILITIES),
      model_id: fields.model_id,
      base_url: fields.base_url.optional(),
      api_key_env: fields.api_key_env.optional(),
      priority: fields.priority.default(100),
      cost_per_call_usd: fields.cost_per_call_usd.default(0),
      timeout_ms: fields.timeout_ms.default(60_000),
      notes: fields.notes.optional(),
      is_active: z.boolean().default(false),
    })
    .strict()
    .superRefine((v, ctx) => {
      if (v.provider === 'mock') {
        if (v.api_key_env) ctx.addIssue({ code: 'custom', path: ['api_key_env'], message: 'Provider mock tidak memakai API key' });
        return;
      }
      if (!v.api_key_env) ctx.addIssue({ code: 'custom', path: ['api_key_env'], message: 'Wajib diisi untuk provider ini' });
      if (v.provider === 'openai_compat' && !v.base_url) {
        ctx.addIssue({ code: 'custom', path: ['base_url'], message: 'Wajib diisi untuk provider openai_compat' });
      }
    }),
};

/** `provider` and `capability` are immutable: delete and recreate the model to change them. */
export const updateModelSchemas = {
  params: idParams.params,
  body: requireAnyKey(
    z
      .object({
        name: fields.name.optional(),
        model_id: fields.model_id.optional(),
        base_url: fields.base_url.optional(),
        api_key_env: fields.api_key_env.optional(),
        priority: fields.priority.optional(),
        cost_per_call_usd: fields.cost_per_call_usd.optional(),
        timeout_ms: fields.timeout_ms.optional(),
        notes: fields.notes.optional(),
      })
      .strict(),
  ),
};

export const deactivateModelSchemas = {
  params: idParams.params,
  body: z.object({ new_default_id: z.string().uuid().optional() }).strict().default({}),
};
