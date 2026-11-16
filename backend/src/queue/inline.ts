import { logger } from '../lib/logger.js';
import { failGeneration } from '../pipeline/failGeneration.js';
import { runGeneration } from '../pipeline/runGeneration.js';
import type { GenerationQueue } from './types.js';

/**
 * Runs jobs inside the API process, asynchronously: `enqueue` returns immediately (the HTTP handler
 * answers 202) and the pipeline starts on the next tick. No retries: this driver is for development
 * and tests. `onIdle()` lets tests await completion of everything that was enqueued.
 */
export function createInlineQueue(): GenerationQueue {
  const pending = new Set<Promise<void>>();

  return {
    driver: 'inline',
    async enqueue(generationId) {
      const job = new Promise<void>((resolve) => {
        setImmediate(() => {
          runGeneration(generationId)
            .then(() => undefined)
            .catch(async (err: unknown) => {
              logger.error({ generation_id: generationId, err_name: (err as Error)?.name }, 'inline generation job crashed');
              await failGeneration(generationId, 'INTERNAL_ERROR').catch(() => undefined);
            })
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
