import { assetUrl } from '../../storage/urls.js';

export interface GenerationListRow {
  id: string;
  mode: string;
  subject: string;
  publication: string;
  status: string;
  progress_step: string | null;
  slot_values: Record<string, unknown> | null;
  remarks: string | null;
  reference_inputs: { reference_id: string; role: string }[] | null;
  used_reference_image: boolean;
  reference_count_used: number;
  composited_text: boolean;
  degraded: boolean;
  error_code: string | null;
  duration_ms: number | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
  template_id: string | null;
  template_slug: string | null;
  template_name: string | null;
  result_key: string | null;
  thumbnail_key: string | null;
  result_width: number | null;
  result_height: number | null;
}

/** Columns the serializer reads. Prompt columns (final_prompt_*), costs, model ids and event data are never selected. */
export const GENERATION_SELECT = `
  SELECT g.id, g.mode, g.subject, g.publication, g.status, g.progress_step, g.slot_values, g.remarks,
         g.reference_inputs, g.used_reference_image, g.reference_count_used, g.composited_text, g.degraded,
         g.error_code, g.duration_ms, g.archived_at, g.created_at, g.updated_at,
         t.id AS template_id, t.slug AS template_slug, t.name AS template_name,
         ra.storage_key AS result_key, ta.storage_key AS thumbnail_key, ra.width AS result_width, ra.height AS result_height
    FROM generations g
    LEFT JOIN templates t ON t.id = g.template_id
    LEFT JOIN assets ra ON ra.id = g.result_asset_id AND ra.deleted_at IS NULL
    LEFT JOIN assets ta ON ta.id = g.thumbnail_asset_id AND ta.deleted_at IS NULL`;

/**
 * Explicit allowlist. There is deliberately no prompt, analysis, ciphertext, cost or model field here:
 * anything not listed below cannot reach a response, whatever the row contains.
 */
export const toGenerationDTO = (g: GenerationListRow) => {
  const done = g.status === 'done';
  return {
    id: g.id,
    status: g.status,
    progress_step: g.progress_step,
    template: g.template_id ? { id: g.template_id, slug: g.template_slug, name: g.template_name } : null,
    mode: g.mode,
    subject: g.subject,
    publication: g.publication,
    slot_values: g.slot_values ?? {},
    remarks: g.remarks,
    references: (g.reference_inputs ?? []).map((r) => ({ id: r.reference_id, role: r.role })),
    used_reference_image: g.used_reference_image,
    reference_count_used: g.reference_count_used,
    composited_text: g.composited_text,
    degraded: g.degraded,
    error_code: g.status === 'failed' ? g.error_code : null,
    result_url: done ? assetUrl(g.result_key) : null,
    thumbnail_url: done ? assetUrl(g.thumbnail_key) : null,
    width: done ? g.result_width : null,
    height: done ? g.result_height : null,
    duration_ms: g.duration_ms,
    archived: g.archived_at !== null,
    created_at: g.created_at,
    updated_at: g.updated_at,
  };
};
