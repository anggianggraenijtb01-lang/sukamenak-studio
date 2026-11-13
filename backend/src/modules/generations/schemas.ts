import { z } from 'zod';

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(100);

export const createGenerationSchemas = {
  body: z
    .object({
      template_id: z.string().uuid().optional(),
      template_slug: slug.optional(),
      /** Omitted: i2i when references are given, otherwise t2i (or i2i for an i2i-only template). */
      mode: z.enum(['i2i', 't2i']).optional(),
      slot_values: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/).max(60), z.string().max(1000)).default({}),
      remarks: z.string().max(1000).optional(),
      reference_ids: z.array(z.string().uuid()).max(12).default([]),
      consent_confirmed: z.boolean().default(false),
    })
    .strict()
    .refine((b) => Boolean(b.template_id) !== Boolean(b.template_slug), {
      message: 'Kirim tepat satu dari template_id atau template_slug',
      path: ['template_id'],
    }),
};

export const generationIdParams = { params: z.object({ id: z.string().uuid() }) };

export const listGenerationsSchemas = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    status: z.enum(['queued', 'running', 'done', 'failed']).optional(),
    /** `false` (default) hides archived items, `true` shows only archived ones, `all` shows both. */
    archived: z.enum(['true', 'false', 'all']).default('false'),
  }),
};
