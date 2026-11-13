import { z } from 'zod';
import { boolQuery, idParams, pageFields } from '../common.js';

/** Mirrors the CHECK on core_prompts.key, e.g. `product.poster`. */
export const CORE_PROMPT_KEY = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const keyField = z.string().trim().max(80).regex(CORE_PROMPT_KEY, 'Gunakan format seperti product.poster');

const SUBJECTS = ['product', 'human_model'] as const;
const PUBLICATIONS = ['poster', 'psa', 'social_post', 'product_shot', 'human_model'] as const;

export const listCorePromptsSchemas = {
  query: z.object({
    ...pageFields(50, 100),
    key: keyField.optional(),
    active: boolQuery.optional(),
  }),
};

export const versionsSchemas = { query: z.object({ key: keyField }) };

export const corePromptIdSchemas = idParams;

export const createCorePromptSchemas = {
  body: z
    .object({
      key: keyField,
      subject: z.enum(SUBJECTS),
      publication: z.enum(PUBLICATIONS),
      /** WRITE-ONLY: accepted here, encrypted, and never returned by any endpoint. */
      body: z.string().min(20, 'Terlalu pendek').max(8000, 'Maksimal 8000 karakter'),
    })
    .strict(),
};

export const testRenderSchemas = {
  body: z
    .object({
      key: keyField.optional(),
      id: z.string().uuid().optional(),
      template_slug: z
        .string()
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
        .max(100)
        .optional(),
      /** Without a template, blanks are addressed as `blank_1`, `blank_2`, ... */
      slot_values: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/).max(60), z.string().max(1000)).default({}),
      remarks: z.string().max(1000).optional(),
    })
    .strict()
    .refine((b) => Boolean(b.key) !== Boolean(b.id), { message: 'Kirim tepat satu dari key atau id', path: ['key'] }),
};
