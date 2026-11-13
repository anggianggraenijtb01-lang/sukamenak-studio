import { query, queryOne, type Queryable } from '../../../db/pool.js';
import { withTx } from '../../../db/tx.js';
import { cleanValue, composePromptDetailed, type ComposeSlot } from '../../../engine/promptComposer.js';
import { BLANK_TOKEN, countBlanks, findUnknownPlaceholders, NAMED_PLACEHOLDERS } from '../../../engine/placeholders.js';
import { containsForbiddenWords, FORBIDDEN_PROMPT_WORDS } from '../../../engine/policy.js';
import { sanitizeRemark } from '../../../engine/sanitizeRemark.js';
import { corePromptAad, decryptWithCoreKey, encryptWithCoreKey } from '../../../lib/coreCipher.js';
import { AppError, notFound } from '../../../lib/errors.js';
import { loadBrand, loadTemplateData } from '../../../pipeline/context.js';
import { getActivePolicy } from '../../shared/settings.js';
import { recordAudit } from '../auditLog.js';
import { offsetOf, Where, type AdminCtx } from '../common.js';
import { CORE_PROMPT_META_SELECT, toCorePromptMetaDTO, type CorePromptMetaRow } from './dto.js';

/** Replaced for the whole composed prompt in test-render responses. */
export const HIDDEN_MARKER = '[HIDDEN_CORE_PROMPT]';

/** Near-miss blank tokens such as `[__]` or `[ ___ ]` would reach the model literally; reject them. */
const BLANK_LIKE = /\[\s*_{2,}\s*\]/g;

/**
 * Validates a core prompt body and returns its blank count. Error messages and field errors carry
 * counts and the public whitelist only; the offending text is never echoed back.
 */
export function validateCoreBody(body: string): number {
  const unknown = findUnknownPlaceholders(body);
  if (unknown.length > 0) {
    throw new AppError('UNKNOWN_PLACEHOLDER', `Core prompt memuat ${unknown.length} placeholder yang tidak dikenal`, {
      errors: [{ field: 'body', message: `Placeholder yang diizinkan (nama di dalam kurung kurawal ganda): ${NAMED_PLACEHOLDERS.join(', ')}` }],
    });
  }
  const nearMiss = (body.match(BLANK_LIKE) ?? []).filter((t) => t !== BLANK_TOKEN).length;
  if (nearMiss > 0) {
    throw new AppError('VALIDATION_ERROR', `Core prompt memuat ${nearMiss} penanda blank yang salah format`, {
      errors: [{ field: 'body', message: 'Gunakan penanda blank baku: tiga garis bawah di dalam kurung siku, tanpa spasi' }],
    });
  }
  const blanks = countBlanks(body);
  if (blanks < 1) {
    throw new AppError('VALIDATION_ERROR', 'Core prompt harus memiliki minimal satu blank', {
      errors: [{ field: 'body', message: 'Sisipkan minimal satu penanda blank baku (tiga garis bawah di dalam kurung siku)' }],
    });
  }
  if (containsForbiddenWords(body)) {
    throw new AppError('VALIDATION_ERROR', 'Core prompt memuat kata yang dilarang untuk model gambar', {
      errors: [
        {
          field: 'body',
          message: `Model tidak boleh diminta menulis teks. Hindari kata: ${FORBIDDEN_PROMPT_WORDS.join(', ')} (deskripsikan area teks sebagai bidang warna kosong)`,
        },
      ],
    });
  }
  return blanks;
}

async function loadMeta(id: string, client?: Queryable): Promise<CorePromptMetaRow> {
  const row = await queryOne<CorePromptMetaRow>(`${CORE_PROMPT_META_SELECT} WHERE c.id = $1`, [id], client);
  if (!row) throw notFound('Core prompt');
  return row;
}

export async function listCorePrompts(f: { page: number; limit: number; key?: string; active?: boolean }) {
  const where = new Where();
  if (f.key) where.add((p) => `c.key = ${p}`, f.key);
  if (f.active !== undefined) where.add((p) => `c.is_active = ${p}`, f.active);
  const total = (await queryOne<{ n: number }>(`SELECT count(*) AS n FROM core_prompts c ${where.sql}`, where.params))?.n ?? 0;
  const limitP = where.next();
  const offsetP = `$${where.params.length + 2}`;
  const rows = await query<CorePromptMetaRow>(
    `${CORE_PROMPT_META_SELECT} ${where.sql} ORDER BY c.key, c.version DESC LIMIT ${limitP} OFFSET ${offsetP}`,
    [...where.params, f.limit, offsetOf(f)],
  );
  return { items: rows.map(toCorePromptMetaDTO), total };
}

