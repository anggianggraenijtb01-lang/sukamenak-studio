import type { PoolClient } from 'pg';
import sharp from 'sharp';
import { query, queryOne } from '../../../db/pool.js';
import { withTx } from '../../../db/tx.js';
import { withTimeout } from '../../../lib/async.js';
import { AppError, notFound } from '../../../lib/errors.js';
import { isProviderError } from '../../../providers/errors.js';
import { getProvider } from '../../../providers/registry.js';
import type { Capability, ModelConfigRecord } from '../../../providers/types.js';
import { buildDiff, recordAudit } from '../auditLog.js';
import { conflictField, offsetOf, uniqueViolation, Where, type AdminCtx } from '../common.js';
import { isKeyConfigured, MODEL_AUDIT_FIELDS, MODEL_COLUMNS, requiresApiKey, toModelDTO, type ModelRow } from './dto.js';

const asRecord = (row: ModelRow): Record<string, unknown> => row as unknown as Record<string, unknown>;

export async function listModels(f: { page: number; limit: number; capability?: string; provider?: string; active?: boolean }) {
  const where = new Where('deleted_at IS NULL');
  if (f.capability) where.add((p) => `capability = ${p}`, f.capability);
  if (f.provider) where.add((p) => `provider = ${p}`, f.provider);
  if (f.active !== undefined) where.add((p) => `is_active = ${p}`, f.active);
  const total = (await queryOne<{ n: number }>(`SELECT count(*) AS n FROM model_configs ${where.sql}`, where.params))?.n ?? 0;
  const limitP = where.next();
  const offsetP = `$${where.params.length + 2}`;
  const rows = await query<ModelRow>(
    `SELECT ${MODEL_COLUMNS} FROM model_configs ${where.sql}
      ORDER BY capability, is_default DESC, is_active DESC, priority, name LIMIT ${limitP} OFFSET ${offsetP}`,
    [...where.params, f.limit, offsetOf(f)],
  );
  return { items: rows.map(toModelDTO), total };
}

async function loadModel(id: string, client?: PoolClient, lock = false): Promise<ModelRow> {
  const row = await queryOne<ModelRow>(
    `SELECT ${MODEL_COLUMNS} FROM model_configs WHERE id = $1 AND deleted_at IS NULL${lock ? ' FOR UPDATE' : ''}`,
    [id],
    client,
  );
  if (!row) throw notFound('Model');
  return row;
}

export async function getModel(id: string) {
  return toModelDTO(await loadModel(id));
}

/** Locks every live model of a capability so concurrent default / activation changes serialise. */
async function lockCapability(client: PoolClient, capability: string): Promise<void> {
  await client.query('SELECT id FROM model_configs WHERE capability = $1 AND deleted_at IS NULL ORDER BY id FOR UPDATE', [capability]);
}

function assertKeyAvailable(m: Pick<ModelRow, 'provider' | 'api_key_env'>): void {
  if (!isKeyConfigured(m)) {
    throw new AppError('VALIDATION_ERROR', 'Variabel API key model ini belum diatur di server, model tidak dapat diaktifkan', {
      errors: [{ field: 'api_key_env', message: 'Variabel lingkungan belum diatur' }],
    });
  }
}

const nameTaken = () => conflictField('name', 'Nama model sudah digunakan');

export interface CreateModelInput {
  name: string;
  provider: string;
  capability: string;
  model_id: string;
  base_url?: string | null;
  api_key_env?: string | null;
  priority: number;
  cost_per_call_usd: number;
  timeout_ms: number;
  notes?: string | null;
  is_active: boolean;
}

export async function createModel(ctx: AdminCtx, input: CreateModelInput) {
  if (input.is_active) assertKeyAvailable({ provider: input.provider, api_key_env: input.api_key_env ?? null });
  try {
    const row = await withTx(async (client) => {
      const created = (await queryOne<ModelRow>(
        `INSERT INTO model_configs (name, provider, capability, model_id, base_url, api_key_env, priority, cost_per_call_usd, timeout_ms, notes, is_active, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12) RETURNING ${MODEL_COLUMNS}`,
        [
          input.name, input.provider, input.capability, input.model_id, input.base_url ?? null, input.api_key_env ?? null,
          input.priority, input.cost_per_call_usd, input.timeout_ms, input.notes ?? null, input.is_active, ctx.actorId,
        ],
        client,
      )) as ModelRow;
      await recordAudit(ctx, { action: 'model.create', entity: 'model_config', entityId: created.id, diff: buildDiff(MODEL_AUDIT_FIELDS, null, asRecord(created)) }, client);
      return created;
    });
    return toModelDTO(row);
  } catch (err) {
    if (uniqueViolation(err) !== null) throw nameTaken();
    throw err;
  }
}

