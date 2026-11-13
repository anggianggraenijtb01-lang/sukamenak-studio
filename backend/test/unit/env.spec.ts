import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import { testEnv } from '../helpers/testEnv.js';

const valid = (over: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => ({ ...testEnv, ...over }) as NodeJS.ProcessEnv;

describe('loadEnv (fail-fast configuration)', () => {
  it('accepts a complete configuration and applies defaults', () => {
    const env = loadEnv(valid({ PORT: undefined, QUEUE_DRIVER: undefined }));
    expect(env.PORT).toBe(3000);
    expect(env.QUEUE_DRIVER).toBe('inline');
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173']);
    expect(env.isTest).toBe(true);
  });

  it('uses DATABASE_URL_TEST as the effective database in test mode', () => {
    const env = loadEnv(valid({ DATABASE_URL: 'postgres://u:p@h:1/prod', DATABASE_URL_TEST: 'postgres://u:p@h:1/app_test' }));
    expect(env.DATABASE_URL).toBe('postgres://u:p@h:1/app_test');
  });

  it('refuses a test database whose name does not end in _test', () => {
    expect(() => loadEnv(valid({ DATABASE_URL_TEST: 'postgres://u:p@h:1/sukamenak' }))).toThrow(/DATABASE_URL_TEST/);
  });

  it('fails fast naming the variable but never its value', () => {
    try {
      loadEnv(valid({ JWT_ACCESS_SECRET: 'short-secret' }));
      expect.unreachable();
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('JWT_ACCESS_SECRET');
      expect(message).not.toContain('short-secret');
    }
  });

  it('requires distinct JWT secrets and a 32-byte core key', () => {
    expect(() => loadEnv(valid({ JWT_REFRESH_SECRET: testEnv.JWT_ACCESS_SECRET }))).toThrow(/JWT_REFRESH_SECRET/);
    expect(() => loadEnv(valid({ CORE_PROMPT_KEY: Buffer.alloc(16, 1).toString('base64') }))).toThrow(/CORE_PROMPT_KEY/);
    expect(() => loadEnv(valid({ CORE_PROMPT_KEY: undefined }))).toThrow(/CORE_PROMPT_KEY/);
  });

  it('requires S3 settings only for the s3 driver', () => {
    expect(() => loadEnv(valid({ STORAGE_DRIVER: 's3' }))).toThrow(/S3_ENDPOINT/);
    expect(
      loadEnv(
        valid({ STORAGE_DRIVER: 's3', S3_ENDPOINT: 'http://localhost:9000', S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 's' }),
      ).STORAGE_DRIVER,
    ).toBe('s3');
  });

  it('forbids wildcard CORS in production and defaults cookies to Secure there', () => {
    expect(() => loadEnv(valid({ NODE_ENV: 'production', CORS_ORIGIN: '*' }))).toThrow(/CORS_ORIGIN/);
    expect(loadEnv(valid({ NODE_ENV: 'production', COOKIE_SECURE: undefined })).COOKIE_SECURE).toBe(true);
    expect(loadEnv(valid({ NODE_ENV: 'development', COOKIE_SECURE: undefined })).COOKIE_SECURE).toBe(false);
  });

  it('derives a file-signing key when FILE_SIGNING_SECRET is unset, but requires one in production', () => {
    const derived = loadEnv(valid({ FILE_SIGNING_SECRET: undefined }));
    expect(derived.FILE_SIGNING_KEY).toMatch(/^[0-9a-f]{64}$/);
    expect(derived.FILE_SIGNING_KEY).not.toContain(testEnv.JWT_ACCESS_SECRET as string);
    expect(loadEnv(valid()).FILE_SIGNING_KEY).toBe(testEnv.FILE_SIGNING_SECRET);
    expect(() => loadEnv(valid({ FILE_SIGNING_SECRET: 'too-short' }))).toThrow(/FILE_SIGNING_SECRET/);
    expect(() =>
      loadEnv(valid({ NODE_ENV: 'production', FILE_SIGNING_SECRET: undefined, DATABASE_URL: 'postgres://u:p@h:1/prod' })),
    ).toThrow(/FILE_SIGNING_SECRET/);
  });

  it('applies defaults for the Phase B worker, retention and upload settings', () => {
    const env = loadEnv(valid({ JOB_TIMEOUT_MS: undefined, WORKER_CONCURRENCY: undefined, RETENTION_GENERATION_DAYS: undefined, JOB_MAX_ATTEMPTS: undefined }));
    expect(env).toMatchObject({
      JOB_TIMEOUT_MS: 120_000,
      WORKER_CONCURRENCY: 2,
      JOB_MAX_ATTEMPTS: 3,
      RETENTION_GENERATION_DAYS: 90,
      RETENTION_HUMAN_REFERENCE_DAYS: 7,
      QUEUE_NAME: 'generations',
    });
  });
});
