import { query, queryOne } from '../db/pool.js';
import { getActivePolicy, getSettings } from '../modules/shared/settings.js';

export interface GenerationRow {
  id: string;
  user_id: string;
  template_id: string | null;
  mode: 'i2i' | 't2i';
  subject: 'product' | 'human_model';
  publication: string;
  status: string;
  slot_values: Record<string, unknown>;
  remarks: string | null;
  reference_inputs: { reference_id: string; role: string }[];
  consent_confirmed: boolean;
  created_at: Date;
}

export interface SlotRow {
  key: string;
  label: string;
  type: string;
  blank_index: number | null;
  required: boolean;
  default_value: string | null;
  max_length: number | null;
  vision_role: string | null;
  source_hint: string | null;
}

export interface ZoneRow {
  slot_key: string;
  x: string;
  y: string;
  w: string;
  h: string;
  align: 'left' | 'center' | 'right';
  font_family: string;
  font_weight: number;
  font_size_ratio: string;
  color: string;
  max_lines: number;
}

export interface TemplateData {
  id: string;
  slug: string;
  core_prompt_key: string;
  aspect_ratio: string;
  slots: SlotRow[];
  zones: ZoneRow[];
}

export interface PipelineContext {
  gen: GenerationRow;
  template: TemplateData;
  palette: string[];
  brandName: string;
  blockedTerms: string[];
  watermarkEnabled: boolean;
  signal: AbortSignal;
  /** Set by the models that served each layer (vision and image: at most two per generation). */
  modelVisionId: string | null;
  modelImageId: string | null;
  degraded: boolean;
}

export const GENERATION_COLUMNS = `id, user_id, template_id, mode, subject, publication, status, slot_values, remarks,
  reference_inputs, consent_confirmed, created_at`;

export async function loadTemplateData(templateId: string): Promise<TemplateData | null> {
  const template = await queryOne<{ id: string; slug: string; core_prompt_key: string; aspect_ratio: string }>(
    'SELECT id, slug, core_prompt_key, aspect_ratio FROM templates WHERE id = $1 AND deleted_at IS NULL',
    [templateId],
  );
  if (!template) return null;
  const [slots, zones] = await Promise.all([
    query<SlotRow>(
      `SELECT key, label, type, blank_index, required, default_value, max_length, vision_role, source_hint
         FROM template_slots WHERE template_id = $1 ORDER BY sort_order, blank_index NULLS LAST, key`,
      [templateId],
    ),
    query<ZoneRow>(
      `SELECT slot_key, x, y, w, h, align, font_family, font_weight, font_size_ratio, color, max_lines
         FROM text_zones WHERE template_id = $1 ORDER BY slot_key`,
      [templateId],
    ),
  ]);
  return { ...template, slots, zones };
}

export async function loadBrand(): Promise<{ palette: string[]; name: string }> {
  const brand = await queryOne<{ name: string; palette: unknown }>(
    'SELECT name, palette FROM brand_identities WHERE is_default LIMIT 1',
  );
  const palette = Array.isArray(brand?.palette) ? (brand.palette as unknown[]).filter((c): c is string => typeof c === 'string') : [];
  return { palette, name: brand?.name ?? '' };
}

export async function loadSharedContext(): Promise<Pick<PipelineContext, 'palette' | 'brandName' | 'blockedTerms' | 'watermarkEnabled'>> {
  const [brand, policy, settings] = await Promise.all([loadBrand(), getActivePolicy(), getSettings()]);
  return { palette: brand.palette, brandName: brand.name, blockedTerms: policy.blocked_terms, watermarkEnabled: settings.watermark_enabled };
}

/** Slot values that are plain strings (the column is jsonb). */
export function stringValues(values: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) if (typeof v === 'string') out[k] = v;
  return out;
}