export async function listVersions(key: string) {
  const rows = await query<CorePromptMetaRow>(`${CORE_PROMPT_META_SELECT} WHERE c.key = $1 ORDER BY c.version DESC LIMIT 200`, [key]);
  return rows.map(toCorePromptMetaDTO);
}

export async function getCorePromptMeta(id: string) {
  return toCorePromptMetaDTO(await loadMeta(id));
}

export interface CreateCorePromptInput {
  key: string;
  subject: 'product' | 'human_model';
  publication: string;
  body: string;
}

/** Creates the next version of a key (inactive until activated). Responds with metadata only. */
export async function createCorePrompt(ctx: AdminCtx, input: CreateCorePromptInput) {
  const blankCount = validateCoreBody(input.body.replace(/\r\n?/g, '\n'));
  const id = await withTx(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`core_prompt:${input.key}`]);
    const latest = await queryOne<{ version: number; subject: string; publication: string }>(
      'SELECT version, subject, publication FROM core_prompts WHERE key = $1 ORDER BY version DESC LIMIT 1',
      [input.key],
      client,
    );
    if (latest && (latest.subject !== input.subject || latest.publication !== input.publication)) {
      throw new AppError('VALIDATION_ERROR', 'Subject dan publication harus sama dengan versi sebelumnya dari key ini', {
        errors: [{ field: 'subject', message: `Versi sebelumnya: ${latest.subject} / ${latest.publication}` }],
      });
    }
    const version = (latest?.version ?? 0) + 1;
    const enc = encryptWithCoreKey(input.body.replace(/\r\n?/g, '\n'), corePromptAad(input.key, version));
    const row = await queryOne<{ id: string }>(
      `INSERT INTO core_prompts (key, version, subject, publication, body_ciphertext, body_iv, body_auth_tag, blank_count, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $9) RETURNING id`,
      [input.key, version, input.subject, input.publication, enc.ciphertext, enc.iv, enc.authTag, blankCount, ctx.actorId],
      client,
    );
    const created = (row as { id: string }).id;
    await recordAudit(
      ctx,
      {
        action: 'core_prompt.create',
        entity: 'core_prompt',
        entityId: created,
        diff: { key: input.key, version, subject: input.subject, publication: input.publication, blank_count: blankCount },
      },
      client,
    );
    return created;
  });
  return toCorePromptMetaDTO(await loadMeta(id));
}

/**
 * Makes one version the single active version of its key. Refused when a published template using the
 * key would stop matching the blank count (BLANK_SLOT_MISMATCH).
 */
export async function activateCorePrompt(ctx: AdminCtx, id: string) {
  await withTx(async (client) => {
    const target = await loadMeta(id, client);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`core_prompt:${target.key}`]);

    const mismatched = await query<{ slug: string; blanks: number }>(
      `SELECT t.slug, (SELECT count(*) FROM template_slots s WHERE s.template_id = t.id AND s.blank_index IS NOT NULL) AS blanks
         FROM templates t
        WHERE t.core_prompt_key = $1 AND t.status = 'published' AND t.deleted_at IS NULL`,
      [target.key],
      client,
    );
    const bad = mismatched.filter((t) => t.blanks !== target.blank_count);
    if (bad.length > 0) {
      throw new AppError('BLANK_SLOT_MISMATCH', `Versi ini memiliki ${target.blank_count} blank, tidak cocok dengan ${bad.length} template terbit`, {
        errors: bad.map((t) => ({ field: `template.${t.slug}`, message: `Template memiliki ${t.blanks} slot blank` })),
      });
    }

    const current = await queryOne<{ id: string; version: number }>('SELECT id, version FROM core_prompts WHERE key = $1 AND is_active', [target.key], client);
    if (current?.id === id) return;
    // Deactivate first: the unique index allows one active row per key and is checked per statement.
    await client.query('UPDATE core_prompts SET is_active = false, updated_by = $2 WHERE key = $1 AND is_active', [target.key, ctx.actorId]);
    await client.query('UPDATE core_prompts SET is_active = true, updated_by = $2 WHERE id = $1', [id, ctx.actorId]);
    await recordAudit(
      ctx,
      {
        action: 'core_prompt.activate',
        entity: 'core_prompt',
        entityId: id,
        diff: { key: target.key, from_version: current?.version ?? null, to_version: target.version, blank_count: target.blank_count },
      },
      client,
    );
  });
  return toCorePromptMetaDTO(await loadMeta(id));
}

