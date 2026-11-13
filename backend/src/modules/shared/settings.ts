import { queryOne, query } from '../../db/pool.js';

export interface AppSettings {
  language: string;
  default_daily_limit: number;
  watermark_enabled: boolean;
  max_references: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'id',
  default_daily_limit: 10,
  watermark_enabled: false,
  max_references: 4,
};

const TTL_MS = 15_000;
let settingsCache: { value: AppSettings; expiresAt: number } | undefined;

export function invalidateSettingsCache(): void {
  settingsCache = undefined;
}

/** Settings merged over defaults. Wrong-typed stored values fall back to the default. */
export async function getSettings(): Promise<AppSettings> {
  if (settingsCache && settingsCache.expiresAt > Date.now()) return settingsCache.value;
  const rows = await query<{ key: string; value: unknown }>('SELECT key, value FROM app_settings');
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const pick = <K extends keyof AppSettings>(key: K): AppSettings[K] => {
    const v = stored.get(key);
    return typeof v === typeof DEFAULT_SETTINGS[key] ? (v as AppSettings[K]) : DEFAULT_SETTINGS[key];
  };
  const value: AppSettings = {
    language: pick('language'),
    default_daily_limit: pick('default_daily_limit'),
    watermark_enabled: pick('watermark_enabled'),
    max_references: pick('max_references'),
  };
  settingsCache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

export interface ActivePolicy {
  blocked_terms: string[];
  moderation_level: string;
  disclaimers: Record<string, string>;
}

let policyCache: { value: ActivePolicy; expiresAt: number } | undefined;

export function invalidatePolicyCache(): void {
  policyCache = undefined;
}

export async function getActivePolicy(): Promise<ActivePolicy> {
  if (policyCache && policyCache.expiresAt > Date.now()) return policyCache.value;
  const row = await queryOne<{ blocked_terms: string[]; moderation_level: string; disclaimers: Record<string, string> }>(
    'SELECT blocked_terms, moderation_level, disclaimers FROM content_policies WHERE is_active LIMIT 1',
  );
  const value: ActivePolicy = row
    ? { blocked_terms: row.blocked_terms, moderation_level: row.moderation_level, disclaimers: row.disclaimers ?? {} }
    : { blocked_terms: [], moderation_level: 'standard', disclaimers: {} };
  policyCache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}
