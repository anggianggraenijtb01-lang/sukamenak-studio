import { randomBytes } from 'node:crypto';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import { env } from '../config/env.js';
import { closePool } from '../db/pool.js';
import { withTx } from '../db/tx.js';
import { buildDisplayPrompt } from '../engine/displayPrompt.js';
import { countBlanks, findUnknownPlaceholders } from '../engine/placeholders.js';
import { corePromptAad, encryptWithCoreKey } from '../lib/coreCipher.js';
import { hashPassword } from '../lib/password.js';
import { passwordRules } from '../modules/auth/schemas.js';
import { SEED_CORE_PROMPTS, type SeedCorePrompt } from './data/corePrompts.js';
import { SEED_GALLERY } from './data/gallery.js';
import { SEED_MODELS } from './data/models.js';
import { SEED_BRAND, SEED_POLICY, SEED_SETTINGS } from './data/settings.js';
import { SEED_TEMPLATES } from './data/templates.js';
import { SEED_BREAKDOWNS, SEED_TUTORIALS } from './data/tutorials.js';
import { resolveSlots } from './templateSlots.js';

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FRONTEND_PUBLIC = path.resolve(BACKEND_ROOT, '../frontend/public');

export const SEED_USERS = {
  admins: [
    { email: 'admin@sukamenak.studio', name: 'Admin Utama' },
    { email: 'admin2@sukamenak.studio', name: 'Admin Kedua' },
  ],
  demo: { email: 'demo@sukamenak.studio', name: 'Demo Kreator' },
} as const;

export interface SeedOptions {
  adminPassword?: string;
  demoPassword?: string;
  /** Suppress progress output (tests). Generated passwords are always returned in the result. */
  quiet?: boolean;
  /** Copy preview/gallery images from frontend/public into the local storage dir. Default true. */
  copyAssets?: boolean;
}

export interface SeedResult {
  /** Passwords generated because none was supplied. Shown once; never logged. */
  generatedPasswords: { email: string; password: string }[];
  created: Record<string, number>;
}

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function assertPassword(value: string, name: string): string {
  const parsed = passwordRules.safeParse(value);
  if (!parsed.success) throw new Error(`${name} is not a valid password: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
  return value;
}

const generatePassword = (): string => randomBytes(12).toString('base64url');

async function ensureAsset(
  client: PoolClient,
  relFile: string,
  kind: 'preview' | 'gallery' | 'reference',
  copy: boolean,
): Promise<string | null> {
  const source = path.join(FRONTEND_PUBLIC, relFile);
  let size: number;
  try {
    size = (await stat(source)).size;
  } catch {
    return null;
  }
  const storageKey = `seed/${relFile.replace(/\\/g, '/')}`;
  if (copy) {
    const destination = path.resolve(BACKEND_ROOT, env.STORAGE_LOCAL_DIR, storageKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO assets (storage_key, mime, bytes, kind) VALUES ($1, $2, $3, $4)
     ON CONFLICT (storage_key) DO UPDATE SET deleted_at = NULL
     RETURNING id`,
    [storageKey, MIME[path.extname(relFile).toLowerCase()] ?? 'application/octet-stream', size, kind],
  );
  return rows[0]?.id ?? null;
}

