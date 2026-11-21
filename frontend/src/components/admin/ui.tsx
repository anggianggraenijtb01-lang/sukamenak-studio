/**
 * Shared building blocks of the admin pages. They reproduce the visual language that was already used by the mock
 * pages (rounded cards, Royal Blue accent, slate text) so every page can focus on data and behaviour.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, X, XCircle } from 'lucide-react';
import { getErrorMessage } from '../../api/errors';
import type { PageMeta } from '../../api/types';

// ---------------------------------------------------------------------------------------------------
// Class presets
// ---------------------------------------------------------------------------------------------------

export const inputCls =
  'w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed';
export const selectCls = `${inputCls} cursor-pointer`;
export const textareaCls =
  'w-full p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed';
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-black transition-all cursor-pointer shadow-md shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed';
export const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
export const btnOutline =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 hover:border-[#2563EB] hover:text-[#2563EB] text-slate-600 text-xs font-bold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
export const btnDanger =
  'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-black transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
export const cardCls = 'bg-white rounded-3xl border border-slate-200/90 shadow-xs';

// ---------------------------------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------------------------------

interface PageHeaderProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  actions?: React.ReactNode;
  /** The profile page uses a dark icon tile. */
  darkIcon?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ icon, title, description, actions, darkIcon }) => (
  <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] px-6 py-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div className="flex items-center gap-3.5">
      <div
        className={`w-11 h-11 shrink-0 rounded-2xl text-white flex items-center justify-center shadow-md ${
          darkIcon ? 'bg-[#0F172A]' : 'bg-[#2563EB] shadow-blue-500/25'
        }`}
      >
        {icon}
      </div>
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">{title}</h1>
        <p className="text-xs sm:text-sm text-[#475569] mt-0.5">{description}</p>
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">{actions}</div>}
  </div>
);

// ---------------------------------------------------------------------------------------------------
// Notices, loading, empty and error states
// ---------------------------------------------------------------------------------------------------

export type NoticeKind = 'success' | 'error' | 'warning' | 'info';

const NOTICE_STYLE: Record<NoticeKind, { box: string; icon: React.ReactNode }> = {
  success: { box: 'bg-blue-50 border-blue-200 text-[#2563EB]', icon: <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" /> },
  info: { box: 'bg-[#F0F9FF] border-[#0284C7] text-[#0F172A]', icon: <Info className="w-4 h-4 shrink-0 text-[#0369A1]" aria-hidden="true" /> },
  warning: { box: 'bg-amber-50 border-amber-300 text-amber-800', icon: <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" /> },
  error: { box: 'bg-red-50 border-red-200 text-red-700', icon: <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> },
};

export const Banner: React.FC<{
  kind?: NoticeKind;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}> = ({ kind = 'info', children, onDismiss, className = '' }) => {
  const style = NOTICE_STYLE[kind];
  return (
    <div
      role={kind === 'error' || kind === 'warning' ? 'alert' : 'status'}
      className={`p-3.5 rounded-2xl border text-xs font-bold flex items-start gap-2 ${style.box} ${className}`}
    >
      <span className="mt-px">{style.icon}</span>
      <div className="flex-1 min-w-0 break-words">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Tutup pesan" className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer">
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export interface Notice {
  kind: NoticeKind;
  text: string;
}

/** A page-level message: successes fade after a few seconds, errors stay until dismissed or replaced. */
export function useNotice(successMs = 5000) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setNotice(null);
  }, []);

  const show = useCallback(
    (kind: NoticeKind, text: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setNotice({ kind, text });
      if (kind === 'success') timer.current = setTimeout(() => setNotice(null), successMs);
    },
    [successMs],
  );

  const showError = useCallback((err: unknown) => show('error', getErrorMessage(err)), [show]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { notice, show, showError, clear };
}

export const NoticeBanner: React.FC<{ notice: Notice | null; onDismiss: () => void }> = ({ notice, onDismiss }) =>
  notice ? (
    <Banner kind={notice.kind} onDismiss={onDismiss}>
      {notice.text}
    </Banner>
  ) : null;

export const Spinner: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <Loader2 className={`${className} animate-spin`} aria-hidden="true" />
);

export const LoadingBlock: React.FC<{ label?: string; className?: string }> = ({ label = 'Memuat data...', className = '' }) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex items-center justify-center gap-2.5 py-14 text-xs font-bold text-slate-500 ${className}`}
  >
    <Spinner className="w-5 h-5 text-[#2563EB]" />
    <span>{label}</span>
  </div>
);

export const EmptyState: React.FC<{ title: string; hint?: string; action?: React.ReactNode; icon?: React.ReactNode }> = ({
  title,
  hint,
  action,
  icon,
}) => (
  <div className="flex flex-col items-center justify-center text-center gap-2 py-14 px-6">
    {icon && <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">{icon}</div>}
    <div className="text-sm font-extrabold text-[#0F172A]">{title}</div>
    {hint && <p className="text-xs text-slate-500 max-w-md leading-relaxed">{hint}</p>}
    {action}
  </div>
);

export const ErrorState: React.FC<{ error: unknown; onRetry?: () => void; title?: string }> = ({
  error,
  onRetry,
  title = 'Data tidak dapat dimuat',
}) => (
  <div role="alert" className="flex flex-col items-center justify-center text-center gap-2 py-12 px-6">
    <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center">
      <XCircle className="w-6 h-6" aria-hidden="true" />
    </div>
    <div className="text-sm font-extrabold text-[#0F172A]">{title}</div>
    <p className="text-xs text-slate-500 max-w-md">{getErrorMessage(error)}</p>
    {onRetry && (
      <button type="button" onClick={onRetry} className={btnSecondary}>
        Coba lagi
      </button>
    )}
  </div>
);

// ---------------------------------------------------------------------------------------------------
// Form field
// ---------------------------------------------------------------------------------------------------

export const Field: React.FC<{
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ label, htmlFor, error, hint, required, children, className = '' }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="block text-xs font-bold text-[#0F172A] mb-1.5">
      {label}
      {required && <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>}
    </label>
    {children}
    {hint && !error && <p id={`${htmlFor}-hint`} className="text-[11px] text-slate-500 mt-1 leading-relaxed">{hint}</p>}
    {error && (
      <p id={`${htmlFor}-error`} role="alert" className="text-[11px] font-bold text-red-600 mt-1">
        {error}
      </p>
    )}
  </div>
);

// ---------------------------------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------------------------------

const BADGE_TONES = {
  blue: 'bg-blue-50 text-[#2563EB] border-[#BFDBFE]',
  slate: 'bg-slate-100 text-slate-600 border-slate-300',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  dark: 'bg-[#0F172A] text-white border-[#0F172A]',
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export const Badge: React.FC<{ tone?: BadgeTone; children: React.ReactNode; className?: string }> = ({
  tone = 'slate',
  children,
  className = '',
}) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${BADGE_TONES[tone]} ${className}`}
  >
    {children}
  </span>
);

