import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { withTimeout } from '../lib/async.js';
import { logger } from '../lib/logger.js';
import { failGeneration } from '../pipeline/failGeneration.js';
import { runGeneration } from '../pipeline/runGeneration.js';
import type { GenerationJob, GenerationQueue } from './types.js';

export interface BullmqOptions {
  queueName?: string;
  redisUrl?: string;
}

const ENQUEUE_TIMEOUT_MS = 5000;

/** Queue side (API process): adds jobs. Retries are configured here so every job carries them. */
export function createBullmqQueue(opts: BullmqOptions = {}): GenerationQueue {
  const connection = new Redis(opts.redisUrl ?? env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', () => undefined);
  const queue = new Queue<GenerationJob>(opts.queueName ?? env.QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: env.JOB_MAX_ATTEMPTS,
      backoff: { type: 'exponential', delay: env.JOB_BACKOFF_MS },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 86_400 },
    },
  });
  queue.on('error', () => undefined);

  return {
    driver: 'bullmq',
    async enqueue(generationId) {
      // jobId = generation id: enqueueing the same generation twice is a no-op.
      await withTimeout(queue.add('generate', { generationId }, { jobId: generationId }), ENQUEUE_TIMEOUT_MS);
    },
    async onIdle() {
      // Jobs run in the worker process; nothing is tracked locally.
    },
    async close() {
      await queue.close();
      connection.disconnect();
    },
  };
}

export interface WorkerOptions extends BullmqOptions {
  concurrency?: number;
}

/**
 * Worker side: processes generation jobs. `runGeneration` records permanent failures on the row and
 * returns; it only throws (TransientJobError) for transient provider errors, which BullMQ retries with
 * the configured backoff. Anything else that escapes marks the generation failed once attempts run out.
 */
export function createGenerationWorker(opts: WorkerOptions = {}): Worker<GenerationJob> {
  const connection = new Redis(opts.redisUrl ?? env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', () => undefined);
  const worker = new Worker<GenerationJob>(
    opts.queueName ?? env.QUEUE_NAME,
    async (job: Job<GenerationJob>) => {
      await runGeneration(job.data.generationId, {
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts ?? 1,
      });
    },
    { connection, concurrency: opts.concurrency ?? env.WORKER_CONCURRENCY },
  );
  worker.on('error', (err) => logger.error({ err_name: err.name }, 'worker error'));
  worker.on('failed', (job, err) => {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    logger.warn({ generation_id: job.data.generationId, attempt: job.attemptsMade, exhausted, err_name: err.name }, 'generation job failed');
    if (exhausted) void failGeneration(job.data.generationId, err.name === 'TransientJobError' ? 'PROVIDER_UNAVAILABLE' : 'INTERNAL_ERROR').catch(() => undefined);
  });
  const close = worker.close.bind(worker);
  worker.close = async (force?: boolean) => {
    await close(force);
    connection.disconnect();
  };
  return worker;
}
