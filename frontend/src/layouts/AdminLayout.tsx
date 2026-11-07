import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStudio } from '../components/common/StudioContext';
import { LogoIcon } from '../components/common/Logo';
import {
  Activity,
  Users,
  Cpu,
  ShieldAlert,
  Layers,
  FolderArchive,
  Award,
  Terminal,
  FileCheck,
  Sliders,
  LogOut,
  Home,
  KeyRound,
  ArrowRight,
  AlertCircle,
  Mail,
  MessageCircle,
  ChevronDown,
  User,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdminLoggedIn, adminLogin, adminLogout } = useStudio();
  const [emailInput, setEmailInput] = useState('admin@sukamenak.studio');
  const [passwordInput, setPasswordInput] = useState('admin123');
  const [loginError, setLoginError] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [adminAvatar, setAdminAvatar] = useState<string | null>(() =>
    localStorage.getItem('sukamenak_admin_avatar')
  );

  React.useEffect(() => {
    const handleAvatarUpdate = () => {
      setAdminAvatar(localStorage.getItem('sukamenak_admin_avatar'));
    };
    window.addEventListener('adminAvatarUpdated', handleAvatarUpdate);
    return () => window.removeEventListener('adminAvatarUpdated', handleAvatarUpdate);
  }, []);

  // Standard Admin Navigation Menus (Consistent rows)
  const adminMenus = [
    { to: '/admin/dashboard', label: 'Dashboard Analitik', icon: Activity },
    { to: '/admin/users', label: 'Manajemen Pengguna', icon: Users },
    { to: '/admin/models', label: 'Model LLM', icon: Cpu },
    { to: '/admin/core-prompt', label: 'Core Prompt Engine', icon: ShieldAlert },
    { to: '/admin/templates', label: 'Template & Slot', icon: Layers },
    { to: '/admin/references', label: 'Library Referensi', icon: FolderArchive },
    { to: '/admin/curation', label: 'Kurasi Galeri', icon: Award },
    { to: '/admin/logs', label: 'Log & Trace Generasi', icon: Terminal },
    { to: '/admin/policy', label: 'Content Policy', icon: FileCheck },
    { to: '/admin/settings', label: 'Pengaturan Global', icon: Sliders },
    { to: '/admin/profile', label: 'Profil Admin', icon: User },
  ];

  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = adminLogin(emailInput, passwordInput);
    if (success) {
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  const handleAdminLogout = () => {
    adminLogout();
    navigate('/login');
  };

  // ─────────────────────────────────────────────────────────────
  // GERBANG LOGIN ADMIN (Bila belum terotentikasi)
  // ─────────────────────────────────────────────────────────────
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-[#0F172A]">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-8 shadow-xl space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#EFF6FF] border-2 border-[#BFDBFE] flex items-center justify-center text-[#2563EB] shadow-xs">
              <ShieldAlert className="w-8 h-8 text-[#2563EB]" />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-[11px] font-black uppercase tracking-wider">
              <span>Portal Terproteksi Admin</span>
            </div>

            <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
              Gerbang Operasional
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              Masukkan kredensial operator admin untuk mengakses kontrol sistem &amp; model engine Sukamenak Studio.
            </p>
          </div>

          <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0F172A]">
                Email Operator / Admin
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setLoginError(false);
                  }}
                  placeholder="admin@sukamenak.studio"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#F8FAFC] border border-slate-300 text-sm font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0F172A]">
                Kata Sandi Admin
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setLoginError(false);
                  }}
                  placeholder="Masukkan kata sandi admin"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#F8FAFC] border border-slate-300 text-sm font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all"
                />
              </div>
              {loginError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold mt-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Kredensial tidak valid. Gunakan <strong>admin@sukamenak.studio</strong> &amp; <strong>admin123</strong></span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
            >
              <span>Buka Gerbang Operator Admin</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              to="/"
              className="font-bold text-slate-600 hover:text-[#2563EB] transition-colors flex items-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Kembali ke Beranda</span>
            </Link>

            <Link
              to="/creator/dashboard"
              className="font-bold text-[#2563EB] hover:underline"
            >
              Studio Kreator Warga &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // HALAMAN OPERATOR ADMIN AKTIF (STANDARDIZED MINIMALIST HEADER)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] selection:bg-[#2563EB] selection:text-white">
      
      {/* ─────────────────────────────────────────────────────────────
          1. GLOBAL TOP NAVBAR (STANDARDIZED MINIMALIST HEADER)
          - Left: Crisp 'Sukamenak Studio' wordmark with geometric Royal Blue glyph emblem.
          - Middle: Wide, clean negative space (Completely empty).
          - Right: Circular avatar 'A' with label "Admin Operasional • admin@sukamenak.studio".
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-6 lg:px-8 h-18 flex items-center justify-between shadow-2xs">
        
        {/* Left: Crisp 'Sukamenak Studio' wordmark */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 select-none group">
            <LogoIcon className="w-9 h-9 group-hover:scale-105 transition-transform" color="#2563EB" />
            <div className="leading-tight">
              <span className="font-black text-xl tracking-tight text-[#0F172A]">
                Sukamenak <span className="text-[#2563EB]">Studio</span>
              </span>
            </div>
          </Link>
          <span className="ml-2 px-2.5 py-0.5 rounded-full bg-[#0F172A] text-white text-[10px] font-mono font-bold uppercase tracking-wider">
            ADMIN
          </span>
        </div>

        {/* Middle: Wide clean negative space */}
        <div className="flex-1" />

        {/* Right: Circular avatar 'A' with label "Admin Operasional • admin@sukamenak.studio" */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAdminMenu(!showAdminMenu)}
            className="flex items-center gap-2.5 pl-2 pr-3.5 py-1.5 rounded-full bg-white border border-[#CBD5E1] hover:border-[#2563EB] shadow-xs hover:shadow-md transition-all cursor-pointer group"
          >
            {adminAvatar ? (
              <img
                src={adminAvatar}
                alt="Foto Admin"
                className="w-8 h-8 rounded-full object-cover border border-[#CBD5E1]"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-xs font-black">
                A
              </div>
            )}
            <span className="text-xs sm:text-sm font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
              Admin Operasional
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#2563EB] transition-colors" />
          </button>

          {showAdminMenu && (
            <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-2xl p-2 z-50">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <div className="text-xs font-black text-[#0F172A]">Admin Operasional</div>
                <div className="text-[11px] text-[#64748B]">Operator Sistem Terverifikasi</div>
              </div>
              <Link
                to="/admin/profile"
                onClick={() => setShowAdminMenu(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#0F172A] hover:bg-[#EFF6FF] hover:text-[#2563EB] rounded-xl transition-colors"
              >
                <User className="w-4 h-4 text-[#2563EB]" />
                <span>Profil Admin</span>
              </Link>
              
              <button
                type="button"
                onClick={handleAdminLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar (Logout)</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. WORKSPACE BODY: SIDEBAR FLUSH ATTACHED (TOUCHING HEADER & FOOTER)
          - Tidak ngambang (attached edge-to-edge from header to footer)
          - Border-r divider continuous
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex">
        
        {/* Left Sidebar Dock (Attached flush to header & footer) */}
        <aside className="w-64 shrink-0 bg-white border-r border-[#CBD5E1] py-6 px-3.5 hidden lg:flex flex-col">
          <div className="space-y-1 flex-1">
            {adminMenus.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`h-11 px-3.5 rounded-xl flex items-center gap-3 text-xs sm:text-sm font-bold transition-all duration-200 select-none ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-md shadow-blue-600/25'
                      : 'text-slate-600 hover:bg-[#EFF6FF] hover:text-[#2563EB]'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Main Content Area (Scaled down 10% for high density) */}
        <main className="flex-1 min-w-0 p-6 lg:p-8 bg-[#F8FAFC]" style={{ zoom: 0.9 }}>
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. FOOTER RESMI PANEL ADMIN (Deep Slate Navy #0F172A)
          - Prominent curved top border (rounded-t-[2.25rem])
          - 3-column micro layout (Brand, Navigasi Admin, Bantuan Teknis)
          - Bottom copyright divider
      ───────────────────────────────────────────────────────────── */}
      <footer className="mt-auto bg-[#0F172A] text-white rounded-t-[2.25rem] border-t border-slate-800 pt-12 pb-8 px-6 lg:px-12 shadow-2xl">
        <div className="max-w-7xl mx-auto space-y-10">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-slate-800">
            {/* Column 1: Branding & Identity */}
            <div className="md:col-span-6 space-y-3">
              <div className="flex items-center gap-2.5">
                <LogoIcon className="w-8 h-8" color="#2563EB" />
                <span className="text-xl font-black text-white tracking-tight">
                  Sukamenak <span className="text-[#2563EB]">Studio</span>
                </span>
                <span className="ml-1 px-2.5 py-0.5 rounded-full bg-blue-900/50 border border-blue-500/30 text-blue-300 text-[10px] font-mono font-bold">
                  ADMIN CONSOLE
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md font-normal">
                Panel kendali operasional, manajemen model AI, dan enkripsi core prompt terproteksi Sukamenak Studio.
              </p>
              <div className="text-xs text-slate-400 font-medium">
                Sukamenak, Kec. Margahayu, Kab. Bandung
              </div>
            </div>

            {/* Column 2: Quick Navigation */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#2563EB]">
                NAVIGASI ADMIN
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
                <li>
                  <Link to="/admin/dashboard" className="hover:text-white transition-colors">
                    Dashboard Analitik
                  </Link>
                </li>
                <li>
                  <Link to="/admin/core-prompt" className="hover:text-white transition-colors">
                    Core Prompt Engine
                  </Link>
                </li>
                <li>
                  <Link to="/admin/models" className="hover:text-white transition-colors">
                    Model LLM &amp; Kuota
                  </Link>
                </li>
                
              </ul>
            </div>

            {/* Column 3: Technical Help */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#2563EB]">
                BANTUAN TEKNIS
              </h4>
              <div className="flex flex-col gap-2 text-xs text-slate-300">
                <a
                  href="https://wa.me/6281234567890"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-slate-700 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>WhatsApp (+62 812-3456-7890)</span>
                </a>
                <a
                  href="mailto:kontak@sukamenak.org"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-slate-700 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Email (kontak@sukamenak.org)</span>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Copyright Divider */}
          <div className="text-center text-xs text-slate-400 font-normal">
            &copy; 2026 Sukamenak Studio. Platform Desain Visual Promosi Mandiri UMKM.
          </div>
        </div>
      </footer>

    </div>
  );
};
export default AdminLayout;
