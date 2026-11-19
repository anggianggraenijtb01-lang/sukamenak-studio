import { env } from './config/env.js';
import { closePool } from './db/pool.js';
import { logger } from './lib/logger.js';
import { getStorage } from './storage/index.js';
import { closeVideoQueue, createVideoWorker } from './video/queue.js';

/**
 * BullMQ video worker: renders `video_jobs` rows into mp4 files. A separate process from the
 * generation worker because a render saturates the CPU for ~40-60 s and must not delay image jobs.
 *
 * Uses the API's PostgreSQL and storage configuration; only the queue is different.
 */
if (env.QUEUE_DRIVER !== 'bullmq') {
  logger.warn({ queue: env.QUEUE_DRIVER }, 'QUEUE_DRIVER is not "bullmq": the API renders videos inline, nothing for the video worker to do');
  process.exit(0);
}
if (!env.VIDEO_ENABLED) {
  logger.warn('VIDEO_ENABLED is false: nothing for the video worker to do');
  process.exit(0);
}

// Fail fast on a broken storage configuration instead of on the first job.
getStorage();
const worker = createVideoWorker({ concurrency: env.VIDEO_WORKER_CONCURRENCY });
logger.info({ queue: env.VIDEO_QUEUE_NAME, concurrency: env.VIDEO_WORKER_CONCURRENCY, storage: env.STORAGE_DRIVER }, 'video worker started');

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'video worker shutting down: finishing the active render');
  const force = setTimeout(() => process.exit(1), env.VIDEO_JOB_TIMEOUT_MS + 10_000);
  force.unref();
  try {
    await worker.close();
    await closeVideoQueue();
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
