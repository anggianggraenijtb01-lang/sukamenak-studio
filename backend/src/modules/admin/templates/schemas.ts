import { z } from 'zod';
import { idParams, pageFields, requireAnyKey, SLUG } from '../common.js';
import { CORE_PROMPT_KEY } from '../corePrompts/schemas.js';

export const CATEGORIES = ['poster', 'psa', 'social_post', 'product_shot', 'human_model'] as const;
export const MODES = ['i2i', 't2i', 'both'] as const;
export const SUBJECTS = ['product', 'human_model'] as const;
export const STATUSES = ['draft', 'published', 'archived'] as const;
export const SLOT_TYPES = ['text', 'color', 'select', 'textarea'] as const;
export const VISION_ROLES = ['product', 'human_model', 'font', 'color', 'lighting', 'pose', 'background', 'style'] as const;

const slug = z.string().trim().max(100).regex(SLUG, 'Gunakan huruf kecil, angka, dan tanda hubung');
const coreKey = z.string().trim().max(80).regex(CORE_PROMPT_KEY, 'Gunakan format seperti product.poster');
const aspect = z.string().trim().regex(/^[0-9]{1,2}:[0-9]{1,2}$/, 'Gunakan format seperti 4:5');
const slotKey = z.string().trim().max(60).regex(/^[a-z][a-z0-9_]*$/, 'Gunakan huruf kecil, angka, dan garis bawah');

export const listTemplatesSchemas = {
  query: z.object({
    ...pageFields(20, 100),
    status: z.enum(STATUSES).optional(),
    category: z.enum(CATEGORIES).optional(),
    search: z.string().trim().max(80).optional(),
  }),
};

export const templateIdSchemas = idParams;

const templateFields = {
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000),
  category: z.enum(CATEGORIES),
  mode: z.enum(MODES),
  subject: z.enum(SUBJECTS),
  aspect_ratio: aspect,
  core_prompt_key: coreKey,
  sort_order: z.number().int().min(-100_000).max(100_000),
};

export const createTemplateSchemas = {
  body: z
    .object({
      slug,
      name: templateFields.name,
      description: templateFields.description.default(''),
      category: templateFields.category,
      mode: templateFields.mode,
      subject: templateFields.subject,
      aspect_ratio: templateFields.aspect_ratio.default('4:5'),
      core_prompt_key: templateFields.core_prompt_key,
      sort_order: templateFields.sort_order.default(0),
    })
    .strict(),
};

export const updateTemplateSchemas = {
  params: idParams.params,
  body: requireAnyKey(
    z
      .object({
        slug: slug.optional(),
        name: templateFields.name.optional(),
        description: templateFields.description.optional(),
        category: templateFields.category.optional(),
        mode: templateFields.mode.optional(),
        subject: templateFields.subject.optional(),
        aspect_ratio: templateFields.aspect_ratio.optional(),
        core_prompt_key: templateFields.core_prompt_key.optional(),
        sort_order: templateFields.sort_order.optional(),
      })
      .strict(),
  ),
};

// --- slots ----------------------------------------------------------------------------------

const optionSchema = z.object({ value: z.string().trim().min(1).max(100), label: z.string().trim().min(1).max(100) }).strict();

const slotFields = {
  key: slotKey,
  label: z.string().trim().min(1).max(80),
  type: z.enum(SLOT_TYPES),
  blank_index: z.number().int().min(1).max(50).nullable(),
  required: z.boolean(),
  default_value: z.string().max(500).nullable(),
  options: z.array(optionSchema).min(1).max(50).nullable(),
  max_length: z.number().int().min(1).max(2000).nullable(),
  vision_role: z.enum(VISION_ROLES).nullable(),
  source_hint: z.string().trim().max(160).nullable(),
  sort_order: z.number().int().min(0).max(10_000),
};

const slotRules = (v: { type?: string; options?: unknown }, ctx: z.RefinementCtx) => {
  if (v.type === 'select' && (!Array.isArray(v.options) || v.options.length === 0)) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: 'Slot bertipe select membutuhkan options' });
  }
};

export const slotParams = { params: z.object({ id: z.string().uuid(), slotId: z.string().uuid() }) };

