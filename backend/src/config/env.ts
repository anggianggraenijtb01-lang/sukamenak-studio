import { createHmac } from 'node:crypto';
import 'dotenv/config';
import { z } from 'zod';

const boolish = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const intFromString = (def: number, min = 0) =>
  z.coerce.number().int().min(min).default(def);

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v : undefined));

const secret = z.string().min(32, 'must be at least 32 characters');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: intFromString(3000, 1),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    TRUST_PROXY: intFromString(0),
    APP_TIMEZONE: z.string().min(1).default('Asia/Jakarta'),
    PUBLIC_BASE_URL: optionalString,

    DATABASE_URL: z.string().url(),
    DATABASE_URL_TEST: optionalString,

    REDIS_URL: z.string().url().default('redis://localhost:6379'),
    QUEUE_DRIVER: z.enum(['bullmq', 'inline']).default('inline'),
    QUEUE_NAME: z.string().min(1).default('generations'),
    WORKER_CONCURRENCY: intFromString(2, 1),
    /** Hard limit for one generation job (all stages). Exceeding it fails the job with JOB_TIMEOUT. */
    JOB_TIMEOUT_MS: intFromString(120_000, 1000),
    /** BullMQ attempts per job (1 + retries); only transient provider errors are retried. */
    JOB_MAX_ATTEMPTS: intFromString(3, 1),
    JOB_BACKOFF_MS: intFromString(2000, 0),
    GENERATION_RATE_LIMIT_PER_MINUTE: intFromString(10, 1),
    RETENTION_INTERVAL_MINUTES: intFromString(1440),
    RETENTION_GENERATION_DAYS: intFromString(90, 1),
    RETENTION_HUMAN_REFERENCE_DAYS: intFromString(7, 1),

    JWT_ACCESS_SECRET: secret,
    JWT_REFRESH_SECRET: secret,
    ACCESS_TOKEN_TTL_MINUTES: intFromString(60, 1),
    REFRESH_TOKEN_TTL_DAYS: intFromString(7, 1),
    BCRYPT_COST: intFromString(12, 4),
    COOKIE_SECURE: boolish.optional(),
    AUTH_USER_CACHE_TTL_MS: intFromString(5000),

    CORE_PROMPT_KEY: z.string().min(1),

    STORAGE_DRIVER: z.enum(['s3', 'local']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./storage'),
    S3_ENDPOINT: optionalString,
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: optionalString,
    S3_ACCESS_KEY_ID: optionalString,
    S3_SECRET_ACCESS_KEY: optionalString,
    S3_FORCE_PATH_STYLE: boolish.default('true'),
    /** HMAC secret for signed file URLs (local driver). Derived from JWT_ACCESS_SECRET when unset (required in production). */
    FILE_SIGNING_SECRET: optionalString,
    FILE_URL_TTL_SECONDS: intFromString(900, 30),
    MAX_REFERENCES_PER_USER: intFromString(50, 1),
    REFERENCE_UPLOAD_RATE_LIMIT_PER_MINUTE: intFromString(20, 1),

    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    RATE_LIMIT_PER_MINUTE: intFromString(60, 1),
    AUTH_RATE_LIMIT_PER_MINUTE: intFromString(20, 1),
    IMPROVE_RATE_LIMIT_PER_MINUTE: intFromString(10, 1),
    /** Per admin: model test calls and core prompt test renders per minute (a model test may call a paid API). */
    ADMIN_TEST_RATE_LIMIT_PER_MINUTE: intFromString(10, 1),

    // Provider key variable names only; values are read lazily by providers (Phase B).
    DEEPSEEK_API_KEY: optionalString,
    GEMINI_API_KEY: optionalString,
    OPENAI_API_KEY: optionalString,
    FAL_KEY: optionalString,
    ARK_API_KEY: optionalString,

    SEED_ADMIN_PASSWORD: optionalString,
    SEED_DEMO_PASSWORD: optionalString,
    ADMIN_PASSWORD: optionalString,
  })
  .superRefine((v, ctx) => {
    if (v.JWT_ACCESS_SECRET === v.JWT_REFRESH_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['JWT_REFRESH_SECRET'], message: 'must differ from JWT_ACCESS_SECRET' });
    }
    const key = Buffer.from(v.CORE_PROMPT_KEY, 'base64');
    if (key.length !== 32) {
      ctx.addIssue({ code: 'custom', path: ['CORE_PROMPT_KEY'], message: 'must be 32 bytes, base64-encoded' });
    }
    if (v.NODE_ENV === 'test') {
      if (!v.DATABASE_URL_TEST) {
        ctx.addIssue({ code: 'custom', path: ['DATABASE_URL_TEST'], message: 'is required when NODE_ENV=test' });
      } else if (!/_test$/.test(new URL(v.DATABASE_URL_TEST).pathname.replace(/^\//, ''))) {
        ctx.addIssue({
          code: 'custom',
          path: ['DATABASE_URL_TEST'],
          message: 'database name must end with "_test" (tests truncate all tables)',
        });
      }
    }
    if (v.FILE_SIGNING_SECRET !== undefined && v.FILE_SIGNING_SECRET.length < 32) {
      ctx.addIssue({ code: 'custom', path: ['FILE_SIGNING_SECRET'], message: 'must be at least 32 characters' });
    }
    if (v.NODE_ENV === 'production' && !v.FILE_SIGNING_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['FILE_SIGNING_SECRET'], message: 'is required in production' });
    }
    if (v.STORAGE_DRIVER === 's3') {
      for (const k of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
        if (!v[k]) ctx.addIssue({ code: 'custom', path: [k], message: 'is required when STORAGE_DRIVER=s3' });
      }
    }
    if (v.NODE_ENV === 'production' && v.CORS_ORIGIN.split(',').some((o) => o.trim() === '*')) {
      ctx.addIssue({ code: 'custom', path: ['CORS_ORIGIN'], message: 'wildcard origin is not allowed in production' });
    }
  });

export interface Env extends Omit<z.infer<typeof schema>, 'COOKIE_SECURE' | 'DATABASE_URL'> {
  /** Effective database URL (DATABASE_URL_TEST when NODE_ENV=test). */
  DATABASE_URL: string;
  COOKIE_SECURE: boolean;
  CORS_ORIGINS: string[];
  PUBLIC_BASE_URL: string;
  /** Effective HMAC key for signed file URLs. */
  FILE_SIGNING_KEY: string;
  isProduction: boolean;
  isTest: boolean;
}

/** Parses and validates configuration. Throws with variable names only (never values). */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  const v = parsed.data;
  const isTest = v.NODE_ENV === 'test';
  const isProduction = v.NODE_ENV === 'production';
  return {
    ...v,
    DATABASE_URL: isTest ? (v.DATABASE_URL_TEST as string) : v.DATABASE_URL,
    COOKIE_SECURE: v.COOKIE_SECURE ?? isProduction,
    CORS_ORIGINS: v.CORS_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    PUBLIC_BASE_URL: (v.PUBLIC_BASE_URL ?? `http://localhost:${v.PORT}`).replace(/\/+$/, ''),
    FILE_SIGNING_KEY: v.FILE_SIGNING_SECRET ?? createHmac('sha256', v.JWT_ACCESS_SECRET).update('file-signing:v1').digest('hex'),
    isProduction,
    isTest,
  };
}

export const env: Env = loadEnv();
