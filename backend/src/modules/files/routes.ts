import { Router } from 'express';
import { pipeline } from 'node:stream/promises';
import { env } from '../../config/env.js';
import { notFound, unauthorized } from '../../lib/errors.js';
import { isValidStorageKey, mimeForKey } from '../../storage/keys.js';
import { verifyFileToken } from '../../storage/signing.js';
import { getStorage } from '../../storage/index.js';

/**
 * Serves stored files for the local driver, and only with a valid unexpired HMAC token bound to
 * the exact key. With the s3 driver clients receive presigned bucket URLs instead, so this route 404s.
 */
export const filesRouter = Router();

filesRouter.get('/*key', async (req, res) => {
  if (env.STORAGE_DRIVER !== 'local') throw notFound('File');
  const parts = (req.params as unknown as { key: string[] }).key;
  const key = Array.isArray(parts) ? parts.join('/') : String(parts);
  if (!isValidStorageKey(key)) throw notFound('File');
  if (!verifyFileToken(key, req.query.token)) throw unauthorized('Tautan file tidak valid atau kedaluwarsa');

  const object = await getStorage().open(key);
  if (!object) throw notFound('File');

  res.setHeader('Content-Type', mimeForKey(key));
  res.setHeader('Content-Length', String(object.bytes));
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Content-Disposition', 'inline');
  await pipeline(object.stream, res);
});