export const createSlotSchemas = {
  params: idParams.params,
  body: z
    .object({
      key: slotFields.key,
      label: slotFields.label,
      type: slotFields.type.default('text'),
      blank_index: slotFields.blank_index.default(null),
      required: slotFields.required.default(false),
      default_value: slotFields.default_value.default(null),
      options: slotFields.options.default(null),
      max_length: slotFields.max_length.default(null),
      vision_role: slotFields.vision_role.default(null),
      source_hint: slotFields.source_hint.default(null),
      sort_order: slotFields.sort_order.default(0),
    })
    .strict()
    .superRefine(slotRules),
};

export const updateSlotSchemas = {
  params: slotParams.params,
  body: requireAnyKey(
    z
      .object({
        key: slotFields.key.optional(),
        label: slotFields.label.optional(),
        type: slotFields.type.optional(),
        blank_index: slotFields.blank_index.optional(),
        required: slotFields.required.optional(),
        default_value: slotFields.default_value.optional(),
        options: slotFields.options.optional(),
        max_length: slotFields.max_length.optional(),
        vision_role: slotFields.vision_role.optional(),
        source_hint: slotFields.source_hint.optional(),
        sort_order: slotFields.sort_order.optional(),
      })
      .strict(),
  ),
};

// --- text zones -----------------------------------------------------------------------------

const frac = z.number().min(0).max(1);
/** `#rgb`, `#rrggbb`, `brand` or `brand:N`, exactly what the compositor understands. */
const zoneColor = z.string().trim().regex(/^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|brand(:\d{1,2})?)$/, 'Gunakan #rrggbb, brand, atau brand:N');
/** Free text would end up in rendering markup, so the family name is restricted. */
const fontFamily = z.string().trim().regex(/^[A-Za-z0-9 _-]{1,60}$/, 'Nama font hanya huruf, angka, spasi, _ dan -');

const zoneFields = {
  slot_key: slotKey,
  x: frac,
  y: frac,
  w: z.number().gt(0).max(1),
  h: z.number().gt(0).max(1),
  align: z.enum(['left', 'center', 'right']),
  font_family: fontFamily,
  font_weight: z.number().int().min(100).max(900),
  font_size_ratio: z.number().gt(0).max(1),
  color: zoneColor,
  max_lines: z.number().int().min(1).max(20),
};

/** Mirrors CHECK (x + w <= 1.0001 AND y + h <= 1.0001) on text_zones. */
const withinCanvas = (v: { x?: number; y?: number; w?: number; h?: number }, ctx: z.RefinementCtx) => {
  if (v.x !== undefined && v.w !== undefined && v.x + v.w > 1.0001) {
    ctx.addIssue({ code: 'custom', path: ['w'], message: 'x + w tidak boleh melebihi 1' });
  }
  if (v.y !== undefined && v.h !== undefined && v.y + v.h > 1.0001) {
    ctx.addIssue({ code: 'custom', path: ['h'], message: 'y + h tidak boleh melebihi 1' });
  }
};

export const zoneParams = { params: z.object({ id: z.string().uuid(), zoneId: z.string().uuid() }) };

export const createZoneSchemas = {
  params: idParams.params,
  body: z
    .object({
      slot_key: zoneFields.slot_key,
      x: zoneFields.x,
      y: zoneFields.y,
      w: zoneFields.w,
      h: zoneFields.h,
      align: zoneFields.align.default('center'),
      font_family: zoneFields.font_family.default('Inter'),
      font_weight: zoneFields.font_weight.default(700),
      font_size_ratio: zoneFields.font_size_ratio.default(0.05),
      color: zoneFields.color.default('#FFFFFF'),
      max_lines: zoneFields.max_lines.default(2),
    })
    .strict()
    .superRefine(withinCanvas),
};

export const updateZoneSchemas = {
  params: zoneParams.params,
  body: requireAnyKey(
    z
      .object({
        slot_key: zoneFields.slot_key.optional(),
        x: zoneFields.x.optional(),
        y: zoneFields.y.optional(),
        w: zoneFields.w.optional(),
        h: zoneFields.h.optional(),
        align: zoneFields.align.optional(),
        font_family: zoneFields.font_family.optional(),
        font_weight: zoneFields.font_weight.optional(),
        font_size_ratio: zoneFields.font_size_ratio.optional(),
        color: zoneFields.color.optional(),
        max_lines: zoneFields.max_lines.optional(),
      })
      .strict()
      .superRefine(withinCanvas),
  ),
};

export { withinCanvas };
