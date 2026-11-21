import { env } from '../config/env.js';
import { ProviderError } from './errors.js';
import {
  asArray,
  asRecord,
  asString,
  costOf,
  decodeBase64Image,
  defaultFetch,
  fetchOk,
  joinUrl,
  readJson,
  requireApiKey,
  withDeadline,
  type ProviderDeps,
} from './http.js';
import type { GenerateImageResult, ModelConfigRecord, ProviderAdapter } from './types.js';

const DEFAULT_BASE_URL = 'https://api.cloudflare.com/client/v4/accounts';
/** `flux-1-schnell` accepts 1..8 steps; 4 is its documented default and what the neuron price assumes. */
const T2I_STEPS = 4;

/** Cloudflare answers 200 with `success: false` for some failures, so the code decides, not the status. */
const errorsToProviderError = (payload: Record<string, unknown>): ProviderError => {
  const first = asRecord(asArray(payload.errors)[0]);
  const code = Number(first.code);
  // 4006: the daily neuron allocation is spent — retrying today cannot help.
  if (code === 4006) return new ProviderError('PROVIDER_UNAVAILABLE');
  // 3040: capacity temporarily exceeded; worth another attempt.
  if (code === 3040) return new ProviderError('PROVIDER_RATE_LIMITED');
  if (code === 10000 || code === 10001) return new ProviderError('PROVIDER_AUTH');
  return new ProviderError('PROVIDER_BAD_REQUEST');
};

/** The models return base64 without saying what it is; both give JPEG today, PNG is cheap to allow. */
const sniffMime = (image: Buffer): string => (image[0] === 0x89 && image[1] === 0x50 ? 'image/png' : 'image/jpeg');

/**
 * Adapter for Cloudflare Workers AI. One credential covers every capability, and the free plan grants
 * 10,000 neurons a day; a 1024x1024 `flux-1-schnell` render measured 172.8 of them, so roughly 57 images
 * a day at no cost. Verified against the live API on 20 Nov 2026:
 *   - t2i  (`flux-1-schnell`)      JSON `{ prompt, steps }`            -> `result.image` (base64 JPEG)
 *   - i2i  (`flux-2-klein-4b`)     multipart `prompt` + `image` file   -> `result.image` (base64 JPEG)
 * Both return 1024x1024, which the canvas step resizes to the template's aspect ratio.
 */
export function createCloudflareProvider(deps: ProviderDeps = {}): ProviderAdapter {
  const doFetch = deps.fetch ?? defaultFetch;

  /** The Account ID is not a secret, so it rides in the model's base_url; the env value is a fallback. */
  function runUrl(config: ModelConfigRecord): string {
    const base =
      config.base_url ?? (env.CF_ACCOUNT_ID ? `${DEFAULT_BASE_URL}/${env.CF_ACCOUNT_ID}/ai/run` : undefined);
    if (!base) throw new ProviderError('PROVIDER_BAD_REQUEST');
    return joinUrl(base, config.model_id);
  }

  return {
    name: 'cloudflare',

    async generateImage(config, input, opts): Promise<GenerateImageResult> {
      const key = requireApiKey(config);

      return withDeadline(config.timeout_ms, opts?.signal, async (signal) => {
        const url = runUrl(config);
        const reference = input.mode === 'i2i' ? input.references[0] : undefined;

        let headers: Record<string, string>;
        let body: string | FormData;
        if (reference) {
          // `flux-2-klein-*` unifies generation and editing. The reference field is named `image`;
          // multi-image endpoints do not exist on Workers AI, so only the first reference is sent.
          const form = new FormData();
          form.set('prompt', input.prompt);
          form.set('image', new Blob([new Uint8Array(reference.data)], { type: reference.mime }), 'reference');
          headers = { Authorization: `Bearer ${key}` };
          body = form;
        } else {
          headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
          body = JSON.stringify({ prompt: input.prompt, steps: T2I_STEPS });
        }

        const res = await fetchOk(doFetch, url, { method: 'POST', headers, body }, signal);
        const payload = asRecord(await readJson(res));
        if (payload.success === false) throw errorsToProviderError(payload);

        const base64 = asString(asRecord(payload.result).image);
        if (!base64) throw new ProviderError('PROVIDER_BAD_RESPONSE');

        const { image } = decodeBase64Image(base64);
        return {
          image,
          mime: sniffMime(image),
          costUsd: costOf(config),
          referencesUsed: reference ? 1 : 0,
        };
      });
    },
  };
}
