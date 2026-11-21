import { Router } from 'express';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { env } from '../../config/env.js';
import { notFound, unauthorized } from '../../lib/errors.js';
import { isValidStorageKey, mimeForKey } from '../../storage/keys.js';
import { verifyFileToken } from '../../storage/signing.js';
import { getStorage } from '../../storage/index.js';

/**
 * Serves stored files for the local driver, and only with a valid unexpired HMAC token bound to
 * the exact key. With the s3 driver clients receive presigned bucket URLs instead, so this route 404s.
 *
 * Range requests are answered with 206 for every file, and are what make a `<video>` seekable:
 * without them the browser downloads the whole mp4 again before it can jump anywhere.
 */
export const filesRouter = Router();

export interface ByteRange {
  start: number;
  end: number;
}

/** Parses one `bytes=start-end` range. Multi-range and malformed headers are ignored (full body, 200). */
export function parseRange(header: string | undefined, size: number): ByteRange | null {
  if (!header || size <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart = '', rawEnd = ''] = match;
  if (rawStart === '' && rawEnd === '') return null;

  let start: number;
  let end: number;
  if (rawStart === '') {
    // Suffix form: the last N bytes.
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Number(rawEnd);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

filesRouter.get('/*key', async (req, res) => {
  if (env.STORAGE_DRIVER !== 'local') throw notFound('File');
  const parts = (req.params as unknown as { key: string[] }).key;
  const key = Array.isArray(parts) ? parts.join('/') : String(parts);
  if (!isValidStorageKey(key)) throw notFound('File');
  if (!verifyFileToken(key, req.query.token)) throw unauthorized('Tautan file tidak valid atau kedaluwarsa');

  const object = await getStorage().open(key);
  if (!object) throw notFound('File');

  const size = object.bytes;
  const range = parseRange(req.headers.range, size);

  res.setHeader('Content-Type', mimeForKey(key));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Content-Disposition', 'inline');

  if (!range) {
    res.setHeader('Content-Length', String(size));
    await pipeline(object.stream, res);
    return;
  }

  res.status(206);
  res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  res.setHeader('Content-Length', String(range.end - range.start + 1));

  // The local driver knows the path, so the range is read straight off disk.
  if (object.filePath) {
    await pipeline(createReadStream(object.filePath, { start: range.start, end: range.end }), res);
    return;
  }

  // A driver without a path can only stream from the start: skip ahead, then stop at the range end.
  await pipeline(
    object.stream,
    async function* slice(source: AsyncIterable<string | Buffer>) {
      let offset = 0;
      for await (const chunk of source) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const chunkStart = offset;
        const chunkEnd = offset + buf.length - 1;
        offset += buf.length;
        if (chunkEnd < range.start) continue;
        if (chunkStart > range.end) return;
        yield buf.subarray(Math.max(0, range.start - chunkStart), Math.min(buf.length, range.end - chunkStart + 1));
      }
    },
    res,
  );
});
