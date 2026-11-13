import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import type { Capability, ModelConfigRecord, ProviderAdapter, ProviderName } from './types.js';

const adapters = new Map<ProviderName, ProviderAdapter>();

/** The built-in adapters are registered by initProviders(); tests may register fakes. */
export function registerProvider(adapter: ProviderAdapter): void {
  adapters.set(adapter.name, adapter);
}

export function unregisterProvider(name: ProviderName): void {
  adapters.delete(name);
}

export function getProvider(name: ProviderName): ProviderAdapter | undefined {
  return adapters.get(name);
}

/**
 * Active, non-deleted configs for a capability: default first, then by priority.
 * Configs whose API key variable is unset are skipped (the mock provider needs none).
 */
export async function listActiveModels(capability: Capability): Promise<ModelConfigRecord[]> {
  const rows = await query<ModelConfigRecord>(
    `SELECT id, name, provider, capability, model_id, base_url, api_key_env, is_default, is_active,
            priority, cost_per_call_usd::text AS cost_per_call_usd, timeout_ms
       FROM model_configs
      WHERE capability = $1 AND is_active AND deleted_at IS NULL
      ORDER BY is_default DESC, priority ASC, created_at ASC`,
    [capability],
  );
  return rows.filter((m) => m.provider === 'mock' || !m.api_key_env || Boolean(process.env[m.api_key_env]));
}

export type AdapterMethod = 'improveText' | 'analyzeReference' | 'generateImage';

const METHOD_FOR_CAPABILITY: Record<Capability, AdapterMethod> = {
  vision: 'analyzeReference',
  text: 'improveText',
  t2i: 'generateImage',
  i2i: 'generateImage',
};

/**
 * Candidates for a capability in call order (default model first, then by priority), restricted to
 * models whose adapter actually implements the capability. Throws NO_MODEL_AVAILABLE when none.
 */
export async function resolveModels(capability: Capability): Promise<ModelConfigRecord[]> {
  const method = METHOD_FOR_CAPABILITY[capability];
  const usable = (await listActiveModels(capability)).filter((m) => typeof getProvider(m.provider)?.[method] === 'function');
  if (usable.length === 0) throw new AppError('NO_MODEL_AVAILABLE', 'Tidak ada model aktif untuk kapabilitas ini');
  return usable;
}
