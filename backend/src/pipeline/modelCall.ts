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
  for (const config of models) {
    if (signal.aborted) throw new JobTimeoutError();
    const adapter = getProvider(config.provider) as ProviderAdapter;
    try {
      return { value: await fn(adapter, config), config };
    } catch (err) {
      if (!isProviderError(err)) throw err;
      lastError = err;
      if (err.code === 'PROVIDER_ABORTED') throw err;
    }
  }
  throw lastError;
}
