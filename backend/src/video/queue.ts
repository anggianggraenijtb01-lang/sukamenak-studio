import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { withTimeout } from '../lib/async.js';
import { logger } from '../lib/logger.js';
import { runVideoJob } from './runVideoJob.js';

const ENQUEUE_TIMEOUT_MS = 5000;

export interface VideoJob {
  videoJobId: string;
}

export interface VideoQueue {
  readonly driver: 'inline' | 'bullmq';
  enqueue(videoJobId: string): Promise<void>;
  /** Waits for locally running jobs (inline driver only: tests). */
  onIdle(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Video rendering runs in its own worker process with its own queue: a 40-60 s render must never sit
 * in front of a generation job whose p95 is under 1.5 s. The inline driver exists so tests (and a
 * laptop without Redis) can exercise the endpoints without a browser.
 */
function createInlineVideoQueue(): VideoQueue {
  const pending = new Set<Promise<void>>();
  return {
    driver: 'inline',
    async enqueue(videoJobId) {
      const job = new Promise<void>((resolve) => {
        setImmediate(() => {
          runVideoJob(videoJobId)
            .catch((err: unknown) => logger.error({ video_job_id: videoJobId, err_name: (err as Error)?.name }, 'inline video job crashed'))
            .finally(resolve);
        });
      });
      pending.add(job);
      void job.finally(() => pending.delete(job));
    },
    async onIdle() {
      while (pending.size > 0) await Promise.all([...pending]);
    },
    async close() {
      await this.onIdle();
    },
  };
}

function createBullmqVideoQueue(): VideoQueue {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', () => undefined);
  const queue = new Queue<VideoJob>(env.VIDEO_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      // A failed render is not retried automatically: it is expensive and usually deterministic.
      attempts: 1,
      removeOnComplete: { age: 3600, count: 500 },
      removeOnFail: { age: 86_400 },
    },
  });
  queue.on('error', () => undefined);
  return {
    driver: 'bullmq',
    async enqueue(videoJobId) {
      await withTimeout(queue.add('render', { videoJobId }, { jobId: videoJobId }), ENQUEUE_TIMEOUT_MS);
    },
    async onIdle() {
      // Runs in the video worker process.
    },
    async close() {
      await queue.close();
      connection.disconnect();
    },
  };
}

let queue: VideoQueue | undefined;

export function getVideoQueue(): VideoQueue {
  queue ??= env.QUEUE_DRIVER === 'bullmq' ? createBullmqVideoQueue() : createInlineVideoQueue();
  return queue;
}

export async function awaitVideoQueueIdle(): Promise<void> {
  await queue?.onIdle();
}

export async function closeVideoQueue(): Promise<void> {
  await queue?.close();
  queue = undefined;
}

export interface VideoWorkerOptions {
  concurrency?: number;
  redisUrl?: string;
  queueName?: string;
}

/** One render at a time by default: Chrome plus FFmpeg saturate the CPU of a small VPS. */
export function createVideoWorker(opts: VideoWorkerOptions = {}): Worker<VideoJob> {
  const connection = new Redis(opts.redisUrl ?? env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', () => undefined);
  const worker = new Worker<VideoJob>(
    opts.queueName ?? env.VIDEO_QUEUE_NAME,
    async (job: Job<VideoJob>) => {
      await runVideoJob(job.data.videoJobId);
    },
    { connection, concurrency: opts.concurrency ?? env.VIDEO_WORKER_CONCURRENCY },
  );
  worker.on('error', (err) => logger.error({ err_name: err.name }, 'video worker error'));
  worker.on('failed', (job, err) => {
    if (!job) return;
    logger.warn({ video_job_id: job.data.videoJobId, err_name: err.name }, 'video render failed');
  });
  const close = worker.close.bind(worker);
  worker.close = async (force?: boolean) => {
    await close(force);
    connection.disconnect();
  };
  return worker;
}
