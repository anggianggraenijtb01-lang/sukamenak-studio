import { query, queryOne, type Queryable } from '../../../db/pool.js';
import { withTx } from '../../../db/tx.js';
import { buildDisplayPrompt, type DisplaySlot } from '../../../engine/displayPrompt.js';
import { assertContentPolicy } from '../../../engine/policy.js';
import { AppError, notFound } from '../../../lib/errors.js';
import { createAsset, softDeleteAssets } from '../../../storage/assets.js';
import { processUploadedImage } from '../../../storage/image.js';
import { getStorage } from '../../../storage/index.js';
import { assetUrl } from '../../../storage/urls.js';
import { getActivePolicy } from '../../shared/settings.js';
import { buildDiff, recordAudit } from '../auditLog.js';
import { conflictField, escapeLike, offsetOf, Where, type AdminCtx } from '../common.js';
import { containsCorePromptText } from '../corePrompts/guard.js';

interface GalleryRow {
  id: string;
  generation_id: string | null;
  template_id: string | null;
  template_slug: string | null;
  template_name: string | null;
  image_asset_id: string;
  storage_key: string;
  title: string;
  display_prompt: string;
  is_featured: boolean;
  is_hidden: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

const SELECT = `
  SELECT g.id, g.generation_id, g.template_id, t.slug AS template_slug, t.name AS template_name, g.image_asset_id, a.storage_key,
         g.title, g.display_prompt, g.is_featured, g.is_hidden, g.sort_order, g.created_at, g.updated_at
    FROM gallery_items g
    JOIN assets a ON a.id = g.image_asset_id AND a.deleted_at IS NULL
    LEFT JOIN templates t ON t.id = g.template_id AND t.deleted_at IS NULL`;

const toDTO = (g: GalleryRow) => ({
  id: g.id,
  title: g.title,
  display_prompt: g.display_prompt,
  image_url: assetUrl(g.storage_key),
  is_featured: g.is_featured,
  is_hidden: g.is_hidden,
  sort_order: g.sort_order,
  generation_id: g.generation_id,
  template: g.template_id && g.template_slug ? { id: g.template_id, slug: g.template_slug, name: g.template_name } : null,
  created_at: g.created_at,
  updated_at: g.updated_at,
});

const AUDIT_FIELDS = ['title', 'display_prompt', 'is_featured', 'is_hidden', 'sort_order'] as const;

export async function listGallery(f: { page: number; limit: number; hidden?: boolean; featured?: boolean; template?: string; search?: string }) {
  const where = new Where();
  if (f.hidden !== undefined) where.add((p) => `g.is_hidden = ${p}`, f.hidden);
  if (f.featured !== undefined) where.add((p) => `g.is_featured = ${p}`, f.featured);
  if (f.template) where.add((p) => `t.slug = ${p}`, f.template);
  if (f.search) where.add((p) => `g.title ILIKE ${p}`, `%${escapeLike(f.search as string)}%`);
  const from = `FROM gallery_items g JOIN assets a ON a.id = g.image_asset_id AND a.deleted_at IS NULL LEFT JOIN templates t ON t.id = g.template_id AND t.deleted_at IS NULL ${where.sql}`;
  const total = (await queryOne<{ n: number }>(`SELECT count(*) AS n ${from}`, where.params))?.n ?? 0;
  const limitP = where.next();
  const offsetP = `$${where.params.length + 2}`;
  const rows = await query<GalleryRow>(
    `${SELECT} ${where.sql} ORDER BY g.is_featured DESC, g.sort_order, g.created_at DESC, g.id LIMIT ${limitP} OFFSET ${offsetP}`,
    [...where.params, f.limit, offsetOf(f)],
  );
  return { items: rows.map(toDTO), total };
}

async function loadItem(id: string, lock = false, db?: Queryable): Promise<GalleryRow> {
  const row = await queryOne<GalleryRow>(`${SELECT} WHERE g.id = $1${lock ? ' FOR UPDATE OF g' : ''}`, [id], db);
  if (!row) throw notFound('Item galeri');
  return row;
}

/** Rejects anything that is not safe to show publicly: placeholder tokens, core prompt text, blocked terms. */
async function assertPublicText(fields: Record<string, string>): Promise<void> {
  for (const [field, value] of Object.entries(fields)) {
    if (/\[\s*_{2,}\s*\]|\{\{|\}\}/.test(value)) {
      throw new AppError('VALIDATION_ERROR', 'Teks galeri tidak boleh memuat placeholder prompt', { errors: [{ field, message: 'Mengandung placeholder' }] });
    }
  }
  if (await containsCorePromptText(...Object.values(fields))) {
    throw new AppError('VALIDATION_ERROR', 'Teks galeri tidak boleh memuat bagian dari core prompt', {
      errors: Object.keys(fields).map((field) => ({ field, message: 'Mengandung teks prompt internal' })),
    });
  }
  assertContentPolicy(fields, (await getActivePolicy()).blocked_terms);
}

async function templateSlots(templateId: string | null): Promise<DisplaySlot[]> {
  if (!templateId) return [];
  return query<DisplaySlot>('SELECT key, label FROM template_slots WHERE template_id = $1 ORDER BY sort_order, key', [templateId]);
}

/** Fills in a label for any slot key the template does not know (deleted templates, renamed slots). */
function withFallbackLabels(slots: DisplaySlot[], values: Record<string, unknown>): DisplaySlot[] {
  const known = new Set(slots.map((s) => s.key));
  const extra = Object.keys(values).filter((k) => !known.has(k)).map((key) => ({ key, label: key }));
  return [...slots, ...extra];
}

const stringValues = (values: Record<string, unknown> | null): Record<string, string> =>
  Object.fromEntries(Object.entries(values ?? {}).filter((e): e is [string, string] => typeof e[1] === 'string'));

export interface CreateGalleryInput {
  generation_id?: string;
  template_id?: string;
  template_slug?: string;
  title: string;
  slot_values?: Record<string, string>;
  remarks?: string;
  is_featured: boolean;
  is_hidden: boolean;
  sort_order: number;
  file?: Buffer;
}

export async function createGalleryItem(ctx: AdminCtx, input: CreateGalleryInput) {
  if (Boolean(input.generation_id) === Boolean(input.file)) {
    throw new AppError('VALIDATION_ERROR', 'Kirim tepat satu sumber: generation_id atau file gambar beserta template', {
      errors: [{ field: input.generation_id ? 'file' : 'generation_id', message: 'Pilih salah satu sumber' }],
    });
  }

  let templateId: string | null = null;
  let slotValues: Record<string, string> = {};
  let remarks: string | null = null;
  let image: { buffer: Buffer; mime: string; width: number | null; height: number | null };

  if (input.generation_id) {
    const gen = await queryOne<{
      status: string;
      template_id: string | null;
      slot_values: Record<string, unknown> | null;
      remarks: string | null;
      purged_at: Date | null;
      deleted_at: Date | null;
      storage_key: string | null;
      mime: string | null;
      width: number | null;
      height: number | null;
    }>(
      `SELECT g.status, g.template_id, g.slot_values, g.remarks, g.purged_at, g.deleted_at, a.storage_key, a.mime, a.width, a.height
         FROM generations g LEFT JOIN assets a ON a.id = g.result_asset_id AND a.deleted_at IS NULL
        WHERE g.id = $1`,
      [input.generation_id],
    );
    if (!gen) throw notFound('Pembuatan gambar');
    if (gen.status !== 'done' || !gen.storage_key || gen.deleted_at || gen.purged_at) {
      throw new AppError('VALIDATION_ERROR', 'Hanya hasil pembuatan yang selesai dan masih tersimpan yang dapat dimasukkan ke galeri', {
        errors: [{ field: 'generation_id', message: 'Hasil tidak tersedia' }],
      });
    }
    templateId = gen.template_id;
    slotValues = stringValues(gen.slot_values);
    remarks = gen.remarks;
    // The gallery owns a copy so it survives the creator deleting the generation or retention purging it.
    image = { buffer: await getStorage().get(gen.storage_key), mime: gen.mime as string, width: gen.width, height: gen.height };
  } else {
    if (!input.template_id && !input.template_slug) {
      throw conflictField('template_id', 'Template wajib diisi saat membuat dari gambar unggahan');
    }
    const t = input.template_id
      ? await queryOne<{ id: string }>('SELECT id FROM templates WHERE id = $1 AND deleted_at IS NULL', [input.template_id])
      : await queryOne<{ id: string }>('SELECT id FROM templates WHERE slug = $1 AND deleted_at IS NULL', [input.template_slug]);
    if (!t) throw conflictField('template_id', 'Template tidak ditemukan');
    templateId = t.id;
    slotValues = input.slot_values ?? {};
    remarks = input.remarks ?? null;
    const processed = await processUploadedImage(input.file as Buffer);
    image = { buffer: processed.buffer, mime: processed.mime, width: processed.width, height: processed.height };
  }

  const slots = withFallbackLabels(await templateSlots(templateId), slotValues);
  const displayPrompt = buildDisplayPrompt(slots, slotValues, remarks);
  await assertPublicText({ title: input.title, display_prompt: displayPrompt });

  const asset = await createAsset({ buffer: image.buffer, mime: image.mime, kind: 'gallery', ownerId: null, prefix: 'gallery', width: image.width, height: image.height });
  try {
    const id = await withTx(async (client) => {
      const row = await queryOne<{ id: string }>(
        `INSERT INTO gallery_items (generation_id, template_id, image_asset_id, title, display_prompt, is_featured, is_hidden, sort_order, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING id`,
        [input.generation_id ?? null, templateId, asset.id, input.title, displayPrompt, input.is_featured, input.is_hidden, input.sort_order, ctx.actorId],
        client,
      );
      const created = (row as { id: string }).id;
      await recordAudit(
        ctx,
        {
          action: 'gallery.create',
          entity: 'gallery_item',
          entityId: created,
          diff: buildDiff(AUDIT_FIELDS, null, { title: input.title, display_prompt: displayPrompt, is_featured: input.is_featured, is_hidden: input.is_hidden, sort_order: input.sort_order }, {
            source: input.generation_id ? 'generation' : 'upload',
            generation_id: input.generation_id ?? null,
          }),
        },
        client,
      );
      return created;
    });
    return toDTO(await loadItem(id));
  } catch (err) {
    await softDeleteAssets([asset.id]).catch(() => undefined);
    throw err;
  }
}

export async function updateGalleryItem(
  ctx: AdminCtx,
  id: string,
  patch: { title?: string; display_prompt?: string; is_featured?: boolean; is_hidden?: boolean; sort_order?: number },
) {
  const toCheck: Record<string, string> = {};
  if (patch.title !== undefined) toCheck.title = patch.title;
  if (patch.display_prompt !== undefined) toCheck.display_prompt = patch.display_prompt;
  if (Object.keys(toCheck).length > 0) await assertPublicText(toCheck);

  await withTx(async (client) => {
    const before = await loadItem(id, true, client);
    const next = {
      title: patch.title ?? before.title,
      display_prompt: patch.display_prompt ?? before.display_prompt,
      is_featured: patch.is_featured ?? before.is_featured,
      is_hidden: patch.is_hidden ?? before.is_hidden,
      sort_order: patch.sort_order ?? before.sort_order,
    };
    await client.query('UPDATE gallery_items SET title = $2, display_prompt = $3, is_featured = $4, is_hidden = $5, sort_order = $6, updated_by = $7 WHERE id = $1', [
      id, next.title, next.display_prompt, next.is_featured, next.is_hidden, next.sort_order, ctx.actorId,
    ]);
    await recordAudit(ctx, { action: 'gallery.update', entity: 'gallery_item', entityId: id, diff: buildDiff(AUDIT_FIELDS, before as unknown as Record<string, unknown>, next) }, client);
  });
  return toDTO(await loadItem(id));
}

export async function deleteGalleryItem(ctx: AdminCtx, id: string): Promise<void> {
  const assetId = await withTx(async (client) => {
    const before = await loadItem(id, true, client);
    await client.query('DELETE FROM gallery_items WHERE id = $1', [id]);
    await recordAudit(ctx, { action: 'gallery.delete', entity: 'gallery_item', entityId: id, diff: { title: before.title } }, client);
    return before.image_asset_id;
  });
  // Seed images are protected by softDeleteAssets; copies made by this module are removed with the item.
  await softDeleteAssets([assetId]);
}
