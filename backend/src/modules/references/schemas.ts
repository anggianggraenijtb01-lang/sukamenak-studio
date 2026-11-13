import { z } from 'zod';

/** PRD reference roles. Also the CHECK constraint on reference_assets.role. */
export const REFERENCE_ROLES = ['product', 'human_model', 'font', 'color', 'lighting', 'pose', 'background', 'style'] as const;
export type ReferenceRole = (typeof REFERENCE_ROLES)[number];

/** Multipart fields arrive as strings. */
const boolField = z.preprocess((v) => {
  if (v === true || v === 'true' || v === '1' || v === 'on') return true;
  if (v === false || v === 'false' || v === '0' || v === undefined || v === '') return false;
  return v;
}, z.boolean());

export const createReferenceSchemas = {
  body: z.object({
    role: z.enum(REFERENCE_ROLES),
    label: z.string().trim().max(80).optional(),
    consent_note: z.string().trim().max(500).optional(),
    consent_confirmed: boolField.default(false),
  }),
};

export const listMineSchemas = {
  query: z.object({
    role: z.enum(REFERENCE_ROLES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
};

export const listLibrarySchemas = {
  query: z.object({
    role: z.enum(REFERENCE_ROLES).optional(),
    template: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .max(100)
      .optional(),
  }),
};

export const referenceIdParams = { params: z.object({ id: z.string().uuid() }) };
