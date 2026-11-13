import { z } from 'zod';
import { requireAnyKey } from '../common.js';
import { CATEGORIES } from '../templates/schemas.js';

/** One Zod schema per app_settings key. A key that is not listed here cannot be stored. */
export const SETTING_SCHEMAS = {
  language: z.enum(['id', 'en']),
  default_daily_limit: z.number().int().min(0).max(1000),
  watermark_enabled: z.boolean(),
  max_references: z.number().int().min(1).max(12),
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[];

export const updateSettingsSchemas = {
  body: requireAnyKey(z.object(SETTING_SCHEMAS).partial().strict()),
};

// --- brand identity -------------------------------------------------------------------------

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Gunakan warna heksadesimal #rrggbb');

export const updateBrandSchemas = {
  body: requireAnyKey(
    z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        palette: z.array(hexColor).max(12).optional(),
        font_family: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9 _-]{1,60}$/, 'Nama font hanya huruf, angka, spasi, _ dan -')
          .nullable()
          .optional(),
        disclaimer: z.string().trim().max(500).nullable().optional(),
      })
      .strict(),
  ),
};

// --- content policy -------------------------------------------------------------------------

const disclaimerText = z.string().max(500).nullable();
const disclaimerShape = Object.fromEntries(CATEGORIES.map((c) => [c, disclaimerText])) as Record<(typeof CATEGORIES)[number], typeof disclaimerText>;

export const updatePolicySchemas = {
  body: requireAnyKey(
    z
      .object({
        blocked_terms: z.array(z.string().max(80)).max(1000).optional(),
        moderation_level: z.enum(['lenient', 'standard', 'strict']).optional(),
        /** Per publication category. `null` or empty removes a category's disclaimer, except `psa`, which is mandatory. */
        disclaimers: z.object(disclaimerShape).partial().strict().optional(),
      })
      .strict(),
  ),
};
