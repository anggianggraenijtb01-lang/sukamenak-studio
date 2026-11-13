export interface ModelRow {
  id: string;
  name: string;
  provider: string;
  capability: string;
  model_id: string;
  base_url: string | null;
  api_key_env: string | null;
  is_default: boolean;
  is_active: boolean;
  priority: number;
  cost_per_call_usd: string;
  timeout_ms: number;
  last_test_at: Date | null;
  last_test_ok: boolean | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export const MODEL_COLUMNS = `id, name, provider, capability, model_id, base_url, api_key_env, is_default, is_active, priority,
  cost_per_call_usd::text AS cost_per_call_usd, timeout_ms, last_test_at, last_test_ok, notes, created_at, updated_at`;

export const requiresApiKey = (provider: string): boolean => provider !== 'mock';

/** Whether the server environment currently provides the key variable this model names. */
export const isKeyConfigured = (m: Pick<ModelRow, 'provider' | 'api_key_env'>): boolean =>
  !requiresApiKey(m.provider) || Boolean(m.api_key_env && process.env[m.api_key_env]);

/**
 * Shows the variable NAME and whether it is set, never a key value (the value is not even read into
 * the DTO: only a boolean is derived from it).
 */
export const toModelDTO = (m: ModelRow) => ({
  id: m.id,
  name: m.name,
  provider: m.provider,
  capability: m.capability,
  model_id: m.model_id,
  base_url: m.base_url,
  api_key_env: m.api_key_env,
  requires_api_key: requiresApiKey(m.provider),
  api_key_configured: isKeyConfigured(m),
  is_default: m.is_default,
  is_active: m.is_active,
  usable: m.is_active && isKeyConfigured(m),
  priority: m.priority,
  cost_per_call_usd: Number(m.cost_per_call_usd),
  timeout_ms: m.timeout_ms,
  last_test_at: m.last_test_at,
  last_test_ok: m.last_test_ok,
  notes: m.notes,
  created_at: m.created_at,
  updated_at: m.updated_at,
});

export const MODEL_AUDIT_FIELDS = [
  'name',
  'provider',
  'capability',
  'model_id',
  'base_url',
  'api_key_env',
  'is_default',
  'is_active',
  'priority',
  'cost_per_call_usd',
  'timeout_ms',
  'notes',
] as const;
