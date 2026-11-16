import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, KeyRound, Loader2, LogOut, Mail, Save, ShieldCheck, Store, Trash2 } from 'lucide-react';
import { useAuth, useMe } from '../../auth/AuthProvider';
import { deleteMe, downloadMyData, updateMe } from '../../api/creator';
import { getErrorMessage, isApiError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import type { MeResponse } from '../../api/types';
import { ConfirmDialog } from '../../components/creator/Modal';
import { FieldError } from '../../components/creator/StateViews';

const inputClass =
  'w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all disabled:opacity-60';

const byteLength = (s: string) => new TextEncoder().encode(s).length;

/** Client-side password rules (the server enforces the same: 8 to 72 bytes, confirmation is only a UI check). */
export function validatePasswordChange(current: string, next: string, confirm: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!current) errors.current_password = 'Wajib diisi';
  if (!next) errors.new_password = 'Wajib diisi';
  else if (next.length < 8) errors.new_password = 'Minimal 8 karakter';
  else if (byteLength(next) > 72) errors.new_password = 'Terlalu panjang (maksimal 72 byte)';
  else if (next === current) errors.new_password = 'Kata sandi baru harus berbeda dari yang lama';
  if (next && confirm !== next) errors.confirm_password = 'Konfirmasi tidak sama dengan kata sandi baru';
  return errors;
}

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const NoticeBox: React.FC<{ notice: Notice }> = ({ notice }) =>
  notice ? (
    <div
      role={notice.tone === 'error' ? 'alert' : 'status'}
      className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2 border ${
        notice.tone === 'error' ? 'bg-orange-50 border-orange-200 text-[#EA580C]' : 'bg-blue-50 border-blue-200 text-[#2563EB]'
      }`}
    >
      {notice.tone === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
      <span>{notice.text}</span>
    </div>
  ) : null;

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout, refreshUser } = useAuth();
  const me = useMe();
  const usage = me.data?.usage;
  const isAdmin = user?.role === 'admin';

  // ---- name ----
  const [name, setName] = useState<string | null>(null);
  const shownName = name ?? user?.name ?? '';
  const [nameBusy, setNameBusy] = useState(false);
  const [nameErrors, setNameErrors] = useState<Record<string, string>>({});
  const [nameNotice, setNameNotice] = useState<Notice>(null);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nameBusy) return;
    const trimmed = shownName.trim();
    const local: Record<string, string> = {};
    if (trimmed.length < 2) local.name = 'Minimal 2 karakter';
    else if (trimmed.length > 80) local.name = 'Maksimal 80 karakter';
    setNameErrors(local);
    setNameNotice(null);
    if (Object.keys(local).length > 0) return;
    setNameBusy(true);
    try {
      const res = await updateMe({ name: trimmed });
      queryClient.setQueryData<MeResponse>(queryKeys.me, (old) => (old ? { ...old, user: res.user } : old));
      await refreshUser();
      setName(null);
      setNameNotice({ tone: 'ok', text: 'Nama berhasil disimpan.' });
    } catch (err) {
      if (isApiError(err) && err.errors.length > 0) setNameErrors(err.fieldErrors);
      setNameNotice({ tone: 'error', text: getErrorMessage(err) });
    } finally {
      setNameBusy(false);
    }
  };

  // ---- password ----
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwNotice, setPwNotice] = useState<Notice>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwBusy) return;
    const local = validatePasswordChange(currentPw, newPw, confirmPw);
    setPwErrors(local);
    setPwNotice(null);
    if (Object.keys(local).length > 0) return;
    setPwBusy(true);
    try {
      // `updateMe` applies the fresh session the server returns, so this device stays signed in.
      await updateMe({ current_password: currentPw, new_password: newPw });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwNotice({ tone: 'ok', text: 'Kata sandi berhasil diganti. Perangkat lain otomatis dikeluarkan; perangkat ini tetap masuk.' });
    } catch (err) {
      const fields = isApiError(err) ? { ...err.fieldErrors } : {};
      // A wrong current password answers INVALID_CREDENTIALS; it belongs under that field.
      if (isApiError(err) && err.code === 'INVALID_CREDENTIALS') fields.current_password = 'Kata sandi saat ini salah.';
      setPwErrors(fields);
      setPwNotice(Object.keys(fields).length > 0 ? null : { tone: 'error', text: getErrorMessage(err) });
    } finally {
      setPwBusy(false);
    }
  };

  // ---- export ----
  const [exportBusy, setExportBusy] = useState(false);
  const [exportNotice, setExportNotice] = useState<Notice>(null);
  const handleExport = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    setExportNotice(null);
    try {
      await downloadMyData();
      setExportNotice({ tone: 'ok', text: 'Data Anda diunduh sebagai sukamenak-data-saya.json.' });
    } catch (err) {
      setExportNotice({ tone: 'error', text: getErrorMessage(err) });
    } finally {
      setExportBusy(false);
    }
  };

  // ---- delete account ----
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const closeDelete = () => {
    if (deleteBusy) return;
    setDeleteOpen(false);
    setDeletePw('');
    setDeleteError(null);
  };
  const handleDelete = async () => {
    if (!deletePw) {
      setDeleteError('Masukkan kata sandi Anda untuk mengonfirmasi.');
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteMe(deletePw);
      await logout();
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(isApiError(err) && err.code === 'INVALID_CREDENTIALS' ? 'Kata sandi salah.' : getErrorMessage(err));
      setDeleteBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const initial = (user?.name ?? '').trim().charAt(0).toUpperCase() || '?';
  const roleLabel = isAdmin ? 'Admin Sukamenak' : 'Kreator & Pelaku UMKM';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 sm:p-7 shadow-xs">
        <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">Profil Saya</h1>
        <p className="text-xs sm:text-sm text-[#475569] mt-1 font-normal">Kelola nama, kata sandi, dan data pribadi Anda di Sukamenak Studio.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT PANE: identity */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-7 text-center space-y-5 shadow-sm">
          <div
            className="w-28 h-28 mx-auto rounded-full bg-[#EFF6FF] border-4 border-white text-[#2563EB] flex items-center justify-center font-black text-4xl shadow-lg shadow-blue-500/20"
            aria-hidden="true"
          >
            {initial}
          </div>

          <div>
            <h2 className="font-black text-xl text-[#0F172A]" data-testid="profile-name">
              {user?.name ?? '...'}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">{roleLabel}</p>
          </div>

          <div className="pt-4 border-t border-slate-100 text-left space-y-3 text-xs">
            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Mail className="w-3 h-3 text-[#2563EB]" />
                Alamat Email
              </span>
              <span className="font-semibold text-[#0F172A] block break-all">{user?.email ?? '...'}</span>
            </div>
            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#2563EB]" />
                Kuota Hari Ini
              </span>
              <span className="font-semibold text-[#0F172A] block">
                {usage ? `${usage.remaining_today} dari ${usage.daily_limit} tersisa` : me.isError ? 'Tidak tersedia' : 'Memuat...'}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="w-full py-2.5 px-4 rounded-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-red-600" />
              <span>Keluar dari Akun</span>
            </button>
          </div>
        </div>

        {/* RIGHT PANE */}
        <div className="lg:col-span-8 space-y-6">
          {/* Name */}
          <section className="bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-8 shadow-sm space-y-5" aria-labelledby="profile-name-heading">
            <div className="border-b border-slate-100 pb-3">
              <h3 id="profile-name-heading" className="text-base font-black text-[#0F172A]">
                Data Akun
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Nama ini tampil di pojok kanan atas dan pada data akun Anda.</p>
            </div>
            <form onSubmit={handleSaveName} noValidate className="space-y-4">
              <div>
                <label htmlFor="profile-input-name" className="block text-xs font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-[#2563EB]" />
                  Nama
                </label>
                <input
                  id="profile-input-name"
                  type="text"
                  autoComplete="name"
                  value={shownName}
                  disabled={nameBusy}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama Anda atau nama usaha"
                  aria-invalid={nameErrors.name ? true : undefined}
                  className={inputClass}
                />
                <FieldError message={nameErrors.name} />
              </div>
              <NoticeBox notice={nameNotice} />
              <button
                type="submit"
                disabled={nameBusy || shownName.trim() === (user?.name ?? '')}
                className="w-full sm:w-auto px-8 py-3 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 transition-all cursor-pointer hover:shadow-lg disabled:opacity-60 disabled:pointer-events-none"
              >
                {nameBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Simpan Nama</span>
              </button>
            </form>
          </section>

          {/* Password */}
          <section className="bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-8 shadow-sm space-y-5" aria-labelledby="profile-pw-heading">
            <div className="border-b border-slate-100 pb-3">
              <h3 id="profile-pw-heading" className="text-base font-black text-[#0F172A]">
                Ganti Kata Sandi
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Perlu kata sandi saat ini. Perangkat lain akan dikeluarkan setelah kata sandi diganti.</p>
            </div>
            <form onSubmit={handleChangePassword} noValidate className="space-y-4">
              {(
                [
                  ['profile-pw-current', 'Kata sandi saat ini', currentPw, setCurrentPw, 'current-password', 'current_password'],
                  ['profile-pw-new', 'Kata sandi baru', newPw, setNewPw, 'new-password', 'new_password'],
                  ['profile-pw-confirm', 'Ulangi kata sandi baru', confirmPw, setConfirmPw, 'new-password', 'confirm_password'],
                ] as const
              ).map(([id, label, value, setter, autoComplete, field]) => (
                <div key={id}>
                  <label htmlFor={id} className="block text-xs font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#2563EB]" />
                    {label}
                  </label>
                  <input
                    id={id}
                    type="password"
                    autoComplete={autoComplete}
                    value={value}
                    disabled={pwBusy}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={field === 'new_password' ? 'Minimal 8 karakter' : undefined}
                    aria-invalid={pwErrors[field] ? true : undefined}
                    className={inputClass}
                  />
                  <FieldError message={pwErrors[field]} />
                </div>
              ))}
              <NoticeBox notice={pwNotice} />
              <button
                type="submit"
                disabled={pwBusy}
                className="w-full sm:w-auto px-8 py-3 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 transition-all cursor-pointer hover:shadow-lg disabled:opacity-60 disabled:pointer-events-none"
              >
                {pwBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                <span>Ganti Kata Sandi</span>
              </button>
            </form>
          </section>

          {/* Data and privacy */}
          <section className="bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-8 shadow-sm space-y-4" aria-labelledby="profile-data-heading">
            <div className="border-b border-slate-100 pb-3">
              <h3 id="profile-data-heading" className="text-base font-black text-[#0F172A]">
                Data Saya &amp; Privasi
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Anda berhak mengakses dan membawa data Anda. Pelajari apa yang kami simpan di{' '}
                <Link to="/privasi" className="font-bold text-[#2563EB] hover:underline">
                  Kebijakan Privasi
                </Link>
                .
              </p>
            </div>
            <NoticeBox notice={exportNotice} />
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exportBusy}
              className="px-6 py-3 rounded-full bg-white border border-[#CBD5E1] hover:border-[#2563EB] text-[#2563EB] font-black text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              {exportBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Unduh Data Saya (JSON)</span>
            </button>
          </section>

          {/* Danger zone */}
          <section className="bg-white rounded-3xl border border-red-200 p-6 sm:p-8 shadow-sm space-y-4" aria-labelledby="profile-delete-heading">
            <div className="border-b border-red-100 pb-3">
              <h3 id="profile-delete-heading" className="text-base font-black text-red-700">
                Hapus Akun
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Akun dianonimkan, desain dan foto referensi Anda dihapus, dan Anda dikeluarkan. Tindakan ini tidak bisa dibatalkan.
              </p>
            </div>
            {isAdmin ? (
              <p className="text-xs text-slate-500 font-semibold">Akun admin tidak dapat dihapus sendiri. Minta admin lain untuk mengelola akun ini.</p>
            ) : (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="px-6 py-3 rounded-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-black text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Akun Saya</span>
              </button>
            )}
          </section>
        </div>
      </div>

      {deleteOpen && (
        <ConfirmDialog
          title="Hapus akun Anda?"
          message="Masukkan kata sandi untuk mengonfirmasi. Setelah dihapus, Anda tidak bisa masuk lagi dengan akun ini."
          confirmLabel="Ya, Hapus Akun"
          danger
          busy={deleteBusy}
          error={deleteError}
          onConfirm={() => void handleDelete()}
          onCancel={closeDelete}
        >
          <div>
            <label htmlFor="profile-delete-password" className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Kata sandi
            </label>
            <input
              id="profile-delete-password"
              type="password"
              autoComplete="current-password"
              value={deletePw}
              disabled={deleteBusy}
              onChange={(e) => setDeletePw(e.target.value)}
              className={inputClass}
            />
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
};
export default ProfilePage;
