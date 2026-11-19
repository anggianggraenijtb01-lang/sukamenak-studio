import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Deterministic environment for tests. Only DATABASE_URL_TEST may come from the developer's
 * environment (.env); everything else is pinned so results do not depend on local secrets.
 */
export const TEST_ADMIN_PASSWORD = 'Admin-test-pass-1';
export const TEST_DEMO_PASSWORD = 'Demo-test-pass-1';

export const testDatabaseUrl =
  process.env.DATABASE_URL_TEST ?? 'postgres://sukamenak:sukamenak@localhost:5433/sukamenak_test';

/** Generated files of integration tests live here, never in the developer's ./storage. Wiped by global setup. */
export const TEST_STORAGE_DIR = path.join(os.tmpdir(), 'sukamenak-studio-test-storage');

/**
 * Video rendering in tests runs a stand-in script, not Remotion: the endpoints and the job state
 * machine are what these specs cover. The real renderer is typechecked in video/ and rendered
 * manually (see video/README.md).
 */
export const TEST_RENDER_SCRIPT = path.join(TEST_ROOT, 'fixtures', 'fakeRender.mjs');

export const testEnv: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: testDatabaseUrl,
  DATABASE_URL_TEST: testDatabaseUrl,
  REDIS_URL: 'redis://localhost:6379',
  QUEUE_DRIVER: 'inline',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: TEST_STORAGE_DIR,
  FILE_SIGNING_SECRET: 'test-file-signing-secret-0123456789abcdef01',
  PUBLIC_BASE_URL: 'http://localhost:3999',
  JOB_TIMEOUT_MS: '20000',
  JOB_BACKOFF_MS: '200',
  GENERATION_RATE_LIMIT_PER_MINUTE: '10',
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef0123456789',
  JWT_REFRESH_SECRET: 'test-refresh-secret-fedcba9876543210fedcba98765',
  // 32 bytes of 0x07, base64. Test-only key.
  CORE_PROMPT_KEY: Buffer.alloc(32, 7).toString('base64'),
  BCRYPT_COST: '4',
  AUTH_USER_CACHE_TTL_MS: '0',
  RATE_LIMIT_PER_MINUTE: '100000',
  AUTH_RATE_LIMIT_PER_MINUTE: '100000',
  IMPROVE_RATE_LIMIT_PER_MINUTE: '100000',
  ADMIN_TEST_RATE_LIMIT_PER_MINUTE: '100000',
  CORS_ORIGIN: 'http://localhost:5173',
  COOKIE_SECURE: 'false',
  PORT: '3999',
  SEED_ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
  SEED_DEMO_PASSWORD: TEST_DEMO_PASSWORD,
  VIDEO_ENABLED: 'true',
  VIDEO_DAILY_LIMIT: '3',
  VIDEO_MAX_DURATION_SECONDS: '15',
  VIDEO_JOB_TIMEOUT_MS: '20000',
  VIDEO_RENDER_COMMAND: TEST_RENDER_SCRIPT,
};
