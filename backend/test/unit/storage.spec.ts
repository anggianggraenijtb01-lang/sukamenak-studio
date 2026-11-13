import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppError } from '../../src/lib/errors.js';
import { MAX_UPLOAD_BYTES, detectImageMime, makeThumbnail, processUploadedImage } from '../../src/storage/image.js';
import { isValidStorageKey, mimeForKey, newStorageKey } from '../../src/storage/keys.js';
import { createLocalStorage } from '../../src/storage/local.js';
import { presignGetUrl } from '../../src/storage/presign.js';
import { signFileToken, verifyFileToken } from '../../src/storage/signing.js';

const SECRET = 'unit-test-file-signing-secret-0123456789';

describe('signed file tokens', () => {
  it('accepts a fresh token for the same key', () => {
    const token = signFileToken('results/2026-11/a.png', 60, Date.now(), SECRET);
    expect(verifyFileToken('results/2026-11/a.png', token, Date.now(), SECRET)).toBe(true);
  });

  it('rejects an expired token, a token for another key, a tampered token and garbage', () => {
    const now = Date.now();
    const token = signFileToken('a/b.png', 60, now, SECRET);
    expect(verifyFileToken('a/b.png', token, now + 61_000, SECRET)).toBe(false);
    expect(verifyFileToken('a/c.png', token, now, SECRET)).toBe(false);
    const [exp, sig] = token.split('.') as [string, string];
    expect(verifyFileToken('a/b.png', `${Number(exp) + 1000}.${sig}`, now, SECRET)).toBe(false);
    expect(verifyFileToken('a/b.png', `${exp}.${sig.slice(0, -2)}xx`, now, SECRET)).toBe(false);
    expect(verifyFileToken('a/b.png', 'nonsense', now, SECRET)).toBe(false);
    expect(verifyFileToken('a/b.png', undefined, now, SECRET)).toBe(false);
    expect(verifyFileToken('a/b.png', token, now, 'another-secret-another-secret-another')).toBe(false);
  });
});

describe('storage keys', () => {
  it('accepts normal keys and rejects traversal and odd characters', () => {
    expect(isValidStorageKey('seed/posters/poster-kopi.jpg')).toBe(true);
    expect(isValidStorageKey('results/2026-11/3f2b.png')).toBe(true);
    for (const bad of ['', '../etc/passwd', 'a/../b', '/abs', 'a//b', 'a b.png', 'a\\b.png', 'a/./b', '.hidden', 'x/%2e%2e/y']) {
      expect(isValidStorageKey(bad), bad).toBe(false);
    }
  });

  it('builds unguessable keys with the right extension', () => {
    const a = newStorageKey('refs', 'image/webp', new Date('2026-03-05T00:00:00Z'));
    expect(a).toMatch(/^refs\/2026-03\/[0-9a-f-]{36}\.webp$/);
    expect(newStorageKey('refs', 'image/webp')).not.toBe(newStorageKey('refs', 'image/webp'));
    expect(mimeForKey('x/y.jpg')).toBe('image/jpeg');
    expect(mimeForKey('x/y.unknown')).toBe('application/octet-stream');
  });
});

describe('local storage driver', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'sk-local-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes, reads, streams and deletes inside its root', async () => {
    const storage = createLocalStorage(dir, 'http://api.test');
    await storage.put('refs/2026-11/x.png', Buffer.from('hello'), 'image/png');
    expect((await storage.get('refs/2026-11/x.png')).toString()).toBe('hello');
    expect((await readFile(path.join(dir, 'refs/2026-11/x.png'))).toString()).toBe('hello');
    const opened = await storage.open('refs/2026-11/x.png');
    expect(opened?.bytes).toBe(5);
    opened?.stream.resume();
    await storage.delete('refs/2026-11/x.png');
    expect(await storage.open('refs/2026-11/x.png')).toBeNull();
    await storage.delete('refs/2026-11/x.png');
  });

  it('refuses keys that escape the root and only hands out signed URLs', async () => {
    const storage = createLocalStorage(dir, 'http://api.test');
    await expect(storage.put('../escape.png', Buffer.from('x'), 'image/png')).rejects.toThrow();
    const url = storage.url('seed/a b.png'.replace(' ', '_'));
    expect(url).toMatch(/^http:\/\/api\.test\/api\/v1\/files\/seed\/a_b\.png\?token=\d+\./);
  });
});

