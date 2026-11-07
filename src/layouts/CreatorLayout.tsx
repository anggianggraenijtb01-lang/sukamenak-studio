import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogoIcon } from '../components/common/Logo';
import {
  LayoutGrid,
  Image as ImageIcon,
  Wand2,
  Sparkles,
  History,
  BookOpen,
  User,
  MessageCircle,
  Mail,
  Instagram,
  LogOut,
  ChevronDown,
} from 'lucide-react';

export const CreatorLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [avatarImage, setAvatarImage] = useState<string | null>(() => localStorage.getItem('sukamenak_user_avatar'));

  useEffect(() => {
    const handleAvatarUpdate = () => {
      setAvatarImage(localStorage.getItem('sukamenak_user_avatar'));
    };
    window.addEventListener('avatarUpdated', handleAvatarUpdate);
    return () => window.removeEventListener('avatarUpdated', handleAvatarUpdate);
  }, []);

  // 7 Standard Creator Navigation Items with 56px rows
  const creatorMenus = [
    { to: '/creator/dashboard', label: 'Dashboard', icon: LayoutGrid, exact: true },
    { to: '/creator/gallery', label: 'Galeri Template', icon: ImageIcon },
    { to: '/creator/studio', label: 'Studio Generator', icon: Wand2 },
    { to: '/creator/advisor', label: 'Prompt Advisor', icon: Sparkles },
    { to: '/creator/history', label: 'Riwayat & Unduhan', icon: History },
    { to: '/creator/tutorials', label: 'Edukasi Visual', icon: BookOpen },
    { to: '/creator/profile', label: 'Profil Saya', icon: User },
  ];

  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] selection:bg-[#2563EB] selection:text-white">
      
      {/* ─────────────────────────────────────────────────────────────
          1. GLOBAL TOP NAVBAR (STANDARDIZED MINIMALIST HEADER)
          - Left: Crisp 'Sukamenak Studio' wordmark with geometric Royal Blue glyph emblem.
          - Middle: Wide, clean negative space (Completely empty; strictly NO search bar, NO quota badges).
          - Right: Sleek elevated profile capsule: "Cantika Anggi" (avatar 'C').
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-6 lg:px-8 h-18 flex items-center justify-between shadow-2xs">
        
        {/* Left: Crisp 'Sukamenak Studio' wordmark with geometric Royal Blue emblem */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 select-none group">
            <LogoIcon className="w-9 h-9 group-hover:scale-105 transition-transform" color="#2563EB" />
            <div className="leading-tight">
              <span className="font-black text-xl tracking-tight text-[#0F172A]">
                Sukamenak <span className="text-[#2563EB]">Studio</span>
              </span>
            </div>
          </Link>
        </div>

        {/* Middle: Wide Clean Negative Space (Empty, zero clutter) */}
        <div className="flex-1" />

        {/* Right: Sleek elevated profile capsule: Circular light-slate avatar with Royal Blue initial 'C' & "Cantika Anggi" */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 pl-2 pr-3.5 py-1.5 rounded-full bg-white border border-[#CBD5E1] hover:border-[#2563EB] shadow-xs hover:shadow-md transition-all cursor-pointer group"
          >
            {avatarImage ? (
              <img
                src={avatarImage}
                alt="Foto Profil Cantika"
                className="w-8 h-8 rounded-full object-cover border border-[#BFDBFE]"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-xs font-black text-[#2563EB]">
                C
              </div>
            )}
            <span className="text-xs sm:text-sm font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
              Cantika Anggi
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#2563EB] transition-colors" />
          </button>

          {/* Profile Dropdown Popover */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl border border-slate-200 shadow-2xl p-2 z-50">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <div className="text-xs font-black text-[#0F172A]">Cantika Anggi</div>
                <div className="text-[11px] text-[#64748B]">Kreator UMKM Sukamenak</div>
              </div>
              <Link
                to="/creator/profile"
                onClick={() => setShowProfileMenu(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#0F172A] hover:bg-[#EFF6FF] hover:text-[#2563EB] rounded-xl transition-colors"
              >
                <User className="w-4 h-4" />
                <span>Pengaturan Profil</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Akun</span>
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
        
        {/* Left Sidebar Dock (High-Density, 56px menu rows, nempel heder & footer) */}
        <aside className="w-64 shrink-0 bg-white border-r border-[#CBD5E1] py-6 px-3.5 hidden lg:flex flex-col">
          <div className="space-y-1.5 flex-1">
            {creatorMenus.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? location.pathname === item.to || (item.to === '/creator/dashboard' && location.pathname === '/creator')
                : location.pathname.startsWith(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`h-14 px-4 rounded-2xl flex items-center gap-3.5 text-xs sm:text-sm font-bold transition-all duration-200 select-none ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-md shadow-blue-600/25'
                      : 'text-slate-600 hover:bg-[#EFF6FF] hover:text-[#2563EB]'
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-[#2563EB]'}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Mobile Horizontal Menu Strip for Small Screens */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 flex items-center justify-around">
          {creatorMenus.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? location.pathname === item.to || (item.to === '/creator/dashboard' && location.pathname === '/creator')
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`p-2 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold ${
                  isActive ? 'text-[#2563EB]' : 'text-slate-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate max-w-[60px]">{item.label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </div>

        {/* Center Main Module Outlet (Scaled down 10% for high density) */}
        <main className="flex-1 min-w-0 p-6 lg:p-8 bg-[#F8FAFC]" style={{ zoom: 0.9 }}>
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. EXACT TOP-CURVED MODERN FOOTER (Deep Slate Navy #0F172A)
          - Prominent curved top border (rounded-t-[2.25rem])
          - 3-column micro layout (Brand, Quick Nav, Contact Channels)
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
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md font-normal">
                Platform studio visual modern untuk membantu promosi produk UMKM secara mandiri, praktis, dan profesional.
              </p>
              <div className="text-xs text-slate-400 font-medium">
                Sukamenak, Kec. Margahayu, Kab. Bandung
              </div>
            </div>

            {/* Column 2: Quick Navigation */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#2563EB]">
                NAVIGASI RINGKAS
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
                <li>
                  <Link to="/" className="hover:text-white transition-colors">
                    Beranda
                  </Link>
                </li>
                <li>
                  <Link to="/creator/gallery" className="hover:text-white transition-colors">
                    Galeri Template
                  </Link>
                </li>
                <li>
                  <a href="/#faq" className="hover:text-white transition-colors">
                    Tanya Jawab (FAQ)
                  </a>
                </li>
                <li>
                  <Link to="/creator/tutorials" className="hover:text-white transition-colors">
                    Panduan
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Direct Contact Channels */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#2563EB]">
                HUBUNGI KAMI
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
                <a
                  href="https://instagram.com/sukamenak.studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-slate-700 transition-colors"
                >
                  <Instagram className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Instagram (@sukamenak.studio)</span>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Copyright Divider */}
          <div className="text-center text-xs text-slate-400 font-normal">
            &copy; 2026 Sukamenak Studio. Bebas Biaya untuk Kemajuan Bersama.
          </div>
        </div>
      </footer>
    </div>
  );
};
export default CreatorLayout;
