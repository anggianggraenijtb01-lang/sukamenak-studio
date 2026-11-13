import { query, queryOne } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import { getActivePolicy } from '../shared/settings.js';
import {
  toTemplateDetailDTO,
  toTemplateListItemDTO,
  type ExampleReferenceRow,
  type SlotRow,
  type TemplateRow,
  type TextZoneRow,
} from './dto.js';

const TEMPLATE_SELECT = `
  SELECT t.id, t.slug, t.name, t.description, t.category, t.mode, t.subject, t.aspect_ratio,
         t.sort_order, a.storage_key AS preview_key
    FROM templates t
    LEFT JOIN assets a ON a.id = t.preview_asset_id AND a.deleted_at IS NULL`;

export interface TemplateFilters {
  category?: string;
  mode?: string;
  subject?: string;
  search?: string;
}

export async function listPublishedTemplates(filters: TemplateFilters) {
  const where = ["t.status = 'published'", 't.deleted_at IS NULL'];
  const params: unknown[] = [];
  const add = (clause: (placeholder: string) => string, value: unknown) => {
    params.push(value);
    where.push(clause(`$${params.length}`));
  };
  if (filters.category) add((p) => `t.category = ${p}`, filters.category);
  if (filters.mode) add((p) => `(t.mode = ${p} OR t.mode = 'both')`, filters.mode);
  if (filters.subject) add((p) => `t.subject = ${p}`, filters.subject);
  if (filters.search) {
    const escaped = filters.search.replace(/[%_\\]/g, '\\$&');
    add((p) => `(t.name ILIKE ${p} OR t.description ILIKE ${p})`, `%${escaped}%`);
  }

  const sql = `${TEMPLATE_SELECT} WHERE ${where.join(' AND ')} ORDER BY t.sort_order, t.name`;
  const rows = await query<TemplateRow>(sql, params);
  return rows.map(toTemplateListItemDTO);
}

export async function getPublishedTemplate(slug: string) {
  const template = await queryOne<TemplateRow>(
    `${TEMPLATE_SELECT} WHERE t.slug = $1 AND t.status = 'published' AND t.deleted_at IS NULL`,
    [slug],
  );
  if (!template) throw notFound('Template');

  const [slots, zones, examples, policy] = await Promise.all([
    query<SlotRow>(
      `SELECT key, label, type, blank_index, required, default_value, options, max_length, vision_role, sort_order
         FROM template_slots WHERE template_id = $1 ORDER BY sort_order, blank_index NULLS LAST, key`,
      [template.id],
    ),
    query<TextZoneRow>(
      `SELECT slot_key, x, y, w, h, align, font_family, font_weight, font_size_ratio, color, max_lines
         FROM text_zones WHERE template_id = $1 ORDER BY slot_key`,
      [template.id],
    ),
    query<ExampleReferenceRow>(
      `SELECT r.id, r.role, r.label, a.storage_key
         FROM reference_assets r JOIN assets a ON a.id = r.asset_id AND a.deleted_at IS NULL
        WHERE r.template_id = $1 AND r.is_library AND r.deleted_at IS NULL
        ORDER BY r.created_at`,
      [template.id],
    ),
    getActivePolicy(),
  ]);

  const disclaimer = policy.disclaimers[template.category] ?? null;
  return toTemplateDetailDTO(template, slots, zones, examples, disclaimer);
}
