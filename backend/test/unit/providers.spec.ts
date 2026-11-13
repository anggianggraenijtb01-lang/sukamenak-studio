import sharp from 'sharp';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createFalProvider } from '../../src/providers/fal.js';
import { createGeminiProvider } from '../../src/providers/gemini.js';
import { createOpenAiCompatProvider } from '../../src/providers/openaiCompat.js';
import { ProviderError } from '../../src/providers/errors.js';
import type { FetchLike } from '../../src/providers/http.js';
import { nearestAspect, aspectSize } from '../../src/providers/aspect.js';
import type { GenerateImageInput, ImageInput, ModelConfigRecord } from '../../src/providers/types.js';

const KEY = 'sk-test-SECRET-KEY-1234567890';
const PROMPT = 'TOP-SECRET-PROMPT-BODY roasted product on a table';

let png: Buffer;
let refs: ImageInput[];
beforeAll(async () => {
  png = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#336699' } }).png().toBuffer();
  refs = [0, 1, 2].map(() => ({ data: png, mime: 'image/png' }));
});

afterEach(() => {
  delete process.env.PROVIDER_KEY_TEST;
});

function config(over: Partial<ModelConfigRecord> = {}): ModelConfigRecord {
  process.env.PROVIDER_KEY_TEST = KEY;
  return {
    id: 'cfg-1',
    name: 'Test model',
    provider: 'openai_compat',
    capability: 'i2i',
    model_id: 'gpt-image-1',
    base_url: 'https://api.example.test/v1',
    api_key_env: 'PROVIDER_KEY_TEST',
    is_default: true,
    is_active: true,
    priority: 100,
    cost_per_call_usd: '0.04',
    timeout_ms: 2000,
    ...over,
  };
}

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(handler: (call: Call, n: number) => Response | Promise<Response>): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const call = { url, init: init ?? {} };
    calls.push(call);
    return handler(call, calls.length);
  };
  return { fetch, calls };
}

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const header = (call: Call, name: string): string | undefined => (call.init.headers as Record<string, string>)[name];
const jsonBody = (call: Call): Record<string, any> => JSON.parse(String(call.init.body));

const genInput = (over: Partial<GenerateImageInput> = {}): GenerateImageInput => ({
  prompt: PROMPT,
  mode: 'i2i',
  references: refs,
  aspectRatio: '4:5',
  width: 816,
  height: 1024,
  ...over,
});

const imageB64 = (): string => png.toString('base64');

describe('aspect helpers', () => {
  it('maps ratios to supported sizes', () => {
    expect(nearestAspect('4:5', ['1:1', '3:4', '4:3', '9:16', '16:9'])).toBe('3:4');
    expect(nearestAspect('9:16', ['1:1', '9:16'])).toBe('9:16');
    expect(aspectSize('4:5', 1024)).toEqual({ width: 816, height: 1024 });
    expect(aspectSize('16:9', 1024)).toEqual({ width: 1024, height: 576 });
  });
});