export type UpdateModelInput = Partial<Pick<CreateModelInput, 'name' | 'model_id' | 'base_url' | 'api_key_env' | 'priority' | 'cost_per_call_usd' | 'timeout_ms' | 'notes'>>;

export async function updateModel(ctx: AdminCtx, id: string, patch: UpdateModelInput) {
  try {
    const row = await withTx(async (client) => {
      const before = await loadModel(id, client, true);
      const next = {
        name: patch.name ?? before.name,
        model_id: patch.model_id ?? before.model_id,
        base_url: patch.base_url === undefined ? before.base_url : patch.base_url,
        api_key_env: patch.api_key_env === undefined ? before.api_key_env : patch.api_key_env,
        priority: patch.priority ?? before.priority,
        cost_per_call_usd: patch.cost_per_call_usd ?? Number(before.cost_per_call_usd),
        timeout_ms: patch.timeout_ms ?? before.timeout_ms,
        notes: patch.notes === undefined ? before.notes : patch.notes,
      };
      if (requiresApiKey(before.provider) && !next.api_key_env) {
        throw new AppError('VALIDATION_ERROR', 'Provider ini membutuhkan api_key_env', { errors: [{ field: 'api_key_env', message: 'Wajib diisi' }] });
      }
      if (before.provider === 'mock' && next.api_key_env) {
        throw new AppError('VALIDATION_ERROR', 'Provider mock tidak memakai API key', { errors: [{ field: 'api_key_env', message: 'Tidak dipakai oleh provider mock' }] });
      }
      if (before.provider === 'openai_compat' && !next.base_url) {
        throw new AppError('VALIDATION_ERROR', 'Provider openai_compat membutuhkan base_url', { errors: [{ field: 'base_url', message: 'Wajib diisi' }] });
      }
      if (before.is_active) assertKeyAvailable({ provider: before.provider, api_key_env: next.api_key_env });
      const updated = (await queryOne<ModelRow>(
        `UPDATE model_configs SET name = $2, model_id = $3, base_url = $4, api_key_env = $5, priority = $6, cost_per_call_usd = $7,
                timeout_ms = $8, notes = $9, updated_by = $10
          WHERE id = $1 RETURNING ${MODEL_COLUMNS}`,
        [id, next.name, next.model_id, next.base_url, next.api_key_env, next.priority, next.cost_per_call_usd, next.timeout_ms, next.notes, ctx.actorId],
        client,
      )) as ModelRow;
      await recordAudit(ctx, { action: 'model.update', entity: 'model_config', entityId: id, diff: buildDiff(MODEL_AUDIT_FIELDS, asRecord(before), asRecord(updated)) }, client);
      return updated;
    });
    return toModelDTO(row);
  } catch (err) {
    if (uniqueViolation(err) !== null) throw nameTaken();
    throw err;
  }
}

/** Soft delete. The default model of a capability cannot be deleted: switch the default first. */
export async function deleteModel(ctx: AdminCtx, id: string): Promise<void> {
  await withTx(async (client) => {
    const before = await loadModel(id, client, true);
    if (before.is_default) {
      throw new AppError('NO_MODEL_AVAILABLE', 'Model default tidak dapat dihapus. Jadikan model lain sebagai default terlebih dahulu.', { status: 409 });
    }
    await client.query('UPDATE model_configs SET deleted_at = now(), is_active = false, updated_by = $2 WHERE id = $1', [id, ctx.actorId]);
    await recordAudit(ctx, { action: 'model.delete', entity: 'model_config', entityId: id, diff: { name: before.name, capability: before.capability } }, client);
  });
}

/** Makes `id` the single default of its capability. One transaction; concurrent switches serialise on the row locks. */
export async function setDefault(ctx: AdminCtx, id: string) {
  const row = await withTx(async (client) => {
    const target = await loadModel(id, client);
    await lockCapability(client, target.capability);
    const locked = await loadModel(id, client, true);
    if (!locked.is_active) {
      throw new AppError('VALIDATION_ERROR', 'Hanya model aktif yang dapat dijadikan default', { errors: [{ field: 'id', message: 'Model tidak aktif' }] });
    }
    assertKeyAvailable(locked);
    const previous = await queryOne<{ id: string; name: string }>(
      'SELECT id, name FROM model_configs WHERE capability = $1 AND is_default AND deleted_at IS NULL AND id <> $2',
      [locked.capability, id],
      client,
    );
    await client.query('UPDATE model_configs SET is_default = false, updated_by = $3 WHERE capability = $1 AND is_default AND id <> $2', [locked.capability, id, ctx.actorId]);
    const updated = (await queryOne<ModelRow>(
      `UPDATE model_configs SET is_default = true, updated_by = $2 WHERE id = $1 RETURNING ${MODEL_COLUMNS}`,
      [id, ctx.actorId],
      client,
    )) as ModelRow;
    await recordAudit(
      ctx,
      {
        action: 'model.set_default',
        entity: 'model_config',
        entityId: id,
        diff: { capability: locked.capability, previous_default_id: previous?.id ?? null, previous_default_name: previous?.name ?? null, new_default_name: locked.name },
      },
      client,
    );
    return updated;
  });
  return toModelDTO(row);
}

