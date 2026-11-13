import { env } from '../config/env.js';
import { createBullmqQueue } from './bullmq.js';
import { createInlineQueue } from './inline.js';
import type { GenerationQueue } from './types.js';

export type { GenerationJob, GenerationQueue } from './types.js';

let queue: GenerationQueue | undefined;

export function getQueue(): GenerationQueue {
  queue ??= env.QUEUE_DRIVER === 'bullmq' ? createBullmqQueue() : createInlineQueue();
  return queue;
}

/** Test hook: replace (or reset with undefined) the process-wide queue. */
export function setQueue(next: GenerationQueue | undefined): void {
  queue = next;
}

/** Resolves when every locally running job has finished (inline driver); immediate for bullmq. */
export async function awaitQueueIdle(): Promise<void> {
  await queue?.onIdle();
}

export async function closeQueue(): Promise<void> {
  await queue?.close();
  queue = undefined;
}
