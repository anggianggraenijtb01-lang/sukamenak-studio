import type { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../lib/errors.js';
import { MAX_UPLOAD_BYTES } from '../storage/image.js';

interface ReceiverLimits {
  fields: number;
  fieldSize: number;
  parts: number;
  /** Multipart field holding the file; defaults to `file`. */
  field?: string;
  /** Per-file size cap; defaults to MAX_UPLOAD_BYTES (8 MB). */
  fileSize?: number;
}

/** Single file field held in memory; multer failures become the API's VALIDATION_ERROR envelope. */
export function createFileReceiver({ field = 'file', fileSize = MAX_UPLOAD_BYTES, ...limits }: ReceiverLimits): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize, files: 1, ...limits },
  });
  const sizeMessage = `Ukuran file maksimal ${Math.round(fileSize / (1024 * 1024))} MB`;
  return (req, res, next) => {
    upload.single(field)(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE' ? sizeMessage : `Unggahan tidak valid: gunakan satu file pada field "${field}"`;
        return next(new AppError('VALIDATION_ERROR', message, { errors: [{ field, message }] }));
      }
      next(err);
    });
  };
}

/** Creator uploads: a handful of short text fields. */
export const receiveFile = createFileReceiver({ fields: 8, fieldSize: 2048, parts: 12 });

/** Profile photo: one `avatar` file, no meaningful text fields, smaller cap than other uploads. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const receiveAvatar = createFileReceiver({ field: 'avatar', fileSize: AVATAR_MAX_BYTES, fields: 2, fieldSize: 256, parts: 3 });

/** Admin uploads may carry longer text fields (for example slot values as JSON). */
export const receiveAdminFile = createFileReceiver({ fields: 16, fieldSize: 8192, parts: 20 });

/** Runs `receiveAdminFile` only for multipart requests; JSON requests pass straight through. */
export const receiveAdminFileIfMultipart: RequestHandler = (req, res, next) => {
  if (req.is('multipart/form-data')) return receiveAdminFile(req, res, next);
  next();
};
