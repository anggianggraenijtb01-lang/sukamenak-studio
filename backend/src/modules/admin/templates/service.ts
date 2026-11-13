import type { PoolClient } from 'pg';
import { query, queryOne, type Queryable } from '../../../db/pool.js';
import { withTx } from '../../../db/tx.js';
import { AppError, notFound, type ErrorCode } from '../../../lib/errors.js';
import { createAsset, softDeleteAssets } from '../../../storage/assets.js';
import { processUploadedImage } from '../../../storage/image.js';
import { buildDiff, recordAudit } from '../auditLog.js';
import { conflictField, escapeLike, offsetOf, uniqueViolation, Where, type AdminCtx } from '../common.js';
import {
  ADMIN_TEMPLATE_SELECT,
  SLOT_AUDIT_FIELDS,
  SLOT_COLUMNS,
  TEMPLATE_AUDIT_FIELDS,
  toAdminSlotDTO,
  toAdminTemplateDTO,
  toAdminZoneDTO,
  ZONE_AUDIT_FIELDS,
  ZONE_COLUMNS,
  type AdminSlotRow,
  type AdminTemplateRow,
  type AdminZoneRow,
  type PublishIssue,
} from './dto.js';

const rec = (row: object): Record<string, unknown> => row as Record<string, unknown>;

// --- loading --------------------------------------------------------------------------------

async function loadTemplate(id: string, db?: Queryable, lock = false): Promise<AdminTemplateRow> {
  const row = await queryOne<AdminTemplateRow>(
    `${ADMIN_TEMPLATE_SELECT} WHERE t.id = $1 AND t.deleted_at IS NULL${lock ? ' FOR UPDATE OF t' : ''}`,
    [id],
    db,
  );
  if (!row) throw notFound('Template');
  return row;
}

export async function listTemplates(f: { page: number; limit: number; status?: string; category?: string; search?: string }) {
  const where = new Where('t.deleted_at IS NULL');
  if (f.status) where.add((p) => `t.status = ${p}`, f.status);
  if (f.category) where.add((p) => `t.category = ${p}`, f.category);
  if (f.search) where.add((p) => `(t.name ILIKE ${p} OR t.slug ILIKE ${p})`, `%${escapeLike(f.search as string)}%`);
  const total = (await queryOne<{ n: number }>(`SELECT count(*) AS n FROM templates t ${where.sql}`, where.params))?.n ?? 0;
  const limitP = where.next();
  const offsetP = `$${where.params.length + 2}`;
  const rows = await query<AdminTemplateRow>(
    `${ADMIN_TEMPLATE_SELECT} ${where.sql} ORDER BY t.sort_order, t.name, t.id LIMIT ${limitP} OFFSET ${offsetP}`,
    [...where.params, f.limit, offsetOf(f)],
  );
  return { items: rows.map(toAdminTemplateDTO), total };
}

export async function getTemplate(id: string) {
  const template = await loadTemplate(id);
  const [slots, zones, issues] = await Promise.all([
    query<AdminSlotRow>(`SELECT ${SLOT_COLUMNS} FROM template_slots WHERE template_id = $1 ORDER BY sort_order, blank_index NULLS LAST, key`, [id]),
    query<AdminZoneRow>(`SELECT ${ZONE_COLUMNS} FROM text_zones WHERE template_id = $1 ORDER BY slot_key`, [id]),
    collectIssues(template),
  ]);
  return {
    ...toAdminTemplateDTO(template),
    slots: slots.map(toAdminSlotDTO),
    text_zones: zones.map(toAdminZoneDTO),
    readiness: { publishable: issues.length === 0, issues },
  };
}

// --- publish validation ---------------------------------------------------------------------

