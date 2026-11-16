export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  EMAIL_EXISTS: 409,
  INVALID_CREDENTIALS: 401,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  ACCOUNT_INACTIVE: 403,
  TOO_MANY_REFERENCES: 400,
  CONTENT_POLICY_VIOLATION: 422,
  CONSENT_REQUIRED: 422,
  DAILY_LIMIT_REACHED: 429,
  RATE_LIMIT_EXCEEDED: 429,
  NO_MODEL_AVAILABLE: 503,
  BLANK_SLOT_MISMATCH: 422,
  UNKNOWN_PLACEHOLDER: 422,
  CORE_PROMPT_REQUIRED: 422,
  JOB_TIMEOUT: 504,
  CANNOT_MODIFY_SELF: 409,
  LAST_ADMIN: 409,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export interface FieldError {
  field: string;
  message: string;
}

/**
 * Operational error that is safe to show to the client. `message` and `errors` must never
 * contain prompt bodies, secrets or provider payloads.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly errors?: FieldError[];

  constructor(code: ErrorCode, message: string, opts: { errors?: FieldError[]; status?: number } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = opts.status ?? ERROR_STATUS[code];
    this.errors = opts.errors;
  }
}

export const notFound = (what = 'Data') => new AppError('NOT_FOUND', `${what} tidak ditemukan`);
export const unauthorized = (message = 'Autentikasi diperlukan') => new AppError('UNAUTHORIZED', message);
export const forbidden = (message = 'Anda tidak memiliki akses ke sumber daya ini') =>
  new AppError('FORBIDDEN', message);
