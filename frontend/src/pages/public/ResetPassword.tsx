import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { resetPassword } from '../../api/auth';
import { getErrorMessage, isApiError } from '../../api/errors';

const byteLength = (s: string) => new TextEncoder().encode(s).length;

/** Client-side rules for the new password (the server enforces 8 to 72 bytes; confirmation is a UI check). */
export function validateNewPassword(next: string, confirm: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!next) errors.new_password = 'Wajib diisi';
  else if (next.length < 8) errors.new_password = 'Minimal 8 karakter';
  else if (byteLength(next) > 72) errors.new_password = 'Terlalu panjang (maksimal 72 byte)';
  if (!confirm) errors.confirm_password = 'Wajib diisi';
  else if (next && confirm !== next) errors.confirm_password = 'Konfirmasi tidak sama dengan kata sandi baru';
  return errors;
}

const inputClass =
  'w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-[#1E40AF] transition-all disabled:opacity-60';

/** Card shown instead of the form when the link cannot be used (missing, invalid, expired or used token). */
const InvalidLinkCard: React.FC<{ message: string }> = ({ message }) => (
  <div className="space-y-5">
    <div role="alert" className="p-4 rounded-2xl bg-orange-50 border border-orange-200 flex items-start gap-3">
      <div className="w-9 h-9 shrink-0 rounded-xl bg-white border border-orange-200 flex items-center justify-center shadow-xs">
        <AlertTriangle className="w-4.5 h-4.5 text-[#EA580C]" />
      </div>
      <div className="text-xs text-[#9A3412] leading-relaxed">
        <p className="font-black text-sm mb-1">Tautan tidak dapat dipakai</p>
        <p>{message}</p>
      </div>
    </div>
    <Link
      to="/login"
      className="w-full py-3.5 rounded-full bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-700/25 transition-all hover:-translate-y-0.5"
    >
      <span>Kembali ke Halaman Masuk</span>
      <ArrowRight className="w-4 h-4" />
    </Link>
    <p className="text-[11px] text-center text-[#64748B]">Di halaman masuk, pilih “Lupa kata sandi?” untuk meminta tautan baru.</p>
  </div>
);

export const ResetPassword: React.FC = () => {
  const [params] = useSearchParams();
  const token = (params.get('token') ?? '').trim();

  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErrorMsg('');
    const local = validateNewPassword(newPw, confirmPw);
    setFieldErrors(local);
    if (Object.keys(local).length > 0) return;
    setBusy(true);
    try {
      await resetPassword({ token, new_password: newPw });
      setNewPw('');
      setConfirmPw('');
      setDone(true);
    } catch (err) {
      if (isApiError(err) && err.code === 'INVALID_RESET_TOKEN') {
        setTokenError(getErrorMessage(err));
      } else {
        // Only the password field is the user's to fix; a token field error means the link itself is bad.
        const fields = isApiError(err) ? err.fieldErrors : {};
        if (fields.token) setTokenError('Tautan atur ulang kata sandi tidak valid. Minta tautan baru.');
        else if (fields.new_password) setFieldErrors({ new_password: fields.new_password });
        setErrorMsg(fields.token ? '' : getErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const linkProblem = !token ? 'Tautan ini tidak lengkap: kode atur ulang tidak ditemukan. Buka lagi tautan dari email Anda, atau minta tautan baru.' : tokenError;

  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4 sm:px-6 py-10 bg-[#F8FAFC]">
      <div className="w-full max-w-3xl bg-white rounded-3xl border border-[#E2E8F0] shadow-xl shadow-slate-900/10 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left: banner */}
        <div className="relative bg-gradient-to-br from-[#1E40AF] via-[#1E3A8A] to-[#0F172A] p-6 sm:p-8 text-white flex flex-col justify-center overflow-hidden min-h-[220px] md:min-h-[420px]">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-blue-400/20 blur-2xl" />
            <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-sky-400/20 blur-2xl" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-lg shadow-blue-950/30">
              <ShieldCheck className="w-6 h-6 text-sky-200" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">Atur Ulang Kata Sandi</h2>
            <p className="text-sm text-blue-100/90 leading-relaxed">
              Buat kata sandi baru untuk akun Sukamenak Studio Anda, lalu masuk kembali dengan kata sandi tersebut.
            </p>
          </div>
        </div>

        {/* Right: form / states */}
        <div className="bg-white p-6 sm:p-8 flex flex-col justify-center">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">Kata Sandi Baru</h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1">Minimal 8 karakter. Gunakan kombinasi yang sulit ditebak.</p>
          </div>

          {done ? (
            <div className="space-y-5">
              <div role="status" className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-3">
                <div className="w-9 h-9 shrink-0 rounded-xl bg-white border border-blue-200 flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-4.5 h-4.5 text-[#1E40AF]" />
                </div>
                <div className="text-xs text-[#1E3A8A] leading-relaxed">
                  <p className="font-black text-sm mb-1">Kata sandi berhasil diganti</p>
                  <p>Silakan masuk dengan kata sandi baru Anda.</p>
                </div>
              </div>
              <Link
                to="/login"
                className="w-full py-3.5 rounded-full bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-700/25 transition-all hover:-translate-y-0.5"
              >
                <span>Masuk Sekarang</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : linkProblem ? (
            <InvalidLinkCard message={linkProblem} />
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {(
                [
                  ['reset-new', 'Kata sandi baru', newPw, setNewPw, 'new_password', 'Minimal 8 karakter'],
                  ['reset-confirm', 'Ulangi kata sandi baru', confirmPw, setConfirmPw, 'confirm_password', 'Ketik ulang kata sandi'],
                ] as const
              ).map(([id, label, value, setter, field, placeholder]) => (
                <div key={id}>
                  <label htmlFor={id} className="block text-xs font-bold text-[#0F172A] mb-1">
                    {label}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                      {field === 'new_password' ? <Lock className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
                    </div>
                    <input
                      id={id}
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={value}
                      disabled={busy}
                      onChange={(e) => setter(e.target.value)}
                      placeholder={placeholder}
                      aria-invalid={fieldErrors[field] ? true : undefined}
                      className={inputClass}
                    />
                    {field === 'new_password' && (
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#64748B] hover:text-[#1E40AF] cursor-pointer"
                        title={showPw ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                        aria-label={showPw ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                  {fieldErrors[field] && <p className="mt-1 text-[11px] font-semibold text-[#EA580C]">{fieldErrors[field]}</p>}
                </div>
              ))}

              {errorMsg && (
                <div role="alert" className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-[#EA580C] font-semibold">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3.5 rounded-full bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-700/25 transition-all hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-70 disabled:pointer-events-none"
              >
                <span>{busy ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}</span>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              </button>
            </form>
          )}

          <div className="mt-5 pt-4 border-t border-[#E2E8F0] text-center">
            <p className="text-xs text-[#64748B]">
              Ingat kata sandi Anda?{' '}
              <Link to="/login" className="font-extrabold text-[#1E40AF] hover:underline">
                Masuk
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ResetPassword;
