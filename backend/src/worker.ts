import { env } from './config/env.js';
import { closePool } from './db/pool.js';
import { logger } from './lib/logger.js';
import { initProviders } from './providers/index.js';
import { createGenerationWorker } from './queue/bullmq.js';
import { startRetentionSchedule } from './retention/retention.js';

/**
 * BullMQ worker process: runs the generation pipeline for queued jobs and the daily retention pass.
 * Run with `npm run worker` (dev) or `node dist/worker.js` next to the API. With QUEUE_DRIVER=inline
 * the API runs jobs itself and no worker is needed.
 */
if (env.QUEUE_DRIVER !== 'bullmq') {
  logger.warn({ queue: env.QUEUE_DRIVER }, 'QUEUE_DRIVER is not "bullmq": the API runs jobs inline, nothing for the worker to do');
  process.exit(0);
}

initProviders();
const worker = createGenerationWorker({ concurrency: env.WORKER_CONCURRENCY });
const stopRetention = startRetentionSchedule();
logger.info({ queue: env.QUEUE_NAME, concurrency: env.WORKER_CONCURRENCY, storage: env.STORAGE_DRIVER }, 'worker started');

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'worker shutting down: finishing active jobs');
  const force = setTimeout(() => process.exit(1), env.JOB_TIMEOUT_MS + 10_000);
  force.unref();
  stopRetention();
  try {
    // Stops taking new jobs and waits for running ones (each bounded by JOB_TIMEOUT_MS).
    await worker.close();
    await closePool();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err_name: (reason as Error)?.name }, 'unhandled rejection');
});
