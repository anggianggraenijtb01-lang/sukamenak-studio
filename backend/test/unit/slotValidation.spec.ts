import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/lib/errors.js';
import { validateSlotValues, type SlotDef } from '../../src/modules/generations/slotValidation.js';

const slots: SlotDef[] = [
  { key: 'product', label: 'Produk', type: 'text', required: true, default_value: 'a packaged product', options: null, max_length: 20 },
  { key: 'title', label: 'Judul', type: 'text', required: true, default_value: null, options: null, max_length: 10 },
  { key: 'lighting', label: 'Cahaya', type: 'select', required: false, default_value: null, options: [{ value: 'soft', label: 'Lembut' }, { value: 'hard', label: 'Keras' }], max_length: null },
  { key: 'notes', label: 'Catatan', type: 'textarea', required: false, default_value: null, options: null, max_length: null },
];

const errorsOf = (raw: Record<string, string>): { field: string; message: string }[] => {
  try {
    validateSlotValues(slots, raw);
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    return (err as AppError).errors ?? [];
  }
  return [];
};

describe('validateSlotValues', () => {
  it('trims, drops empty values and returns the clean map', () => {
    expect(validateSlotValues(slots, { title: '  Halo  ', product: '   ', lighting: 'soft' })).toEqual({ title: 'Halo', lighting: 'soft' });
  });

  it('requires required slots that have no default (a default satisfies "required")', () => {
    expect(errorsOf({})).toEqual([{ field: 'slot_values.title', message: 'Wajib diisi' }]);
    expect(errorsOf({ title: '   ' }).map((e) => e.field)).toEqual(['slot_values.title']);
  });

  it('rejects unknown keys, over-long values, invalid select options and control characters', () => {
    const errs = errorsOf({ title: 'x'.repeat(11), lighting: 'neon', ghost: 'boo' });
    expect(errs.map((e) => e.field).sort()).toEqual(['slot_values.ghost', 'slot_values.lighting', 'slot_values.title']);
    expect(errorsOf({ title: 'bad\u0000char' })[0]?.field).toBe('slot_values.title');
    expect(errorsOf({ title: 'ok', notes: 'x'.repeat(501) })[0]?.field).toBe('slot_values.notes');
  });

  it('allows newlines in textareas', () => {
    expect(validateSlotValues(slots, { title: 'ok', notes: 'baris 1\r\nbaris 2' }).notes).toBe('baris 1\nbaris 2');
  });
});
