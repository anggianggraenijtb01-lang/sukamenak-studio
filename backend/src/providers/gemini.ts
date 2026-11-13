import { nearestAspect } from './aspect.js';
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
  toBase64,
  withDeadline,
  type ProviderDeps,
} from './http.js';
import { IMPROVE_SYSTEM_PROMPT, MAX_TEXT_TOKENS } from './instructions.js';
import type { GenerateImageResult, ImageInput, ModelConfigRecord, ProviderAdapter } from './types.js';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_ASPECTS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const;
const IMAGEN_ASPECTS = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const;
const BLOCKED_FINISH = new Set(['SAFETY', 'IMAGE_SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION']);
/** Thinking-capable models spend output tokens on reasoning, so analysis needs headroom. */
const VISION_MAX_TOKENS = 1024;

const isImagen = (model: string): boolean => /^imagen/i.test(model);

const inlinePart = (img: ImageInput) => ({ inline_data: { mime_type: img.mime, data: toBase64(img) } });

function candidateParts(payload: unknown): Record<string, unknown>[] {
  const root = asRecord(payload);
  const feedback = asRecord(root.promptFeedback);
  if (asString(feedback.blockReason)) throw new ProviderError('PROVIDER_CONTENT_BLOCKED');
  const candidate = asRecord(asArray(root.candidates)[0]);
  const finish = asString(candidate.finishReason);
  const parts = asArray(asRecord(candidate.content).parts).map(asRecord);
  if (finish && BLOCKED_FINISH.has(finish) && parts.length === 0) throw new ProviderError('PROVIDER_CONTENT_BLOCKED');
  return parts;
}

const textOf = (parts: Record<string, unknown>[]): string =>
  parts
    .map((p) => (p.thought === true ? '' : (asString(p.text) ?? '')))
    .join('')
    .trim();

/**
 * Adapter for the Gemini Developer API (generateContent for vision/text/image output, `:predict` for
 * Imagen). Written against the public docs; not exercised against live endpoints.
 */
export function createGeminiProvider(deps: ProviderDeps = {}): ProviderAdapter {
  const doFetch = deps.fetch ?? defaultFetch;

  async function call(config: ModelConfigRecord, action: 'generateContent' | 'predict', body: unknown, signal: AbortSignal): Promise<unknown> {
    const key = requireApiKey(config);
    const url = joinUrl(config.base_url ?? DEFAULT_BASE_URL, `/models/${encodeURIComponent(config.model_id)}:${action}`);
    const res = await fetchOk(
      doFetch,
      url,
      { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      signal,
    );
    return readJson(res);
  }

  return {
    name: 'gemini',

    async improveText(config, { text }, opts) {
      requireApiKey(config);
      return withDeadline(config.timeout_ms, opts?.signal, async (signal) => {
        const payload = await call(
          config,
          'generateContent',
          {
            systemInstruction: { parts: [{ text: IMPROVE_SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: Math.max(MAX_TEXT_TOKENS, VISION_MAX_TOKENS) },
          },
          signal,
        );
        const out = textOf(candidateParts(payload));
        if (!out) throw new ProviderError('PROVIDER_BAD_RESPONSE');
        return { text: out, source: 'model' as const, costUsd: costOf(config) };
      });
    },

    async analyzeReference(config, { image, instruction }, opts) {
      requireApiKey(config);
      return withDeadline(config.timeout_ms, opts?.signal, async (signal) => {
        const payload = await call(
          config,
          'generateContent',
          {
            contents: [{ role: 'user', parts: [{ text: instruction }, inlinePart(image)] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: VISION_MAX_TOKENS },
          },
          signal,
        );
        const description = textOf(candidateParts(payload));
        if (!description) throw new ProviderError('PROVIDER_BAD_RESPONSE');
        return { description, costUsd: costOf(config) };
      });
    },

    async generateImage(config, input, opts): Promise<GenerateImageResult> {
      requireApiKey(config);
      return withDeadline(config.timeout_ms, opts?.signal, async (signal) => {
        const useRefs = input.mode === 'i2i' && input.references.length > 0;

        if (isImagen(config.model_id)) {
          // Imagen is text-to-image only: refuse rather than silently dropping the references.
          if (useRefs) throw new ProviderError('PROVIDER_BAD_REQUEST');
          const payload = asRecord(
            await call(
              config,
              'predict',
              { instances: [{ prompt: input.prompt }], parameters: { sampleCount: 1, aspectRatio: nearestAspect(input.aspectRatio, IMAGEN_ASPECTS) } },
              signal,
            ),
          );
          const first = asRecord(asArray(payload.predictions)[0]);
          const b64 = asString(first.bytesBase64Encoded);
          if (!b64) throw new ProviderError('PROVIDER_BAD_RESPONSE');
          const { image, mime } = decodeBase64Image(b64, asString(first.mimeType) ?? 'image/png');
          return { image, mime, costUsd: costOf(config), referencesUsed: 0 };
        }

        const parts: unknown[] = [{ text: input.prompt }];
        if (useRefs) parts.push(...input.references.map(inlinePart));
        const payload = await call(
          config,
          'generateContent',
          {
            contents: [{ role: 'user', parts }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
              imageConfig: { aspectRatio: nearestAspect(input.aspectRatio, GEMINI_ASPECTS) },
            },
          },
          signal,
        );
        for (const part of candidateParts(payload)) {
          const inline = asRecord(part.inlineData ?? part.inline_data);
          const data = asString(inline.data);
          if (data) {
            const { image, mime } = decodeBase64Image(data, asString(inline.mimeType ?? inline.mime_type) ?? 'image/png');
            return { image, mime, costUsd: costOf(config), referencesUsed: useRefs ? input.references.length : 0 };
          }
        }
        throw new ProviderError('PROVIDER_BAD_RESPONSE');
      });
    },
  };
}