// ---------------------------------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------------------------------

export const Pagination: React.FC<{
  meta: PageMeta | undefined;
  onPage: (page: number) => void;
  busy?: boolean;
  noun?: string;
}> = ({ meta, onPage, busy, noun = 'data' }) => {
  if (!meta) return null;
  const totalPages = Math.max(1, meta.total_pages);
  return (
    <nav aria-label="Navigasi halaman" className="flex flex-wrap items-center justify-between gap-3 px-1 pt-3 text-xs text-slate-600">
      <span>
        {meta.total} {noun} &bull; Halaman <strong>{meta.page}</strong> dari <strong>{totalPages}</strong>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(meta.page - 1)}
          disabled={busy || meta.page <= 1}
          className={btnOutline}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Sebelumnya
        </button>
        <button
          type="button"
          onClick={() => onPage(meta.page + 1)}
          disabled={busy || meta.page >= totalPages}
          className={btnOutline}
          aria-label="Halaman berikutnya"
        >
          Berikutnya
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
};

// ---------------------------------------------------------------------------------------------------
// Modal (in-page replacement for window.alert / confirm / prompt)
// ---------------------------------------------------------------------------------------------------

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const MODAL_WIDTH = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const;

export const Modal: React.FC<{
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof MODAL_WIDTH;
  /** While busy the dialog cannot be dismissed (a request is in flight). */
  busy?: boolean;
}> = ({ title, onClose, children, footer, size = 'md', busy }) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('[data-autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (items.length === 0) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/40 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="min-h-full flex items-center justify-center p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`w-full ${MODAL_WIDTH[size]} bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl space-y-4 outline-none`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h2 id={titleId} className="text-base font-black text-[#0F172A]">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Tutup dialog"
              className="w-7 h-7 shrink-0 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500 cursor-pointer disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-4">{children}</div>
          {footer && <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2.5">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** Confirmation dialog. `onConfirm` may be async: the dialog stays open and shows the error if it throws. */
export const ConfirmModal: React.FC<{
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<unknown> | unknown;
  onClose: () => void;
  /** Wording for a failed `onConfirm` (defaults to the generic Indonesian text of the error code). */
  formatError?: (err: unknown) => string;
}> = ({ title, message, confirmLabel, danger, onConfirm, onClose, formatError }) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const mounted = useRef(true);
  // Re-armed in the effect body: React StrictMode mounts, unmounts and re-mounts every component once in development.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      if (mounted.current) onClose();
    } catch (err) {
      if (mounted.current) {
        setError(err);
        setPending(false);
      }
    }
  };

  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>
            Batal
          </button>
          <button type="button" onClick={run} disabled={pending} data-autofocus className={danger ? btnDanger : btnPrimary}>
            {pending && <Spinner />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">{message}</div>
      {error != null && <Banner kind="error">{formatError ? formatError(error) : getErrorMessage(error)}</Banner>}
    </Modal>
  );
};

/** Section card with an optional heading row. */
export const SectionCard: React.FC<{
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, actions, children, className = '' }) => (
  <section className={`${cardCls} p-6 space-y-4 ${className}`}>
    {(title || actions) && (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          {title && <h2 className="text-sm sm:text-base font-extrabold text-[#0F172A]">{title}</h2>}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </div>
    )}
    {children}
  </section>
);