async function seedUsers(client: PoolClient, opts: SeedOptions, result: SeedResult): Promise<void> {
  const adminPassword = opts.adminPassword ?? env.SEED_ADMIN_PASSWORD;
  const demoPassword = opts.demoPassword ?? env.SEED_DEMO_PASSWORD;
  if (adminPassword) assertPassword(adminPassword, 'SEED_ADMIN_PASSWORD');
  if (demoPassword) assertPassword(demoPassword, 'SEED_DEMO_PASSWORD');

  const accounts = [
    ...SEED_USERS.admins.map((a) => ({ ...a, role: 'admin' as const, password: adminPassword })),
    { ...SEED_USERS.demo, role: 'creator' as const, password: demoPassword },
  ];
  // Admins share one password (supplied or generated once) so there is a single value to hand over.
  let generatedAdmin: string | undefined;
  for (const account of accounts) {
    const existing = await client.query('SELECT 1 FROM users WHERE email = $1', [account.email]);
    if (existing.rowCount) continue;

    let password = account.password;
    if (!password) {
      if (account.role === 'admin') password = generatedAdmin ??= generatePassword();
      else password = generatePassword();
      result.generatedPasswords.push({ email: account.email, password });
    }
    await client.query(
      `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
      [account.email, await hashPassword(password), account.name, account.role],
    );
    result.created.users = (result.created.users ?? 0) + 1;
  }
}

async function seedSettings(client: PoolClient, result: SeedResult): Promise<void> {
  for (const [key, value] of Object.entries(SEED_SETTINGS)) {
    const r = await client.query('INSERT INTO app_settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING', [
      key,
      JSON.stringify(value),
    ]);
    result.created.app_settings = (result.created.app_settings ?? 0) + (r.rowCount ?? 0);
  }

  const policy = await client.query(
    `INSERT INTO content_policies (name, blocked_terms, moderation_level, disclaimers)
     SELECT $1::text, $2::text[], $3::text, $4::jsonb WHERE NOT EXISTS (SELECT 1 FROM content_policies WHERE is_active)`,
    [SEED_POLICY.name, SEED_POLICY.blocked_terms, SEED_POLICY.moderation_level, JSON.stringify(SEED_POLICY.disclaimers)],
  );
  result.created.content_policies = policy.rowCount ?? 0;

  const brand = await client.query(
    `INSERT INTO brand_identities (name, palette, font_family, disclaimer, is_default)
     SELECT $1::text, $2::jsonb, $3::text, $4::text, true WHERE NOT EXISTS (SELECT 1 FROM brand_identities WHERE is_default)`,
    [SEED_BRAND.name, JSON.stringify(SEED_BRAND.palette), SEED_BRAND.font_family, SEED_BRAND.disclaimer],
  );
  result.created.brand_identities = brand.rowCount ?? 0;
}

async function seedModels(client: PoolClient, result: SeedResult): Promise<void> {
  for (const m of SEED_MODELS) {
    const r = await client.query(
      `INSERT INTO model_configs (name, provider, capability, model_id, base_url, api_key_env, is_default, is_active, priority, notes)
       SELECT $1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::boolean, $8::boolean, $9::integer, $10::text
        WHERE NOT EXISTS (SELECT 1 FROM model_configs WHERE name = $1)
          AND NOT ($7 AND EXISTS (SELECT 1 FROM model_configs WHERE capability = $3 AND is_default AND deleted_at IS NULL))`,
      [m.name, m.provider, m.capability, m.model_id, m.base_url ?? null, m.api_key_env ?? null, m.is_default, m.is_active, m.priority, m.notes ?? null],
    );
    result.created.model_configs = (result.created.model_configs ?? 0) + (r.rowCount ?? 0);
  }
}

function validateCorePrompt(core: SeedCorePrompt): void {
  const unknown = findUnknownPlaceholders(core.body);
  if (unknown.length > 0) throw new Error(`Seed bug: core prompt ${core.key} has ${unknown.length} unknown placeholder(s)`);
  if (countBlanks(core.body) !== core.blankKeys.length) {
    throw new Error(`Seed bug: core prompt ${core.key} has ${countBlanks(core.body)} blanks but ${core.blankKeys.length} blank keys`);
  }
}

async function seedCorePrompts(client: PoolClient, result: SeedResult): Promise<void> {
  for (const core of SEED_CORE_PROMPTS) {
    validateCorePrompt(core);
    const version = 1;
    const enc = encryptWithCoreKey(core.body, corePromptAad(core.key, version));
    const r = await client.query(
      `INSERT INTO core_prompts (key, version, subject, publication, body_ciphertext, body_iv, body_auth_tag, blank_count, is_active)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, true
        WHERE NOT EXISTS (SELECT 1 FROM core_prompts WHERE key = $1)`,
      [core.key, version, core.subject, core.publication, enc.ciphertext, enc.iv, enc.authTag, core.blankKeys.length],
    );
    result.created.core_prompts = (result.created.core_prompts ?? 0) + (r.rowCount ?? 0);
  }
}

async function seedTemplates(client: PoolClient, copy: boolean, result: SeedResult): Promise<void> {
  const cores = new Map(SEED_CORE_PROMPTS.map((c) => [c.key, c]));
  for (const [index, t] of SEED_TEMPLATES.entries()) {
    const core = cores.get(t.core_prompt_key);
    if (!core) throw new Error(`Seed bug: template ${t.slug} references unknown core prompt ${t.core_prompt_key}`);
    if ((await client.query('SELECT 1 FROM templates WHERE slug = $1', [t.slug])).rowCount) continue;

    const slots = resolveSlots(t, core);
    if (slots.filter((s) => s.blank_index !== null).length !== core.blankKeys.length) {
      throw new Error(`Seed bug: template ${t.slug} slot count does not match core prompt ${core.key}`);
    }
    const previewId = t.preview_file ? await ensureAsset(client, t.preview_file, 'preview', copy) : null;
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO templates (slug, name, description, category, mode, subject, aspect_ratio, core_prompt_key, status, preview_asset_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published', $9, $10) RETURNING id`,
      [t.slug, t.name, t.description, t.category, t.mode, t.subject, t.aspect_ratio, t.core_prompt_key, previewId, (index + 1) * 10],
    );
    const templateId = rows[0]?.id as string;

    for (const s of slots) {
      await client.query(
        `INSERT INTO template_slots (template_id, key, label, type, blank_index, required, default_value, options, max_length, vision_role, source_hint, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12)`,
        [
          templateId, s.key, s.label, s.type, s.blank_index, s.required ?? false, s.default_value ?? null,
          s.options ? JSON.stringify(s.options) : null, s.max_length ?? null, s.vision_role ?? null, s.source_hint ?? null, s.sort_order,
        ],
      );
      if (s.overlay) {
        const z = s.overlay.zone;
        await client.query(
          `INSERT INTO text_zones (template_id, slot_key, x, y, w, h, align, font_family, font_weight, font_size_ratio, color, max_lines)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [templateId, s.key, z.x, z.y, z.w, z.h, z.align, z.font_family ?? 'Inter', z.font_weight ?? 700, z.font_size_ratio, z.color ?? '#FFFFFF', z.max_lines],
        );
      }
    }
    for (const ref of t.example_references ?? []) {
      const assetId = await ensureAsset(client, ref.file, 'reference', copy);
      if (assetId) {
        await client.query(
          `INSERT INTO reference_assets (role, asset_id, template_id, label, is_library) VALUES ($1, $2, $3, $4, true)`,
          [ref.role, assetId, templateId, ref.label],
        );
      }
    }
    result.created.templates = (result.created.templates ?? 0) + 1;
  }
}

async function seedGallery(client: PoolClient, copy: boolean, result: SeedResult): Promise<void> {
  const cores = new Map(SEED_CORE_PROMPTS.map((c) => [c.key, c]));
  for (const [index, item] of SEED_GALLERY.entries()) {
    const spec = SEED_TEMPLATES.find((t) => t.slug === item.template_slug);
    const core = spec ? cores.get(spec.core_prompt_key) : undefined;
    if (!spec || !core) throw new Error(`Seed bug: gallery item "${item.title}" references unknown template ${item.template_slug}`);
    if ((await client.query('SELECT 1 FROM gallery_items WHERE title = $1', [item.title])).rowCount) continue;

    const template = await client.query<{ id: string }>('SELECT id FROM templates WHERE slug = $1', [spec.slug]);
    const assetId = await ensureAsset(client, item.image_file, 'gallery', copy);
    if (!assetId || !template.rows[0]) continue;

    const displayPrompt = buildDisplayPrompt(resolveSlots(spec, core), item.slot_values, item.remarks);
    await client.query(
      `INSERT INTO gallery_items (template_id, image_asset_id, title, display_prompt, is_featured, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [template.rows[0].id, assetId, item.title, displayPrompt, item.is_featured ?? false, (index + 1) * 10],
    );
    result.created.gallery_items = (result.created.gallery_items ?? 0) + 1;
  }
}

async function seedTutorials(client: PoolClient, result: SeedResult): Promise<void> {
  for (const [index, t] of SEED_TUTORIALS.entries()) {
    if ((await client.query('SELECT 1 FROM tutorials WHERE slug = $1', [t.slug])).rowCount) continue;
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO tutorials (slug, title, summary, level, status, sort_order) VALUES ($1, $2, $3, $4, 'published', $5) RETURNING id`,
      [t.slug, t.title, t.summary, t.level, (index + 1) * 10],
    );
    const tutorialId = rows[0]?.id as string;
    for (const [i, s] of t.sections.entries()) {
      await client.query(
        'INSERT INTO tutorial_sections (tutorial_id, kind, title, body_md, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [tutorialId, s.kind, s.title, s.body_md, i],
      );
    }
    if (t.slug === 'elemen-visual-dasar') {
      for (const [i, b] of SEED_BREAKDOWNS.entries()) {
        await client.query(
          `INSERT INTO visual_breakdowns (tutorial_id, aspect, title, description, prompt_fragment, sort_order) VALUES ($1, $2, $3, $4, $5, $6)`,
          [tutorialId, b.aspect, b.title, b.description, b.prompt_fragment, i],
        );
      }
    }
    result.created.tutorials = (result.created.tutorials ?? 0) + 1;
  }
}

/** Idempotent: every block inserts only what is missing and never overwrites admin edits. */
export async function runSeed(opts: SeedOptions = {}): Promise<SeedResult> {
  const result: SeedResult = { generatedPasswords: [], created: {} };
  const copy = opts.copyAssets ?? true;
  await withTx(async (client) => {
    await seedUsers(client, opts, result);
    await seedSettings(client, result);
    await seedModels(client, result);
    await seedCorePrompts(client, result);
    await seedTemplates(client, copy, result);
    await seedGallery(client, copy, result);
    await seedTutorials(client, result);
  });
  return result;
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  runSeed()
    .then((result) => {
      const summary = Object.entries(result.created).map(([k, v]) => `${k}=${v}`).join(', ') || 'nothing new (already seeded)';
      process.stdout.write(`Seed complete: ${summary}\n`);
      if (result.generatedPasswords.length > 0) {
        // Printed once to stdout only; deliberately not routed through the logger.
        process.stdout.write('\nGenerated credentials (shown once, store them now):\n');
        for (const { email, password } of result.generatedPasswords) process.stdout.write(`  ${email}  ${password}\n`);
        process.stdout.write('Set SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD in .env to choose your own.\n');
      }
    })
    .catch((err: unknown) => {
      process.stderr.write(`Seed failed: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    })
    .finally(() => closePool());
}
