import { query, queryOne } from '../../../db/pool.js';
import { withTx } from '../../../db/tx.js';
import { normalizeForMatch } from '../../../engine/policy.js';
import { AppError } from '../../../lib/errors.js';
import { createAsset, softDeleteAssets } from '../../../storage/assets.js';
import { processUploadedImage } from '../../../storage/image.js';
import { assetUrl } from '../../../storage/urls.js';
import { getSettings, invalidatePolicyCache, invalidateSettingsCache } from '../../shared/settings.js';
import { buildDiff, recordAudit } from '../auditLog.js';
import type { AdminCtx } from '../common.js';
import { SETTING_KEYS, SETTING_SCHEMAS, type SettingKey } from './schemas.js';

// --- app settings ---------------------------------------------------------------------------

async function freshSettings() {
  invalidateSettingsCache();
  return getSettings();
}

export async function readSettings() {
  const settings = await freshSettings();
  const updated = await queryOne<{ updated_at: Date | null }>('SELECT max(updated_at) AS updated_at FROM app_settings');
  return { settings, schema: describeSettings(), updated_at: updated?.updated_at ?? null };
}

/** Allowed values per key, so the admin UI can render the right control. */
function describeSettings() {
  return {
    language: { type: 'enum', values: ['id', 'en'] },
    default_daily_limit: { type: 'integer', min: 0, max: 1000 },
    watermark_enabled: { type: 'boolean' },
    max_references: { type: 'integer', min: 1, max: 12 },
  };
}

export async function updateSettings(ctx: AdminCtx, patch: Partial<Record<SettingKey, unknown>>) {
  const before = await getSettingsFresh();
  await withTx(async (client) => {
    const after: Record<string, unknown> = { ...before };
    for (const key of SETTING_KEYS) {
      if (patch[key] === undefined) continue;
      const value = SETTING_SCHEMAS[key].parse(patch[key]);
      after[key] = value;
      await client.query(
        `INSERT INTO app_settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by`,
        [key, JSON.stringify(value), ctx.actorId],
      );
    }
    await recordAudit(ctx, { action: 'settings.update', entity: 'app_settings', entityId: null, diff: buildDiff(SETTING_KEYS, before, after) }, client);
  });
  // Takes effect on the very next request served by this process.
  return readSettings();
}

async function getSettingsFresh(): Promise<Record<string, unknown>> {
  return { ...(await freshSettings()) };
}

// --- brand identity -------------------------------------------------------------------------

interface BrandRow {
  id: string;
  name: string;
  palette: unknown;
  font_family: string | null;
  disclaimer: string | null;
  logo_asset_id: string | null;
  logo_key: string | null;
  updated_at: Date;
}

const BRAND_SELECT = `
  SELECT b.id, b.name, b.palette, b.font_family, b.disclaimer, b.logo_asset_id, a.storage_key AS logo_key, b.updated_at
    FROM brand_identities b
    LEFT JOIN assets a ON a.id = b.logo_asset_id AND a.deleted_at IS NULL`;

const BRAND_AUDIT_FIELDS = ['name', 'palette', 'font_family', 'disclaimer'] as const;

const toBrandDTO = (b: BrandRow) => ({
  id: b.id,
  name: b.name,
  palette: Array.isArray(b.palette) ? b.palette.filter((c): c is string => typeof c === 'string') : [],
  font_family: b.font_family,
  disclaimer: b.disclaimer,
  logo_url: assetUrl(b.logo_key),
  updated_at: b.updated_at,
});

async function ensureBrand(): Promise<BrandRow> {
  const existing = await queryOne<BrandRow>(`${BRAND_SELECT} WHERE b.is_default LIMIT 1`);
  if (existing) return existing;
  await query("INSERT INTO brand_identities (name, palette, is_default) SELECT 'Brand', '[]'::jsonb, true WHERE NOT EXISTS (SELECT 1 FROM brand_identities WHERE is_default)");
  return (await queryOne<BrandRow>(`${BRAND_SELECT} WHERE b.is_default LIMIT 1`)) as BrandRow;
}

export async function getBrand() {
  return toBrandDTO(await ensureBrand());
}

export async function updateBrand(
  ctx: AdminCtx,
  patch: { name?: string; palette?: string[]; font_family?: string | null; disclaimer?: string | null },
) {
  const current = await ensureBrand();
  await withTx(async (client) => {
    const before = (await queryOne<BrandRow>(`${BRAND_SELECT} WHERE b.id = $1 FOR UPDATE OF b`, [current.id], client)) as BrandRow;
    const next = {
      name: patch.name ?? before.name,
      palette: patch.palette ?? before.palette,
      font_family: patch.font_family === undefined ? before.font_family : patch.font_family,
      disclaimer: patch.disclaimer === undefined ? before.disclaimer : patch.disclaimer,
    };
    await client.query('UPDATE brand_identities SET name = $2, palette = $3::jsonb, font_family = $4, disclaimer = $5, updated_by = $6 WHERE id = $1', [
      current.id,
      next.name,
      JSON.stringify(next.palette),
      next.font_family,
      next.disclaimer && next.disclaimer.trim() !== '' ? next.disclaimer : null,
      ctx.actorId,
    ]);
    await recordAudit(
      ctx,
      { action: 'brand.update', entity: 'brand_identity', entityId: current.id, diff: buildDiff(BRAND_AUDIT_FIELDS, before as unknown as Record<string, unknown>, next) },
      client,
    );
  });
  return getBrand();
}