/** Everything that must hold before a template may be (or stay) published. */
export async function collectIssues(template: Pick<AdminTemplateRow, 'id' | 'category' | 'core_prompt_key'>, db?: Queryable): Promise<PublishIssue[]> {
  const issues: PublishIssue[] = [];

  const core = await queryOne<{ blank_count: number }>('SELECT blank_count FROM core_prompts WHERE key = $1 AND is_active', [template.core_prompt_key], db);
  if (!core) {
    issues.push({ code: 'CORE_PROMPT_REQUIRED', message: `Belum ada core prompt aktif untuk key "${template.core_prompt_key}"` });
  } else {
    const blanks = (await queryOne<{ n: number }>('SELECT count(*) AS n FROM template_slots WHERE template_id = $1 AND blank_index IS NOT NULL', [template.id], db))?.n ?? 0;
    if (blanks !== core.blank_count) {
      issues.push({ code: 'BLANK_SLOT_MISMATCH', message: `Core prompt memiliki ${core.blank_count} blank, template memiliki ${blanks} slot ber-blank_index` });
    }
  }

  const orphans = await query<{ slot_key: string }>(
    `SELECT z.slot_key FROM text_zones z
       LEFT JOIN template_slots s ON s.template_id = z.template_id AND s.key = z.slot_key
      WHERE z.template_id = $1 AND s.id IS NULL`,
    [template.id],
    db,
  );
  for (const o of orphans) issues.push({ code: 'VALIDATION_ERROR', message: `Text zone merujuk slot yang tidak ada: ${o.slot_key}` });

  if (template.category === 'psa') {
    const policy = await queryOne<{ disclaimer: string | null }>("SELECT disclaimers->>'psa' AS disclaimer FROM content_policies WHERE is_active LIMIT 1", [], db);
    if (!policy?.disclaimer || policy.disclaimer.trim() === '') {
      issues.push({ code: 'CONTENT_POLICY_VIOLATION', message: 'Template kategori psa wajib memiliki disclaimer psa pada kebijakan konten' });
    }
  }
  return issues;
}

async function assertPublishable(db: Queryable, id: string): Promise<void> {
  const template = await loadTemplate(id, db);
  const issues = await collectIssues(template, db);
  const first = issues[0];
  if (first) {
    throw new AppError(first.code as ErrorCode, first.message, {
      errors: issues.map((i) => ({ field: i.code, message: i.message })),
    });
  }
}

/** Published templates are live: every edit re-validates and rolls back the whole change on failure. */
async function revalidateIfPublished(client: PoolClient, template: AdminTemplateRow): Promise<void> {
  if (template.status === 'published') await assertPublishable(client, template.id);
}

// --- templates ------------------------------------------------------------------------------

export interface CreateTemplateInput {
  slug: string;
  name: string;
  description: string;
  category: string;
  mode: string;
  subject: string;
  aspect_ratio: string;
  core_prompt_key: string;
  sort_order: number;
}

const slugTaken = () => conflictField('slug', 'Slug sudah digunakan');

export async function createTemplate(ctx: AdminCtx, input: CreateTemplateInput) {
  try {
    const id = await withTx(async (client) => {
      const row = await queryOne<{ id: string }>(
        `INSERT INTO templates (slug, name, description, category, mode, subject, aspect_ratio, core_prompt_key, sort_order, status, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $10) RETURNING id`,
        [input.slug, input.name, input.description, input.category, input.mode, input.subject, input.aspect_ratio, input.core_prompt_key, input.sort_order, ctx.actorId],
        client,
      );
      const created = (row as { id: string }).id;
      await recordAudit(ctx, { action: 'template.create', entity: 'template', entityId: created, diff: buildDiff(TEMPLATE_AUDIT_FIELDS, null, { ...input, status: 'draft' }) }, client);
      return created;
    });
    return getTemplate(id);
  } catch (err) {
    if (uniqueViolation(err) !== null) throw slugTaken();
    throw err;
  }
}

export type UpdateTemplateInput = Partial<Omit<CreateTemplateInput, never>>;

