import React from 'react';
import type { TemplateSlot } from '../../api/types';
import { FieldError } from './StateViews';
import { slotFieldName, slotIsMandatory, slotMaxLength } from './studioLogic';

interface SlotFieldProps {
  slot: TemplateSlot;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
}

const inputClass =
  'w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all disabled:opacity-60';

const HEX = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/i;

/** First hex colour mentioned in a colour value, normalised to #rrggbb for the native colour picker. */
export function hexOf(value: string): string | null {
  const match = HEX.exec(value);
  if (!match) return null;
  const hex = match[0].toLowerCase();
  return hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
}

/** One input of the dynamic form, chosen by the slot's `type` (text, textarea, select, color). */
export const SlotField: React.FC<SlotFieldProps> = ({ slot, value, onChange, error, disabled }) => {
  const id = `slot-${slot.key}`;
  const errId = `${id}-error`;
  const max = slotMaxLength(slot);
  const mandatory = slotIsMandatory(slot);
  const common = {
    id,
    disabled,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errId : undefined,
    'aria-required': slot.required || undefined,
    'data-field': slotFieldName(slot.key),
  } as const;
  const placeholder = mandatory ? 'Wajib diisi' : slot.default_value ? 'Otomatis bila dikosongkan' : '';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-3">
        <label htmlFor={id} className="text-xs font-bold text-[#0F172A]">
          {slot.label}
          {slot.required && <span className="text-[#EA580C]" aria-hidden="true"> *</span>}
          {slot.required && <span className="sr-only"> (wajib)</span>}
        </label>
        {max && slot.type !== 'select' && (
          <span className={`text-[10px] font-mono ${value.length > max ? 'text-[#EA580C] font-bold' : 'text-slate-400'}`}>
            {value.length}/{max}
          </span>
        )}
      </div>

      {slot.type === 'select' ? (
        <select {...common} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} cursor-pointer`}>
          {!mandatory && <option value="">Otomatis (bawaan template)</option>}
          {mandatory && !value && <option value="">Pilih salah satu</option>}
          {(slot.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : slot.type === 'textarea' ? (
        <textarea
          {...common}
          rows={2}
          value={value}
          maxLength={max ?? undefined}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs text-[#0F172A] leading-relaxed resize-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all disabled:opacity-60"
        />
      ) : slot.type === 'color' ? (
        <div className="flex items-center gap-2">
          <input
            {...common}
            type="text"
            value={value}
            maxLength={max ?? undefined}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'Contoh: biru royal atau #2563EB'}
            className={inputClass}
          />
          <input
            type="color"
            aria-label={`Pilih warna untuk ${slot.label}`}
            disabled={disabled}
            value={hexOf(value) ?? '#2563eb'}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="w-10 h-10 shrink-0 rounded-full border border-[#CBD5E1] bg-white p-0.5 cursor-pointer disabled:opacity-60"
          />
        </div>
      ) : (
        <input
          {...common}
          type="text"
          value={value}
          maxLength={max ?? undefined}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
      <FieldError id={errId} message={error} />
    </div>
  );
};
