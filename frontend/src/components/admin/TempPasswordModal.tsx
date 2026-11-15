import React, { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Banner, Modal, btnPrimary, btnSecondary } from './ui';

/**
 * Shows a temporary password exactly once. The password only lives in the parent's state while this dialog is open:
 * the parent must drop it in `onClose` (set its state to null). Nothing is written to storage, and the copy button only
 * uses the clipboard.
 */
export const TempPasswordModal: React.FC<{
  email: string;
  password: string;
  title?: string;
  onClose: () => void;
}> = ({ email, password, title = 'Kata sandi sementara', onClose }) => {
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied('ok');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={btnPrimary} data-autofocus>
          Saya sudah menyimpannya
        </button>
      }
    >
      <Banner kind="warning">Kata sandi ini hanya ditampilkan sekali. Setelah dialog ditutup, tidak ada cara untuk melihatnya lagi.</Banner>
      <div className="space-y-1.5">
        <div className="text-[11px] font-bold text-slate-500">Akun: {email}</div>
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#2563EB] shrink-0" aria-hidden="true" />
          <code
            data-testid="temp-password"
            className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#F0F9FF] border border-[#0284C7] text-sm font-mono font-bold text-[#0F172A] break-all select-all"
          >
            {password}
          </code>
          <button type="button" onClick={copy} className={btnSecondary} aria-label="Salin kata sandi sementara">
            {copied === 'ok' ? <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
            {copied === 'ok' ? 'Tersalin' : 'Salin'}
          </button>
        </div>
        {copied === 'failed' && <p className="text-[11px] text-red-600 font-bold">Penyalinan otomatis gagal. Salin manual dari kotak di atas.</p>}
        <p className="text-[11px] text-slate-500">Minta pengguna mengganti kata sandi ini setelah masuk (menu Profil).</p>
      </div>
    </Modal>
  );
};