export async function activateModel(ctx: AdminCtx, id: string) {
  const row = await withTx(async (client) => {
    const target = await loadModel(id, client);
    await lockCapability(client, target.capability);
    const before = await loadModel(id, client, true);
    if (before.is_active) return before;
    assertKeyAvailable(before);
    const updated = (await queryOne<ModelRow>(
      `UPDATE model_configs SET is_active = true, updated_by = $2 WHERE id = $1 RETURNING ${MODEL_COLUMNS}`,
      [id, ctx.actorId],
      client,
    )) as ModelRow;
    await recordAudit(ctx, { action: 'model.activate', entity: 'model_config', entityId: id, diff: buildDiff(MODEL_AUDIT_FIELDS, asRecord(before), asRecord(updated)) }, client);
    return updated;
  });
  return toModelDTO(row);
}

/**
 * Deactivating the default model needs a replacement: `newDefaultId` must be another active model of the
 * same capability. With no other active model the request is refused (NO_MODEL_AVAILABLE) so the
 * pipeline can never be left without a usable model by one click.
 */
export async function deactivateModel(ctx: AdminCtx, id: string, newDefaultId?: string) {
  const row = await withTx(async (client) => {
    const target = await loadModel(id, client);
    await lockCapability(client, target.capability);
    const before = await loadModel(id, client, true);
    if (!before.is_active) return before;

    let replacement: ModelRow | null = null;
    if (before.is_default) {
      const others = await query<ModelRow>(
        `SELECT ${MODEL_COLUMNS} FROM model_configs WHERE capability = $1 AND is_active AND deleted_at IS NULL AND id <> $2 ORDER BY priority, name`,
        [before.capability, id],
        client,
      );
      const usable = others.filter(isKeyConfigured);
      if (usable.length === 0) {
        throw new AppError('NO_MODEL_AVAILABLE', 'Ini satu-satunya model aktif untuk kapabilitas ini. Aktifkan model lain terlebih dahulu.', { status: 409 });
      }
      if (!newDefaultId) {
        throw new AppError('VALIDATION_ERROR', 'Model default harus digantikan: pilih new_default_id', {
          errors: [{ field: 'new_default_id', message: 'Wajib diisi saat menonaktifkan model default' }],
        });
      }
      replacement = usable.find((m) => m.id === newDefaultId) ?? null;
      if (!replacement) {
        throw new AppError('VALIDATION_ERROR', 'new_default_id harus model aktif lain dengan kapabilitas yang sama', {
          errors: [{ field: 'new_default_id', message: 'Tidak valid' }],
        });
      }
    }
    // Clear the default first: the partial unique index is checked per statement.
    const updated = (await queryOne<ModelRow>(
      `UPDATE model_configs SET is_active = false, is_default = false, updated_by = $2 WHERE id = $1 RETURNING ${MODEL_COLUMNS}`,
      [id, ctx.actorId],
      client,
    )) as ModelRow;
    if (replacement) {
      await client.query('UPDATE model_configs SET is_default = true, updated_by = $2 WHERE id = $1', [replacement.id, ctx.actorId]);
    }
    await recordAudit(
      ctx,
      {
        action: 'model.deactivate',
        entity: 'model_config',
        entityId: id,
        diff: { ...buildDiff(MODEL_AUDIT_FIELDS, asRecord(before), asRecord(updated)), new_default_id: replacement?.id ?? null },
      },
      client,
    );
    return updated;
  });
  return toModelDTO(row);
}

// --- connectivity test ----------------------------------------------------------------------

export interface ModelTestResult {
  ok: boolean;
  latency_ms: number;
  error_code: string | null;
  /** Fixed, sanitised text. Never a provider response body, URL, key or prompt. */
  error: string | null;
  tested_at: string;
}

