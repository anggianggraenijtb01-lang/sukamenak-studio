import { AppError, type FieldError } from '../../lib/errors.js';

export interface SlotDef {
  key: string;
  label: string;
  type: string;
  required: boolean;
  default_value: string | null;
  options: unknown;
  max_length: number | null;
}

const DEFAULT_MAX = { text: 200, color: 80, select: 200, textarea: 500 } as const;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f​-‏‪-‮⁠﻿]/;

function optionValues(options: unknown): string[] | null {
  if (!Array.isArray(options) || options.length === 0) return null;
  const values = options
    .map((o) => (o && typeof o === 'object' ? (o as { value?: unknown }).value : undefined))
    .filter((v): v is string => typeof v === 'string');
  return values.length > 0 ? values : null;
}

/**
 * Validates creator-supplied slot values against the template's slot definitions (unknown keys,
 * `max_length`, `select` options, required slots) and returns the trimmed, non-empty values.
 * A required slot is satisfied by a value or by the slot's own default.
 */
export function validateSlotValues(slots: SlotDef[], raw: Record<string, string>): Record<string, string> {
  const errors: FieldError[] = [];
  const byKey = new Map(slots.map((s) => [s.key, s]));
  const values: Record<string, string> = {};
  const rejected = new Set<string>();

  for (const [key, input] of Object.entries(raw)) {
    const field = `slot_values.${key}`;
    const slot = byKey.get(key);
    if (!slot) {
      errors.push({ field, message: 'Slot tidak dikenal untuk template ini' });
      continue;
    }
    const value = input.replace(/\r\n?/g, '\n').trim();
    if (value === '') continue;
    if (CONTROL.test(value)) {
      errors.push({ field, message: 'Mengandung karakter yang tidak diizinkan' });
      rejected.add(key);
      continue;
    }
    const max = slot.max_length ?? DEFAULT_MAX[slot.type as keyof typeof DEFAULT_MAX] ?? 200;
    if (value.length > max) {
      errors.push({ field, message: `Maksimal ${max} karakter` });
      rejected.add(key);
      continue;
    }
    if (slot.type === 'select') {
      const allowed = optionValues(slot.options);
      if (allowed && !allowed.includes(value)) {
        errors.push({ field, message: 'Pilihan tidak valid' });
        rejected.add(key);
        continue;
      }
    }
    values[key] = value;
  }

  for (const slot of slots) {
    if (slot.required && !rejected.has(slot.key) && !values[slot.key] && !slot.default_value?.trim()) {
      errors.push({ field: `slot_values.${slot.key}`, message: 'Wajib diisi' });
    }
  }

  if (errors.length > 0) throw new AppError('VALIDATION_ERROR', 'Data yang dikirim tidak valid', { errors });
  return values;
}
