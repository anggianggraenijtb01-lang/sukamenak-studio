import { assetUrl } from '../../../storage/urls.js';

export interface AdminTemplateRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  mode: string;
  subject: string;
  aspect_ratio: string;
  core_prompt_key: string;
  status: string;
  sort_order: number;
  preview_asset_id: string | null;
  preview_key: string | null;
  slot_count: number;
  zone_count: number;
  created_at: Date;
  updated_at: Date;
}

export const ADMIN_TEMPLATE_SELECT = `
  SELECT t.id, t.slug, t.name, t.description, t.category, t.mode, t.subject, t.aspect_ratio, t.core_prompt_key,
         t.status, t.sort_order, t.preview_asset_id, a.storage_key AS preview_key, t.created_at, t.updated_at,
         (SELECT count(*) FROM template_slots s WHERE s.template_id = t.id) AS slot_count,
         (SELECT count(*) FROM text_zones z WHERE z.template_id = t.id) AS zone_count
    FROM templates t
    LEFT JOIN assets a ON a.id = t.preview_asset_id AND a.deleted_at IS NULL`;

export interface AdminSlotRow {
  id: string;
  key: string;
  label: string;
  type: string;
  blank_index: number | null;
  required: boolean;
  default_value: string | null;
  options: unknown;
  max_length: number | null;
  vision_role: string | null;
  source_hint: string | null;
  sort_order: number;
}

export const SLOT_COLUMNS = 'id, key, label, type, blank_index, required, default_value, options, max_length, vision_role, source_hint, sort_order';

export interface AdminZoneRow {
  id: string;
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

export const ZONE_COLUMNS = 'id, slot_key, x, y, w, h, align, font_family, font_weight, font_size_ratio, color, max_lines';

export interface PublishIssue {
  code: string;
  message: string;
}

/** Admin view. `core_prompt_key` is the NAME of a core prompt (metadata); its text is never exposed. */
export const toAdminTemplateDTO = (t: AdminTemplateRow) => ({
  id: t.id,
  slug: t.slug,
  name: t.name,
  description: t.description,
  category: t.category,
  mode: t.mode,
  subject: t.subject,
  aspect_ratio: t.aspect_ratio,
  core_prompt_key: t.core_prompt_key,
  status: t.status,
  sort_order: t.sort_order,
  preview_url: assetUrl(t.preview_key),
  slot_count: t.slot_count,
  zone_count: t.zone_count,
  created_at: t.created_at,
  updated_at: t.updated_at,
});

export const toAdminSlotDTO = (s: AdminSlotRow) => ({
  id: s.id,
  key: s.key,
  label: s.label,
  type: s.type,
  blank_index: s.blank_index,
  required: s.required,
  default_value: s.default_value,
  options: s.options ?? null,
  max_length: s.max_length,
  vision_role: s.vision_role,
  source_hint: s.source_hint,
  sort_order: s.sort_order,
});

export const toAdminZoneDTO = (z: AdminZoneRow) => ({
  id: z.id,
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

export const TEMPLATE_AUDIT_FIELDS = [
  'slug', 'name', 'description', 'category', 'mode', 'subject', 'aspect_ratio', 'core_prompt_key', 'status', 'sort_order',
] as const;
export const SLOT_AUDIT_FIELDS = [
  'key', 'label', 'type', 'blank_index', 'required', 'default_value', 'options', 'max_length', 'vision_role', 'source_hint', 'sort_order',
] as const;
export const ZONE_AUDIT_FIELDS = [
  'slot_key', 'x', 'y', 'w', 'h', 'align', 'font_family', 'font_weight', 'font_size_ratio', 'color', 'max_lines',
] as const;
