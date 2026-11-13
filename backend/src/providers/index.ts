import { createFalProvider } from './fal.js';
import { createGeminiProvider } from './gemini.js';
import { mockProvider } from './mock.js';
import { createOpenAiCompatProvider } from './openaiCompat.js';
import { registerProvider } from './registry.js';

let initialised = false;

/**
 * Registers the built-in adapters. Idempotent; called once at app/worker start. The real adapters
 * are always registered but only used for model configs whose `api_key_env` variable is set.
 */
export function initProviders(): void {
  if (initialised) return;
  registerProvider(mockProvider);
  registerProvider(createOpenAiCompatProvider());
  registerProvider(createGeminiProvider());
  registerProvider(createFalProvider());
  initialised = true;
}
