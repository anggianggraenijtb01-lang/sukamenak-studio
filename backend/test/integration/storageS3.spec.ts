import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createS3Storage, type S3StorageConfig } from '../../src/storage/s3.js';

// MinIO from docker-compose (throwaway dev credentials). Skipped when it is not reachable.
const config: S3StorageConfig = {
  endpoint: process.env.TEST_S3_ENDPOINT ?? 'http://localhost:9000',
  region: 'us-east-1',
  bucket: process.env.TEST_S3_BUCKET ?? 'sukamenak',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
  forcePathStyle: true,
};

async function minioReady(): Promise<boolean> {
  try {
    const storage = createS3Storage(config);
    const key = `test-probe/${randomUUID()}.png`;
    await storage.put(key, Buffer.from('probe'), 'image/png');
    await storage.delete(key);
    return true;
  } catch {
    return false;
  }
}

const ready = await minioReady();
if (!ready) process.stderr.write('[storageS3.spec] MinIO/bucket not reachable: s3 driver tests are skipped\n');

describe.skipIf(!ready)('s3 storage driver against MinIO', () => {
  it('puts, gets, streams, serves through a presigned URL, and deletes', async () => {
    const storage = createS3Storage(config);
    const key = `test-probe/${randomUUID()}.png`;
    const body = Buffer.from('hello s3 driver');
    await storage.put(key, body, 'image/png');
    try {
      expect((await storage.get(key)).equals(body)).toBe(true);
      const opened = await storage.open(key);
      expect(opened?.bytes).toBe(body.length);
      (opened?.stream as NodeJS.ReadableStream).resume();

      const url = storage.url(key, 60);
      expect(url).toContain('X-Amz-Signature=');
      const res = await fetch(url);
      expect(res.status).toBe(200);
      expect(Buffer.from(await res.arrayBuffer()).equals(body)).toBe(true);
      expect(res.headers.get('content-type')).toBe('image/png');

      // Tampering with the signed URL (another object, or the signature) is refused by the store.
      const other = await fetch(url.replace(key, `test-probe/${randomUUID()}.png`));
      expect(other.status).toBeGreaterThanOrEqual(400);
      const forged = await fetch(url.replace(/X-Amz-Signature=[0-9a-f]{4}/, 'X-Amz-Signature=0000'));
      expect(forged.status).toBe(403);
    } finally {
      await storage.delete(key);
    }
    expect(await storage.open(key)).toBeNull();
    await expect(storage.delete(key)).resolves.toBeUndefined();
    expect((await fetch(storage.url(key, 60))).status).toBe(404);
  });

  it('rejects unsafe keys', async () => {
    const storage = createS3Storage(config);
    await expect(storage.put('../x.png', Buffer.from('x'), 'image/png')).rejects.toThrow();
    expect(() => storage.url('a/../b.png')).toThrow();
  });
});
