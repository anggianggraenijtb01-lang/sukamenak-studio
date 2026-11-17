import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { env } from '../config/env.js';
import { closePool, query, queryOne } from '../db/pool.js';
import { csvRow } from '../lib/csv.js';
import { AppError } from '../lib/errors.js';
import { hashPassword } from '../lib/password.js';
import { isKeyConfigured, MODEL_COLUMNS, type ModelRow } from '../modules/admin/models/dto.js';
import { setDefault } from '../modules/admin/models/service.js';
import { createGeneration } from '../modules/generations/service.js';
import type { SlotDef } from '../modules/generations/slotValidation.js';
import { createReference } from '../modules/references/service.js';
import { initProviders } from '../providers/index.js';
import { awaitQueueIdle, closeQueue } from '../queue/index.js';
import { SEED_GALLERY } from '../seed/data/gallery.js';
import { getStorage } from '../storage/index.js';

/**
 * Phase F (docs/IMPLEMENTATION_PLAN.md): runs the REAL pipeline for every (image model x template x reference
 * photo) and saves each result image plus a results.csv with empty scoring columns for the human review
 * (DoD AI checklist). It switches the default model of the capability for the duration of the run and
 * restores it afterwards, so run it on dev/staging, never while creators use the environment.
 *
 * Nothing secret is written: no core prompt, no final prompt, no key. The CSV holds names, codes and numbers.
 *
 *   npm run benchmark -- --refs ./golden/product
 *   npm run benchmark -- --refs ./golden/product --models "Seedream (i2i),FLUX.1 dev (i2i)" --templates poster-promo-produk
 *   npm run benchmark -- --refs ./golden/product --human-refs ./golden/human --include-human   # written consent only
 */

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const BENCHMARK_EMAIL = 'benchmark@sukamenak.studio';
const POLL_MS = 1000;

export const SCORE_COLUMNS = ['huruf_rusak', 'manusia_di_mode_product', 'referensi_dipakai', 'skor_1_5', 'catatan'] as const;
export const RESULT_COLUMNS = [
  'model_target',
  'model_used',
  'fallback',
  'template',
  'reference',
  'status',
  'error_code',
  'degraded',
  'used_reference_image',
  'composited_text',
  'duration_ms',
  'cost_usd',
  'image_file',
  ...SCORE_COLUMNS,
] as const;

const firstOption = (options: unknown): string | undefined => {
  if (!Array.isArray(options)) return undefined;
  const first = options.find((o) => o && typeof o === 'object' && typeof (o as { value?: unknown }).value === 'string');
  return first ? (first as { value: string }).value : undefined;
};

/**
 * Slot values for one benchmark run: the gallery example for that template where it exists (realistic
 * input), otherwise a placeholder only for required slots without a default, so the template's own
 * defaults stay in effect. Values are cut to the slot's max_length.
 */
export function sampleSlotValues(slots: SlotDef[], preset: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slot of slots) {
    let value = preset[slot.key];
    if (!value && slot.required && !slot.default_value?.trim()) {
      value = slot.type === 'select' ? firstOption(slot.options) : slot.type === 'color' ? 'warm orange and cream' : slot.label;
    }
    if (value) out[slot.key] = slot.max_length ? value.slice(0, slot.max_length) : value;
  }
  return out;
}

/** File-name-safe token (model names contain spaces, dots and parentheses). */
export const fileToken = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'x';

const stamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

interface TemplateTarget {
  id: string;
  slug: string;
  subject: 'product' | 'human_model';
  slots: SlotDef[];
}

async function benchmarkUser(): Promise<string> {
  const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [BENCHMARK_EMAIL]);
  if (existing) {
    await query('UPDATE users SET is_active = true, daily_limit_override = 100000 WHERE id = $1', [existing.id]);
    return existing.id;
  }
  // A creator account nobody signs in to: the password is random and never printed.
  const hash = await hashPassword(randomBytes(32).toString('base64url'));
  const row = await queryOne<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role, daily_limit_override) VALUES ($1, $2, 'Benchmark (CLI)', 'creator', 100000) RETURNING id`,
    [BENCHMARK_EMAIL, hash],
  );
  return (row as { id: string }).id;
}

async function adminActor(): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM users WHERE role = 'admin' AND is_active AND deleted_at IS NULL ORDER BY created_at LIMIT 1`,
  );
  if (!row) throw new Error('No active admin account (run npm run seed first)');
  return row.id;
}

async function listImages(dir: string): Promise<string[]> {
  const names = (await readdir(dir)).filter((n) => IMAGE_EXT.test(n)).sort();
  if (names.length === 0) throw new Error(`No .jpg/.png/.webp files in ${dir}`);
  return names.map((n) => path.join(dir, n));
}

