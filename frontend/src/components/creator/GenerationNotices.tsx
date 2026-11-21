import React from 'react';
import { AlertTriangle, Ban, Clock, Info, ShieldAlert, UserCheck, XCircle } from 'lucide-react';
import { messageForCode } from '../../api/errors';
import { STEPPER_LABELS, stepperStates, type StepState } from './studioLogic';
import type { Generation } from '../../api/types';

// ---- error notice ----------------------------------------------------------------------------------------

export interface GenerationProblem {
  title: string;
  message: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * One clear UI state per error code. Used both for the answer of `POST /generations` and for the `error_code`
 * stored on a failed generation. The text is always fixed Indonesian copy (`messageForCode`), never server text.
 */
export function describeGenerationProblem(code: string | null | undefined): GenerationProblem {
  const message = messageForCode(code ?? 'INTERNAL_ERROR', 0);
  switch (code) {
    case 'DAILY_LIMIT_REACHED':
      return { title: 'Batas harian tercapai', message: `${message} Jatah Anda terisi kembali besok.`, icon: Clock };
    case 'CONSENT_REQUIRED':
      return { title: 'Persetujuan diperlukan', message, icon: UserCheck };
    case 'CONTENT_POLICY_VIOLATION':
    case 'PROVIDER_CONTENT_BLOCKED':
      return { title: 'Konten tidak diizinkan', message, icon: ShieldAlert };
    case 'RATE_LIMIT_EXCEEDED':
    case 'PROVIDER_RATE_LIMITED':
      return { title: 'Terlalu banyak permintaan', message, icon: Clock };
    case 'NO_MODEL_AVAILABLE':
    case 'PROVIDER_UNAVAILABLE':
    case 'PROVIDER_AUTH':
      return { title: 'Layanan sedang tidak tersedia', message, icon: Ban };
    case 'TOO_MANY_REFERENCES':
      return { title: 'Terlalu banyak foto referensi', message, icon: AlertTriangle };
    case 'VALIDATION_ERROR':
      return { title: 'Isian belum sesuai', message, icon: AlertTriangle };
    default:
      return { title: 'Desain belum berhasil dibuat', message, icon: XCircle };
  }
}

export const GenerationErrorNotice: React.FC<{ code: string | null | undefined; className?: string; children?: React.ReactNode }> = ({
  code,
  className = '',
  children,
}) => {
  const problem = describeGenerationProblem(code);
  const Icon = problem.icon;
  return (
    <div role="alert" data-error-code={code ?? ''} className={`p-3.5 rounded-xl bg-orange-50 border border-orange-200 text-xs text-[#EA580C] flex items-start gap-2.5 ${className}`}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <div className="font-black">{problem.title}</div>
        <div className="font-semibold leading-relaxed">{problem.message}</div>
        {children}
      </div>
    </div>
  );
};

/** Gentle notice for `degraded`: the result exists but a stage used its fallback path. */
export const DegradedNotice: React.FC = () => (
  <div role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2 leading-relaxed">
    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
    <span>
      Sebagian tahap memakai jalur cadangan, sehingga hasil mungkin kurang mengikuti foto referensi. Anda bisa mencoba membuat ulang bila kurang sesuai.
    </span>
  </div>
);

// ---- stepper ---------------------------------------------------------------------------------------------

const circleClass = (state: StepState) =>
  state === 'done'
    ? 'bg-[#2563EB] text-white'
    : state === 'running'
      ? 'bg-[#2563EB] text-white animate-pulse ring-4 ring-blue-200'
      : state === 'failed'
        ? 'bg-red-600 text-white'
        : 'bg-slate-200 text-slate-500';

/**
 * The four-step tracker of the Studio. `generation` is the polled object: its `progress_step` decides which
 * step is running (analysis, compose, generate and composite all map onto "Render", done onto "Selesai").
 */
export const GenerationStepper: React.FC<{ generation: Pick<Generation, 'status' | 'progress_step'> | null | undefined }> = ({ generation }) => {
  const states = stepperStates(generation);
  return (
    <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-slate-200">
      <ol className="grid grid-cols-4 gap-2 text-center select-none" aria-label="Tahapan pembuatan desain">
        {STEPPER_LABELS.map((label, i) => {
          const state = states[i];
          return (
            <li key={label} data-step-state={state} aria-current={state === 'running' ? 'step' : undefined} className="flex flex-col items-center gap-1">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${circleClass(state)}`}>
                {state === 'failed' ? '!' : state === 'done' || state === 'running' ? '✓' : i + 1}
              </span>
              <span className={`text-[10px] ${state === 'pending' ? 'text-slate-500' : state === 'failed' ? 'font-black text-red-600' : 'font-black text-[#0F172A]'}`}>
                {label}
              </span>
              <span className="sr-only">
                {state === 'done' ? 'selesai' : state === 'running' ? 'sedang berjalan' : state === 'failed' ? 'gagal' : 'menunggu'}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
