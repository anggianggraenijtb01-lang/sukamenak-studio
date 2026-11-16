import React from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { getErrorMessage } from '../../api/errors';

/** Loading state: a spinner with a readable label (announced to screen readers). */
export const LoadingBlock: React.FC<{ label?: string; className?: string }> = ({ label = 'Memuat data...', className = '' }) => (
  <div role="status" aria-live="polite" className={`flex items-center justify-center gap-3 py-14 text-sm text-slate-500 font-semibold ${className}`}>
    <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" aria-hidden="true" />
    <span>{label}</span>
  </div>
);

/** Error state with a retry button. The text always comes from `getErrorMessage` (never raw server text). */
export const ErrorBlock: React.FC<{ error: unknown; onRetry?: () => void; title?: string; className?: string }> = ({
  error,
  onRetry,
  title = 'Data tidak dapat dimuat',
  className = '',
}) => (
  <div role="alert" className={`rounded-3xl border border-orange-200 bg-orange-50 p-6 text-center space-y-3 ${className}`}>
    <AlertTriangle className="w-7 h-7 text-[#EA580C] mx-auto" aria-hidden="true" />
    <div>
      <h3 className="text-sm font-black text-[#0F172A]">{title}</h3>
      <p className="text-xs text-[#EA580C] font-semibold mt-1">{getErrorMessage(error)}</p>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-orange-200 text-xs font-bold text-[#EA580C] hover:bg-orange-100 transition-colors cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Coba Lagi</span>
      </button>
    )}
  </div>
);

/** Empty state: nothing to show yet, with an optional call to action. */
export const EmptyBlock: React.FC<{ title: string; hint?: string; action?: React.ReactNode; className?: string }> = ({
  title,
  hint,
  action,
  className = '',
}) => (
  <div className={`rounded-3xl border border-dashed border-[#CBD5E1] bg-white p-10 text-center space-y-3 ${className}`}>
    <Inbox className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
    <div>
      <h3 className="text-sm font-black text-[#0F172A]">{title}</h3>
      {hint && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{hint}</p>}
    </div>
    {action}
  </div>
);

/** Inline field message under an input. */
export const FieldError: React.FC<{ id?: string; message?: string | null }> = ({ id, message }) =>
  message ? (
    <p id={id} role="alert" className="mt-1 text-[11px] font-semibold text-[#EA580C]">
      {message}
    </p>
  ) : null;
