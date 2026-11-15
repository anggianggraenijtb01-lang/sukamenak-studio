import React from 'react';
import { Check, Image as ImageIcon } from 'lucide-react';
import { fileUrl } from '../../api/client';
import type { TemplateListItem } from '../../api/types';
import { categoryLabel } from './labels';

interface TemplatePickerProps {
  templates: TemplateListItem[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  disabled?: boolean;
}

/** Grid of published templates. Selecting one reloads the slot form below it. */
export const TemplatePicker: React.FC<TemplatePickerProps> = ({ templates, selectedSlug, onSelect, disabled }) => (
  <div role="radiogroup" aria-label="Pilih template" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
    {templates.map((t) => {
      const active = t.slug === selectedSlug;
      return (
        <button
          key={t.slug}
          type="button"
          role="radio"
          aria-checked={active}
          disabled={disabled}
          onClick={() => onSelect(t.slug)}
          className={`text-left p-2 rounded-2xl border transition-all cursor-pointer flex items-center gap-2.5 disabled:opacity-60 ${
            active ? 'bg-[#EFF6FF] border-[#2563EB] ring-1 ring-blue-500/20 shadow-xs' : 'bg-[#F8FAFC] border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="w-11 h-14 shrink-0 rounded-lg overflow-hidden bg-slate-200 flex items-center justify-center">
            {t.preview_url ? (
              <img src={fileUrl(t.preview_url)} alt="" loading="lazy" className="w-full h-full object-cover" draggable={false} />
            ) : (
              <ImageIcon className="w-4 h-4 text-slate-400" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className={`text-xs font-black leading-tight line-clamp-2 ${active ? 'text-[#2563EB]' : 'text-[#0F172A]'}`}>{t.name}</div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              {categoryLabel(t.category)} &bull; {t.aspect_ratio}
            </div>
          </div>
          {active && <Check className="w-4 h-4 text-[#2563EB] shrink-0" aria-hidden="true" />}
        </button>
      );
    })}
  </div>
);
