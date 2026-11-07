import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Eye, EyeOff, User } from 'lucide-react';
import { useStudio } from '../../components/common/StudioContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { adminLogin } = useStudio();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Single unified entry: automatically detect admin credentials or normal citizens
    if (email.includes('admin') || email.includes('operator')) {
      const success = adminLogin(email, password);
      if (success) {
        navigate('/admin/dashboard');
        return;
      } else {
        setErrorMsg('Kredensial operator admin tidak cocok. Silakan periksa kembali.');
        return;
      }
    }

    // Default: Citizen & UMKM Creator Workspace
    navigate('/creator/studio');
  };

  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4 sm:px-6 py-10 bg-[#F8FAFC]">
      {/* 2-Column Split Card Container (Kompak, Proporsional, dan Bersih) */}
      <div className="w-full max-w-3xl bg-white rounded-3xl border border-[#E2E8F0] shadow-xl shadow-slate-900/10 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        
        {/* ═══════════════════════════════════════════════════════════════════
            KOLOM KIRI: WELCOME BANNER (NAVY MINIMALIS & BERSIH)
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative bg-gradient-to-br from-[#1E40AF] via-[#1E3A8A] to-[#0F172A] p-6 sm:p-8 text-white flex flex-col justify-center overflow-hidden min-h-[260px] md:min-h-[460px]">
          {/* Latar Belakang Dekorasi Vektor: Gelombang Fluida & Geometri */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Blob Atas Kiri */}
            <svg
              className="absolute -top-16 -left-16 w-64 h-64 text-blue-400/25"
              viewBox="0 0 200 200"
              fill="currentColor"
            >
              <path d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,79.6,-45.8C87.4,-32.6,90,-16.3,88.5,-0.9C86.9,14.6,81.2,29.1,72.6,41.9C64,54.7,52.5,65.7,39.1,72.4C25.7,79.1,10.3,81.5,-4.7,79.7C-19.7,77.9,-34.3,71.9,-46.9,63.1C-59.5,54.3,-70.1,42.7,-76.8,29C-83.6,15.3,-86.6,-0.5,-83.8,-15.4C-81,-30.3,-72.4,-44.3,-60.7,-52.7C-49,-61.1,-34.2,-63.9,-20.1,-71.1C-6,-78.3,7.4,-89.9,22.1,-89.6C36.8,-89.3,52.8,-77.1,44.7,-76.4Z" transform="translate(100 100)" />
            </svg>

            {/* Blob Bawah Kanan */}
            <svg
              className="absolute -bottom-16 -right-16 w-72 h-72 text-sky-400/20"
              viewBox="0 0 200 200"
              fill="currentColor"
            >
              <path d="M38.1,-63.9C49.9,-58.4,60.2,-48.9,67.8,-37.2C75.4,-25.6,80.3,-11.8,79.6,1.9C78.9,15.6,72.6,29.2,64,40.9C55.4,52.6,44.5,62.4,32,68.2C19.5,74,-4.6,75.8,-21.8,70.6C-39,65.4,-49.3,53.2,-57.8,40.1C-66.3,27,-73,13,-73.4,-1.2C-73.8,-15.4,-67.9,-29.8,-58.6,-40.8C-49.3,-51.8,-36.6,-59.4,-23.6,-64.1C-10.6,-68.8,2.7,-70.6,15.2,-69.4C27.7,-68.2,39.4,-64,38.1,-63.9Z" transform="translate(100 100)" />
            </svg>

            {/* Aksen Segitiga Geometris */}
            <div className="absolute top-8 right-8 flex items-center gap-1.5 opacity-35">
              <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-sky-300" />
              <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-sky-300" />
              <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-sky-300" />
            </div>

            <div className="absolute bottom-8 left-8 flex items-center gap-1.5 opacity-35">
              <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-sky-300" />
              <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-sky-300" />
              <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-sky-300" />
            </div>

            {/* Lingkaran Pendaran Lembut */}
            <div className="absolute -top-8 right-8 w-20 h-20 rounded-full bg-blue-300/20 blur-xl" />
            <div className="absolute bottom-16 right-4 w-12 h-12 rounded-full bg-sky-300/25 blur-xs" />
          </div>

          {/* Bagian Tengah: Teks Sambutan Bersih & Tenang */}
          <div className="relative z-10 space-y-3">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
              Selamat Datang!
            </h2>
            <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed font-normal">
              Masuk untuk membuat poster promosi dan katalog produk usaha Anda.
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            KOLOM KANAN: FORM MASUK (SIGN IN PANEL)
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="bg-white p-6 sm:p-8 flex flex-col justify-center">
          
          {/* Header Form */}
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Masuk ke Akun
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1 leading-relaxed font-normal">
              Masukkan email dan kata sandi Anda.
            </p>
          </div>

          {/* Form Utama */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Input 1: Email */}
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-[#1E40AF] transition-all"
                />
              </div>
            </div>

            {/* Input 2: Kata Sandi */}
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-[#1E40AF] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#64748B] hover:text-[#1E40AF] cursor-pointer"
                  title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Baris Opsi: Ingat Saya & Lupa Kata Sandi */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 text-[#475569] font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-[#1E40AF] focus:ring-[#1E40AF] border-[#CBD5E1] accent-[#1E40AF]"
                />
                <span>Ingat saya</span>
              </label>
              <a
                href="#bantuan"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Untuk bantuan pemulihan kata sandi warga RW 15, silakan hubungi pengurus sekretariat via WhatsApp: +62 812-3456-7890.');
                }}
                className="text-[#1E40AF] hover:underline font-semibold"
              >
                Lupa kata sandi?
              </a>
            </div>

            {/* Pesan Kesalahan jika ada */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-[#EA580C] font-semibold">
                {errorMsg}
              </div>
            )}

            {/* Tombol Aksi Utama: Masuk ke Studio → */}
            <button
              type="submit"
              className="w-full py-3.5 rounded-full bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-700/25 transition-all hover:shadow-xl hover:shadow-blue-700/35 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <span>Masuk ke Studio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Tautan Daftar Akun Baru */}
          <div className="mt-5 pt-4 border-t border-[#E2E8F0] text-center">
            <p className="text-xs text-[#64748B]">
              Belum punya akun?{' '}
              <Link to="/register" className="font-extrabold text-[#1E40AF] hover:underline">
                Daftar Akun Baru
              </Link>
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
