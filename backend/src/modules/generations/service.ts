import { env } from '../../config/env.js';
import { query, queryOne } from '../../db/pool.js';
import { withTx } from '../../db/tx.js';
import { assertContentPolicy } from '../../engine/policy.js';
import { AppError, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { failGeneration } from '../../pipeline/failGeneration.js';
import { getQueue } from '../../queue/index.js';
import { softDeleteAssets } from '../../storage/assets.js';
import { getUsage } from '../me/usage.js';
import { getActivePolicy, getSettings } from '../shared/settings.js';
import { GENERATION_SELECT, toGenerationDTO, type GenerationListRow } from './dto.js';
import { validateSlotValues, type SlotDef } from './slotValidation.js';

export interface CreateGenerationInput {
  template_id?: string;
  template_slug?: string;
  mode?: 'i2i' | 't2i';
  slot_values: Record<string, string>;
  remarks?: string;
  reference_ids: string[];
  consent_confirmed: boolean;
}

interface TemplateRow {
  id: string;
  mode: 'i2i' | 't2i' | 'both';
  subject: 'product' | 'human_model';
  category: string;
}

const invalid = (field: string, message: string) =>
  new AppError('VALIDATION_ERROR', message, { errors: [{ field, message }] });

/**
 * Accepts a generation request. Order of checks (cheapest and most user-fixable first):
 * template -> mode -> slot values -> content policy -> daily limit -> reference rules -> consent ->
 * rate limit -> insert + enqueue. Limit, reference, consent and rate checks run in one transaction
 * under a per-user advisory lock, so concurrent requests cannot slip past the daily limit.
 */
export async function createGeneration(userId: string, input: CreateGenerationInput): Promise<{ id: string; status: string }> {
  const template = await queryOne<TemplateRow>(
    `SELECT id, mode, subject, category FROM templates
      WHERE status = 'published' AND deleted_at IS NULL AND ${input.template_id ? 'id = $1' : 'slug = $1'}`,
    [input.template_id ?? input.template_slug],
  );
  if (!template) throw notFound('Template');

  const referenceIds = [...new Set(input.reference_ids)];
  const mode = input.mode ?? (referenceIds.length > 0 || template.mode === 'i2i' ? 'i2i' : 't2i');
  if (template.mode !== 'both' && template.mode !== mode) {
    throw invalid('mode', `Template ini tidak mendukung mode ${mode}`);
  }
  if (mode === 'i2i' && referenceIds.length === 0) {
    throw invalid('reference_ids', 'Template ini membutuhkan minimal 1 gambar referensi');
  }
  if (mode === 't2i' && referenceIds.length > 0) {
    throw invalid('reference_ids', 'Mode t2i tidak memakai gambar referensi');
  }

  const slots = await query<SlotDef>(
    'SELECT key, label, type, required, default_value, options, max_length FROM template_slots WHERE template_id = $1',
    [template.id],
  );
  const slotValues = validateSlotValues(slots, input.slot_values);

  const policy = await getActivePolicy();
  assertContentPolicy(
    { ...Object.fromEntries(Object.entries(slotValues).map(([k, v]) => [`slot_values.${k}`, v])), remarks: input.remarks },
    policy.blocked_terms,
  );

  const settings = await getSettings();
  const remarks = input.remarks?.trim() ? input.remarks.trim() : null;

  const generationId = await withTx(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`generation:${userId}`]);

    const usage = await getUsage(userId, client);
    if (usage.remaining_today <= 0) {
      throw new AppError('DAILY_LIMIT_REACHED', 'Batas pembuatan gambar harian tercapai. Coba lagi besok.');
    }

    if (referenceIds.length > settings.max_references) {
      throw new AppError('TOO_MANY_REFERENCES', `Maksimal ${settings.max_references} gambar referensi per pembuatan`);
    }
    const refs = referenceIds.length
      ? (
          await client.query<{ id: string; role: string }>(
            `SELECT r.id, r.role
               FROM reference_assets r JOIN assets a ON a.id = r.asset_id AND a.deleted_at IS NULL
              WHERE r.id = ANY($1::uuid[]) AND r.deleted_at IS NULL
                AND (r.expires_at IS NULL OR r.expires_at > now())
                AND (r.is_library OR r.owner_id = $2)`,
            [referenceIds, userId],
          )
        ).rows
      : [];
    if (refs.length !== referenceIds.length) throw notFound('Referensi');
    const byId = new Map(refs.map((r) => [r.id, r]));

    const needsConsent = template.subject === 'human_model' || refs.some((r) => r.role === 'human_model');
    if (needsConsent && !input.consent_confirmed) {
      throw new AppError('CONSENT_REQUIRED', 'Pembuatan gambar dengan model manusia membutuhkan konfirmasi persetujuan', {
        errors: [{ field: 'consent_confirmed', message: 'Wajib dikonfirmasi' }],
      });
    }

    const recent = (
      await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM generations WHERE user_id = $1 AND created_at > now() - interval '1 minute'`,
        [userId],
      )
    ).rows[0]?.n ?? 0;
    if (recent >= env.GENERATION_RATE_LIMIT_PER_MINUTE) {
      throw new AppError('RATE_LIMIT_EXCEEDED', 'Terlalu banyak permintaan pembuatan gambar, coba lagi sebentar lagi');
    }

    const referenceInputs = referenceIds.map((id) => ({ reference_id: id, role: (byId.get(id) as { role: string }).role }));
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO generations (user_id, template_id, mode, subject, publication, status, slot_values, remarks, reference_inputs, consent_confirmed)
       VALUES ($1, $2, $3, $4, $5, 'queued', $6::jsonb, $7, $8::jsonb, $9) RETURNING id`,
      [userId, template.id, mode, template.subject, template.category, JSON.stringify(slotValues), remarks, JSON.stringify(referenceInputs), input.consent_confirmed],
    );
    return (rows[0] as { id: string }).id;
  });

  try {
    await getQueue().enqueue(generationId);
  } catch (err) {
    logger.error({ generation_id: generationId, err_name: (err as Error)?.name }, 'could not enqueue generation');
    await failGeneration(generationId, 'INTERNAL_ERROR').catch(() => undefined);
    throw new AppError('INTERNAL_ERROR', 'Antrean pembuatan gambar sedang tidak tersedia, coba lagi nanti', { status: 503 });
  }
  return { id: generationId, status: 'queued' };
}