async function loadTemplates(slugs: string[] | undefined, includeHuman: boolean): Promise<TemplateTarget[]> {
  const rows = await query<{ id: string; slug: string; subject: 'product' | 'human_model' }>(
    `SELECT id, slug, subject FROM templates
      WHERE status = 'published' AND deleted_at IS NULL AND mode IN ('i2i', 'both')
      ORDER BY slug`,
  );
  const picked = rows.filter((t) => (slugs ? slugs.includes(t.slug) : true) && (includeHuman || t.subject === 'product'));
  const missing = slugs?.filter((s) => !rows.some((t) => t.slug === s)) ?? [];
  if (missing.length > 0) throw new Error(`Unknown or unpublished i2i template(s): ${missing.join(', ')}`);
  const out: TemplateTarget[] = [];
  for (const t of picked) {
    const slots = await query<SlotDef>(
      `SELECT key, label, type, required, default_value, options, max_length FROM template_slots WHERE template_id = $1 ORDER BY sort_order`,
      [t.id],
    );
    out.push({ ...t, slots });
  }
  return out;
}

async function loadModels(names: string[] | undefined, includeMock: boolean): Promise<ModelRow[]> {
  const rows = await query<ModelRow>(
    `SELECT ${MODEL_COLUMNS} FROM model_configs WHERE capability = 'i2i' AND is_active AND deleted_at IS NULL ORDER BY priority, name`,
  );
  const usable = rows.filter((m) => isKeyConfigured(m) && (includeMock || m.provider !== 'mock'));
  if (!names) return usable;
  const picked = names.map((n) => usable.find((m) => m.name === n || m.id === n));
  const missing = names.filter((_, i) => !picked[i]);
  if (missing.length > 0) {
    throw new Error(`Not an active, keyed i2i model: ${missing.join(', ')} (activate it in the admin panel first)`);
  }
  return picked as ModelRow[];
}

/** Starts one generation, retrying once after a minute when the per-minute generation limit is hit. */
async function start(userId: string, input: Parameters<typeof createGeneration>[1]): Promise<string> {
  try {
    return (await createGeneration(userId, input)).id;
  } catch (err) {
    if (!(err instanceof AppError) || err.code !== 'RATE_LIMIT_EXCEEDED') throw err;
    process.stdout.write('  (per-minute generation limit reached, waiting 61 s)\n');
    await sleep(61_000);
    return (await createGeneration(userId, input)).id;
  }
}

interface FinishedRow {
  status: string;
  error_code: string | null;
  degraded: boolean;
  used_reference_image: boolean;
  composited_text: boolean;
  duration_ms: number | null;
  total_cost_usd: string;
  model_image_id: string | null;
  storage_key: string | null;
}

