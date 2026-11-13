import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool } from './db/pool.js';
import { logger } from './lib/logger.js';
import { awaitQueueIdle, closeQueue } from './queue/index.js';
import { startRetentionSchedule } from './retention/retention.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV, queue: env.QUEUE_DRIVER, storage: env.STORAGE_DRIVER }, 'api listening');
});

// With the bullmq driver the worker process owns the retention schedule; inline mode has no worker.
const stopRetention = env.QUEUE_DRIVER === 'inline' ? startRetentionSchedule() : () => undefined;

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  stopRetention();
  server.close(async () => {
    try {
      await awaitQueueIdle();
      await closeQueue();
      await closePool();
    } finally {
      process.exit(0);
    }
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled rejection');
});
