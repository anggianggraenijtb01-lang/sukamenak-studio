export type ProviderErrorCode =
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_AUTH'
  | 'PROVIDER_BAD_REQUEST'
  | 'PROVIDER_CONTENT_BLOCKED'
  | 'PROVIDER_BAD_RESPONSE'
  | 'PROVIDER_ABORTED';

const MESSAGES: Record<ProviderErrorCode, string> = {
  PROVIDER_TIMEOUT: 'Model provider did not respond in time',
  PROVIDER_RATE_LIMITED: 'Model provider rate limit reached',
  PROVIDER_UNAVAILABLE: 'Model provider is temporarily unavailable',
  PROVIDER_AUTH: 'Model provider rejected the credentials or the key is not configured',
  PROVIDER_BAD_REQUEST: 'Model provider rejected the request',
  PROVIDER_CONTENT_BLOCKED: 'Model provider blocked the content',
  PROVIDER_BAD_RESPONSE: 'Model provider returned an unusable response',
  PROVIDER_ABORTED: 'Model call was cancelled',
};

const TRANSIENT: ReadonlySet<ProviderErrorCode> = new Set(['PROVIDER_TIMEOUT', 'PROVIDER_RATE_LIMITED', 'PROVIDER_UNAVAILABLE']);

/**
 * Sanitised provider failure. The message is a fixed string per code: it never carries the
 * response body, request payload, URL (which may embed a key) or the prompt.
 */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  /** True for failures worth retrying (timeout, 429, 5xx, network). */
  readonly transient: boolean;
  readonly httpStatus?: number;

  constructor(code: ProviderErrorCode, opts: { httpStatus?: number } = {}) {
    super(opts.httpStatus ? `${MESSAGES[code]} (HTTP ${opts.httpStatus})` : MESSAGES[code]);
    this.name = 'ProviderError';
    this.code = code;
    this.transient = TRANSIENT.has(code);
    this.httpStatus = opts.httpStatus;
  }
}

export function providerErrorFromStatus(status: number): ProviderError {
  if (status === 401 || status === 403) return new ProviderError('PROVIDER_AUTH', { httpStatus: status });
  if (status === 408 || status === 504) return new ProviderError('PROVIDER_TIMEOUT', { httpStatus: status });
  if (status === 429) return new ProviderError('PROVIDER_RATE_LIMITED', { httpStatus: status });
  if (status >= 500) return new ProviderError('PROVIDER_UNAVAILABLE', { httpStatus: status });
  return new ProviderError('PROVIDER_BAD_REQUEST', { httpStatus: status });
}

export const isProviderError = (err: unknown): err is ProviderError => err instanceof ProviderError;
