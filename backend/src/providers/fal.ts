import { ProviderError } from './errors.js';
import {
  asArray,
  asRecord,
  asString,
  costOf,
  defaultFetch,
  downloadImage,
  fetchOk,
  joinUrl,
  readJson,
  requireApiKey,
  toDataUrl,
  withDeadline,
  type ProviderDeps,
} from './http.js';
import type { GenerateImageResult, ModelConfigRecord, ProviderAdapter } from './types.js';

const DEFAULT_BASE_URL = 'https://queue.fal.run';
const DEFAULT_POLL_MS = 1000;

export interface FalDeps extends ProviderDeps {
  pollIntervalMs?: number;
}

/** Endpoints that take exactly one input image (`image_url`); multi-image endpoints also read `image_urls`. */
const isSingleImageEndpoint = (modelId: string): boolean => /image-to-image/i.test(modelId) && !/edit|multi/i.test(modelId);

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      },
      { once: true },
    );
  });

/**
 * Adapter for fal.ai model endpoints. Uses the queue REST API (submit, poll status, fetch result)
 * unless `base_url` points at the synchronous `fal.run` host. Written against the public docs;
 * not exercised against live endpoints.
 */
export function createFalProvider(deps: FalDeps = {}): ProviderAdapter {
  const doFetch = deps.fetch ?? defaultFetch;
  const pollMs = deps.pollIntervalMs ?? DEFAULT_POLL_MS;

  async function runModel(config: ModelConfigRecord, input: Record<string, unknown>, signal: AbortSignal): Promise<Record<string, unknown>> {
    const key = requireApiKey(config);
    const headers = { Authorization: `Key ${key}`, 'Content-Type': 'application/json' };
    const base = config.base_url ?? DEFAULT_BASE_URL;
    const submit = await fetchOk(doFetch, joinUrl(base, config.model_id), { method: 'POST', headers, body: JSON.stringify(input) }, signal);
    const submitted = asRecord(await readJson(submit));

    // Synchronous host: the result is the response itself.
    if (!asString(submitted.request_id)) return submitted;

    const statusUrl = asString(submitted.status_url);
    const responseUrl = asString(submitted.response_url);
    if (!statusUrl || !responseUrl) throw new ProviderError('PROVIDER_BAD_RESPONSE');

    for (;;) {
      const status = asRecord(await readJson(await fetchOk(doFetch, statusUrl, { method: 'GET', headers }, signal)));
      const state = asString(status.status);
      if (state === 'COMPLETED') break;
      if (state === 'FAILED' || state === 'CANCELLED') throw new ProviderError('PROVIDER_UNAVAILABLE');
      await sleep(pollMs, signal);
    }
    return asRecord(await readJson(await fetchOk(doFetch, responseUrl, { method: 'GET', headers }, signal)));
  }

  return {
    name: 'fal',

    async generateImage(config, input, opts): Promise<GenerateImageResult> {
      requireApiKey(config);
      return withDeadline(config.timeout_ms, opts?.signal, async (signal) => {
        const body: Record<string, unknown> = {
          prompt: input.prompt,
          image_size: { width: input.width, height: input.height },
          num_images: 1,
          enable_safety_checker: true,
        };
        let referencesUsed = 0;
        if (input.mode === 'i2i' && input.references.length > 0) {
          const urls = input.references.map(toDataUrl);
          body.image_url = urls[0];
          referencesUsed = 1;
          if (!isSingleImageEndpoint(config.model_id) && urls.length > 1) {
            body.image_urls = urls;
            referencesUsed = urls.length;
          }
        }

        const result = await runModel(config, body, signal);
        const nsfw = asArray(result.has_nsfw_concepts);
        if (nsfw.length > 0 && nsfw[0] === true) throw new ProviderError('PROVIDER_CONTENT_BLOCKED');

        const first = asRecord(asArray(result.images)[0] ?? result.image);
        const url = asString(first.url);
        if (!url) throw new ProviderError('PROVIDER_BAD_RESPONSE');
        const { image, mime } = await downloadImage(doFetch, url, signal);
        return { image, mime: asString(first.content_type) ?? mime, costUsd: costOf(config), referencesUsed };
      });
    },
  };
}
