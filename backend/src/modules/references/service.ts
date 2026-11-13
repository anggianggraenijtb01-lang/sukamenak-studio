import { env } from '../../config/env.js';
import { query, queryOne } from '../../db/pool.js';
import { AppError, notFound } from '../../lib/errors.js';
import { createAsset, softDeleteAssets } from '../../storage/assets.js';
import { processUploadedImage } from '../../storage/image.js';
import { toLibraryReferenceDTO, toReferenceDTO, type ReferenceRow } from './dto.js';
import type { ReferenceRole } from './schemas.js';

const SELECT = `
  SELECT r.id, r.owner_id, r.role, r.label, r.is_library, r.expires_at, r.created_at,
         a.storage_key, a.width, a.height, t.slug AS template_slug
    FROM reference_assets r
    JOIN assets a ON a.id = r.asset_id AND a.deleted_at IS NULL
    LEFT JOIN templates t ON t.id = r.template_id AND t.deleted_at IS NULL`;

export interface CreateReferenceInput {
  buffer: Buffer;
  role: ReferenceRole;
  label?: string;
  consent_note?: string;
  consent_confirmed: boolean;
}

export async function createReference(userId: string, input: CreateReferenceInput) {
  const isHuman = input.role === 'human_model';
  // Photos of people are only accepted with an explicit consent confirmation (UU PDP).
  if (isHuman && !input.consent_confirmed) {
    throw new AppError('CONSENT_REQUIRED', 'Unggah foto orang membutuhkan konfirmasi persetujuan', {
      errors: [{ field: 'consent_confirmed', message: 'Wajib dikonfirmasi untuk foto orang' }],
    });
  }

  const count =
    (
      await queryOne<{ n: number }>(
        'SELECT count(*) AS n FROM reference_assets WHERE owner_id = $1 AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > now())',
        [userId],
      )
    )?.n ?? 0;
  if (count >= env.MAX_REFERENCES_PER_USER) {
    throw new AppError('TOO_MANY_REFERENCES', `Batas ${env.MAX_REFERENCES_PER_USER} referensi tersimpan tercapai. Hapus yang lama terlebih dahulu.`);
  }

  const image = await processUploadedImage(input.buffer);
  const asset = await createAsset({
    buffer: image.buffer,
    mime: image.mime,
    kind: 'reference',
    ownerId: userId,
    prefix: 'refs',
    width: image.width,
    height: image.height,
  });

  const consentNote = isHuman
    ? input.consent_note || 'Pengunggah mengonfirmasi memiliki persetujuan dari orang pada foto'
    : (input.consent_note ?? null);
  try {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO reference_assets (owner_id, role, asset_id, label, consent_note, is_library, expires_at)
       VALUES ($1, $2, $3, $4, $5, false, CASE WHEN $2 = 'human_model' THEN now() + make_interval(days => $6) ELSE NULL END)
       RETURNING id`,
      [userId, input.role, asset.id, input.label ?? null, consentNote, env.RETENTION_HUMAN_REFERENCE_DAYS],
    );
    const created = await queryOne<ReferenceRow>(`${SELECT} WHERE r.id = $1`, [(row as { id: string }).id]);
    return toReferenceDTO(created as ReferenceRow);
  } catch (err) {
    await softDeleteAssets([asset.id]).catch(() => undefined);
    throw err;
  }
}

export async function listMyReferences(userId: string, filters: { role?: string; page: number; limit: number }) {
  const where = ['r.owner_id = $1', 'r.deleted_at IS NULL', '(r.expires_at IS NULL OR r.expires_at > now())'];
  const params: unknown[] = [userId];
  if (filters.role) {
    params.push(filters.role);
    where.push(`r.role = $${params.length}`);
  }
  const clause = where.join(' AND ');
  const total =
    (
      await queryOne<{ n: number }>(
        `SELECT count(*) AS n FROM reference_assets r JOIN assets a ON a.id = r.asset_id AND a.deleted_at IS NULL WHERE ${clause}`,
        params,
      )
    )?.n ?? 0;
  const rows = await query<ReferenceRow>(
    `${SELECT} WHERE ${clause} ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, (filters.page - 1) * filters.limit],
  );
  return { items: rows.map(toReferenceDTO), total };
}

/** Admin-curated references any creator may reuse without uploading again. */
export async function listLibraryReferences(filters: { role?: string; template?: string }) {
  const where = ['r.is_library', 'r.owner_id IS NULL', 'r.deleted_at IS NULL'];
  const params: unknown[] = [];
  if (filters.role) {
    params.push(filters.role);
    where.push(`r.role = $${params.length}`);
  }
  if (filters.template) {
    params.push(filters.template);
    where.push(`t.slug = $${params.length}`);
  }
  const rows = await query<ReferenceRow>(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY t.slug NULLS LAST, r.created_at`, params);
  return rows.map(toLibraryReferenceDTO);
}

/** Owner only. Library references and other people's references answer 404. */
export async function deleteReference(userId: string, id: string): Promise<void> {
  const row = await queryOne<{ asset_id: string }>(
    `UPDATE reference_assets SET deleted_at = now()
      WHERE id = $1 AND owner_id = $2 AND NOT is_library AND deleted_at IS NULL
      RETURNING asset_id`,
    [id, userId],
  );
  if (!row) throw notFound('Referensi');
  await softDeleteAssets([row.asset_id]);
}
