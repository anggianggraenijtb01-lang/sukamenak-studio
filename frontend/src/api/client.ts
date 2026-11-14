/**
 * HTTP client for the Sukamenak Studio API.
 *
 * - Unwraps the envelope `{status, message, data, meta}` and throws `ApiError` for the error envelope.
 * - The access token lives in memory only (never localStorage / sessionStorage). The refresh token is an
 *   httpOnly cookie the browser sends by itself, so every request uses `credentials: 'include'`.
 * - SINGLE-FLIGHT REFRESH. The backend rotates refresh tokens on every use and revokes the whole family when an
 *   old one is replayed (no grace window), so two parallel `/auth/refresh` calls would log the user out. When
 *   several requests fail with 401 at the same time they all wait for ONE refresh and are then retried once.
 *   A request that failed with a token that has already been replaced is simply retried, without refreshing.
 * - Signed file URLs returned inside DTOs work as plain `<img src>` / `<a href>`; `fileUrl()` only makes a
 *   root-relative one absolute when the API lives on another origin.
 */
import { ApiError, type FieldError } from './errors';
import type { ErrorEnvelope, Page, PageMeta, Session, SuccessEnvelope } from './types';

export const DEFAULT_API_BASE_URL = '/api/v1';

const envBase = import.meta.env?.VITE_API_BASE_URL;
export const API_BASE_URL: string = (envBase && envBase.trim() ? envBase.trim() : DEFAULT_API_BASE_URL).replace(/\/+$/, '');

const JSON_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 120_000;
const REFRESH_TIMEOUT_MS = 15_000;

type QueryScalar = string | number | boolean | null | undefined;
/** Any object of scalars (or arrays of scalars): typed query interfaces are accepted as they are. */
export type QueryParams = object;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: QueryParams;
  /** JSON body. */
  body?: unknown;
  /** multipart/form-data body (the browser sets the boundary). */
  formData?: FormData;
  signal?: AbortSignal;
  /** Default true. `false`: no Authorization header and no refresh on 401 (login, register, public reads). */
  auth?: boolean;
  /** Override the default timeout (30 s, 120 s for uploads). */
  timeoutMs?: number;
}

export interface Envelope<T, M = undefined> {
  data: T;
  meta: M | undefined;
  /** Indonesian text meant for toasts. Never branch on it. */
  message: string;
}

export type AuthEvent =
  | { type: 'session'; session: Session }
  /** The session is over: the refresh token was refused, or the account was deactivated. */
  | { type: 'expired'; reason: 'session' | 'inactive' };

export type AuthListener = (event: AuthEvent) => void;

export type RefreshResult =
  | { status: 'ok'; session: Session }
  /** The server refused the refresh token (or there was none): the user is anonymous. */
  | { status: 'denied' }
  /** Network error, 5xx or 429: the session state is unknown, nobody is logged out. */
  | { status: 'failed'; error: ApiError };

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface DownloadOptions {
  query?: QueryParams;
  /** Used when the server sends no filename. */
  filename?: string;
  signal?: AbortSignal;
}

const isScalar = (v: unknown): v is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof v);

/** Appends `query` to a path. Empty values are skipped, arrays are repeated, booleans become `true`/`false`. */
export function buildQueryString(query?: QueryParams): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query as Record<string, QueryScalar | readonly QueryScalar[]>)) {
    if (Array.isArray(value)) {
      for (const item of value) if (isScalar(item)) params.append(key, String(item));
    } else if (isScalar(value) && value !== '') {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Makes a URL taken from a DTO usable as `<img src>` / `<a href>`.
 * Absolute URLs (S3 presigned, or local driver with PUBLIC_BASE_URL) pass through unchanged; a root-relative
 * one (`/api/v1/files/...`) is resolved against the API origin when the API base is absolute.
 */
export function resolveFileUrl(url: string, baseUrl: string = API_BASE_URL): string {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) return url;
  if (url.startsWith('/') && /^https?:\/\//i.test(baseUrl)) {
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return url;
    }
  }
  return url;
}

export function fileUrl(url: string): string;
export function fileUrl(url: string | null | undefined): string | null;
export function fileUrl(url: string | null | undefined): string | null {
  return url ? resolveFileUrl(url) : null;
}

function statusToCode(status: number): string {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMIT_EXCEEDED';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'INVALID_RESPONSE';
}

