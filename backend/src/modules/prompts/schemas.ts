import { z } from 'zod';

const promptText = z.string().trim().min(1, 'Teks wajib diisi').max(4000, 'Maksimal 4000 karakter');

export const analyzeSchemas = { body: z.object({ text: promptText }) };
export const improveSchemas = { body: z.object({ text: promptText }) };

export const idParams = { params: z.object({ id: z.string().uuid() }) };

export const listPromptsSchemas = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
};

export const createPromptSchemas = {
  body: z.object({
    title: z.string().trim().min(1).max(120),
    body: promptText,
    source: z.enum(['manual', 'imported']).default('manual'),
  }),
};

export const updatePromptSchemas = {
  params: idParams.params,
  body: z
    .object({
      title: z.string().trim().min(1).max(120).optional(),
      body: promptText.optional(),
    })
    .refine((v) => v.title !== undefined || v.body !== undefined, { message: 'Tidak ada perubahan yang dikirim' }),
};
