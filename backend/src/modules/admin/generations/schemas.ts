import { z } from 'zod';
import { boolQuery, dateOnly, idParams, pageFields } from '../common.js';

const filterShape = {
  status: z.enum(['queued', 'running', 'done', 'failed']).optional(),
  user: z.string().uuid().optional(),
  template: z.string().uuid().optional(),
  /** Matches the vision OR the image model that served the generation. */
  model: z.string().uuid().optional(),
  mode: z.enum(['i2i', 't2i']).optional(),
  /** Inclusive calendar dates in APP_TIMEZONE. */
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  degraded: boolQuery.optional(),
  flagged: boolQuery.optional(),
};

const dateOrder = (v: { from?: string; to?: string }, ctx: z.RefinementCtx) => {
  if (v.from && v.to && v.from > v.to) ctx.addIssue({ code: 'custom', path: ['to'], message: 'Harus sama atau setelah from' });
};

export const generationFilters = z.object(filterShape).superRefine(dateOrder);
export type GenerationFilters = z.infer<typeof generationFilters>;

export const listGenerationsSchemas = {
  query: z.object({ ...pageFields(20, 100), ...filterShape }).superRefine(dateOrder),
};

export const exportGenerationsSchemas = { query: generationFilters };

export const generationIdSchemas = idParams;

export const flagGenerationSchemas = {
  params: idParams.params,
  body: z
    .object({
      flagged: z.boolean(),
      note: z.string().trim().max(500).optional(),
    })
    .strict(),
};