function isErrorEnvelope(v: unknown): v is ErrorEnvelope {
  return !!v && typeof v === 'object' && (v as { status?: unknown }).status === 'error';
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  if (isErrorEnvelope(body) && typeof body.error_code === 'string') {
    const errors: FieldError[] = Array.isArray(body.errors)
      ? body.errors
          .filter((e) => e && typeof e.field === 'string' && typeof e.message === 'string')
          .map((e) => ({ field: e.field, message: e.message }))
      : [];
    return new ApiError({ status, code: body.error_code, errors, serverMessage: body.message });
  }
  return new ApiError({ status, code: statusToCode(status) });
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? API_BASE_URL).replace(/\/+$/, '');
  const doFetch: typeof fetch = (...args) => (options.fetch ?? globalThis.fetch)(...args);

  let accessToken: string | null = null;
  const listeners = new Set<AuthListener>();
  let refreshInFlight: Promise<RefreshResult> | null = null;

  const emit = (event: AuthEvent) => {
    for (const l of [...listeners]) {
      try {
        l(event);
      } catch {
        /* a failing listener must not break the request pipeline */
      }
    }
  };

  const url = (path: string, query?: QueryParams) => `${baseUrl}${path.startsWith('/') ? path : `/${path}`}${buildQueryString(query)}`;

  /** Absolute version of `url`, for links shared outside the app. */
  const absoluteUrl = (path: string, query?: QueryParams) => {
    const u = url(path, query);
    if (/^https?:\/\//i.test(u)) return u;
    return typeof window !== 'undefined' ? new URL(u, window.location.origin).toString() : u;
  };

  // ---- session ---------------------------------------------------------------------------------------

  const getAccessToken = () => accessToken;

  /** Stores the session returned by login / register / refresh / password change and tells the auth layer. */
  const setSession = (session: Session) => {
    accessToken = session.access_token;
    emit({ type: 'session', session });
  };

  /** Forgets the access token (logout). Does not notify. */
  const clearSession = () => {
    accessToken = null;
  };

  const subscribe = (listener: AuthListener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  async function doRefresh(hadToken: boolean): Promise<RefreshResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REFRESH_TIMEOUT_MS);
    try {
      let res: Response;
      try {
        res = await doFetch(url('/auth/refresh'), {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
          signal: ctrl.signal,
        });
      } catch {
        return { status: 'failed', error: new ApiError({ status: 0, code: 'NETWORK_ERROR' }) };
      }
      const body = await readJson(res);
      if (res.ok) {
        const session = (body as SuccessEnvelope<Session> | undefined)?.data;
        if (session && typeof session.access_token === 'string') {
          setSession(session);
          return { status: 'ok', session };
        }
        return { status: 'failed', error: new ApiError({ status: res.status, code: 'INVALID_RESPONSE' }) };
      }
      if (res.status === 401 || res.status === 403) {
        accessToken = null;
        if (hadToken) emit({ type: 'expired', reason: 'session' });
        return { status: 'denied' };
      }
      return { status: 'failed', error: toApiError(res.status, body) };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Single-flight refresh: concurrent callers share one `POST /auth/refresh`.
   * Also used for the silent refresh on app start (`restoreSession`).
   */
  const refresh = (): Promise<RefreshResult> => {
    if (!refreshInFlight) {
      const hadToken = accessToken !== null;
      refreshInFlight = doRefresh(hadToken).finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  };

  /** Silent refresh with the cookie on app start. Resolves to the session, or `null` when anonymous. */
  const restoreSession = async (): Promise<Session | null> => {
    const result = await refresh();
    return result.status === 'ok' ? result.session : null;
  };

  // ---- transport -------------------------------------------------------------------------------------

  async function fetchOnce(path: string, opts: RequestOptions, token: string | null, signal: AbortSignal): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    let body: BodyInit | undefined;
    if (opts.formData) {
      body = opts.formData;
    } else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    return doFetch(url(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body,
      credentials: 'include',
      signal,
    });
  }

  /** The error code of a 401 response, read from a clone so the original body stays readable. */
  async function codeOf(res: Response): Promise<string | null> {
    try {
      const body = await readJson(res.clone());
      return isErrorEnvelope(body) ? body.error_code : null;
    } catch {
      return null;
    }
  }

  /**
   * Sends the request with the current token; on 401 UNAUTHORIZED / TOKEN_EXPIRED refreshes once (shared with
   * every other failing request) and retries once. Also ends the session on 403 ACCOUNT_INACTIVE.
   */
  async function sendWithAuth(path: string, opts: RequestOptions, signal: AbortSignal): Promise<Response> {
    const useAuth = opts.auth !== false;
    const tokenUsed = useAuth ? accessToken : null;
    let res = await fetchOnce(path, opts, tokenUsed, signal);

    if (useAuth && tokenUsed && res.status === 401) {
      const code = await codeOf(res);
      if (code === 'UNAUTHORIZED' || code === 'TOKEN_EXPIRED' || code === null) {
        let retry = false;
        if (accessToken !== tokenUsed) {
          // Another request already refreshed (or the session ended) while this one was in flight.
          retry = accessToken !== null;
        } else {
          retry = (await refresh()).status === 'ok';
        }
        if (retry) res = await fetchOnce(path, opts, accessToken, signal);
      }
    }

    if (useAuth && tokenUsed && res.status === 403 && (await codeOf(res)) === 'ACCOUNT_INACTIVE') {
      accessToken = null;
      emit({ type: 'expired', reason: 'inactive' });
    }
    return res;
  }

  /** Runs `read` on the response under a timeout and the caller's abort signal. */
  async function perform<T>(path: string, opts: RequestOptions, read: (res: Response) => Promise<T>): Promise<T> {
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, opts.timeoutMs ?? (opts.formData ? UPLOAD_TIMEOUT_MS : JSON_TIMEOUT_MS));
    const outer = opts.signal;
    const onAbort = () => ctrl.abort();
    if (outer) {
      if (outer.aborted) ctrl.abort();
      else outer.addEventListener('abort', onAbort, { once: true });
    }
    try {
      const res = await sendWithAuth(path, opts, ctrl.signal);
      return await read(res);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (outer?.aborted) throw err; // caller cancelled: let the AbortError through untouched
      if (timedOut) throw new ApiError({ status: 0, code: 'REQUEST_TIMEOUT' });
      throw new ApiError({ status: 0, code: 'NETWORK_ERROR' });
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onAbort);
    }
  }

  async function readEnvelope<T, M>(res: Response): Promise<Envelope<T, M>> {
    const body = await readJson(res);
    if (!res.ok) throw toApiError(res.status, body);
    if (res.status === 204 || body === undefined) return { data: undefined as T, meta: undefined, message: '' };
    const env = body as Partial<SuccessEnvelope<T, M>>;
    if (env.status !== 'success') throw new ApiError({ status: res.status, code: 'INVALID_RESPONSE' });
    return { data: env.data as T, meta: env.meta, message: env.message ?? '' };
  }

  // ---- public request helpers ------------------------------------------------------------------------

  /** Full envelope: data, meta and message. */
  const requestEnvelope = <T, M = undefined>(path: string, opts: RequestOptions = {}): Promise<Envelope<T, M>> =>
    perform(path, opts, (res) => readEnvelope<T, M>(res));

  /** `data` of the envelope. */
  const request = async <T>(path: string, opts: RequestOptions = {}): Promise<T> => (await requestEnvelope<T>(path, opts)).data;

  /** A paginated list: `data` becomes `items`, `meta` is the pagination block. */
  const requestPage = async <T, M = PageMeta>(path: string, opts: RequestOptions = {}): Promise<Page<T, M>> => {
    const env = await requestEnvelope<T[], M>(path, opts);
    return { items: env.data ?? [], meta: env.meta as M };
  };

  const get = <T>(path: string, query?: QueryParams, signal?: AbortSignal) => request<T>(path, { query, signal });
  const getPage = <T, M = PageMeta>(path: string, query?: QueryParams, signal?: AbortSignal) =>
    requestPage<T, M>(path, { query, signal });
  const post = <T>(path: string, body?: unknown, signal?: AbortSignal) => request<T>(path, { method: 'POST', body, signal });
  const patch = <T>(path: string, body: unknown, signal?: AbortSignal) => request<T>(path, { method: 'PATCH', body, signal });
  const del = <T>(path: string, body?: unknown, signal?: AbortSignal) => request<T>(path, { method: 'DELETE', body, signal });
  const upload = <T>(path: string, formData: FormData, opts: { method?: 'POST' | 'PATCH'; signal?: AbortSignal } = {}) =>
    request<T>(path, { method: opts.method ?? 'POST', formData, signal: opts.signal });

  /**
   * Authenticated file download (for endpoints that need the Bearer header, such as the CSV export: a plain link
   * cannot send it). Saves the response through a temporary object URL.
   */
  const download = async (path: string, opts: DownloadOptions = {}): Promise<void> => {
    const { blob, filename } = await perform(path, { query: opts.query, signal: opts.signal, timeoutMs: UPLOAD_TIMEOUT_MS }, async (res) => {
      if (!res.ok) throw toApiError(res.status, await readJson(res));
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
      return { blob: await res.blob(), filename: match?.[1] ? decodeURIComponent(match[1]) : (opts.filename ?? 'unduhan') };
    });
    saveBlob(blob, filename);
  };

  return {
    baseUrl,
    url,
    absoluteUrl,
    getAccessToken,
    setSession,
    clearSession,
    subscribe,
    refresh,
    restoreSession,
    requestEnvelope,
    request,
    requestPage,
    get,
    getPage,
    post,
    patch,
    del,
    upload,
    download,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Triggers a browser download of `blob`. */
export function saveBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/** The app-wide client. Tests build their own with `createApiClient({ fetch })`. */
export const apiClient: ApiClient = createApiClient();

export { ApiError } from './errors';