describe('openai_compat adapter', () => {
  it('vision: sends the image as a data URL with bearer auth and returns the description and cost', async () => {
    const { fetch, calls } = fakeFetch(() => json({ choices: [{ message: { content: ' warm orange tones ' } }] }));
    const provider = createOpenAiCompatProvider({ fetch });
    const out = await provider.analyzeReference!(config({ capability: 'vision', model_id: 'gpt-4o-mini' }), {
      image: refs[0]!,
      role: 'color',
      instruction: 'Extract ONLY the colour palette',
    });
    expect(out).toEqual({ description: 'warm orange tones', costUsd: 0.04 });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.example.test/v1/chat/completions');
    expect(header(calls[0]!, 'Authorization')).toBe(`Bearer ${KEY}`);
    const body = jsonBody(calls[0]!);
    expect(body.model).toBe('gpt-4o-mini');
    const content = body.messages[0].content;
    expect(content[0]).toMatchObject({ type: 'text', text: 'Extract ONLY the colour palette' });
    expect(content[1].image_url.url).toBe(`data:image/png;base64,${imageB64()}`);
  });

  it('text: chat completion with the system prompt', async () => {
    const { fetch, calls } = fakeFetch(() => json({ choices: [{ message: { content: 'better prompt' } }] }));
    const out = await createOpenAiCompatProvider({ fetch }).improveText!(config({ capability: 'text', model_id: 'deepseek-chat' }), { text: 'prompt saya' });
    expect(out).toMatchObject({ text: 'better prompt', source: 'model' });
    expect(jsonBody(calls[0]!).messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user']);
  });

  it('t2i: posts JSON to /images/generations with a size for the aspect and decodes b64_json', async () => {
    const { fetch, calls } = fakeFetch(() => json({ data: [{ b64_json: imageB64() }] }));
    const out = await createOpenAiCompatProvider({ fetch }).generateImage!(config({ capability: 't2i', model_id: 'dall-e-3' }), genInput({ mode: 't2i', references: [] }));
    expect(calls[0]!.url).toBe('https://api.example.test/v1/images/generations');
    const body = jsonBody(calls[0]!);
    expect(body).toMatchObject({ model: 'dall-e-3', prompt: PROMPT, n: 1, size: '1024x1024', response_format: 'b64_json' });
    expect(out.referencesUsed).toBe(0);
    expect(out.image.equals(png)).toBe(true);
  });

  it('i2i (gpt-image): multipart /images/edits with EVERY reference as an image[] part and auth header', async () => {
    const { fetch, calls } = fakeFetch(() => json({ data: [{ b64_json: imageB64() }] }));
    const out = await createOpenAiCompatProvider({ fetch }).generateImage!(config(), genInput());
    const call = calls[0]!;
    expect(call.url).toBe('https://api.example.test/v1/images/edits');
    expect(header(call, 'Authorization')).toBe(`Bearer ${KEY}`);
    // fetch must set the multipart boundary itself.
    expect(header(call, 'Content-Type')).toBeUndefined();
    const form = call.init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    const images = form.getAll('image[]');
    expect(images).toHaveLength(3);
    for (const part of images) {
      expect(part).toBeInstanceOf(Blob);
      expect((part as Blob).type).toBe('image/png');
      expect((part as Blob).size).toBe(png.length);
    }
    expect(form.get('prompt')).toBe(PROMPT);
    expect(form.get('model')).toBe('gpt-image-1');
    expect(form.get('size')).toBe('1024x1536');
    expect(out.referencesUsed).toBe(3);
  });

  it('i2i (non gpt-image models) repeats the plain `image` field; dall-e only takes one image and says so', async () => {
    const edits = fakeFetch(() => json({ data: [{ b64_json: imageB64() }] }));
    await createOpenAiCompatProvider({ fetch: edits.fetch }).generateImage!(config({ model_id: 'custom-edit-model' }), genInput());
    expect((edits.calls[0]!.init.body as FormData).getAll('image')).toHaveLength(3);

    const dalle = fakeFetch(() => json({ data: [{ b64_json: imageB64() }] }));
    const out = await createOpenAiCompatProvider({ fetch: dalle.fetch }).generateImage!(config({ model_id: 'dall-e-2' }), genInput());
    expect((dalle.calls[0]!.init.body as FormData).getAll('image')).toHaveLength(1);
    expect(out.referencesUsed).toBe(1);
  });

  it('i2i via an ARK/Seedream endpoint sends all references as an image array to /images/generations', async () => {
    const { fetch, calls } = fakeFetch(() => json({ data: [{ b64_json: imageB64() }] }));
    const out = await createOpenAiCompatProvider({ fetch }).generateImage!(
      config({ model_id: 'seedream-4-0-250828', base_url: 'https://ark.ap-southeast.bytepluses.com/api/v3' }),
      genInput(),
    );
    expect(calls[0]!.url).toBe('https://ark.ap-southeast.bytepluses.com/api/v3/images/generations');
    const body = jsonBody(calls[0]!);
    expect(body.image).toHaveLength(3);
    expect(body.image[0]).toMatch(/^data:image\/png;base64,/);
    expect(out.referencesUsed).toBe(3);
  });

  it('follows an image URL in the response', async () => {
    const { fetch, calls } = fakeFetch((call) =>
      call.url.endsWith('/images/generations') ? json({ data: [{ url: 'https://cdn.example.test/out.png' }] }) : new Response(png, { status: 200, headers: { 'content-type': 'image/png' } }),
    );
    const out = await createOpenAiCompatProvider({ fetch }).generateImage!(config({ model_id: 'dall-e-3' }), genInput({ mode: 't2i', references: [] }));
    expect(calls[1]!.url).toBe('https://cdn.example.test/out.png');
    expect(out.image.equals(png)).toBe(true);
  });

  it('maps HTTP failures to sanitised provider errors that never echo the key, prompt or body', async () => {
    const cases: [number, string, boolean][] = [
      [401, 'PROVIDER_AUTH', false],
      [403, 'PROVIDER_AUTH', false],
      [429, 'PROVIDER_RATE_LIMITED', true],
      [500, 'PROVIDER_UNAVAILABLE', true],
      [503, 'PROVIDER_UNAVAILABLE', true],
      [504, 'PROVIDER_TIMEOUT', true],
      [404, 'PROVIDER_BAD_REQUEST', false],
    ];
    for (const [status, code, transient] of cases) {
      const { fetch } = fakeFetch(() => json({ error: { message: `leaked ${KEY} ${PROMPT}` } }, status));
      const err = (await createOpenAiCompatProvider({ fetch }).generateImage!(config(), genInput()).catch((e: unknown) => e)) as ProviderError;
      expect(err, String(status)).toBeInstanceOf(ProviderError);
      expect(err.code).toBe(code);
      expect(err.transient).toBe(transient);
      expect(err.message).not.toContain(KEY);
      expect(err.message).not.toContain('SECRET');
      expect(JSON.stringify(err)).not.toContain(KEY);
    }
  });

  it('classifies a 400 with a moderation marker as blocked content, other 400s as bad request', async () => {
    const blocked = fakeFetch(() => json({ error: { code: 'content_policy_violation', message: PROMPT } }, 400));
    const e1 = (await createOpenAiCompatProvider({ fetch: blocked.fetch }).generateImage!(config(), genInput()).catch((e: unknown) => e)) as ProviderError;
    expect(e1.code).toBe('PROVIDER_CONTENT_BLOCKED');
    expect(e1.transient).toBe(false);
    expect(e1.message).not.toContain('SECRET');
    const bad = fakeFetch(() => json({ error: { message: 'invalid size' } }, 400));
    const e2 = (await createOpenAiCompatProvider({ fetch: bad.fetch }).generateImage!(config(), genInput()).catch((e: unknown) => e)) as ProviderError;
    expect(e2.code).toBe('PROVIDER_BAD_REQUEST');
  });

  it('network failures and unusable bodies become transient / bad-response errors without details', async () => {
    const net = createOpenAiCompatProvider({
      fetch: async () => {
        throw new Error(`connect ECONNREFUSED https://api.example.test/v1?key=${KEY}`);
      },
    });
    const e1 = (await net.generateImage!(config(), genInput()).catch((e: unknown) => e)) as ProviderError;
    expect(e1).toMatchObject({ code: 'PROVIDER_UNAVAILABLE', transient: true });
    expect(e1.message).not.toContain(KEY);

    const empty = fakeFetch(() => json({ data: [] }));
    const e2 = (await createOpenAiCompatProvider({ fetch: empty.fetch }).generateImage!(config(), genInput()).catch((e: unknown) => e)) as ProviderError;
    expect(e2.code).toBe('PROVIDER_BAD_RESPONSE');
    const garbage = fakeFetch(() => new Response('<html>nope</html>', { status: 200 }));
    const e3 = (await createOpenAiCompatProvider({ fetch: garbage.fetch }).generateImage!(config(), genInput()).catch((e: unknown) => e)) as ProviderError;
    expect(e3.code).toBe('PROVIDER_BAD_RESPONSE');
  });

  it('is unusable without its key variable and does not call the network', async () => {
    const { fetch, calls } = fakeFetch(() => json({}));
    const cfg = config();
    delete process.env.PROVIDER_KEY_TEST;
    const err = (await createOpenAiCompatProvider({ fetch }).generateImage!(cfg, genInput()).catch((e: unknown) => e)) as ProviderError;
    expect(err.code).toBe('PROVIDER_AUTH');
    expect(calls).toHaveLength(0);
  });

  it('enforces timeout_ms even when fetch ignores its abort signal', async () => {
    const hang: FetchLike = () => new Promise<Response>(() => undefined);
    const started = Date.now();
    const err = (await createOpenAiCompatProvider({ fetch: hang }).generateImage!(config({ timeout_ms: 60 }), genInput()).catch((e: unknown) => e)) as ProviderError;
    expect(err).toMatchObject({ code: 'PROVIDER_TIMEOUT', transient: true });
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it('honours an external abort signal', async () => {
    const hang: FetchLike = (_url, init) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    const controller = new AbortController();
    const pending = createOpenAiCompatProvider({ fetch: hang }).generateImage!(config({ timeout_ms: 5000 }), genInput(), { signal: controller.signal });
    setTimeout(() => controller.abort(), 20);
    const err = (await pending.catch((e: unknown) => e)) as ProviderError;
    expect(err).toMatchObject({ code: 'PROVIDER_ABORTED', transient: false });
  });
});

describe('gemini adapter', () => {
  const gcfg = (over: Partial<ModelConfigRecord> = {}) =>
    config({ provider: 'gemini', base_url: null, model_id: 'gemini-3.1-flash-image-preview', cost_per_call_usd: '0.03', ...over });

  it('vision: generateContent with the image inline and the key in a header, never in the URL', async () => {
    const { fetch, calls } = fakeFetch(() => json({ candidates: [{ content: { parts: [{ text: 'soft golden light' }] } }] }));
    const out = await createGeminiProvider({ fetch }).analyzeReference!(gcfg({ capability: 'vision', model_id: 'gemini-flash-latest' }), {
      image: refs[0]!,
      role: 'lighting',
      instruction: 'Extract ONLY the lighting',
    });
    expect(out).toEqual({ description: 'soft golden light', costUsd: 0.03 });
    expect(calls[0]!.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent');
    expect(calls[0]!.url).not.toContain(KEY);
    expect(header(calls[0]!, 'x-goog-api-key')).toBe(KEY);
    const parts = jsonBody(calls[0]!).contents[0].parts;
    expect(parts[0].text).toBe('Extract ONLY the lighting');
    expect(parts[1].inline_data).toEqual({ mime_type: 'image/png', data: imageB64() });
  });

  it('i2i: sends the prompt and ALL references as inline images, with the nearest aspect ratio, and decodes the image part', async () => {
    const { fetch, calls } = fakeFetch(() => json({ candidates: [{ content: { parts: [{ text: 'ok' }, { inlineData: { mimeType: 'image/png', data: imageB64() } }] } }] }));
    const out = await createGeminiProvider({ fetch }).generateImage!(gcfg(), genInput());
    const body = jsonBody(calls[0]!);
    const parts = body.contents[0].parts;
    expect(parts).toHaveLength(4);
    expect(parts[0].text).toBe(PROMPT);
    expect(parts.slice(1).every((p: any) => p.inline_data?.mime_type === 'image/png')).toBe(true);
    expect(body.generationConfig.responseModalities).toContain('IMAGE');
    expect(body.generationConfig.imageConfig.aspectRatio).toBe('4:5');
    expect(out.referencesUsed).toBe(3);
    expect(out.image.equals(png)).toBe(true);
    expect(header(calls[0]!, 'x-goog-api-key')).toBe(KEY);
  });

  it('t2i sends no reference parts', async () => {
    const { fetch, calls } = fakeFetch(() => json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: imageB64() } }] } }] }));
    const out = await createGeminiProvider({ fetch }).generateImage!(gcfg({ capability: 't2i' }), genInput({ mode: 't2i', references: [] }));
    expect(jsonBody(calls[0]!).contents[0].parts).toHaveLength(1);
    expect(out.referencesUsed).toBe(0);
  });

  it('Imagen uses :predict, text-to-image only', async () => {
    const { fetch, calls } = fakeFetch(() => json({ predictions: [{ bytesBase64Encoded: imageB64(), mimeType: 'image/png' }] }));
    const provider = createGeminiProvider({ fetch });
    const out = await provider.generateImage!(gcfg({ model_id: 'imagen-4.0-generate-001', capability: 't2i' }), genInput({ mode: 't2i', references: [] }));
    expect(calls[0]!.url).toContain(':predict');
    expect(jsonBody(calls[0]!)).toMatchObject({ instances: [{ prompt: PROMPT }], parameters: { sampleCount: 1, aspectRatio: '3:4' } });
    expect(out.image.equals(png)).toBe(true);
    const refused = (await provider.generateImage!(gcfg({ model_id: 'imagen-4.0-generate-001' }), genInput()).catch((e: unknown) => e)) as ProviderError;
    expect(refused.code).toBe('PROVIDER_BAD_REQUEST');
  });

  it('maps safety blocks and HTTP failures without leaking anything', async () => {
    const blocked = fakeFetch(() => json({ promptFeedback: { blockReason: 'SAFETY' } }));
    const e1 = (await createGeminiProvider({ fetch: blocked.fetch }).generateImage!(gcfg(), genInput()).catch((e: unknown) => e)) as ProviderError;
    expect(e1).toMatchObject({ code: 'PROVIDER_CONTENT_BLOCKED', transient: false });
    const noImage = fakeFetch(() => json({ candidates: [{ content: { parts: [{ text: 'sorry' }] } }] }));
    const e2 = (await createGeminiProvider({ fetch: noImage.fetch }).generateImage!(gcfg(), genInput()).catch((e: unknown) => e)) as ProviderError;
    expect(e2.code).toBe('PROVIDER_BAD_RESPONSE');
    const down = fakeFetch(() => json({ error: { message: `${KEY} ${PROMPT}` } }, 503));
    const e3 = (await createGeminiProvider({ fetch: down.fetch }).generateImage!(gcfg(), genInput()).catch((e: unknown) => e)) as ProviderError;
    expect(e3).toMatchObject({ code: 'PROVIDER_UNAVAILABLE', transient: true });
    expect(e3.message).not.toContain(KEY);
    expect(e3.message).not.toContain('SECRET');
  });

  it('enforces timeout_ms', async () => {
    const err = (await createGeminiProvider({ fetch: () => new Promise<Response>(() => undefined) })
      .analyzeReference!(gcfg({ timeout_ms: 50 }), { image: refs[0]!, role: 'color', instruction: 'x' })
      .catch((e: unknown) => e)) as ProviderError;
    expect(err.code).toBe('PROVIDER_TIMEOUT');
  });
});

