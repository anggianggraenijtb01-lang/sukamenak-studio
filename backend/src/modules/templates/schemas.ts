import { z } from 'zod';

export const CATEGORIES = ['poster', 'psa', 'social_post', 'product_shot', 'human_model'] as const;
export const MODES = ['i2i', 't2i', 'both'] as const;
export const SUBJECTS = ['product', 'human_model'] as const;

export const listTemplatesSchemas = {
  query: z.object({
    category: z.enum(CATEGORIES).optional(),
    mode: z.enum(MODES).optional(),
    subject: z.enum(SUBJECTS).optional(),
    search: z.string().trim().max(80).optional(),
  }),
};

export const templateSlugSchemas = {
  params: z.object({ slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(100) }),
};