export interface TestRenderInput {
  key?: string;
  id?: string;
  template_slug?: string;
  slot_values: Record<string, string>;
  remarks?: string;
}

interface CipherRow {
  id: string;
  key: string;
  version: number;
  subject: 'product' | 'human_model';
  blank_count: number;
  body_ciphertext: Buffer;
  body_iv: Buffer;
  body_auth_tag: Buffer;
}

/**
 * Dry run of the composer for the admin. The core prompt is decrypted and composed ON THE SERVER, but the
 * response contains only a masked marker, per-blank filled/empty status and the sanitised values the
 * admin supplied. Neither the body, any part of it, nor the composed prompt ever leaves this function.
 */
export async function testRender(ctx: AdminCtx, input: TestRenderInput) {
  const row = input.id
    ? await queryOne<CipherRow>('SELECT id, key, version, subject, blank_count, body_ciphertext, body_iv, body_auth_tag FROM core_prompts WHERE id = $1', [input.id])
    : await queryOne<CipherRow>(
        'SELECT id, key, version, subject, blank_count, body_ciphertext, body_iv, body_auth_tag FROM core_prompts WHERE key = $1 AND is_active',
        [input.key],
      );
  if (!row) throw notFound(input.id ? 'Core prompt' : 'Core prompt aktif');

  const template = input.template_slug
    ? await queryOne<{ id: string }>('SELECT id FROM templates WHERE slug = $1 AND deleted_at IS NULL', [input.template_slug])
    : null;
  if (input.template_slug && !template) throw notFound('Template');
  const data = template ? await loadTemplateData(template.id) : null;

  const slots: ComposeSlot[] = data
    ? data.slots.map((s) => ({
        key: s.key,
        label: s.label,
        blank_index: s.blank_index,
        required: s.required,
        default_value: s.default_value,
        max_length: s.max_length,
        source_hint: s.source_hint,
      }))
    : Array.from({ length: row.blank_count }, (_, i) => ({ key: `blank_${i + 1}`, blank_index: i + 1 }));

  const [policy, brand] = await Promise.all([getActivePolicy(), loadBrand()]);
  const blockedTerms = policy.blocked_terms;

  const body = decryptWithCoreKey(
    { ciphertext: row.body_ciphertext, iv: row.body_iv, authTag: row.body_auth_tag },
    corePromptAad(row.key, row.version),
  );
  // The composed prompt is discarded on purpose: only provenance (`sources`) is read from the result.
  const { sources, droppedRemarks } = composePromptDetailed({
    coreBody: body,
    slots,
    slotValues: input.slot_values,
    remarks: input.remarks ?? null,
    subject: row.subject,
    aspectRatio: data?.aspect_ratio ?? '4:5',
    brand: { palette: brand.palette },
    textZones: data?.zones.map((z) => ({ slot_key: z.slot_key, x: Number(z.x), y: Number(z.y), w: Number(z.w), h: Number(z.h) })),
    blockedTerms,
  });

  const blanks = slots
    .filter((s) => s.blank_index !== null)
    .sort((a, b) => (a.blank_index as number) - (b.blank_index as number))
    .map((s) => ({
      index: s.blank_index as number,
      slot_key: s.key,
      status: sources[s.key] === undefined || sources[s.key] === 'fallback' ? ('empty' as const) : ('filled' as const),
      source: sources[s.key] ?? 'fallback',
    }));

  const sanitizedValues: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.slot_values)) sanitizedValues[key] = cleanValue(value, 400, blockedTerms);
  const sanitizedRemarks = input.remarks
    ? cleanValue(sanitizeRemark(input.remarks, { blockedTerms, maxLength: 300 }), 300, blockedTerms)
    : null;

  await recordAudit(ctx, {
    action: 'core_prompt.test_render',
    entity: 'core_prompt',
    entityId: row.id,
    diff: { key: row.key, version: row.version, blank_count: row.blank_count },
  });

  return {
    masked_prompt: HIDDEN_MARKER,
    core_prompt: { id: row.id, key: row.key, version: row.version, blank_count: row.blank_count },
    template: data ? { id: data.id, slug: data.slug } : null,
    blanks,
    filled_count: blanks.filter((b) => b.status === 'filled').length,
    empty_count: blanks.filter((b) => b.status === 'empty').length,
    sanitized_values: sanitizedValues,
    sanitized_remarks: sanitizedRemarks,
    remarks_dropped: droppedRemarks,
  };
}
