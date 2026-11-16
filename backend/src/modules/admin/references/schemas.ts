import { z } from 'zod';
import { idParams, pageFields, requireAnyKey, SLUG } from '../common.js';
import { REFERENCE_ROLES } from '../../references/schemas.js';

const label = z.string().trim().max(80);
const consent = z.string().trim().max(500);
const slug = z.string().regex(SLUG).max(100);

export const listReferencesSchemas = {
  query: z.object({
    ...pageFields(20, 100),
    role: z.enum(REFERENCE_ROLES).optional(),
    template: slug.optional(),
    search: z.string().trim().max(80).optional(),
  }),
};

export const referenceIdSchemas = idParams;

/** Multipart fields arrive as strings. */
export const createReferenceSchemas = {
  body: z.object({
    role: z.enum(REFERENCE_ROLES),
    label: label.optional(),
    consent_note: consent.optional(),
    template_id: z.string().uuid().optional(),
    template_slug: slug.optional(),
  }),
};

export const updateReferenceSchemas = {
  params: idParams.params,
  body: requireAnyKey(
    z
      .object({
        role: z.enum(REFERENCE_ROLES).optional(),
        label: label.nullable().optional(),
        consent_note: consent.nullable().optional(),
        template_id: z.string().uuid().nullable().optional(),
      })
      .strict(),
  ),
};