export async function uploadBrandLogo(ctx: AdminCtx, buffer: Buffer) {
  const current = await ensureBrand();
  const image = await processUploadedImage(buffer);
  const asset = await createAsset({ buffer: image.buffer, mime: image.mime, kind: 'logo', ownerId: null, prefix: 'brand', width: image.width, height: image.height });
  let previous: string | null = null;
  try {
    previous = await withTx(async (client) => {
      const before = await queryOne<{ logo_asset_id: string | null }>('SELECT logo_asset_id FROM brand_identities WHERE id = $1 FOR UPDATE', [current.id], client);
      await client.query('UPDATE brand_identities SET logo_asset_id = $2, updated_by = $3 WHERE id = $1', [current.id, asset.id, ctx.actorId]);
      await recordAudit(ctx, { action: 'brand.logo_upload', entity: 'brand_identity', entityId: current.id, diff: { replaced: Boolean(before?.logo_asset_id), bytes: asset.bytes } }, client);
      return before?.logo_asset_id ?? null;
    });
  } catch (err) {
    await softDeleteAssets([asset.id]).catch(() => undefined);
    throw err;
  }
  await softDeleteAssets([previous]);
  return getBrand();
}

// --- content policy -------------------------------------------------------------------------

interface PolicyRow {
  id: string;
  name: string;
  blocked_terms: string[];
  moderation_level: string;
  disclaimers: Record<string, string> | null;
  updated_at: Date;
}

const POLICY_COLUMNS = 'id, name, blocked_terms, moderation_level, disclaimers, updated_at';

const toPolicyDTO = (p: PolicyRow) => ({
  id: p.id,
  name: p.name,
  blocked_terms: p.blocked_terms,
  moderation_level: p.moderation_level,
  disclaimers: p.disclaimers ?? {},
  updated_at: p.updated_at,
});

/** Lower-cased, whitespace-collapsed, de-duplicated (by accent- and punctuation-insensitive match key). */
export function normaliseBlockedTerms(terms: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of terms) {
    const term = raw.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
    const key = normalizeForMatch(term);
    if (!term || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }
  return out;
}

async function ensurePolicy(): Promise<PolicyRow> {
  const existing = await queryOne<PolicyRow>(`SELECT ${POLICY_COLUMNS} FROM content_policies WHERE is_active LIMIT 1`);
  if (existing) return existing;
  await query(
    `INSERT INTO content_policies (name, blocked_terms, moderation_level, disclaimers)
     SELECT 'Kebijakan Konten', '{}', 'standard', '{}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM content_policies WHERE is_active)`,
  );
  return (await queryOne<PolicyRow>(`SELECT ${POLICY_COLUMNS} FROM content_policies WHERE is_active LIMIT 1`)) as PolicyRow;
}

export async function getPolicy() {
  return toPolicyDTO(await ensurePolicy());
}

export async function updatePolicy(
  ctx: AdminCtx,
  patch: { blocked_terms?: string[]; moderation_level?: string; disclaimers?: Record<string, string | null | undefined> },
) {
  const current = await ensurePolicy();

  await withTx(async (client) => {
    const before = (await queryOne<PolicyRow>(`SELECT ${POLICY_COLUMNS} FROM content_policies WHERE id = $1 FOR UPDATE`, [current.id], client)) as PolicyRow;

    const disclaimers: Record<string, string> = { ...(before.disclaimers ?? {}) };
    for (const [category, text] of Object.entries(patch.disclaimers ?? {})) {
      if (text === undefined) continue;
      const trimmed = text === null ? '' : text.trim();
      if (trimmed === '') delete disclaimers[category];
      else disclaimers[category] = trimmed;
    }
    if (!disclaimers.psa || disclaimers.psa.trim() === '') {
      throw new AppError('VALIDATION_ERROR', 'Disclaimer untuk kategori psa wajib diisi', {
        errors: [{ field: 'disclaimers.psa', message: 'Tidak boleh kosong' }],
      });
    }

    const terms = patch.blocked_terms === undefined ? before.blocked_terms : normaliseBlockedTerms(patch.blocked_terms);
    const level = patch.moderation_level ?? before.moderation_level;
    await client.query('UPDATE content_policies SET blocked_terms = $2::text[], moderation_level = $3, disclaimers = $4::jsonb, updated_by = $5 WHERE id = $1', [
      current.id,
      terms,
      level,
      JSON.stringify(disclaimers),
      ctx.actorId,
    ]);

    const oldSet = new Set(before.blocked_terms);
    const newSet = new Set(terms);
    await recordAudit(
      ctx,
      {
        action: 'policy.update',
        entity: 'content_policy',
        entityId: current.id,
        diff: buildDiff(['moderation_level', 'disclaimers'], { moderation_level: before.moderation_level, disclaimers: before.disclaimers ?? {} }, { moderation_level: level, disclaimers }, {
          blocked_terms_added: terms.filter((t) => !oldSet.has(t)).length,
          blocked_terms_removed: before.blocked_terms.filter((t) => !newSet.has(t)).length,
          blocked_terms_total: terms.length,
        }),
      },
      client,
    );
  });
  invalidatePolicyCache();
  return getPolicy();
}
