import { describe, expect, it } from 'vitest';
import { analyzePrompt, heuristicImprove } from '../../src/engine/promptAnalysis.js';

const COMPACT =
  'Keripik tempe renyah dalam kemasan standing pouch, latar meja kayu, cahaya jendela lembut, warna oranye hangat, gaya minimalis bersih, sudut 45 derajat.';
const RAMBLING =
  'tolong buatkan gambar yang sangat sangat bagus dan keren banget gitu, pokoknya bagus, bagus, keren, mungkin sesuatu yang bagus saja ya';

describe('analyzePrompt', () => {
  it('is deterministic', () => {
    expect(analyzePrompt(COMPACT)).toEqual(analyzePrompt(COMPACT));
  });

  it('scores a dense, specific prompt higher than a rambling one', () => {
    const good = analyzePrompt(COMPACT);
    const bad = analyzePrompt(RAMBLING);
    expect(good.score).toBeGreaterThan(bad.score);
    expect(good.score).toBeGreaterThanOrEqual(70);
    expect(bad.score).toBeLessThan(50);
    expect(bad.filler_words.length).toBeGreaterThan(3);
  });

  it('reports covered and missing aspects', () => {
    const a = analyzePrompt(COMPACT);
    expect(a.covered_aspects).toEqual(expect.arrayContaining(['background', 'lighting', 'color', 'angle']));
    expect(a.missing_aspects).not.toContain('lighting');
  });

  it('keeps every number in range and handles empty input', () => {
    for (const text of ['', '   ', 'x', COMPACT, RAMBLING, 'word '.repeat(400)]) {
      const a = analyzePrompt(text);
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(100);
      for (const v of Object.values(a.breakdown)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
    expect(analyzePrompt('').word_count).toBe(0);
    expect(analyzePrompt('').suggestions.length).toBeGreaterThan(0);
  });

  it('penalises very long prompts and repeated terms', () => {
    const long = analyzePrompt('keripik renyah gurih '.repeat(40));
    expect(long.breakdown.length).toBeLessThan(60);
    expect(long.repeated_terms).toContain('keripik');
    expect(long.suggestions.join(' ')).toMatch(/ringkas|pengulangan/);
  });
});

describe('heuristicImprove', () => {
  it('removes filler and adjacent repeats without inventing content', () => {
    const { text, changes } = heuristicImprove('please make a very very nice photo of tempe chips, tempe chips');
    expect(text.toLowerCase()).not.toMatch(/\b(please|very|nice)\b/);
    expect(text.toLowerCase()).toContain('photo of tempe chips');
    expect(changes.length).toBeGreaterThan(0);
    expect(text.toLowerCase().split('tempe chips').length - 1).toBe(1);
  });

  it('raises (or keeps) the score and never grows the prompt', () => {
    const { text } = heuristicImprove(RAMBLING);
    expect(text.length).toBeLessThanOrEqual(RAMBLING.length);
    expect(analyzePrompt(text).score).toBeGreaterThanOrEqual(analyzePrompt(RAMBLING).score);
  });

  it('leaves an already-clean prompt essentially unchanged', () => {
    const { text } = heuristicImprove(COMPACT);
    expect(text.replace(/[.,]/g, '').toLowerCase()).toBe(COMPACT.replace(/[.,]/g, '').toLowerCase());
  });
});
