import React from 'react';
import { Gauge, Sparkles, CheckCircle2 } from 'lucide-react';
import { evaluatePromptCompactness } from '../../services/api';

interface CompactnessMeterProps {
  promptText: string;
}

export const CompactnessMeter: React.FC<CompactnessMeterProps> = ({ promptText }) => {
  const analysis = evaluatePromptCompactness(promptText);
  const activeBars = Math.round((analysis.score / 100) * 5);

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-[#2563EB]" />
          <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
            Prompt Advisor • Compactness Meter
          </span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]">
          {analysis.statusLabel} ({analysis.score}%)
        </span>
      </div>

      {/* 5-segment Royal Blue Compactness Bar */}
      <div className="grid grid-cols-5 gap-1.5 my-2.5">
        {[1, 2, 3, 4, 5].map((bar) => (
          <div
            key={bar}
            className={`h-2 rounded-full transition-all ${
              bar <= activeBars ? 'bg-[#2563EB]' : 'bg-[#E2E8F0]'
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#475569] font-mono mb-2.5">
        <span>Kata: {analysis.wordCount} kata</span>
        <span>Estimasi Token: ~{analysis.tokenEstimate} tok</span>
        <span className="text-[#2563EB] font-semibold">Efisiensi Royal- Grade</span>
      </div>

      <div className="space-y-1.5 bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
        {analysis.suggestions.map((tip, idx) => (
          <div key={idx} className="flex items-start gap-2 text-[11px] text-[#0F172A]">
            {analysis.score >= 80 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
            )}
            <span>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

