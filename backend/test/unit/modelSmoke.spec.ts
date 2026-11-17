import { describe, expect, it } from 'vitest';
import { selectSmokeTargets, type SmokeCandidate } from '../../src/tools/modelSmoke.js';

const m = (over: Partial<SmokeCandidate>): SmokeCandidate => ({
  id: over.name ?? 'x',
  name: 'x',
  provider: 'gemini',
  capability: 'i2i',
  keyConfigured: true,
  ...over,
});

describe('selectSmokeTargets', () => {
  const models = [
    m({ name: 'Mock I2I', provider: 'mock' }),
    m({ name: 'Gemini I2I' }),
    m({ name: 'Seedream I2I', provider: 'openai_compat', keyConfigured: false }),
    m({ name: 'Gemini Vision', capability: 'vision' }),
  ];

  it('runs only keyed real models by default', () => {
    const s = selectSmokeTargets(models);
    expect(s.run.map((r) => r.name)).toEqual(['Gemini I2I', 'Gemini Vision']);
    expect(s.skipped.map((r) => [r.candidate.name, r.reason])).toEqual([
      ['Mock I2I', 'mock'],
      ['Seedream I2I', 'no_key'],
    ]);
  });

  it('never calls a model whose key is not set, even with includeMock', () => {
    const s = selectSmokeTargets(models, { includeMock: true });
    expect(s.run.map((r) => r.name)).toEqual(['Mock I2I', 'Gemini I2I', 'Gemini Vision']);
  });

  it('filters by capability before anything else', () => {
    const s = selectSmokeTargets(models, { capability: 'vision' });
    expect(s.run.map((r) => r.name)).toEqual(['Gemini Vision']);
    expect(s.skipped.every((r) => r.reason === 'capability')).toBe(true);
  });
});
