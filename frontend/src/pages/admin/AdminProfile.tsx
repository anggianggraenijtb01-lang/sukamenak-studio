import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { updateMe } from '../../api/creator';
import { toFormError } from '../../components/admin/adminErrors';
import { formatDateTime } from '../../components/admin/format';
import { Banner, Field, NoticeBanner, PageHeader, Spinner, btnPrimary, inputCls, useNotice } from '../../components/admin/ui';
import { Calendar, KeyRound, LogOut, Lock, Mail, Save, ShieldCheck, User } from 'lucide-react';

const MIN_PASSWORD = 8;
const MAX_PASSWORD_BYTES = 72;
const byteLength = (s: string) => new TextEncoder().encode(s).length;

/** Up to two initials of a display name. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'A';
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

export const AdminProfile: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const { notice, show, clear } = useNotice();

  const [name, setName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const local: Record<string, string> = {};
    const nameChanged = name.trim() !== user.name;
    const wantsPassword = newPassword !== '' || currentPassword !== '' || confirmPassword !== '';
    if (name.trim().length < 2 || name.trim().length > 80) local.name = 'Nama 2-80 karakter.';
    if (wantsPassword) {
      if (!currentPassword) local.current_password = 'Kata sandi saat ini wajib diisi untuk mengganti kata sandi.';
      if (newPassword.length < MIN_PASSWORD) local.new_password = `Kata sandi baru minimal ${MIN_PASSWORD} karakter.`;
      else if (byteLength(newPassword) > MAX_PASSWORD_BYTES) local.new_password = `Kata sandi baru maksimal ${MAX_PASSWORD_BYTES} byte.`;
      if (newPassword !== confirmPassword) local.confirm_password = 'Konfirmasi tidak sama dengan kata sandi baru.';
    }
    if (!nameChanged && !wantsPassword) {
      setError({ message: 'Tidak ada perubahan untuk disimpan.', fields: {} });
      return;
    }
    if (Object.keys(local).length > 0) {
      setError({ message: 'Periksa kembali isian yang ditandai.', fields: local });
      return;
    }

    setPending(true);
    setError(null);
    try {
      const res = await updateMe({
        ...(nameChanged ? { name: name.trim() } : {}),
        ...(wantsPassword ? { current_password: currentPassword, new_password: newPassword } : {}),
      });
      // A password change returns a fresh session that the API layer already applied; the name needs a re-read.
      if (!res.session) await refreshUser();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      show('success', wantsPassword ? 'Profil dan kata sandi diperbarui. Sesi di perangkat lain telah dicabut.' : 'Profil administrator berhasil disimpan.');
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setPending(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const fe = (f: string) => error?.fields[f] ?? null;
  const displayName = user?.name ?? '';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        darkIcon
        icon={<ShieldCheck className="w-6 h-6 text-[#2563EB]" />}
        title={
          <>
            Profil Admin &amp; <span className="text-[#2563EB]">Kredensial Operator</span>
          </>
        }
        description="Kelola nama operator dan kata sandi akses panel admin."
      />

      <NoticeBanner notice={notice} onDismiss={clear} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Admin Identity Card */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-7 text-center space-y-5 shadow-xs">
          <div
            className="w-28 h-28 mx-auto rounded-full bg-[#0F172A] border-4 border-white text-white flex items-center justify-center font-black text-4xl shadow-lg shadow-blue-500/20"
            role="img"
            aria-label={`Inisial ${displayName}`}
          >
            {initialsOf(displayName)}
          </div>

          <div>
            <h2 className="font-black text-xl text-[#0F172A]">{displayName}</h2>
            <p className="text-xs text-[#2563EB] font-bold mt-0.5">Administrator &bull; Sukamenak Studio</p>
          </div>

          <div className="pt-4 border-t border-slate-100 text-left space-y-3 text-xs">
            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <Mail className="w-3 h-3 text-[#2563EB]" aria-hidden="true" />
                Email Administrator
              </span>
              <span className="font-semibold text-[#0F172A] block break-all">{user?.email}</span>
            </div>
            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#2563EB]" aria-hidden="true" />
                Aktivitas Akun
              </span>
              <span className="font-semibold text-[#0F172A] block">Login terakhir: {user?.last_login_at ? formatDateTime(user.last_login_at) : '-'}</span>
              <span className="text-slate-500 block">Terdaftar: {user?.created_at ? formatDateTime(user.created_at) : '-'}</span>
            </div>
            <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-blue-600 flex items-center gap-1">
                <Lock className="w-3 h-3 text-[#2563EB]" aria-hidden="true" />
                Tingkat Otoritas Sistem
              </span>
              <span className="font-bold text-[#0F172A] block">Hak penuh panel admin (peran: {user?.role})</span>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Profile Form */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-[#0F172A]">
              Informasi Akun <span className="text-[#2563EB]">Operator Administrator</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Nama ini tercatat pada log audit. Email hanya dapat diubah melalui admin lain.</p>
          </div>

          <form onSubmit={handleSave} noValidate className="space-y-4">
            {error && <Banner kind={error.message.startsWith('Tidak ada') ? 'info' : 'error'}>{error.message}</Banner>}

            <Field label="Nama Operator Admin" htmlFor="profile-name" error={fe('name')}>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-[#2563EB] absolute left-4 top-3.5" aria-hidden="true" />
                <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} disabled={pending} placeholder="Admin Operasional" className={`${inputCls} !pl-10`} />
              </div>
            </Field>

            <Field label="Email Administrator" htmlFor="profile-email" hint="Tidak dapat diubah dari halaman ini.">
              <input id="profile-email" value={user?.email ?? ''} readOnly disabled className={inputCls} />
            </Field>

            <div className="border-t border-slate-100 pt-4 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Keamanan &amp; Kata Sandi Gerbang Admin</h4>
              <p className="text-[11px] text-slate-500">Mengganti kata sandi mencabut sesi Anda di perangkat lain.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Kata Sandi Saat Ini" htmlFor="profile-current" error={fe('current_password')}>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-[#2563EB] absolute left-4 top-3.5" aria-hidden="true" />
                    <input id="profile-current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={pending} placeholder="Kata sandi saat ini" className={`${inputCls} !pl-10`} />
                  </div>
                </Field>
                <Field label="Kata Sandi Baru (Opsional)" htmlFor="profile-new" error={fe('new_password')} hint={`Minimal ${MIN_PASSWORD} karakter.`}>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-4 top-3.5" aria-hidden="true" />
                    <input id="profile-new" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={pending} placeholder="Kosongkan jika tidak diubah" className={`${inputCls} !pl-10`} />
                  </div>
                </Field>
              </div>
              <Field label="Ulangi Kata Sandi Baru" htmlFor="profile-confirm" error={fe('confirm_password')} className="sm:max-w-[50%]">
                <input id="profile-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={pending} className={inputCls} />
              </Field>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
              <button type="submit" disabled={pending} className={`${btnPrimary} w-full sm:w-auto !px-8 !py-3.5`}>
                {pending ? <Spinner /> : <Save className="w-4 h-4" aria-hidden="true" />}
                <span>Simpan Profil Admin</span>
              </button>

              <button
                type="button"
                onClick={() => void handleLogout()}
                className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-red-600" aria-hidden="true" />
                <span>Keluar Akun Admin (Logout)</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
export default AdminProfile;
