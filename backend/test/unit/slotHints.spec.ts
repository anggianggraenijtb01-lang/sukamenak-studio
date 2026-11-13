import { describe, expect, it } from 'vitest';
import { SLOT_HINTS, hintScore, mapRemarksToSlots, matchClauseToSlot } from '../../src/engine/slotHints.js';

const ALL = Object.keys(SLOT_HINTS);

describe('SLOT_HINTS', () => {
  it('covers the canonical slots with Indonesian and English keywords', () => {
    for (const key of ['lighting', 'background', 'color', 'angle', 'composition', 'style', 'pose', 'outfit', 'product']) {
      expect(SLOT_HINTS[key]?.length).toBeGreaterThan(5);
    }
    expect(SLOT_HINTS.color).toContain('warna');
    expect(SLOT_HINTS.color).toContain('colour');
    expect(SLOT_HINTS.lighting).toContain('cahaya');
    expect(SLOT_HINTS.lighting).toContain('lighting');
  });

  it('routes Indonesian clauses', () => {
    expect(matchClauseToSlot('warna oranye hangat', ALL)).toBe('color');
    expect(matchClauseToSlot('cahaya lembut dari samping', ALL)).toBe('lighting');
    expect(matchClauseToSlot('latar meja kayu', ALL)).toBe('background');
    expect(matchClauseToSlot('sudut dari atas', ALL)).toBe('angle');
  });

  it('routes English clauses', () => {
    expect(matchClauseToSlot('warm golden hour light', ALL)).toBe('lighting');
    expect(matchClauseToSlot('minimalist modern style', ALL)).toBe('style');
    expect(matchClauseToSlot('wooden table background', ALL)).toBe('background');
  });

  it('breaks ties by slot priority (a "white background" is a background)', () => {
    expect(matchClauseToSlot('white background', ALL)).toBe('background');
  });

  it('returns null when nothing matches or the slot is unavailable', () => {
    expect(matchClauseToSlot('lorem ipsum dolor', ALL)).toBeNull();
    expect(matchClauseToSlot('warna biru', ['lighting', 'background'])).toBeNull();
    expect(matchClauseToSlot('', ALL)).toBeNull();
  });

  it('maps a multi-clause remark and keeps the unmapped parts', () => {
    const { assigned, unmapped } = mapRemarksToSlots('warna biru laut, cahaya lembut dari samping, ramah dan bersahabat', [
      'color',
      'lighting',
      'remarks',
    ]);
    expect(assigned.color).toBe('warna biru laut');
    expect(assigned.lighting).toBe('cahaya lembut dari samping');
    expect(unmapped).toEqual(['ramah dan bersahabat']);
  });

  it('joins several clauses that land on the same slot', () => {
    const { assigned } = mapRemarksToSlots('warna hangat, warna krem', ['color']);
    expect(assigned.color).toBe('warna hangat, warna krem');
  });

  it('is deterministic', () => {
    const a = mapRemarksToSlots('warm light; blue colour; something odd', ALL);
    const b = mapRemarksToSlots('warm light; blue colour; something odd', ALL);
    expect(a).toEqual(b);
  });

  it('hintScore measures topic coverage', () => {
    expect(hintScore('soft light and warm colour', 'lighting')).toBeGreaterThan(0);
    expect(hintScore('hello', 'lighting')).toBe(0);
    expect(hintScore('hello', 'unknown-slot')).toBe(0);
  });
});
