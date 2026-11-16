import { z } from 'zod';
import { boolQuery, idParams, pageFields, requireAnyKey, SLUG } from '../common.js';

const title = z.string().trim().min(1).max(120);
const displayPrompt = z.string().trim().max(1000);
const slug = z.string().regex(SLUG).max(100);

/** JSON requests send real booleans, multipart sends strings. */
const boolField = z.preprocess((v) => {
  if (v === true || v === 'true' || v === '1' || v === 'on') return true;
  if (v === false || v === 'false' || v === '0' || v === undefined || v === '') return false;
  return v;
}, z.boolean());

/** Multipart can only carry slot values as a JSON string. */
const slotValuesField = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  },
  z.record(z.string().regex(/^[a-z][a-z0-9_]*$/).max(60), z.string().max(1000)),
);

export const listGallerySchemas = {
  query: z.object({
    ...pageFields(20, 100),
    hidden: boolQuery.optional(),
    featured: boolQuery.optional(),
    template: slug.optional(),
    search: z.string().trim().max(80).optional(),
  }),
};

export const galleryIdSchemas = idParams;

/**
 * The only way a gallery item comes into existence: from a finished generation (`generation_id`) or from an
 * uploaded image plus a template (`file`, `template_id|template_slug`). `display_prompt` is never accepted
 * here: it is built from slot values and remarks only.
 */
export const createGallerySchemas = {
  body: z
    .object({
      generation_id: z.string().uuid().optional(),
      template_id: z.string().uuid().optional(),
      template_slug: slug.optional(),
      title,
      slot_values: slotValuesField.optional(),
      remarks: z.string().trim().max(1000).optional(),
      is_featured: boolField.default(false),
      is_hidden: boolField.default(false),
      sort_order: z.coerce.number().int().min(-100_000).max(100_000).default(0),
    })
    .strict()
    .superRefine((b, ctx) => {
      if (b.generation_id && (b.template_id || b.template_slug || b.slot_values || b.remarks)) {
        ctx.addIssue({ code: 'custom', path: ['generation_id'], message: 'Dari generation_id, template/slot_values/remarks diambil otomatis dan tidak boleh dikirim' });
      }
      if (b.template_id && b.template_slug) {
        ctx.addIssue({ code: 'custom', path: ['template_id'], message: 'Kirim salah satu dari template_id atau template_slug' });
      }
    }),
};

export const updateGallerySchemas = {
  params: idParams.params,
  body: requireAnyKey(
    z
      .object({
        title: title.optional(),
        display_prompt: displayPrompt.optional(),
        is_featured: z.boolean().optional(),
        is_hidden: z.boolean().optional(),
        sort_order: z.number().int().min(-100_000).max(100_000).optional(),
      })
      .strict(),
  ),
};