export async function updateTemplate(ctx: AdminCtx, id: string, patch: UpdateTemplateInput) {
  try {
    await withTx(async (client) => {
      const before = await loadTemplate(id, client, true);
      const next = { ...rec(before), ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
      const row = await queryOne<AdminTemplateRow>(
        `UPDATE templates SET slug = $2, name = $3, description = $4, category = $5, mode = $6, subject = $7, aspect_ratio = $8,
                core_prompt_key = $9, sort_order = $10, updated_by = $11
          WHERE id = $1 RETURNING id, slug, name, description, category, mode, subject, aspect_ratio, core_prompt_key, status, sort_order`,
        [id, next.slug, next.name, next.description, next.category, next.mode, next.subject, next.aspect_ratio, next.core_prompt_key, next.sort_order, ctx.actorId],
        client,
      );
      await revalidateIfPublished(client, before);
      await recordAudit(ctx, { action: 'template.update', entity: 'template', entityId: id, diff: buildDiff(TEMPLATE_AUDIT_FIELDS, rec(before), rec(row as object)) }, client);
    });
    return getTemplate(id);
  } catch (err) {
    if (uniqueViolation(err) !== null) throw slugTaken();
    throw err;
  }
}

/** Only unpublished templates can be deleted. The slug is freed by renaming the soft-deleted row. */
export async function deleteTemplate(ctx: AdminCtx, id: string): Promise<void> {
  await withTx(async (client) => {
    const before = await loadTemplate(id, client, true);
    if (before.status === 'published') {
      throw new AppError('VALIDATION_ERROR', 'Template terbit tidak dapat dihapus. Batalkan penerbitan atau arsipkan terlebih dahulu.', {
        errors: [{ field: 'status', message: 'Template sedang terbit' }],
      });
    }
    await client.query(
      `UPDATE templates SET deleted_at = now(), slug = left(slug, 80) || '-deleted-' || left(id::text, 8), updated_by = $2 WHERE id = $1`,
      [id, ctx.actorId],
    );
    await recordAudit(ctx, { action: 'template.delete', entity: 'template', entityId: id, diff: { slug: before.slug, status: before.status } }, client);
  });
}

async function setStatus(ctx: AdminCtx, id: string, status: 'draft' | 'published' | 'archived', action: string) {
  await withTx(async (client) => {
    const before = await loadTemplate(id, client, true);
    if (before.status === status) return;
    if (status === 'published') await assertPublishable(client, id);
    await client.query('UPDATE templates SET status = $2, updated_by = $3 WHERE id = $1', [id, status, ctx.actorId]);
    await recordAudit(ctx, { action, entity: 'template', entityId: id, diff: { slug: before.slug, from: before.status, to: status } }, client);
  });
  return getTemplate(id);
}

export const publishTemplate = (ctx: AdminCtx, id: string) => setStatus(ctx, id, 'published', 'template.publish');
export const unpublishTemplate = (ctx: AdminCtx, id: string) => setStatus(ctx, id, 'draft', 'template.unpublish');
export const archiveTemplate = (ctx: AdminCtx, id: string) => setStatus(ctx, id, 'archived', 'template.archive');

export async function uploadPreview(ctx: AdminCtx, id: string, buffer: Buffer) {
  await loadTemplate(id);
  const image = await processUploadedImage(buffer);
  const asset = await createAsset({ buffer: image.buffer, mime: image.mime, kind: 'preview', ownerId: null, prefix: 'previews', width: image.width, height: image.height });
  let previousAssetId: string | null = null;
  try {
    previousAssetId = await withTx(async (client) => {
      const before = await loadTemplate(id, client, true);
      await client.query('UPDATE templates SET preview_asset_id = $2, updated_by = $3 WHERE id = $1', [id, asset.id, ctx.actorId]);
      await recordAudit(ctx, { action: 'template.preview_upload', entity: 'template', entityId: id, diff: { replaced: before.preview_asset_id !== null, bytes: asset.bytes } }, client);
      return before.preview_asset_id;
    });
  } catch (err) {
    await softDeleteAssets([asset.id]).catch(() => undefined);
    throw err;
  }
  await softDeleteAssets([previousAssetId]);
  return getTemplate(id);
}

// --- slots ----------------------------------------------------------------------------------

export interface SlotInput {
  key: string;
  label: string;
  type: string;
  blank_index: number | null;
  required: boolean;
  default_value: string | null;
  options: unknown[] | null;
  max_length: number | null;
  vision_role: string | null;
  source_hint: string | null;
  sort_order: number;
}

function mapSlotConflict(err: unknown): never {
  const constraint = uniqueViolation(err);
  if (constraint === null) throw err;
  if (constraint.includes('blank_index')) throw conflictField('blank_index', 'blank_index sudah dipakai slot lain pada template ini');
  throw conflictField('key', 'Key slot sudah digunakan pada template ini');
}

function assertSelectOptions(slot: Pick<SlotInput, 'type' | 'options'>): void {
  if (slot.type === 'select' && (!slot.options || slot.options.length === 0)) {
    throw conflictField('options', 'Slot bertipe select membutuhkan options');
  }
}

export async function createSlot(ctx: AdminCtx, templateId: string, input: SlotInput) {
  assertSelectOptions(input);
  try {
    return await withTx(async (client) => {
      const template = await loadTemplate(templateId, client, true);
      const row = (await queryOne<AdminSlotRow>(
        `INSERT INTO template_slots (template_id, key, label, type, blank_index, required, default_value, options, max_length, vision_role, source_hint, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12) RETURNING ${SLOT_COLUMNS}`,
        [templateId, input.key, input.label, input.type, input.blank_index, input.required, input.default_value, input.options ? JSON.stringify(input.options) : null, input.max_length, input.vision_role, input.source_hint, input.sort_order],
        client,
      )) as AdminSlotRow;
      await revalidateIfPublished(client, template);
      await recordAudit(ctx, { action: 'template_slot.create', entity: 'template_slot', entityId: row.id, diff: buildDiff(SLOT_AUDIT_FIELDS, null, rec(row), { template_id: templateId }) }, client);
      return toAdminSlotDTO(row);
    });
  } catch (err) {
    return mapSlotConflict(err);
  }
}

export async function updateSlot(ctx: AdminCtx, templateId: string, slotId: string, patch: Partial<SlotInput>) {
  try {
    return await withTx(async (client) => {
      const template = await loadTemplate(templateId, client, true);
      const before = await queryOne<AdminSlotRow>(`SELECT ${SLOT_COLUMNS} FROM template_slots WHERE id = $1 AND template_id = $2 FOR UPDATE`, [slotId, templateId], client);
      if (!before) throw notFound('Slot');
      const next = { ...rec(before), ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) } as unknown as SlotInput;
      assertSelectOptions(next);
      const row = (await queryOne<AdminSlotRow>(
        `UPDATE template_slots SET key = $3, label = $4, type = $5, blank_index = $6, required = $7, default_value = $8, options = $9::jsonb,
                max_length = $10, vision_role = $11, source_hint = $12, sort_order = $13
          WHERE id = $1 AND template_id = $2 RETURNING ${SLOT_COLUMNS}`,
        [slotId, templateId, next.key, next.label, next.type, next.blank_index, next.required, next.default_value, next.options ? JSON.stringify(next.options) : null, next.max_length, next.vision_role, next.source_hint, next.sort_order],
        client,
      )) as AdminSlotRow;
      await revalidateIfPublished(client, template);
      await recordAudit(ctx, { action: 'template_slot.update', entity: 'template_slot', entityId: slotId, diff: buildDiff(SLOT_AUDIT_FIELDS, rec(before), rec(row), { template_id: templateId }) }, client);
      return toAdminSlotDTO(row);
    });
  } catch (err) {
    return mapSlotConflict(err);
  }
}