describe('fal adapter', () => {
  const fcfg = (over: Partial<ModelConfigRecord> = {}) =>
    config({ provider: 'fal', base_url: null, model_id: 'fal-ai/flux/dev/image-to-image', cost_per_call_usd: '0.025', ...over });

  function queueFetch(extra?: (call: Call) => Response | undefined) {
    let polls = 0;
    return fakeFetch((call) => {
      const custom = extra?.(call);
      if (custom) return custom;
      if (call.init.method === 'POST') {
        return json({ request_id: 'req-1', status_url: 'https://queue.fal.run/q/req-1/status', response_url: 'https://queue.fal.run/q/req-1' });
      }
      if (call.url.endsWith('/status')) {
        polls++;
        return json({ status: polls < 2 ? 'IN_PROGRESS' : 'COMPLETED' });
      }
      if (call.url === 'https://queue.fal.run/q/req-1') return json({ images: [{ url: 'https://v3.fal.media/out.png', content_type: 'image/png' }] });
      return new Response(png, { status: 200, headers: { 'content-type': 'image/png' } });
    });
  }

  it('queue flow: submit, poll until COMPLETED, fetch the result, download the image', async () => {
    const { fetch, calls } = queueFetch();
    const out = await createFalProvider({ fetch, pollIntervalMs: 1 }).generateImage!(fcfg(), genInput());
    expect(calls[0]!.url).toBe('https://queue.fal.run/fal-ai/flux/dev/image-to-image');
    expect(header(calls[0]!, 'Authorization')).toBe(`Key ${KEY}`);
    expect(calls.map((c) => c.url)).toContain('https://queue.fal.run/q/req-1/status');
    expect(calls.filter((c) => c.url.endsWith('/status'))).toHaveLength(2);
    expect(out.image.equals(png)).toBe(true);
    expect(out.costUsd).toBe(0.025);
  });

  it('single-image endpoints get one image_url and honestly report one reference used', async () => {
    const { fetch, calls } = queueFetch();
    const out = await createFalProvider({ fetch, pollIntervalMs: 1 }).generateImage!(fcfg(), genInput());
    const body = jsonBody(calls[0]!);
    expect(body.image_url).toMatch(/^data:image\/png;base64,/);
    expect(body.image_urls).toBeUndefined();
    expect(body.prompt).toBe(PROMPT);
    expect(body.image_size).toEqual({ width: 816, height: 1024 });
    expect(out.referencesUsed).toBe(1);
  });

  it('multi-image endpoints receive every reference', async () => {
    const { fetch, calls } = queueFetch();
    const out = await createFalProvider({ fetch, pollIntervalMs: 1 }).generateImage!(fcfg({ model_id: 'fal-ai/nano-banana/edit' }), genInput());
    expect(jsonBody(calls[0]!).image_urls).toHaveLength(3);
    expect(out.referencesUsed).toBe(3);
  });

  it('t2i sends no image fields', async () => {
    const { fetch, calls } = queueFetch();
    const out = await createFalProvider({ fetch, pollIntervalMs: 1 }).generateImage!(fcfg({ model_id: 'fal-ai/flux/dev', capability: 't2i' }), genInput({ mode: 't2i', references: [] }));
    const body = jsonBody(calls[0]!);
    expect(body.image_url).toBeUndefined();
    expect(out.referencesUsed).toBe(0);
  });

  it('sync host: the POST response is the result', async () => {
    const { fetch, calls } = fakeFetch((call) =>
      call.init.method === 'POST' ? json({ images: [{ url: 'https://v3.fal.media/out.png' }] }) : new Response(png, { status: 200 }),
    );
    const out = await createFalProvider({ fetch }).generateImage!(fcfg({ base_url: 'https://fal.run' }), genInput());
    expect(calls[0]!.url).toBe('https://fal.run/fal-ai/flux/dev/image-to-image');
    expect(out.image.equals(png)).toBe(true);
  });

  it('maps safety flags, failed jobs and HTTP errors; times out', async () => {
    const nsfw = fakeFetch(() => json({ images: [{ url: 'https://x/y.png' }], has_nsfw_concepts: [true] }));
    const e1 = (await createFalProvider({ fetch: nsfw.fetch }).generateImage!(fcfg({ base_url: 'https://fal.run' }), genInput()).catch((e: unknown) => e)) as ProviderError;
    expect(e1.code).toBe('PROVIDER_CONTENT_BLOCKED');

    const failed = queueFetch((call) => (call.url.endsWith('/status') ? json({ status: 'FAILED' }) : undefined));
    const e2 = (await createFalProvider({ fetch: failed.fetch, pollIntervalMs: 1 }).generateImage!(fcfg(), genInput()).catch((e: unknown) => e)) as ProviderError;
    expect(e2.code).toBe('PROVIDER_UNAVAILABLE');

    const auth = fakeFetch(() => json({ detail: `${KEY} ${PROMPT}` }, 401));
    const e3 = (await createFalProvider({ fetch: auth.fetch }).generateImage!(fcfg(), genInput()).catch((e: unknown) => e)) as ProviderError;
    expect(e3).toMatchObject({ code: 'PROVIDER_AUTH', transient: false });
    expect(e3.message).not.toContain('SECRET');

    const slow = queueFetch((call) => (call.url.endsWith('/status') ? json({ status: 'IN_QUEUE' }) : undefined));
    const e4 = (await createFalProvider({ fetch: slow.fetch, pollIntervalMs: 5 }).generateImage!(fcfg({ timeout_ms: 80 }), genInput()).catch((e: unknown) => e)) as ProviderError;
    expect(e4.code).toBe('PROVIDER_TIMEOUT');
  });

  it('does not expose vision or text capabilities', () => {
    const provider = createFalProvider();
    expect(provider.analyzeReference).toBeUndefined();
    expect(provider.improveText).toBeUndefined();
  });
});
