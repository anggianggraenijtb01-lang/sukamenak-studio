import React from 'react';
import { Gauge, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import { compactnessLabel, type PromptAnalysisState } from './promptAnalysis';

interface CompactnessProps {
  state: PromptAnalysisState;
}

const sourceNote = (state: PromptAnalysisState): string => {
  if (state.view.source === 'none') return 'Belum ada teks';
  if (state.pending) return 'Menganalisis...';
  if (state.view.source === 'server') return 'Analisis server';
  return state.failed ? 'Perkiraan lokal (analisis tidak tersedia)' : 'Perkiraan lokal';
};

/**
 * Compactness meter card (Advisor). The score is the server's `POST /prompts/analyze` result; while it is
 * pending or unavailable a local estimate is shown and labelled as such.
 */
export const CompactnessMeter: React.FC<CompactnessProps> = ({ state }) => {
  const { view } = state;
  const activeBars = Math.round((view.score / 100) * 5);
  const hasText = view.source !== 'none';

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs" aria-live="polite">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-[#2563EB]" />
          <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Prompt Advisor &bull; Compactness Meter</span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]">
          {hasText ? `${compactnessLabel(view.score)} (${view.score}%)` : 'Menunggu teks'}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5 my-2.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((bar) => (
          <div key={bar} className={`h-2 rounded-full transition-all ${hasText && bar <= activeBars ? 'bg-[#2563EB]' : 'bg-[#E2E8F0]'}`} />
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#475569] font-mono mb-2.5">
        <span>Kata: {view.wordCount} kata</span>
        <span>Karakter: {view.charCount}</span>
        <span className="text-[#2563EB] font-semibold flex items-center gap-1">
          {state.pending && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
          {sourceNote(state)}
        </span>
      </div>

      {view.suggestions.length > 0 && (
        <div className="space-y-1.5 bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
          {view.suggestions.map((tip, idx) => (
            <div key={idx} className="flex items-start gap-2 text-[11px] text-[#0F172A]">
              {view.score >= 80 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
              )}
              <span>{tip}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** Slim horizontal variant used under the Studio remarks field (same data, smaller footprint). */
export const CompactnessBar: React.FC<CompactnessProps> = ({ state }) => {
  const { view } = state;
  const hasText = view.source !== 'none';
  return (
    <div className="mt-2 space-y-1" aria-live="polite">
      <div
        className="w-full h-2 rounded-full bg-slate-200 overflow-hidden"
        role="meter"
        aria-label="Skor keringkasan deskripsi"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={hasText ? view.score : 0}
      >
        <div className="h-full bg-[#2563EB] rounded-full transition-all duration-300" style={{ width: `${hasText ? view.score : 0}%` }} />
      </div>
      <div className="flex justify-between gap-3 text-[10px] text-slate-500 font-medium">
        <span>{hasText ? compactnessLabel(view.score) : 'Ringkas & Padat'}</span>
        <span>{hasText ? sourceNote(state) : 'Optimal untuk AI Image Synthesis'}</span>
      </div>
      {hasText && view.suggestions[0] && <p className="text-[10px] text-slate-500 leading-snug">{view.suggestions[0]}</p>}
    </div>
  );
};
