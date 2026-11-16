import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { env } from '../config/env.js';
import { assertStorageKey } from './keys.js';
import { presignGetUrl } from './presign.js';
import type { StorageDriver, StoredObject } from './types.js';

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export function s3ConfigFromEnv(): S3StorageConfig {
  return {
    endpoint: env.S3_ENDPOINT as string,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET as string,
    accessKeyId: env.S3_ACCESS_KEY_ID as string,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  };
}

const isMissing = (err: unknown): boolean => {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === 'NoSuchKey' || e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404;
};

export function createS3Storage(config: S3StorageConfig = s3ConfigFromEnv()): StorageDriver {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const Bucket = config.bucket;

  return {
    name: 's3',
    async put(key, body, mime) {
      assertStorageKey(key);
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: mime, CacheControl: 'private, max-age=300' }));
    },
    async get(key) {
      assertStorageKey(key);
      const res = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      return Buffer.from(await (res.Body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray());
    },
    async open(key): Promise<StoredObject | null> {
      assertStorageKey(key);
      try {
        const res = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        return { stream: res.Body as Readable, bytes: res.ContentLength ?? 0 };
      } catch (err) {
        if (isMissing(err)) return null;
        throw err;
      }
    },
    async delete(key) {
      assertStorageKey(key);
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
    url(key, ttlSeconds = env.FILE_URL_TTL_SECONDS) {
      assertStorageKey(key);
      return presignGetUrl({ ...config, key, expiresSeconds: ttlSeconds });
    },
  };
}
