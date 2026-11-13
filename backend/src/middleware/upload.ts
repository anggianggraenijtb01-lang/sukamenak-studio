import type { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../lib/errors.js';
import { MAX_UPLOAD_BYTES } from '../storage/image.js';

interface ReceiverLimits {
  fields: number;
  fieldSize: number;
  parts: number;
}

/** Single `file` field held in memory; multer failures become the API's VALIDATION_ERROR envelope. */
export function createFileReceiver(limits: ReceiverLimits): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, ...limits },
  });
  return (req, res, next) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file maksimal 8 MB' : 'Unggahan tidak valid: gunakan satu file pada field "file"';
        return next(new AppError('VALIDATION_ERROR', message, { errors: [{ field: 'file', message }] }));
      }
      next(err);
    });
  };
}

/** Creator uploads: a handful of short text fields. */
export const receiveFile = createFileReceiver({ fields: 8, fieldSize: 2048, parts: 12 });

/** Admin uploads may carry longer text fields (for example slot values as JSON). */
export const receiveAdminFile = createFileReceiver({ fields: 16, fieldSize: 8192, parts: 20 });

/** Runs `receiveAdminFile` only for multipart requests; JSON requests pass straight through. */
export const receiveAdminFileIfMultipart: RequestHandler = (req, res, next) => {
  if (req.is('multipart/form-data')) return receiveAdminFile(req, res, next);
  next();
};