describe('SigV4 presigned URLs', () => {
  it('matches the AWS documentation example signature', () => {
    // https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
    const url = presignGetUrl({
      endpoint: 'https://s3.amazonaws.com',
      region: 'us-east-1',
      bucket: 'examplebucket',
      key: 'test.txt',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      expiresSeconds: 86400,
      forcePathStyle: false,
      now: new Date('2013-05-24T00:00:00Z'),
    });
    expect(url).toContain('https://examplebucket.s3.amazonaws.com/test.txt?');
    expect(url).toContain('X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404');
  });

  it('uses path-style addressing for MinIO endpoints', () => {
    const url = presignGetUrl({
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      bucket: 'sukamenak',
      key: 'results/2026-11/a b.png'.replace(' ', '_'),
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
      expiresSeconds: 900,
      forcePathStyle: true,
    });
    expect(url).toMatch(/^http:\/\/localhost:9000\/sukamenak\/results\/2026-11\/a_b\.png\?X-Amz-Algorithm=AWS4-HMAC-SHA256/);
    expect(url).toContain('X-Amz-Expires=900');
  });
});

describe('image validation', () => {
  it('detects jpeg, png and webp by magic bytes only', async () => {
    const base = sharp({ create: { width: 64, height: 64, channels: 3, background: '#336699' } });
    expect(detectImageMime(await base.clone().jpeg().toBuffer())).toBe('image/jpeg');
    expect(detectImageMime(await base.clone().png().toBuffer())).toBe('image/png');
    expect(detectImageMime(await base.clone().webp().toBuffer())).toBe('image/webp');
    expect(detectImageMime(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageMime(Buffer.from('MZ\u0090\u0000 not an image'))).toBeNull();
  });

  it('rejects non-images, empty, oversized and implausible dimensions with VALIDATION_ERROR', async () => {
    await expect(processUploadedImage(Buffer.from('not an image'))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(processUploadedImage(Buffer.alloc(0))).rejects.toBeInstanceOf(AppError);
    await expect(processUploadedImage(Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0xff))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const tiny = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toBuffer();
    await expect(processUploadedImage(tiny)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const wide = await sharp({ create: { width: 9000, height: 40, channels: 3, background: '#fff' } }).png().toBuffer();
    await expect(processUploadedImage(wide)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    // Magic bytes of a PNG followed by garbage: passes the signature check, fails decoding.
    await expect(processUploadedImage(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('strips EXIF/GPS metadata and applies the EXIF orientation', async () => {
    const withExif = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#aa5500' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Copyright: 'secret-owner' }, IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '6/1 12/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '106/1 49/1 0/1' } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    expect((await sharp(withExif).metadata()).orientation).toBe(6);

    const processed = await processUploadedImage(withExif);
    const meta = await sharp(processed.buffer).metadata();
    expect(processed.mime).toBe('image/jpeg');
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect(processed.buffer.includes(Buffer.from('secret-owner'))).toBe(false);
    // Orientation 6 means "rotate 90 degrees": a 200x100 file becomes 100x200.
    expect([processed.width, processed.height]).toEqual([100, 200]);
  });

  it('downscales large references and builds webp thumbnails', async () => {
    const big = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#112233' } }).png().toBuffer();
    const processed = await processUploadedImage(big);
    expect(Math.max(processed.width, processed.height)).toBe(2048);
    const thumb = await makeThumbnail(big, 240);
    expect(thumb.mime).toBe('image/webp');
    expect(Math.max(thumb.width, thumb.height)).toBe(240);
    expect((await sharp(thumb.buffer).metadata()).format).toBe('webp');
  });
});
