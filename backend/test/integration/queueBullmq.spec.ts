import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { ProviderError } from '../../src/providers/errors.js';
import { mockProvider } from '../../src/providers/mock.js';
import { registerProvider } from '../../src/providers/registry.js';
import { createBullmqQueue, createGenerationWorker } from '../../src/queue/bullmq.js';
import { setQueue } from '../../src/queue/index.js';
import { api, bearer, pool, registerUser, useDatabase } from '../helpers/api.js';
import { eventsOf, postGeneration, successCountToday } from '../helpers/pipeline.js';

useDatabase();

async function redisReachable(): Promise<boolean> {
  const probe = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 0, retryStrategy: () => null, connectTimeout: 1500 });
  probe.on('error', () => undefined);
  try {
    await probe.connect();
    await probe.ping();
    return true;
  } catch {
    return false;
  } finally {
    probe.disconnect();
  }
}

const up = await redisReachable();
if (!up) process.stderr.write('[queueBullmq.spec] Redis is not reachable: bullmq smoke tests are skipped\n');

async function waitForStatus(token: string, id: string, done: string[], timeoutMs = 25_000) {
  const started = Date.now();
  for (;;) {
    const res = await api().get(`/api/v1/generations/${id}`).set(bearer(token));
    if (done.includes(res.body.data.status)) return res.body.data as Record<string, any>;
    if (Date.now() - started > timeoutMs) throw new Error(`generation ${id} stuck in ${res.body.data.status}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

describe.skipIf(!up)('bullmq driver: enqueue -> worker -> pipeline (real Redis)', () => {
  const queueName = `generations-test-${randomUUID().slice(0, 8)}`;
  let queue: ReturnType<typeof createBullmqQueue>;
  let worker: ReturnType<typeof createGenerationWorker>;

  beforeAll(() => {
    queue = createBullmqQueue({ queueName });
    worker = createGenerationWorker({ queueName, concurrency: 2 });
    setQueue(queue);
  });

  afterEach(() => {
    registerProvider(mockProvider);
  });

  afterAll(async () => {
    setQueue(undefined);
    await worker.close();
    await queue.close();
    const cleaner = new Redis(env.REDIS_URL);
    const keys = await cleaner.keys(`bull:${queueName}:*`);
    if (keys.length > 0) await cleaner.del(...keys);
    cleaner.disconnect();
  });

  it('POST /generations only enqueues; the worker runs the pipeline to completion', async () => {
    const user = await registerUser();
    const created = await postGeneration(user, {
      template_slug: 'poster-kegiatan-organisasi',
      slot_values: { title: 'Bazar Desa', date_venue: 'Balai Desa' },
    });
    expect(created.status).toBe(202);
    expect(created.body.data.status).toBe('queued');
    const g = await waitForStatus(user.accessToken, created.body.data.id, ['done', 'failed']);
    expect(g).toMatchObject({ status: 'done', progress_step: 'done', composited_text: true });
    expect((await eventsOf(created.body.data.id)).map((e) => e.stage)).toEqual(['analysis', 'compose', 'generate', 'composite']);
    expect(await successCountToday(user.id)).toBe(1);
  });

  it('retries a transient provider failure with backoff and then succeeds', async () => {
    let calls = 0;
    registerProvider({
      ...mockProvider,
      async generateImage(config, input, opts) {
        calls++;
        if (calls === 1) throw new ProviderError('PROVIDER_RATE_LIMITED');
        return mockProvider.generateImage!(config, input, opts);
      },
    });
    const user = await registerUser();
    const created = await postGeneration(user, { template_slug: 'poster-kegiatan-organisasi', slot_values: { title: 'Retry', date_venue: 'Balai' } });
    const g = await waitForStatus(user.accessToken, created.body.data.id, ['done', 'failed']);
    expect(g.status).toBe('done');
    expect(calls).toBe(2);
    const events = await eventsOf(created.body.data.id);
    expect(events.filter((e) => e.stage === 'generate').map((e) => e.status)).toEqual(['failed', 'ok']);
    expect(await successCountToday(user.id)).toBe(1); // counted once, for the success
  });

  it('does not retry permanent failures and records them on the generation', async () => {
    let calls = 0;
    registerProvider({
      ...mockProvider,
      async generateImage() {
        calls++;
        throw new ProviderError('PROVIDER_CONTENT_BLOCKED');
      },
    });
    const user = await registerUser();
    const created = await postGeneration(user, { template_slug: 'poster-kegiatan-organisasi', slot_values: { title: 'Blok', date_venue: 'Balai' } });
    const g = await waitForStatus(user.accessToken, created.body.data.id, ['done', 'failed']);
    expect(g).toMatchObject({ status: 'failed', error_code: 'PROVIDER_CONTENT_BLOCKED' });
    await new Promise((r) => setTimeout(r, 800));
    expect(calls).toBe(1);
    expect(await successCountToday(user.id)).toBe(0);
  });

  it('gives up after the configured attempts for a persistent transient failure', async () => {
    let calls = 0;
    registerProvider({
      ...mockProvider,
      async generateImage() {
        calls++;
        throw new ProviderError('PROVIDER_UNAVAILABLE');
      },
    });
    const user = await registerUser();
    const created = await postGeneration(user, { template_slug: 'poster-kegiatan-organisasi', slot_values: { title: 'Down', date_venue: 'Balai' } });
    const g = await waitForStatus(user.accessToken, created.body.data.id, ['failed'], 30_000);
    expect(g).toMatchObject({ status: 'failed', error_code: 'PROVIDER_UNAVAILABLE' });
    expect(calls).toBe(env.JOB_MAX_ATTEMPTS);
    const row = (await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM generation_events WHERE generation_id = $1 AND stage = $2', [created.body.data.id, 'generate'])).rows[0];
    expect(row?.n).toBe(env.JOB_MAX_ATTEMPTS);
    expect(await successCountToday(user.id)).toBe(0);
  });
});
