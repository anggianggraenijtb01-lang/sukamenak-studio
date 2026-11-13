import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { withTimeout } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { ok } from '../../lib/response.js';

export const healthRouter = Router();

type CheckState = 'up' | 'down' | 'skipped';

async function checkDb(): Promise<CheckState> {
  try {
    await withTimeout(pool.query('SELECT 1'), 2000);
    return 'up';
  } catch {
    return 'down';
  }
}

async function checkRedis(): Promise<CheckState> {
  if (env.QUEUE_DRIVER !== 'bullmq') return 'skipped';
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    retryStrategy: () => null,
  });
  client.on('error', () => undefined);
  try {
    await withTimeout(client.connect(), 2500);
    await withTimeout(client.ping(), 2000);
    return 'up';
  } catch {
    return 'down';
  } finally {
    client.disconnect();
  }
}

healthRouter.get('/health', async (_req, res) => {
  const [database, redis] = await Promise.all([checkDb(), checkRedis()]);
  const checks = { database, redis };
  const failed = Object.entries(checks).filter(([, state]) => state === 'down');
  if (failed.length > 0) {
    throw new AppError('INTERNAL_ERROR', 'Layanan belum siap', {
      status: 503,
      errors: failed.map(([component]) => ({ field: component, message: 'tidak dapat dijangkau' })),
    });
  }
  ok(res, { status: 'ok', uptime_seconds: Math.round(process.uptime()), checks }, 'Layanan sehat');
});

const pkg = JSON.parse(
  readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../package.json'), 'utf8'),
) as { name: string; version: string };

healthRouter.get('/meta/version', (_req, res) => {
  ok(res, { name: pkg.name, version: pkg.version, api: 'v1', environment: env.NODE_ENV }, 'Versi');
});
