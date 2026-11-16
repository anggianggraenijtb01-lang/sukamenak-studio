/**
 * Error model of the API layer.
 *
 * - `ApiError` is what every failed call throws (HTTP error envelope, network failure, bad response).
 * - `ERROR_CODES` lists every `error_code` documented in backend/docs/API.md (section 1.3, the stored
 *   generation failure codes and the admin recap). KEEP IT IN SYNC with that document: `errors.test.ts`
 *   checks that every entry has a message and, when the backend docs are present, that every code in the
 *   docs is listed here.
 * - User-facing text always comes from `ERROR_MESSAGES` (fixed Indonesian copy). Raw server text is never
 *   shown, and nothing from a 5xx response ever reaches the screen.
 */

/** Codes the server documents. */
export const SERVER_ERROR_CODES = [
  'VALIDATION_ERROR',
  'EMAIL_EXISTS',
  'INVALID_CREDENTIALS',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'ACCOUNT_INACTIVE',
  'NOT_FOUND',
  'TOO_MANY_REFERENCES',
  'CONTENT_POLICY_VIOLATION',
  'CONSENT_REQUIRED',
  'DAILY_LIMIT_REACHED',
  'RATE_LIMIT_EXCEEDED',
  'NO_MODEL_AVAILABLE',
  'BLANK_SLOT_MISMATCH',
  'UNKNOWN_PLACEHOLDER',
  'CORE_PROMPT_REQUIRED',
  'JOB_TIMEOUT',
  'CANNOT_MODIFY_SELF',
  'LAST_ADMIN',
  'INTERNAL_ERROR',
  // Stored on a failed generation (`error_code`), never an HTTP error.
  'PROVIDER_TIMEOUT',
  'PROVIDER_RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_AUTH',
  'PROVIDER_BAD_REQUEST',
  'PROVIDER_CONTENT_BLOCKED',
  'PROVIDER_BAD_RESPONSE',
  'REFERENCE_UNAVAILABLE',
  'TEMPLATE_UNAVAILABLE',
  // Alias some deployments/proxies use for an expired access token.
  'TOKEN_EXPIRED',
] as const;

/** Codes produced by this client itself (no response, unreadable response, timeout). */
export const CLIENT_ERROR_CODES = ['NETWORK_ERROR', 'REQUEST_TIMEOUT', 'INVALID_RESPONSE'] as const;

export const ERROR_CODES = [...SERVER_ERROR_CODES, ...CLIENT_ERROR_CODES] as const;

export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number];
export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number];
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Data yang dikirim belum sesuai. Periksa kembali isian Anda.',
  EMAIL_EXISTS: 'Email ini sudah terdaftar. Silakan masuk atau gunakan email lain.',
  INVALID_CREDENTIALS: 'Email atau kata sandi salah.',
  UNAUTHORIZED: 'Sesi Anda berakhir. Silakan masuk kembali.',
  FORBIDDEN: 'Anda tidak memiliki izin untuk melakukan tindakan ini.',
  ACCOUNT_INACTIVE: 'Akun Anda dinonaktifkan. Hubungi admin.',
  NOT_FOUND: 'Data yang dicari tidak ditemukan.',
  TOO_MANY_REFERENCES: 'Jumlah foto referensi sudah mencapai batas. Hapus sebagian lalu coba lagi.',
  CONTENT_POLICY_VIOLATION: 'Teks mengandung kata yang tidak diizinkan. Ubah teks Anda lalu coba lagi.',
  CONSENT_REQUIRED: 'Foto manusia memerlukan persetujuan. Centang pernyataan persetujuan terlebih dahulu.',
  DAILY_LIMIT_REACHED: 'Batas harian tercapai. Hubungi admin.',
  RATE_LIMIT_EXCEEDED: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
  NO_MODEL_AVAILABLE: 'Layanan pembuatan gambar sedang tidak tersedia. Coba lagi nanti.',
  BLANK_SLOT_MISMATCH: 'Jumlah isian pada core prompt tidak sama dengan jumlah slot template.',
  UNKNOWN_PLACEHOLDER: 'Core prompt memakai placeholder yang tidak dikenal.',
  CORE_PROMPT_REQUIRED: 'Template ini belum memiliki core prompt aktif.',
  JOB_TIMEOUT: 'Pembuatan gambar terlalu lama dan dihentikan. Silakan coba lagi.',
  CANNOT_MODIFY_SELF: 'Anda tidak dapat mengubah, menonaktifkan, atau menghapus akun Anda sendiri.',
  LAST_ADMIN: 'Tindakan ini ditolak karena akan menghapus admin aktif terakhir.',
  INTERNAL_ERROR: 'Terjadi kesalahan pada server. Silakan coba lagi nanti.',
  PROVIDER_TIMEOUT: 'Penyedia model terlalu lama merespons. Silakan coba lagi.',
  PROVIDER_RATE_LIMITED: 'Penyedia model sedang padat. Silakan coba lagi beberapa saat lagi.',
  PROVIDER_UNAVAILABLE: 'Penyedia model sedang tidak tersedia. Silakan coba lagi nanti.',
  PROVIDER_AUTH: 'Layanan pembuatan gambar sedang bermasalah. Hubungi admin.',
  PROVIDER_BAD_REQUEST: 'Permintaan tidak dapat diproses oleh model. Ubah isian Anda lalu coba lagi.',
  PROVIDER_CONTENT_BLOCKED: 'Permintaan ditolak oleh filter konten model. Ubah isian Anda lalu coba lagi.',
  PROVIDER_BAD_RESPONSE: 'Model mengembalikan hasil yang tidak valid. Silakan coba lagi.',
  REFERENCE_UNAVAILABLE: 'Foto referensi tidak tersedia lagi. Unggah ulang lalu coba lagi.',
  TEMPLATE_UNAVAILABLE: 'Template ini sedang tidak tersedia.',
  TOKEN_EXPIRED: 'Sesi Anda berakhir. Silakan masuk kembali.',
  NETWORK_ERROR: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
  REQUEST_TIMEOUT: 'Server terlalu lama merespons. Silakan coba lagi.',
  INVALID_RESPONSE: 'Respons server tidak dapat dibaca. Silakan coba lagi.',
};

