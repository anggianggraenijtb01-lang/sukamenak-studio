import { afterEach, describe, expect, it, vi } from 'vitest';

// allowSkip is read once when the helper loads, so every case imports a fresh copy under its own env.
async function load(allow: string | undefined) {
  vi.resetModules();
  if (allow === undefined) vi.stubEnv('TEST_ALLOW_SKIP', '');
  else vi.stubEnv('TEST_ALLOW_SKIP', allow);
  return import('../helpers/requirements.js');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('requireDependency: a missing dependency can never be a silent skip', () => {
  it('returns true when the dependency is available, whatever the flag says', async () => {
    const { requireDependency } = await load(undefined);
    expect(requireDependency(true, 'Redis', 'start it')).toBe(true);
  });

  it('throws with the dependency name and the fix when it is missing and nobody opted out', async () => {
    const { requireDependency } = await load(undefined);
    expect(() => requireDependency(false, 'Redis at redis://x', 'Start it with docker compose.')).toThrow(
      /Redis at redis:\/\/x is not available\. Start it with docker compose\..*TEST_ALLOW_SKIP=1/,
    );
  });

  it.each(['0', 'true', 'yes', ' 1'])('does not treat TEST_ALLOW_SKIP=%j as an opt-out', async (value) => {
    const { requireDependency } = await load(value);
    expect(() => requireDependency(false, 'MinIO', 'start it')).toThrow(/not available/);
  });

  it('skips only with TEST_ALLOW_SKIP=1, and says so on stderr', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const { requireDependency } = await load('1');
    expect(requireDependency(false, 'MinIO', 'Start it.')).toBe(false);
    expect(write).toHaveBeenCalledWith(expect.stringContaining('SKIPPED ON PURPOSE (TEST_ALLOW_SKIP=1): MinIO is not available. Start it.'));
  });
});
