import { describe, expect, it } from 'vitest';
import {
  BLANK_TOKEN,
  NAMED_PLACEHOLDERS,
  countBlanks,
  findUnknownPlaceholders,
  stripPlaceholderTokens,
} from '../../src/engine/placeholders.js';

describe('placeholders', () => {
  it('exposes the blank token and the whitelist', () => {
    expect(BLANK_TOKEN).toBe('[___]');
    expect([...NAMED_PLACEHOLDERS].sort()).toEqual(
      ['aspect_ratio', 'brand_palette', 'negative', 'subject_lock', 'text_zone'].sort(),
    );
  });

  it('counts blanks', () => {
    expect(countBlanks('no blanks here')).toBe(0);
    expect(countBlanks('a [___] b [___] c [___]')).toBe(3);
    expect(countBlanks('[___][___]')).toBe(2);
    expect(countBlanks('[__] is not a blank')).toBe(0);
  });

  it('accepts whitelisted placeholders, with or without inner spaces', () => {
    expect(findUnknownPlaceholders('{{subject_lock}} {{ negative }} {{text_zone}} {{aspect_ratio}} {{brand_palette}}')).toEqual([]);
  });

  it('reports unknown placeholders once, in order', () => {
    expect(findUnknownPlaceholders('{{foo}} {{subject_lock}} {{bar}} {{foo}}')).toEqual(['foo', 'bar']);
  });

  it('reports empty and unbalanced braces', () => {
    expect(findUnknownPlaceholders('{{}}')).toEqual(['']);
    expect(findUnknownPlaceholders('open {{ never closed')).toContain('{{');
    expect(findUnknownPlaceholders('closed }} never opened')).toContain('}}');
  });

  it('strips blank-like and named tokens from user text', () => {
    const cleaned = stripPlaceholderTokens('hello [___] world {{subject_lock}} [ ____ ] {{ x }} {{ end');
    expect(cleaned).not.toMatch(/\[\s*_+\s*\]/);
    expect(cleaned).not.toContain('{{');
    expect(cleaned).not.toContain('}}');
    expect(cleaned.replace(/\s+/g, ' ').trim()).toBe('hello world end');
  });
});
