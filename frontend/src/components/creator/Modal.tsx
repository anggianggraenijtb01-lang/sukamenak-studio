import React, { useEffect, useId, useRef } from 'react';
import { Loader2, X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Disables Escape / backdrop closing while something is being saved. */
  busy?: boolean;
  /** Tailwind max-width class of the card. */
  widthClass?: string;
  eyebrow?: string;
}

/**
 * In-page dialog (never window.alert / confirm / prompt, those block browser automation and cannot be styled).
 * Closes on Escape and on a click on the backdrop; focus moves into the dialog and returns afterwards.
 */
export const Modal: React.FC<ModalProps> = ({ title, onClose, children, busy = false, widthClass = 'max-w-lg', eyebrow }) => {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-white rounded-3xl ${widthClass} w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-4`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            {eyebrow && <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB] block">{eyebrow}</span>}
            <h3 id={titleId} className="text-lg font-black text-[#0F172A] leading-snug">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup"
            className="w-8 h-8 shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

/** Confirmation in a modal. Extra inputs (for example a password field) go in `children`. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Batal',
  danger = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
  children,
}) => (
  <Modal title={title} onClose={onCancel} busy={busy} widthClass="max-w-md">
    <div className="text-sm text-slate-600 leading-relaxed">{message}</div>
    {children}
    {error && (
      <div role="alert" className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-[#EA580C] font-semibold">
        {error}
      </div>
    )}
    <div className="flex items-center justify-end gap-3 pt-1">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-xs font-bold text-slate-700 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors cursor-pointer disabled:opacity-60"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className={`px-5 py-2.5 rounded-xl text-white text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-60 ${
          danger ? 'bg-red-600 hover:bg-red-700 shadow-red-500/25' : 'bg-[#2563EB] hover:bg-[#1D4ED8] shadow-blue-500/25'
        }`}
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        <span>{confirmLabel}</span>
      </button>
    </div>
  </Modal>
);