/** Owner only: another creator's generation (or a deleted one) is a plain 404. */
export async function getMyGeneration(userId: string, id: string) {
  const row = await queryOne<GenerationListRow>(`${GENERATION_SELECT} WHERE g.id = $1 AND g.user_id = $2 AND g.deleted_at IS NULL`, [id, userId]);
  if (!row) throw notFound('Generasi');
  return toGenerationDTO(row);
}

export async function listMyGenerations(userId: string, f: { page: number; limit: number; status?: string; archived: 'true' | 'false' | 'all' }) {
  const where = ['g.user_id = $1', 'g.deleted_at IS NULL'];
  const params: unknown[] = [userId];
  if (f.status) {
    params.push(f.status);
    where.push(`g.status = $${params.length}`);
  }
  if (f.archived === 'true') where.push('g.archived_at IS NOT NULL');
  if (f.archived === 'false') where.push('g.archived_at IS NULL');
  const clause = where.join(' AND ');

  const total = (await queryOne<{ n: number }>(`SELECT count(*) AS n FROM generations g WHERE ${clause}`, params))?.n ?? 0;
  const rows = await query<GenerationListRow>(
    `${GENERATION_SELECT} WHERE ${clause} ORDER BY g.created_at DESC, g.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, f.limit, (f.page - 1) * f.limit],
  );
  return { items: rows.map(toGenerationDTO), total };
}

/** Soft delete: the row stays for statistics, but its prompt is wiped, its gallery entries hidden and its files removed. */
export async function deleteMyGeneration(userId: string, id: string): Promise<void> {
  const assets = await withTx(async (client) => {
    const { rows } = await client.query<{ result_asset_id: string | null; thumbnail_asset_id: string | null }>(
      `UPDATE generations
          SET deleted_at = now(), final_prompt_ciphertext = NULL, final_prompt_iv = NULL, final_prompt_auth_tag = NULL
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING result_asset_id, thumbnail_asset_id`,
      [id, userId],
    );
    const row = rows[0];
    if (!row) throw notFound('Generasi');
    await client.query('UPDATE gallery_items SET is_hidden = true WHERE generation_id = $1', [id]);
    return [row.result_asset_id, row.thumbnail_asset_id];
  });
  await softDeleteAssets(assets);
}

export async function archiveMyGeneration(userId: string, id: string) {
  const row = await queryOne<{ id: string }>(
    'UPDATE generations SET archived_at = COALESCE(archived_at, now()) WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id',
    [id, userId],
  );
  if (!row) throw notFound('Generasi');
  return getMyGeneration(userId, id);
}