export async function deleteSlot(ctx: AdminCtx, templateId: string, slotId: string): Promise<void> {
  await withTx(async (client) => {
    const template = await loadTemplate(templateId, client, true);
    const before = await queryOne<AdminSlotRow>(`SELECT ${SLOT_COLUMNS} FROM template_slots WHERE id = $1 AND template_id = $2 FOR UPDATE`, [slotId, templateId], client);
    if (!before) throw notFound('Slot');
    // Its text zone (if any) goes with it through the foreign key's ON DELETE CASCADE.
    await client.query('DELETE FROM template_slots WHERE id = $1', [slotId]);
    await revalidateIfPublished(client, template);
    await recordAudit(ctx, { action: 'template_slot.delete', entity: 'template_slot', entityId: slotId, diff: { template_id: templateId, key: before.key, blank_index: before.blank_index } }, client);
  });
}

// --- text zones -----------------------------------------------------------------------------

export interface ZoneInput {
  slot_key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  align: string;
  font_family: string;
  font_weight: number;
  font_size_ratio: number;
  color: string;
  max_lines: number;
}

function assertZoneFits(z: Pick<ZoneInput, 'x' | 'y' | 'w' | 'h'>): void {
  const errors = [];
  if (z.x + z.w > 1.0001) errors.push({ field: 'w', message: 'x + w tidak boleh melebihi 1' });
  if (z.y + z.h > 1.0001) errors.push({ field: 'h', message: 'y + h tidak boleh melebihi 1' });
  if (errors.length > 0) throw new AppError('VALIDATION_ERROR', 'Text zone melewati batas kanvas', { errors });
}

async function assertSlotExists(client: PoolClient, templateId: string, slotKey: string): Promise<void> {
  const slot = await queryOne('SELECT 1 FROM template_slots WHERE template_id = $1 AND key = $2', [templateId, slotKey], client);
  if (!slot) throw conflictField('slot_key', 'Slot dengan key ini tidak ada pada template');
}

