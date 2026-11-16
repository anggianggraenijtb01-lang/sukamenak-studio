import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { ErrorEnvelope } from '../lib/response.js';
import { zodFieldErrors } from './validate.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError('NOT_FOUND', 'Rute tidak ditemukan'));
};

interface HttpLikeError {
  status?: number;
  statusCode?: number;
  type?: string;
}

/**
 * Single place that turns errors into the API envelope. Unknown errors are logged (redacted)
 * and answered with a generic 500: no stack, message or SQL detail ever reaches the client.
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  if (res.headersSent) return next(err);

  let status = 500;
  let body: ErrorEnvelope = {
    status: 'error',
    message: 'Terjadi kesalahan pada server',
    error_code: 'INTERNAL_ERROR',
  };

  if (err instanceof AppError) {
    status = err.status;
    body = { status: 'error', message: err.message, error_code: err.code };
    if (err.errors?.length) body.errors = err.errors;
  } else if (err instanceof ZodError) {
    status = 400;
    body = {
      status: 'error',
      message: 'Data yang dikirim tidak valid',
      error_code: 'VALIDATION_ERROR',
      errors: zodFieldErrors(err),
    };
  } else if (isHttpError(err)) {
    const code = err.status ?? err.statusCode ?? 400;
    status = code;
    body = {
      status: 'error',
      message:
        err.type === 'entity.too.large'
          ? 'Ukuran data terlalu besar'
          : err.type === 'entity.parse.failed'
            ? 'Format JSON tidak valid'
            : 'Permintaan tidak valid',
      error_code: 'VALIDATION_ERROR',
    };
  } else {
    (req.log ?? logger).error({ err, request_id: req.requestId }, 'unhandled error');
  }

  res.status(status).json(body);
};

function isHttpError(err: unknown): err is HttpLikeError {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as HttpLikeError;
  const code = e.status ?? e.statusCode;
  return typeof code === 'number' && code >= 400 && code < 500;
}
