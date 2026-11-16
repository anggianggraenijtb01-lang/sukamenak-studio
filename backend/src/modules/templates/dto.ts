import { assetUrl } from '../../storage/urls.js';

export interface TemplateRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  mode: string;
  subject: string;
  aspect_ratio: string;
  sort_order: number;
  preview_key: string | null;
}

export interface SlotRow {
  key: string;
  label: string;
  type: string;
  blank_index: number | null;
  required: boolean;
  default_value: string | null;
  options: unknown;
  max_length: number | null;
  vision_role: string | null;
  sort_order: number;
}

export interface TextZoneRow {
  slot_key: string;
  x: string;
  y: string;
  w: string;
  h: string;
  align: string;
  font_family: string;
  font_weight: number;
  font_size_ratio: string;
  color: string;
  max_lines: number;
}

export interface ExampleReferenceRow {
  id: string;
  role: string;
  label: string | null;
  storage_key: string;
}

export const toTemplateListItemDTO = (t: TemplateRow) => ({
  id: t.id,
  slug: t.slug,
  name: t.name,
  description: t.description,
  category: t.category,
  mode: t.mode,
  subject: t.subject,
  aspect_ratio: t.aspect_ratio,
  requires_consent: t.subject === 'human_model',
  preview_url: assetUrl(t.preview_key),
});

/**
 * `target` tells the client whether a slot steers the image (`image`) or is overlaid as text by
 * the application on a text zone (`overlay`). Internal wiring (blank index, source hints, the
 * core prompt key) is deliberately not exposed.
 */
export const toSlotDTO = (s: SlotRow) => ({
  key: s.key,
  label: s.label,
  type: s.type,
  target: s.blank_index === null ? ('overlay' as const) : ('image' as const),
  required: s.required,
  default_value: s.default_value,
  options: s.options ?? null,
  max_length: s.max_length,
  reference_role: s.vision_role,
});

export const toTextZoneDTO = (z: TextZoneRow) => ({
  slot_key: z.slot_key,
  x: Number(z.x),
  y: Number(z.y),
  w: Number(z.w),
  h: Number(z.h),
  align: z.align,
  font_family: z.font_family,
  font_weight: z.font_weight,
  font_size_ratio: Number(z.font_size_ratio),
  color: z.color,
  max_lines: z.max_lines,
});

export const toExampleReferenceDTO = (r: ExampleReferenceRow) => ({
  id: r.id,
  role: r.role,
  label: r.label,
  url: assetUrl(r.storage_key),
});

export const toTemplateDetailDTO = (
  t: TemplateRow,
  slots: SlotRow[],
  zones: TextZoneRow[],
  examples: ExampleReferenceRow[],
  disclaimer: string | null,
) => ({
  ...toTemplateListItemDTO(t),
  slots: slots.map(toSlotDTO),
  text_zones: zones.map(toTextZoneDTO),
  example_references: examples.map(toExampleReferenceDTO),
  disclaimer,
});
