import React from 'react';
import { Layers } from 'lucide-react';

interface TextZoneVisualizerProps {
  zoneMode: 'Top Header + Bottom CTA' | 'Bottom Card Overlay' | 'Split Editorial Frame';
  onChange?: (mode: 'Top Header + Bottom CTA' | 'Bottom Card Overlay' | 'Split Editorial Frame') => void;
}

const ZONE_MODES: Array<'Top Header + Bottom CTA' | 'Bottom Card Overlay' | 'Split Editorial Frame'> = [
  'Top Header + Bottom CTA',
  'Bottom Card Overlay',
  'Split Editorial Frame',
];

export const TextZoneVisualizer: React.FC<TextZoneVisualizerProps> = ({ zoneMode, onChange }) => {
  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4 text-[#F8FAFC]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#60A5FA]" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            4:5 Text Zone Safe-Area Visualizer
          </span>
        </div>
        <span className="text-[11px] font-mono text-[#60A5FA]">Sharp Typography Engine</span>
      </div>

      {onChange && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {ZONE_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                zoneMode === m
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#090D16] text-[#94A3B8] border border-[#1E293B] hover:border-[#2563EB]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {/* 4:5 Ratio Frame Simulation */}
      <div className="relative mx-auto w-44 aspect-[4/5] rounded-xl bg-[#090D16] border-2 border-[#2563EB] p-2.5 flex flex-col justify-between overflow-hidden">
        {/* Top Safe Zone */}
        <div
          className={`rounded-md border border-dashed px-2 py-1 text-[10px] font-mono text-center transition-all ${
            zoneMode === 'Top Header + Bottom CTA' || zoneMode === 'Split Editorial Frame'
              ? 'border-[#60A5FA] bg-[#2563EB]/25 text-white'
              : 'border-[#334155] text-[#64748B]'
          }`}
        >
          HEADER SAFE ZONE (Y: 86px)
        </div>

        {/* Center Visual Subject Stage */}
        <div className="my-1.5 flex-1 rounded-lg bg-[#0F172A] border border-[#1E293B] flex flex-col items-center justify-center p-2 text-center">
          <span className="text-[10px] font-mono text-[#60A5FA] font-semibold">
            AI SUBJECT STAGE
          </span>
          <span className="text-[9px] text-[#94A3B8] mt-0.5">1080 × 1350 px (4:5)</span>
        </div>

        {/* Bottom Typography Safe Zone */}
        <div
          className={`rounded-md border border-dashed px-2 py-2 text-[10px] font-mono text-center transition-all ${
            zoneMode
              ? 'border-[#60A5FA] bg-[#2563EB]/30 text-white'
              : 'border-[#334155] text-[#64748B]'
          }`}
        >
          SHARP OVERLAY CARD (Y: 960px)
        </div>
      </div>
    </div>
  );
};