const zoneTaken = () => conflictField('slot_key', 'Slot ini sudah memiliki text zone');

export async function createZone(ctx: AdminCtx, templateId: string, input: ZoneInput) {
  assertZoneFits(input);
  try {
    return await withTx(async (client) => {
      const template = await loadTemplate(templateId, client, true);
      await assertSlotExists(client, templateId, input.slot_key);
      const row = (await queryOne<AdminZoneRow>(
        `INSERT INTO text_zones (template_id, slot_key, x, y, w, h, align, font_family, font_weight, font_size_ratio, color, max_lines)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING ${ZONE_COLUMNS}`,
        [templateId, input.slot_key, input.x, input.y, input.w, input.h, input.align, input.font_family, input.font_weight, input.font_size_ratio, input.color, input.max_lines],
        client,
      )) as AdminZoneRow;
      await revalidateIfPublished(client, template);
      await recordAudit(ctx, { action: 'template_zone.create', entity: 'text_zone', entityId: row.id, diff: buildDiff(ZONE_AUDIT_FIELDS, null, rec(row), { template_id: templateId }) }, client);
      return toAdminZoneDTO(row);
    });
  } catch (err) {
    if (uniqueViolation(err) !== null) throw zoneTaken();
    throw err;
  }
}

export async function updateZone(ctx: AdminCtx, templateId: string, zoneId: string, patch: Partial<ZoneInput>) {
  try {
    return await withTx(async (client) => {
      const template = await loadTemplate(templateId, client, true);
      const before = await queryOne<AdminZoneRow>(`SELECT ${ZONE_COLUMNS} FROM text_zones WHERE id = $1 AND template_id = $2 FOR UPDATE`, [zoneId, templateId], client);
      if (!before) throw notFound('Text zone');
      const merged = { ...rec(before), ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) } as Record<string, unknown>;
      const next: ZoneInput = {
        slot_key: String(merged.slot_key),
        x: Number(merged.x),
        y: Number(merged.y),
        w: Number(merged.w),
        h: Number(merged.h),
        align: String(merged.align),
        font_family: String(merged.font_family),
        font_weight: Number(merged.font_weight),
        font_size_ratio: Number(merged.font_size_ratio),
        color: String(merged.color),
        max_lines: Number(merged.max_lines),
      };
      assertZoneFits(next);
      if (next.slot_key !== before.slot_key) await assertSlotExists(client, templateId, next.slot_key);
      const row = (await queryOne<AdminZoneRow>(
        `UPDATE text_zones SET slot_key = $3, x = $4, y = $5, w = $6, h = $7, align = $8, font_family = $9, font_weight = $10,
                font_size_ratio = $11, color = $12, max_lines = $13
          WHERE id = $1 AND template_id = $2 RETURNING ${ZONE_COLUMNS}`,
        [zoneId, templateId, next.slot_key, next.x, next.y, next.w, next.h, next.align, next.font_family, next.font_weight, next.font_size_ratio, next.color, next.max_lines],
        client,
      )) as AdminZoneRow;
      await revalidateIfPublished(client, template);
      await recordAudit(ctx, { action: 'template_zone.update', entity: 'text_zone', entityId: zoneId, diff: buildDiff(ZONE_AUDIT_FIELDS, rec(before), rec(row), { template_id: templateId }) }, client);
      return toAdminZoneDTO(row);
    });
  } catch (err) {
    if (uniqueViolation(err) !== null) throw zoneTaken();
    throw err;
  }
}

export async function deleteZone(ctx: AdminCtx, templateId: string, zoneId: string): Promise<void> {
  await withTx(async (client) => {
    const template = await loadTemplate(templateId, client, true);
    const before = await queryOne<AdminZoneRow>(`SELECT ${ZONE_COLUMNS} FROM text_zones WHERE id = $1 AND template_id = $2 FOR UPDATE`, [zoneId, templateId], client);
    if (!before) throw notFound('Text zone');
    await client.query('DELETE FROM text_zones WHERE id = $1', [zoneId]);
    await revalidateIfPublished(client, template);
    await recordAudit(ctx, { action: 'template_zone.delete', entity: 'text_zone', entityId: zoneId, diff: { template_id: templateId, slot_key: before.slot_key } }, client);
  });
}