async function waitFor(id: string): Promise<FinishedRow> {
  const deadline = Date.now() + env.JOB_TIMEOUT_MS + 30_000;
  for (;;) {
    const row = await queryOne<FinishedRow>(
      `SELECT g.status, g.error_code, g.degraded, g.used_reference_image, g.composited_text, g.duration_ms,
              g.total_cost_usd, g.model_image_id, a.storage_key
         FROM generations g LEFT JOIN assets a ON a.id = g.result_asset_id
        WHERE g.id = $1`,
      [id],
    );
    if (row && (row.status === 'done' || row.status === 'failed')) return row;
    if (Date.now() > deadline) throw new Error(`Generation ${id} did not finish in time`);
    await sleep(POLL_MS);
  }
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      refs: { type: 'string' },
      'human-refs': { type: 'string' },
      models: { type: 'string' },
      templates: { type: 'string' },
      out: { type: 'string' },
      'include-human': { type: 'boolean', default: false },
      'include-mock': { type: 'boolean', default: false },
      'allow-production': { type: 'boolean', default: false },
    },
  });
  if (!values.refs) {
    process.stderr.write('Usage: npm run benchmark -- --refs <folder of product photos> [--models a,b] [--templates slug,slug] [--out dir]\n');
    return 1;
  }
  if (env.isProduction && !values['allow-production']) {
    process.stderr.write('Refusing to run against production: the benchmark switches the default i2i model while it runs.\n');
    return 1;
  }
  if (values['include-human'] && !values['human-refs']) {
    process.stderr.write('--include-human needs --human-refs <folder> (photos of people with written consent).\n');
    return 1;
  }

  initProviders();
  const split = (s: string | undefined) => s?.split(',').map((x) => x.trim()).filter(Boolean);
  const [productRefs, humanRefs, templates, models] = await Promise.all([
    listImages(values.refs),
    values['include-human'] ? listImages(values['human-refs'] as string) : Promise.resolve([]),
    loadTemplates(split(values.templates), values['include-human']),
    loadModels(split(values.models), values['include-mock']),
  ]);
  if (models.length === 0) {
    process.stderr.write('No active i2i model with a configured key. Run npm run models:smoke, then activate models in the admin panel.\n');
    return 1;
  }

  const userId = await benchmarkUser();
  const actor = { actorId: await adminActor(), ip: null };
  const outDir = path.resolve(values.out ?? path.join('benchmark-results', stamp()));
  await mkdir(outDir, { recursive: true });

  // Upload each photo once; every run reuses the reference ids.
  const refIds = new Map<string, string>();
  for (const file of [...productRefs, ...humanRefs]) {
    const human = humanRefs.includes(file);
    const ref = await createReference(userId, {
      buffer: await readFile(file),
      role: human ? 'human_model' : 'product',
      label: `benchmark ${path.basename(file)}`,
      consent_confirmed: human,
      consent_note: human ? 'Benchmark: persetujuan tertulis disimpan oleh tim' : undefined,
    });
    refIds.set(file, ref.id);
  }

  const original = await queryOne<{ id: string }>(
    `SELECT id FROM model_configs WHERE capability = 'i2i' AND is_default AND deleted_at IS NULL`,
  );
  const modelNames = new Map((await query<{ id: string; name: string }>('SELECT id, name FROM model_configs')).map((m) => [m.id, m.name]));
  const total = models.length * templates.reduce((n, t) => n + (t.subject === 'human_model' ? humanRefs.length : productRefs.length), 0);
  process.stdout.write(`Benchmark: ${models.length} model(s), ${templates.length} template(s), ${total} generation(s) -> ${outDir}\n`);

  let csv = csvRow(RESULT_COLUMNS);
  let done = 0;
  let failed = 0;
  try {
    for (const model of models) {
      await setDefault(actor, model.id);
      for (const t of templates) {
        const preset = SEED_GALLERY.find((g) => g.template_slug === t.slug);
        const slotValues = sampleSlotValues(t.slots, preset?.slot_values);
        for (const file of t.subject === 'human_model' ? humanRefs : productRefs) {
          done += 1;
          const ref = path.basename(file);
          process.stdout.write(`[${done}/${total}] ${model.name} | ${t.slug} | ${ref} ... `);
          let row: FinishedRow;
          try {
            const id = await start(userId, {
              template_id: t.id,
              mode: 'i2i',
              slot_values: slotValues,
              remarks: preset?.remarks,
              reference_ids: [refIds.get(file) as string],
              consent_confirmed: t.subject === 'human_model',
            });
            row = await waitFor(id);
          } catch (err) {
            const code = err instanceof AppError ? err.code : 'BENCHMARK_ERROR';
            row = { status: 'failed', error_code: code, degraded: false, used_reference_image: false, composited_text: false, duration_ms: null, total_cost_usd: '0', model_image_id: null, storage_key: null };
          }
          let imageFile = '';
          if (row.status === 'done' && row.storage_key) {
            imageFile = `${fileToken(model.name)}__${t.slug}__${fileToken(path.parse(ref).name)}${path.extname(row.storage_key) || '.png'}`;
            await writeFile(path.join(outDir, imageFile), await getStorage().get(row.storage_key));
          } else {
            failed += 1;
          }
          const used = row.model_image_id ? (modelNames.get(row.model_image_id) ?? row.model_image_id) : '';
          csv += csvRow([
            model.name,
            used,
            Boolean(row.model_image_id) && row.model_image_id !== model.id,
            t.slug,
            ref,
            row.status,
            row.error_code ?? '',
            row.degraded,
            row.used_reference_image,
            row.composited_text,
            row.duration_ms ?? '',
            Number(row.total_cost_usd),
            imageFile,
            ...SCORE_COLUMNS.map(() => ''),
          ]);
          process.stdout.write(`${row.status}${row.error_code ? ` (${row.error_code})` : ''}\n`);
          // Written after every run so an interrupted benchmark still leaves its results.
          await writeFile(path.join(outDir, 'results.csv'), csv);
        }
      }
    }
  } finally {
    if (original) await setDefault(actor, original.id).catch(() => undefined);
    await awaitQueueIdle();
  }
  process.stdout.write(
    `\n${total - failed}/${total} succeeded. Fill in ${SCORE_COLUMNS.join(', ')} in ${path.join(outDir, 'results.csv')}.\n`,
  );
  return 0;
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err: unknown) => {
      process.stderr.write(`Benchmark failed: ${err instanceof Error ? err.message : 'error'}\n`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeQueue().catch(() => undefined);
      await closePool();
    });
}
