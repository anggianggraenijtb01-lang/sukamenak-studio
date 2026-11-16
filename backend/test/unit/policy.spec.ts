import { describe, expect, it } from 'vitest';
import {
  assertContentPolicy,
  containsForbiddenWords,
  findBlockedTerms,
  normalizeForMatch,
  stripBlockedTerms,
  stripForbiddenWords,
} from '../../src/engine/policy.js';
import { AppError } from '../../src/lib/errors.js';

const BLOCKED = ['judi online', 'Narkoba', 'nude'];

describe('content policy', () => {
  it('normalises case, diacritics and punctuation', () => {
    expect(normalizeForMatch('  Café--NUDE!! ')).toBe('cafe nude');
  });

  it('finds blocked terms as whole words only', () => {
    expect(findBlockedTerms(['promo JUDI  online besar'], BLOCKED)).toEqual(['judi online']);
    expect(findBlockedTerms(['anti-narkoba campaign'], BLOCKED)).toEqual(['Narkoba']);
    expect(findBlockedTerms(['a nudeness study'], BLOCKED)).toEqual([]);
    expect(findBlockedTerms(['keripik tempe'], BLOCKED)).toEqual([]);
  });

  it('throws CONTENT_POLICY_VIOLATION naming fields but never echoing the term', () => {
    try {
      assertContentPolicy({ title: 'Promo judi online', remarks: 'aman', empty: null }, BLOCKED);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const e = err as AppError;
      expect(e.code).toBe('CONTENT_POLICY_VIOLATION');
      expect(e.status).toBe(422);
      expect(e.errors?.map((x) => x.field)).toEqual(['title']);
      expect(JSON.stringify(e.errors) + e.message).not.toMatch(/judi/i);
    }
  });

  it('passes clean content and an empty blocklist', () => {
    expect(() => assertContentPolicy({ a: 'keripik renyah' }, BLOCKED)).not.toThrow();
    expect(() => assertContentPolicy({ a: 'judi online' }, [])).not.toThrow();
  });

  it('strips blocked terms from free text', () => {
    expect(stripBlockedTerms('dijual murah, JUDI   online, dan narkoba!', BLOCKED)).toBe('dijual murah, , dan !');
    expect(stripBlockedTerms('nudeness stays', BLOCKED)).toBe('nudeness stays');
  });

  it('detects and strips glyph words as whole words only', () => {
    expect(containsForbiddenWords('add some Text here')).toBe(true);
    expect(containsForbiddenWords('a bold Typography style')).toBe(true);
    expect(containsForbiddenWords('big HEADLINE')).toBe(true);
    expect(containsForbiddenWords('context and textured wood')).toBe(false);
    expect(stripForbiddenWords('warm text, bold Typography and a headline.')).toBe('warm, bold and a.');
    expect(containsForbiddenWords(stripForbiddenWords('font caption lettering teks'))).toBe(false);
  });
});
