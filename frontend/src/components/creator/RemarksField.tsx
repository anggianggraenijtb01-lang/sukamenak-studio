import React from 'react';
import { FieldError } from './StateViews';
import { MAX_REMARKS_LENGTH } from './studioLogic';

interface RemarksFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  /** The compactness meter goes here, right under the textarea. */
  children?: React.ReactNode;
}

/** Free "Deskripsi Visual & Petunjuk Prompt" text. Optional: a template works with zero remarks. */
export const RemarksField: React.FC<RemarksFieldProps> = ({ value, onChange, error, disabled, children }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label htmlFor="studio-remarks" className="text-xs font-bold text-[#0F172A]">
        Deskripsi Visual &amp; Petunjuk Prompt <span className="font-medium text-slate-400">(opsional)</span>
      </label>
      <span className="text-[10px] text-slate-400 font-mono">{value.length} Karakter</span>
    </div>
    <textarea
      id="studio-remarks"
      data-field="remarks"
      rows={3}
      value={value}
      maxLength={MAX_REMARKS_LENGTH}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Tuliskan gambaran suasana, cahaya, atau latar yang diinginkan..."
      className="w-full p-3.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs text-[#0F172A] leading-relaxed resize-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all disabled:opacity-60"
    />
    <FieldError message={error} />
    {children}
  </div>
);
