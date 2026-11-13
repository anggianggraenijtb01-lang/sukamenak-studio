import { AppError } from '../lib/errors.js';
import { isProviderError } from '../providers/errors.js';

/** Failure of a pipeline step that is not a provider or application error (for example a missing reference file). */
export class PipelineError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'PipelineError';
    this.code = code;
  }
}

/** The job ran past JOB_TIMEOUT_MS. */
export class JobTimeoutError extends Error {
  constructor() {
    super('Pembuatan gambar melebihi batas waktu');
    this.name = 'JobTimeoutError';
  }
}

/** Thrown out of runGeneration when the queue should retry the job (transient provider failure, attempts left). */
export class TransientJobError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`Transient failure: ${code}`);
    this.name = 'TransientJobError';
    this.code = code;
  }
}

export interface FailureInfo {
  /** Stored in `generations.error_code` and `generation_events.error_code`. */
  code: string;
  /** Sanitised: safe to store and to show to an operator. Never contains prompts, keys or provider bodies. */
  message: string;
  transient: boolean;
  /** True for unexpected errors that deserve a log line. */
  unexpected: boolean;
}

export function describeFailure(err: unknown, timedOut: boolean): FailureInfo {
  if (timedOut || err instanceof JobTimeoutError) {
    return { code: 'JOB_TIMEOUT', message: 'Pembuatan gambar melebihi batas waktu', transient: false, unexpected: false };
  }
  if (isProviderError(err)) return { code: err.code, message: err.message, transient: err.transient, unexpected: false };
  if (err instanceof AppError) return { code: err.code, message: err.message, transient: false, unexpected: false };
  if (err instanceof PipelineError) return { code: err.code, message: err.message, transient: false, unexpected: false };
  return { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan internal saat memproses gambar', transient: false, unexpected: true };
}
