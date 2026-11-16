import { env } from '../config/env.js';
import { Agent } from 'undici';
import { guardedLookup, isDisallowedHost } from '../lib/outboundUrl.js';
import { readProviderKey } from '../lib/providerKeyEnv.js';
import { ProviderError, isProviderError, providerErrorFromStatus } from './errors.js';
import type { ImageInput, ModelConfigRecord } from './types.js';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Looked up at call time so tests can stub `globalThis.fetch` after the adapter was created.
 * Unless private hosts are explicitly allowed, literal internal hosts are refused up front and every
 * hostname is resolved by `guardedLookup` at connection time, so the address that is validated is
 * the one that is connected to (a rebinding DNS answer cannot swap it in between). Redirects are
 * refused, so a provider response cannot bounce the request, with its credentials, inward.
 */
const guardedAgent = new Agent({ connect: { lookup: guardedLookup } });

export const defaultFetch: FetchLike = async (input, init) => {
  if (env.ALLOW_PRIVATE_PROVIDER_HOSTS) return globalThis.fetch(input, { ...init, redirect: 'error' });

  let hostname: string;
  try {
    hostname = new URL(input).hostname;
  } catch {
    throw new ProviderError('PROVIDER_BAD_REQUEST');
  }
  if (isDisallowedHost(hostname)) throw new ProviderError('PROVIDER_BAD_REQUEST');

  try {
    // `dispatcher` is undici's extension to fetch and is missing from the DOM RequestInit type.
    return await globalThis.fetch(input, { ...init, redirect: 'error', dispatcher: guardedAgent } as unknown as RequestInit);
  } catch (err) {
    // A refused host is a configuration error, not a transient outage: do not let the queue retry it.
    if ((err as { cause?: { code?: string } })?.cause?.code === 'EBLOCKEDHOST') throw new ProviderError('PROVIDER_BAD_REQUEST');
    throw err;
  }
};

export interface ProviderDeps {
  fetch?: FetchLike;
}

/** API key from the environment variable NAMED by the config. Throws PROVIDER_AUTH when it is not set. */
export function requireApiKey(config: ModelConfigRecord): string {
  const key = readProviderKey(config.api_key_env);
  if (!key) throw new ProviderError('PROVIDER_AUTH');
  return key;
}

/**
 * Runs `fn` under a hard deadline (the model's `timeout_ms`) and an optional external abort signal.
 * Every failure leaves as a sanitised ProviderError. The deadline is enforced by a race, so it also
 * holds for a fetch that ignores its abort signal.
 */
export async function withDeadline<T>(
  timeoutMs: number,
  external: AbortSignal | undefined,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (external?.aborted) controller.abort();
  external?.addEventListener('abort', onExternalAbort, { once: true });

  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error('aborted'));
    if (controller.signal.aborted) onAbort();
    else controller.signal.addEventListener('abort', onAbort, { once: true });
  });
  aborted.catch(() => undefined);

  try {
    return await Promise.race([fn(controller.signal), aborted]);
  } catch (err) {
    if (isProviderError(err)) throw err;
    if (timedOut) throw new ProviderError('PROVIDER_TIMEOUT');
    if (external?.aborted) throw new ProviderError('PROVIDER_ABORTED');
    // Network failure, DNS error, reset connection: no detail (it can contain the URL) is kept.
    throw new ProviderError('PROVIDER_UNAVAILABLE');
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', onExternalAbort);
    if (onAbort) controller.signal.removeEventListener('abort', onAbort);
  }
}

const CONTENT_BLOCK_MARKERS = /content_policy|moderation_blocked|safety|blocked/i;

/** Fetches and requires a 2xx response; the error body is discarded (it may echo the request). */
export async function fetchOk(doFetch: FetchLike, url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  const res = await doFetch(url, { ...init, signal });
  if (!res.ok) {
    if (res.status === 400 || res.status === 422) {
      // Only a fixed set of markers is looked for; the body itself is never kept or surfaced.
      const body = await res.text().catch(() => '');
      if (CONTENT_BLOCK_MARKERS.test(body.slice(0, 4000))) throw new ProviderError('PROVIDER_CONTENT_BLOCKED', { httpStatus: res.status });
    } else {
      void res.body?.cancel().catch(() => undefined);
    }
    throw providerErrorFromStatus(res.status);
  }
  return res;
}

export async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new ProviderError('PROVIDER_BAD_RESPONSE');
  }
}

export const MAX_IMAGE_DOWNLOAD_BYTES = 25 * 1024 * 1024;

/** Downloads a generated image from a URL returned by a provider (or decodes a `data:` URI). */
export async function downloadImage(doFetch: FetchLike, url: string, signal: AbortSignal): Promise<{ image: Buffer; mime: string }> {
  if (url.startsWith('data:')) {
    const match = /^data:([^;,]+);base64,(.+)$/s.exec(url);
    if (!match?.[1] || !match[2]) throw new ProviderError('PROVIDER_BAD_RESPONSE');
    return { image: Buffer.from(match[2], 'base64'), mime: match[1] };
  }
  if (!/^https?:\/\//i.test(url)) throw new ProviderError('PROVIDER_BAD_RESPONSE');
  const res = await fetchOk(doFetch, url, { method: 'GET' }, signal);
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_IMAGE_DOWNLOAD_BYTES) throw new ProviderError('PROVIDER_BAD_RESPONSE');
  const image = Buffer.from(await res.arrayBuffer());
  if (image.length === 0 || image.length > MAX_IMAGE_DOWNLOAD_BYTES) throw new ProviderError('PROVIDER_BAD_RESPONSE');
  return { image, mime: res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png' };
}

export const toBase64 = (img: ImageInput): string => img.data.toString('base64');
export const toDataUrl = (img: ImageInput): string => `data:${img.mime};base64,${toBase64(img)}`;
export const decodeBase64Image = (b64: string, mime = 'image/png'): { image: Buffer; mime: string } => {
  const image = Buffer.from(b64, 'base64');
  if (image.length === 0) throw new ProviderError('PROVIDER_BAD_RESPONSE');
  return { image, mime };
};

export const joinUrl = (base: string, path: string): string => `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

/** Narrow helper for reading untyped JSON without `any`. */
export const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
export const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

export const costOf = (config: ModelConfigRecord): number => Number(config.cost_per_call_usd) || 0;
