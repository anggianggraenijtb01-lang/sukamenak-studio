import { describe, expect, it } from 'vitest';
import type { SlotDef } from '../../src/modules/generations/slotValidation.js';
import { fileToken, RESULT_COLUMNS, sampleSlotValues } from '../../src/tools/benchmark.js';

const slot = (over: Partial<SlotDef>): SlotDef => ({
  key: 'k',
  label: 'Label',
  type: 'text',
  required: false,
  default_value: null,
  options: null,
  max_length: null,
  ...over,
});

describe('sampleSlotValues', () => {
  it('uses the gallery preset first', () => {
    expect(sampleSlotValues([slot({ key: 'title', required: true })], { title: 'Keripik Tempe' })).toEqual({ title: 'Keripik Tempe' });
  });

  it('fills only required slots that have no default', () => {
    const slots = [
      slot({ key: 'title', label: 'Judul', required: true }),
      slot({ key: 'lighting', required: true, default_value: 'soft light' }),
      slot({ key: 'extra' }),
    ];
    expect(sampleSlotValues(slots)).toEqual({ title: 'Judul' });
  });

  it('picks the first option of a required select and cuts to max_length', () => {
    const slots = [
      slot({ key: 'angle', type: 'select', required: true, options: [{ value: 'eye-level', label: 'Sejajar' }, { value: 'top', label: 'Atas' }] }),
      slot({ key: 'title', required: true, max_length: 4 }),
    ];
    expect(sampleSlotValues(slots, { title: 'Keripik' })).toEqual({ angle: 'eye-level', title: 'Keri' });
  });
});

describe('benchmark output', () => {
  it('makes model names safe for file names', () => {
    expect(fileToken('FLUX.1 dev (i2i)')).toBe('flux-1-dev-i2i');
  });

  it('never has a prompt column in results.csv', () => {
    expect(RESULT_COLUMNS.some((c) => /prompt/i.test(c))).toBe(false);
  });
});
