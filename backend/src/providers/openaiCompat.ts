import { aspectSize, nearestSize } from './aspect.js';
import { ProviderError } from './errors.js';
import {
  asArray,
  asRecord,
  asString,
  costOf,
  decodeBase64Image,
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
import { IMPROVE_SYSTEM_PROMPT, MAX_ANALYSIS_TOKENS, MAX_TEXT_TOKENS } from './instructions.js';
import type { GenerateImageInput, GenerateImageResult, ModelConfigRecord, ProviderAdapter } from './types.js';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

const OPENAI_SIZES = ['1024x1024', '1536x1024', '1024x1536', '1792x1024', '1024x1792'] as const;
const DALLE3_SIZES = ['1024x1024', '1792x1024', '1024x1792'] as const;
const GPT_IMAGE_SIZES = ['1024x1024', '1536x1024', '1024x1536'] as const;

const isGptImage = (model: string): boolean => /^gpt-image/i.test(model);
const isDalle = (model: string): boolean => /^dall-e/i.test(model);
/** BytePlus ARK (Seedream) exposes image-to-image through /images/generations with an `image` array. */
const isArk = (config: ModelConfigRecord): boolean => /seedream/i.test(config.model_id) || /bytepluses|volces/i.test(config.base_url ?? '');

function pickSize(config: ModelConfigRecord, input: GenerateImageInput): string {
  if (isArk(config)) {
    const { width, height } = aspectSize(input.aspectRatio, 2048);
    return `${width}x${height}`;
  }
  if (isGptImage(config.model_id)) return nearestSize(input.aspectRatio, GPT_IMAGE_SIZES);
  if (/dall-e-3/i.test(config.model_id)) return nearestSize(input.aspectRatio, DALLE3_SIZES);
  if (isDalle(config.model_id)) return '1024x1024';
  return nearestSize(input.aspectRatio, OPENAI_SIZES);
}

/** Text of a chat completion, accepting both string and content-part array shapes. */
function chatText(payload: unknown): string {
  const message = asRecord(asRecord(asArray(asRecord(payload).choices)[0]).message);
  const content = message.content;
  if (typeof content === 'string') return content.trim();
  return asArray(content)
    .map((p) => asString(asRecord(p).text) ?? '')
    .join('')
    .trim();
}

async function imageFromResponse(
  payload: unknown,
  doFetch: NonNullable<ProviderDeps['fetch']>,
  signal: AbortSignal,
): Promise<{ image: Buffer; mime: string }> {
  const first = asRecord(asArray(asRecord(payload).data)[0]);
  const b64 = asString(first.b64_json);
  if (b64) return decodeBase64Image(b64);
  const url = asString(first.url);
  if (url) return downloadImage(doFetch, url, signal);
  throw new ProviderError('PROVIDER_BAD_RESPONSE');
}

/**
 * Adapter for OpenAI-style APIs (OpenAI, DeepSeek, BytePlus ARK, any compatible gateway).
 * Written against the public API docs; not exercised against live endpoints.
 */
export function createOpenAiCompatProvider(deps: ProviderDeps = {}): ProviderAdapter {
  const doFetch = deps.fetch ?? defaultFetch;

  async function postJson(config: ModelConfigRecord, path: string, body: unknown, signal: AbortSignal): Promise<unknown> {
    const key = requireApiKey(config);
    const res = await fetchOk(
      doFetch,
      joinUrl(config.base_url ?? DEFAULT_BASE_URL, path),
      { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      signal,
    );
    return readJson(res);
  }

  return {
    name: 'openai_compat',

    async improveText(config, { text }, opts) {
      requireApiKey(config);
      return withDeadline(config.timeout_ms, opts?.signal, async (signal) => {
        const payload = await postJson(
          config,
          '/chat/completions',
          {
            model: config.model_id,
            messages: [
              { role: 'system', content: IMPROVE_SYSTEM_PROMPT },
              { role: 'user', content: text },
            ],
            temperature: 0.4,
            max_tokens: MAX_TEXT_TOKENS,
          },
          signal,
        );
        const out = chatText(payload);
        if (!out) throw new ProviderError('PROVIDER_BAD_RESPONSE');
        return { text: out, source: 'model' as const, costUsd: costOf(config) };
      });
    },

    async analyzeReference(config, { image, instruction }, opts) {
      requireApiKey(config);
      return withDeadline(config.timeout_ms, opts?.signal, async (signal) => {
        const payload = await postJson(
          config,
          '/chat/completions',
          {
            model: config.model_id,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: instruction },
                  { type: 'image_url', image_url: { url: toDataUrl(image) } },
                ],
              },
            ],
            temperature: 0.2,
            max_tokens: MAX_ANALYSIS_TOKENS,
          },
          signal,
        );
        const description = chatText(payload);
        if (!description) throw new ProviderError('PROVIDER_BAD_RESPONSE');
        return { description, costUsd: costOf(config) };
      });
    },

    async generateImage(config, input, opts): Promise<GenerateImageResult> {
      const key = requireApiKey(config);
      return withDeadline(config.timeout_ms, opts?.signal, async (signal) => {
        const size = pickSize(config, input);
        const useRefs = input.mode === 'i2i' && input.references.length > 0;
        // dall-e-2 edits take a single image; everything else here accepts several.
        const refs = useRefs ? (isDalle(config.model_id) ? input.references.slice(0, 1) : input.references) : [];

        let payload: unknown;
        if (useRefs && !isArk(config)) {
          const form = new FormData();
          form.append('model', config.model_id);
          form.append('prompt', input.prompt);
          form.append('n', '1');
          form.append('size', size);
          const field = isGptImage(config.model_id) ? 'image[]' : 'image';
          refs.forEach((img, i) => {
            const ext = img.mime === 'image/jpeg' ? 'jpg' : img.mime === 'image/webp' ? 'webp' : 'png';
            form.append(field, new Blob([new Uint8Array(img.data)], { type: img.mime }), `reference-${i + 1}.${ext}`);
          });
          const res = await fetchOk(
            doFetch,
            joinUrl(config.base_url ?? DEFAULT_BASE_URL, '/images/edits'),
            { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form },
            signal,
          );
          payload = await readJson(res);
        } else {
          const body: Record<string, unknown> = { model: config.model_id, prompt: input.prompt, n: 1, size };
          if (!isGptImage(config.model_id)) body.response_format = 'b64_json';
          if (useRefs) body.image = refs.length === 1 ? toDataUrl(refs[0] as NonNullable<(typeof refs)[number]>) : refs.map(toDataUrl);
          payload = await postJson(config, '/images/generations', body, signal);
        }

        const { image, mime } = await imageFromResponse(payload, doFetch, signal);
        return { image, mime, costUsd: costOf(config), referencesUsed: refs.length };
      });
    },
  };
}
