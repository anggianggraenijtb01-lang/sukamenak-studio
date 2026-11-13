/**
 * Which environment variables a model config may name as its API key.
 *
 * `model_configs.api_key_env` is admin-editable and the named variable's VALUE is sent to the
 * provider as a credential. Without a restriction an admin could name CORE_PROMPT_KEY,
 * JWT_ACCESS_SECRET, DATABASE_URL or S3_SECRET_ACCESS_KEY, point `base_url` at a server they
 * control, and have the platform deliver that secret to them. So only two kinds of name are
 * accepted, and every read of such a variable goes through `readProviderKey`:
 *   - the conventional names of the providers this platform ships adapters for;
 *   - any name carrying the dedicated PROVIDER_KEY_ prefix (for a new provider or a second account).
 * None of the application's own settings (see config/env.ts) can collide with either.
 */

export const PROVIDER_KEY_PREFIX = 'PROVIDER_KEY_';

export const KNOWN_PROVIDER_KEY_ENVS: readonly string[] = [
  'DEEPSEEK_API_KEY',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'FAL_KEY',
  'ARK_API_KEY',
];

const PREFIXED = new RegExp(`^${PROVIDER_KEY_PREFIX}[A-Z0-9_]{1,60}$`);

export function isAllowedProviderKeyEnv(name: string): boolean {
  return KNOWN_PROVIDER_KEY_ENVS.includes(name) || PREFIXED.test(name);
}

export const PROVIDER_KEY_ENV_RULE =
  `Gunakan nama baku provider (${KNOWN_PROVIDER_KEY_ENVS.join(', ')}) atau nama berawalan ${PROVIDER_KEY_PREFIX}`;

/** The key value, or undefined when the name is unset, empty, or not an allowed provider-key variable. */
export function readProviderKey(name: string | null | undefined): string | undefined {
  if (!name || !isAllowedProviderKeyEnv(name)) return undefined;
  const value = process.env[name];
  return value ? value : undefined;
}