/** Same code, different meaning by status: the admin API answers 409 when an action would leave no usable model. */
const STATUS_OVERRIDES: Partial<Record<ErrorCode, Record<number, string>>> = {
  NO_MODEL_AVAILABLE: {
    409: 'Tindakan ini akan membuat salah satu kemampuan model tidak punya model aktif. Aktifkan model lain terlebih dahulu.',
  },
};

const STATUS_FALLBACK: Array<[(status: number) => boolean, string]> = [
  [(s) => s === 400, 'Permintaan tidak valid.'],
  [(s) => s === 401, ERROR_MESSAGES.UNAUTHORIZED],
  [(s) => s === 403, ERROR_MESSAGES.FORBIDDEN],
  [(s) => s === 404, ERROR_MESSAGES.NOT_FOUND],
  [(s) => s === 429, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED],
  [(s) => s >= 500, ERROR_MESSAGES.INTERNAL_ERROR],
];

export const GENERIC_ERROR_MESSAGE = 'Terjadi kesalahan. Silakan coba lagi.';

export function isKnownErrorCode(code: unknown): code is ErrorCode {
  return typeof code === 'string' && (ERROR_CODES as readonly string[]).includes(code);
}

/**
 * Fixed Indonesian text for a code (and, for unknown codes, for the HTTP status).
 * Never echoes server text; a 5xx always yields the generic server message.
 */
export function messageForCode(code: string | null | undefined, status = 0): string {
  if (isKnownErrorCode(code)) {
    return STATUS_OVERRIDES[code]?.[status] ?? ERROR_MESSAGES[code];
  }
  return STATUS_FALLBACK.find(([match]) => match(status))?.[1] ?? GENERIC_ERROR_MESSAGE;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorInit {
  status: number;
  code: string;
  errors?: FieldError[];
  /** Message the server sent. Kept for debugging only, never rendered (see `message`). */
  serverMessage?: string;
}

export class ApiError extends Error {
  readonly status: number;
  /** A documented `error_code` (see `ERROR_CODES`), or the raw string the server sent for unknown codes. */
  readonly code: ErrorCode | (string & {});
  readonly errors: FieldError[];
  readonly serverMessage?: string;

  constructor(init: ApiErrorInit) {
    // `message` is the safe, user-facing Indonesian text.
    super(messageForCode(init.code, init.status));
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.errors = init.errors ?? [];
    this.serverMessage = init.serverMessage;
  }

  /** `{ field: message }` for form validation. */
  get fieldErrors(): Record<string, string> {
    return fieldErrorMap(this.errors);
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** True when `err` is an ApiError with one of the given codes. */
export function hasErrorCode(err: unknown, ...codes: string[]): boolean {
  return isApiError(err) && codes.includes(err.code);
}

/** `true` for network failures and timeouts: the request may be retried safely. */
export function isTransientError(err: unknown): boolean {
  return isApiError(err) && (err.status === 0 || err.status >= 500 || err.status === 429);
}

export function fieldErrorMap(errors: readonly FieldError[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of errors) {
    if (!(e.field in out)) out[e.field] = e.message;
  }
  return out;
}

/** Message to show for any thrown value. */
export function getErrorMessage(err: unknown): string {
  if (isApiError(err)) return err.message;
  return GENERIC_ERROR_MESSAGE;
}

/** Message for the `error_code` stored on a failed generation. */
export function generationErrorMessage(code: string | null | undefined): string {
  return messageForCode(code ?? 'INTERNAL_ERROR', 0);
}
