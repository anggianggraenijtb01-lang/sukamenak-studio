import { query, queryOne, type Queryable } from '../../../db/pool.js';
import { withTx } from '../../../db/tx.js';
import { AppError, notFound } from '../../../lib/errors.js';
import { createAsset, softDeleteAssets } from '../../../storage/assets.js';
import { processUploadedImage } from '../../../storage/image.js';
import { assetUrl } from '../../../storage/urls.js';
import { buildDiff, recordAudit } from '../auditLog.js';
import { conflictField, escapeLike, offsetOf, Where, type AdminCtx } from '../common.js';

interface AdminReferenceRow {
  id: string;
  role: string;
  label: string | null;
  consent_note: string | null;
  template_id: string | null;
  template_slug: string | null;
  template_name: string | null;
  asset_id: string;
  storage_key: string;
  width: number | null;
  height: number | null;
  bytes: number;
  created_at: Date;
}

const SELECT = `
  SELECT r.id, r.role, r.label, r.consent_note, r.template_id, t.slug AS template_slug, t.name AS template_name,
         r.asset_id, a.storage_key, a.width, a.height, a.bytes, r.created_at
    FROM reference_assets r
    JOIN assets a ON a.id = r.asset_id AND a.deleted_at IS NULL
    LEFT JOIN templates t ON t.id = r.template_id AND t.deleted_at IS NULL`;

/** Library entries only. The storage key is never returned: clients get a signed, expiring URL. */
const toDTO = (r: AdminReferenceRow) => ({
  id: r.id,
  role: r.role,
  label: r.label,
  consent_note: r.consent_note,
  template: r.template_id && r.template_slug ? { id: r.template_id, slug: r.template_slug, name: r.template_name } : null,
  url: assetUrl(r.storage_key),
  width: r.width,
  height: r.height,
  bytes: r.bytes,
  created_at: r.created_at,
});

const AUDIT_FIELDS = ['role', 'label', 'consent_note', 'template_id'] as const;

const consentRequired = () =>
  new AppError('CONSENT_REQUIRED', 'Referensi bertipe human_model wajib memiliki catatan persetujuan (consent_note)', {
    errors: [{ field: 'consent_note', message: 'Wajib diisi untuk foto orang' }],
  });

const hasText = (v: string | null | undefined): v is string => typeof v === 'string' && v.trim() !== '';

async function resolveTemplateId(input: { template_id?: string; template_slug?: string }): Promise<string | null> {
  if (input.template_id && input.template_slug) throw conflictField('template_id', 'Kirim salah satu dari template_id atau template_slug');
  if (!input.template_id && !input.template_slug) return null;
  const row = input.template_id
    ? await queryOne<{ id: string }>('SELECT id FROM templates WHERE id = $1 AND deleted_at IS NULL', [input.template_id])
    : await queryOne<{ id: string }>('SELECT id FROM templates WHERE slug = $1 AND deleted_at IS NULL', [input.template_slug]);
  if (!row) throw conflictField('template_id', 'Template tidak ditemukan');
  return row.id;
}

export async function listReferences(f: { page: number; limit: number; role?: string; template?: string; search?: string }) {
  const where = new Where('r.is_library', 'r.owner_id IS NULL', 'r.deleted_at IS NULL');
  if (f.role) where.add((p) => `r.role = ${p}`, f.role);
  if (f.template) where.add((p) => `t.slug = ${p}`, f.template);
  if (f.search) where.add((p) => `r.label ILIKE ${p}`, `%${escapeLike(f.search as string)}%`);
  const from = `FROM reference_assets r JOIN assets a ON a.id = r.asset_id AND a.deleted_at IS NULL LEFT JOIN templates t ON t.id = r.template_id AND t.deleted_at IS NULL ${where.sql}`;
  const total = (await queryOne<{ n: number }>(`SELECT count(*) AS n ${from}`, where.params))?.n ?? 0;
  const limitP = where.next();
  const offsetP = `$${where.params.length + 2}`;
  const rows = await query<AdminReferenceRow>(`${SELECT} ${where.sql} ORDER BY r.created_at DESC, r.id LIMIT ${limitP} OFFSET ${offsetP}`, [
    ...where.params,
    f.limit,
    offsetOf(f),
  ]);
  return { items: rows.map(toDTO), total };
}

