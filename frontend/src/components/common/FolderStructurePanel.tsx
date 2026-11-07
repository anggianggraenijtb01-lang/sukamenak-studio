import React from 'react';
import { FolderTree, FileCode2, Server, LayoutGrid, ShieldCheck } from 'lucide-react';

export const FolderStructurePanel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div className="rounded-2xl bg-[#090D16] border border-[#1E293B] text-[#F8FAFC] p-5 shadow-lg font-mono text-xs">
      <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-[#1E293B]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#60A5FA]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#475569]" />
          </div>
          <FolderTree className="w-4 h-4 text-[#60A5FA]" />
          <span className="font-sans font-bold text-sm text-white">
            4. Struktur Folder Kodingan Proyek (Full-Stack Architecture)
          </span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-[#0F172A] border border-[#2563EB]/50 text-[#60A5FA] text-[11px]">
          TypeScript • Vite • BullMQ • Sharp
        </span>
      </div>

      <div className={`grid ${compact ? 'grid-cols-1 gap-4' : 'grid-cols-1 md:grid-cols-2 gap-5'}`}>
        {/* Modul Frontend */}
        <div className="bg-[#0F172A] rounded-xl p-4 border border-[#1E293B]">
          <div className="flex items-center gap-2 text-[#60A5FA] font-bold mb-2.5 font-sans text-xs uppercase tracking-wider">
            <LayoutGrid className="w-3.5 h-3.5" />
            Modul Frontend (React + Tailwind)
          </div>
          <pre className="text-[11.5px] leading-relaxed text-[#CBD5E1] overflow-x-auto">{`├── public/
├── src/components/
│   ├── common/ (Logo.tsx, StudioContext.tsx)
│   ├── creator/ (AsyncStepper.tsx, CompactnessMeter.tsx)
│   └── admin/ (TextZoneVisualizer.tsx)
├── src/layouts/
│   ├── PublicLayout.tsx
│   ├── CreatorLayout.tsx
│   └── AdminLayout.tsx
├── src/pages/
│   ├── public/ (LandingPage.tsx, Login.tsx, Register.tsx)
│   ├── creator/ (StudioGenerator.tsx, Gallery.tsx,
│   │             Tutorials.tsx, Advisor.tsx)
│   └── admin/ (CorePromptManager.tsx,
│               AdminDashboard.tsx, ModelManager.tsx)
└── src/services/ (api.ts)`}</pre>
        </div>

        {/* Modul Backend */}
        <div className="bg-[#0F172A] rounded-xl p-4 border border-[#1E293B] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#60A5FA] font-bold mb-2.5 font-sans text-xs uppercase tracking-wider">
              <Server className="w-3.5 h-3.5" />
              Modul Backend (Pipelines + Workers)
            </div>
            <pre className="text-[11.5px] leading-relaxed text-[#CBD5E1] overflow-x-auto">{`├── src/controllers/
│   ├── generationController.ts
│   └── adminController.ts
├── src/pipelines/
│   ├── vision.ts            (Step 1: Analisis Vision)
│   ├── i2i.ts               (Step 3: Generasi i2i/t2i)
│   └── textOverlaySharp.ts  (Step 4: Tempel Teks Sharp)
├── src/services/
│   └── aesEncryption.ts     (Step 2: AES-256-GCM Vault)
└── src/workers/
    └── bullmqQueue.ts       (Async Queue Orchestrator)`}</pre>
          </div>

          <div className="mt-3 pt-3 border-t border-[#1E293B] flex items-center justify-between text-[11px] font-sans text-[#94A3B8]">
            <span className="inline-flex items-center gap-1.5 text-[#DBEAFE]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
              AES-256-GCM Write-Only Core Prompt
            </span>
            <span className="inline-flex items-center gap-1 text-[#60A5FA]">
              <FileCode2 className="w-3.5 h-3.5" />
              100% Bebas Biaya / Tanpa Pricing
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

