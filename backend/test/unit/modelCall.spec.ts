import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../../src/providers/errors.js';
import type { ModelConfigRecord, ProviderAdapter } from '../../src/providers/types.js';

const resolveModels = vi.fn();
const getProvider = vi.fn();
const warn = vi.fn();

vi.mock('../../src/providers/registry.js', () => ({
  resolveModels: (...args: unknown[]) => resolveModels(...args),
  getProvider: (...args: unknown[]) => getProvider(...args),
}));
vi.mock('../../src/lib/logger.js', () => ({ logger: { warn: (...args: unknown[]) => warn(...args), info: vi.fn(), error: vi.fn() } }));

const { callWithFallback } = await import('../../src/pipeline/modelCall.js');

const model = (provider: string, name: string): ModelConfigRecord =>
  ({ id: `id-${provider}`, name, provider, capability: 't2i' }) as unknown as ModelConfigRecord;

const signal = new AbortController().signal;
const adapter = {} as ProviderAdapter;

describe('callWithFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProvider.mockReturnValue(adapter);
  });

  it('does not log anything when the first model answers', async () => {
    resolveModels.mockResolvedValue([model('cloudflare', 'CF'), model('mock', 'Mock')]);
    const out = await callWithFallback('t2i', signal, async (_a, c) => c.name);
    expect(out.value).toBe('CF');
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs which model failed, with which code, before trying the next one', async () => {
    resolveModels.mockResolvedValue([model('cloudflare', 'CF'), model('mock', 'Mock')]);
    const out = await callWithFallback('t2i', signal, async (_a, c) => {
      if (c.provider === 'cloudflare') throw new ProviderError('PROVIDER_RATE_LIMITED', { httpStatus: 429 });
      return c.name;
    });
    expect(out.value).toBe('Mock');
    expect(out.config.provider).toBe('mock');
    expect(warn).toHaveBeenCalledTimes(1);
    const [fields, message] = warn.mock.calls[0] as [Record<string, unknown>, string];
    expect(fields).toMatchObject({ capability: 't2i', provider: 'cloudflare', model_name: 'CF', code: 'PROVIDER_RATE_LIMITED', http_status: 429, next_model: 'Mock' });
    expect(message).toMatch(/falling back/i);
  });

  it('logs every failed hop and rethrows the last error when all models fail', async () => {
    resolveModels.mockResolvedValue([model('cloudflare', 'CF'), model('fal', 'Fal')]);
    await expect(
      callWithFallback('t2i', signal, async (_a, c) => {
        throw new ProviderError(c.provider === 'cloudflare' ? 'PROVIDER_UNAVAILABLE' : 'PROVIDER_AUTH');
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_AUTH' });
    expect(warn).toHaveBeenCalledTimes(2);
    expect((warn.mock.calls[1] as [Record<string, unknown>])[0]).toMatchObject({ provider: 'fal', code: 'PROVIDER_AUTH', next_model: null });
  });

  it('does not treat a cancelled call as a provider failure', async () => {
    resolveModels.mockResolvedValue([model('cloudflare', 'CF'), model('mock', 'Mock')]);
    await expect(
      callWithFallback('t2i', signal, async () => {
        throw new ProviderError('PROVIDER_ABORTED');
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_ABORTED' });
    expect(warn).not.toHaveBeenCalled();
  });
});