async function tinyImage(): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 64, channels: 3, background: '#336699' } }).png().toBuffer();
}

/** Maps any failure to a fixed message: unknown errors never expose their own text. */
function sanitiseTestError(err: unknown): { code: string; message: string } {
  if (isProviderError(err)) return { code: err.code, message: err.message };
  if (err instanceof AppError) return { code: err.code, message: err.message };
  if (err instanceof Error && err.message === 'timeout') return { code: 'PROVIDER_TIMEOUT', message: 'Model provider did not respond in time' };
  return { code: 'INTERNAL_ERROR', message: 'Pemanggilan uji model gagal' };
}

async function runProbe(config: ModelConfigRecord): Promise<void> {
  const adapter = getProvider(config.provider);
  if (!adapter) throw new AppError('NO_MODEL_AVAILABLE', 'Adapter provider tidak tersedia di server');
  const signal = AbortSignal.timeout(config.timeout_ms);
  const capability = config.capability as Capability;
  if (capability === 'text') {
    if (!adapter.improveText) throw new AppError('NO_MODEL_AVAILABLE', 'Provider tidak mendukung kapabilitas text');
    const r = await adapter.improveText(config, { text: 'a red apple on a wooden table' }, { signal });
    if (!r.text) throw new AppError('INTERNAL_ERROR', 'Respons kosong');
    return;
  }
  if (capability === 'vision') {
    if (!adapter.analyzeReference) throw new AppError('NO_MODEL_AVAILABLE', 'Provider tidak mendukung kapabilitas vision');
    const r = await adapter.analyzeReference(
      config,
      { image: { data: await tinyImage(), mime: 'image/png' }, role: 'color', instruction: 'Describe ONLY the dominant colour of this image in a few words.' },
      { signal },
    );
    if (!r.description) throw new AppError('INTERNAL_ERROR', 'Respons kosong');
    return;
  }
  if (!adapter.generateImage) throw new AppError('NO_MODEL_AVAILABLE', `Provider tidak mendukung kapabilitas ${capability}`);
  const r = await adapter.generateImage(
    config,
    {
      prompt: 'A plain, softly lit blue square on a white background, minimal flat illustration.',
      mode: capability === 'i2i' ? 'i2i' : 't2i',
      references: capability === 'i2i' ? [{ data: await tinyImage(), mime: 'image/png' }] : [],
      aspectRatio: '1:1',
      width: 256,
      height: 256,
    },
    { signal },
  );
  if (!r.image || r.image.length === 0) throw new AppError('INTERNAL_ERROR', 'Respons kosong');
}

/**
 * Runs one tiny real call through the provider adapter (the mock provider passes without keys) and
 * records `last_test_at` / `last_test_ok`. Real providers may bill a very small amount per test.
 */
export async function testModel(ctx: AdminCtx, id: string): Promise<ModelTestResult & { model: ReturnType<typeof toModelDTO> }> {
  const model = await loadModel(id);
  const started = performance.now();
  let error: { code: string; message: string } | null = null;
  if (!isKeyConfigured(model)) {
    error = { code: 'PROVIDER_AUTH', message: 'Variabel API key model ini belum diatur di server' };
  } else {
    try {
      const record: ModelConfigRecord = {
        id: model.id,
        name: model.name,
        provider: model.provider as ModelConfigRecord['provider'],
        capability: model.capability as Capability,
        model_id: model.model_id,
        base_url: model.base_url,
        api_key_env: model.api_key_env,
        is_default: model.is_default,
        is_active: model.is_active,
        priority: model.priority,
        cost_per_call_usd: model.cost_per_call_usd,
        timeout_ms: model.timeout_ms,
      };
      await withTimeout(runProbe(record), model.timeout_ms + 5000);
    } catch (err) {
      error = sanitiseTestError(err);
    }
  }
  const latency = Math.round(performance.now() - started);
  const ok = error === null;
  const updated = await withTx(async (client) => {
    const row = await queryOne<ModelRow>(
      `UPDATE model_configs SET last_test_at = now(), last_test_ok = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING ${MODEL_COLUMNS}`,
      [id, ok],
      client,
    );
    if (!row) throw notFound('Model');
    await recordAudit(
      ctx,
      { action: 'model.test', entity: 'model_config', entityId: id, diff: { ok, latency_ms: latency, error_code: error?.code ?? null } },
      client,
    );
    return row;
  });
  return {
    ok,
    latency_ms: latency,
    error_code: error?.code ?? null,
    error: error?.message ?? null,
    tested_at: (updated.last_test_at as Date).toISOString(),
    model: toModelDTO(updated),
  };
}