async function loadReference(id: string, lock = false, db?: Queryable): Promise<AdminReferenceRow> {
  const row = await queryOne<AdminReferenceRow>(
    `${SELECT} WHERE r.id = $1 AND r.is_library AND r.owner_id IS NULL AND r.deleted_at IS NULL${lock ? ' FOR UPDATE OF r' : ''}`,
    [id],
    db,
  );
  if (!row) throw notFound('Referensi');
  return row;
}

export const getReference = async (id: string) => toDTO(await loadReference(id));

export interface CreateReferenceInput {
  buffer: Buffer;
  role: string;
  label?: string;
  consent_note?: string;
  template_id?: string;
  template_slug?: string;
}

export async function createReference(ctx: AdminCtx, input: CreateReferenceInput) {
  if (input.role === 'human_model' && !hasText(input.consent_note)) throw consentRequired();
  const templateId = await resolveTemplateId(input);
  const image = await processUploadedImage(input.buffer);
  const asset = await createAsset({ buffer: image.buffer, mime: image.mime, kind: 'reference', ownerId: null, prefix: 'library', width: image.width, height: image.height });
  try {
    const id = await withTx(async (client) => {
      const row = await queryOne<{ id: string }>(
        `INSERT INTO reference_assets (owner_id, role, asset_id, template_id, label, consent_note, is_library, expires_at)
         VALUES (NULL, $1, $2, $3, $4, $5, true, NULL) RETURNING id`,
        [input.role, asset.id, templateId, input.label ?? null, hasText(input.consent_note) ? input.consent_note : null],
        client,
      );
      const created = (row as { id: string }).id;
      await recordAudit(
        ctx,
        {
          action: 'reference.create',
          entity: 'reference_asset',
          entityId: created,
          diff: buildDiff(AUDIT_FIELDS, null, { role: input.role, label: input.label ?? null, consent_note: input.consent_note ?? null, template_id: templateId }),
        },
        client,
      );
      return created;
    });
    return toDTO(await loadReference(id));
  } catch (err) {
    await softDeleteAssets([asset.id]).catch(() => undefined);
    throw err;
  }
}

export interface UpdateReferenceInput {
  role?: string;
  label?: string | null;
  consent_note?: string | null;
  template_id?: string | null;
}

export async function updateReference(ctx: AdminCtx, id: string, patch: UpdateReferenceInput) {
  await withTx(async (client) => {
    const before = await loadReference(id, true, client);
    const next = {
      role: patch.role ?? before.role,
      label: patch.label === undefined ? before.label : patch.label,
      consent_note: patch.consent_note === undefined ? before.consent_note : patch.consent_note,
      template_id: patch.template_id === undefined ? before.template_id : patch.template_id,
    };
    if (next.role === 'human_model' && !hasText(next.consent_note)) throw consentRequired();
    if (next.template_id) {
      const exists = await queryOne('SELECT 1 FROM templates WHERE id = $1 AND deleted_at IS NULL', [next.template_id], client);
      if (!exists) throw conflictField('template_id', 'Template tidak ditemukan');
    }
    await client.query('UPDATE reference_assets SET role = $2, label = $3, consent_note = $4, template_id = $5 WHERE id = $1', [
      id,
      next.role,
      next.label,
      hasText(next.consent_note) ? next.consent_note : null,
      next.template_id,
    ]);
    await recordAudit(
      ctx,
      {
        action: 'reference.update',
        entity: 'reference_asset',
        entityId: id,
        diff: buildDiff(AUDIT_FIELDS, before as unknown as Record<string, unknown>, next),
      },
      client,
    );
  });
  return toDTO(await loadReference(id));
}

export async function deleteReference(ctx: AdminCtx, id: string): Promise<void> {
  const assetId = await withTx(async (client) => {
    const before = await loadReference(id, true, client);
    await client.query('UPDATE reference_assets SET deleted_at = now() WHERE id = $1', [id]);
    await recordAudit(ctx, { action: 'reference.delete', entity: 'reference_asset', entityId: id, diff: { role: before.role, label: before.label } }, client);
    return before.asset_id;
  });
  await softDeleteAssets([assetId]);
}
