import { logger } from '../lib/logger.js';
import { isProviderError } from '../providers/errors.js';
import { getProvider, resolveModels } from '../providers/registry.js';
import type { Capability, ModelConfigRecord, ProviderAdapter } from '../providers/types.js';
import { JobTimeoutError } from './errors.js';

export interface ModelCallResult<T> {
  value: T;
  config: ModelConfigRecord;
}

/**
 * Runs `fn` against the default model for `capability`, falling back to the next active model (by
 * priority) when a provider fails. NO_MODEL_AVAILABLE when none is usable; the last provider error
 * when all fail. Non-provider errors (bugs) are not retried on another model.
 */
export async function callWithFallback<T>(
  capability: Capability,
  signal: AbortSignal,
  fn: (adapter: ProviderAdapter, config: ModelConfigRecord) => Promise<T>,
): Promise<ModelCallResult<T>> {
  const models = await resolveModels(capability);
  let lastError: unknown;
  for (const [index, config] of models.entries()) {
    if (signal.aborted) throw new JobTimeoutError();
    const adapter = getProvider(config.provider) as ProviderAdapter;
    try {
      return { value: await fn(adapter, config), config };
    } catch (err) {
      if (!isProviderError(err)) throw err;
      lastError = err;
      if (err.code === 'PROVIDER_ABORTED') throw err;
      // A silent fallback hides a broken default behind a successful job: the creator gets an image
      // from the next model and nothing says the first one failed. ProviderError messages are fixed
      // strings per code, so the code and HTTP status are safe to record (no body, URL or prompt).
      logger.warn(
        {
          capability,
          provider: config.provider,
          model_name: config.name,
          code: err.code,
          http_status: err.httpStatus ?? null,
          next_model: models[index + 1]?.name ?? null,
        },
        'model call failed, falling back to the next model',
      );
    }
  }
  throw lastError;
}
