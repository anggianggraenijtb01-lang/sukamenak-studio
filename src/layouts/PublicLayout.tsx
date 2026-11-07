import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { MessageCircle, Mail, Instagram } from 'lucide-react';
import { LogoIcon } from '../components/common/Logo';

export const PublicLayout: React.FC = () => {
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (window.location.pathname === '/') {
      e.preventDefault();
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        window.history.pushState(null, '', `#${id}`);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* 1. HEADER NAVIGASI (Clean Modern SaaS) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-2xs">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-20 flex items-center justify-between gap-6">
          {/* Logo 'Sukamenak Studio' dengan HD Vector Logo */}
          <Link to="/" className="inline-flex items-center gap-3 select-none group">
            <LogoIcon className="w-10 h-10 group-hover:scale-105 transition-transform" color="#2563EB" />
            <div className="leading-tight">
              <span className="font-extrabold text-xl tracking-tight text-[#0F172A]">
                Sukamenak <span className="text-[#2563EB]">Studio</span>
              </span>
            </div>
          </Link>

          {/* Menu Ringkas: 'Beranda', 'Layanan', 'Katalog Contoh', 'Cara Kerja', 'FAQ' */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#475569]">
            <a
              href="/#beranda"
              onClick={(e) => handleNavClick(e, 'beranda')}
              className="text-[#2563EB] font-bold hover:text-[#1D4ED8] transition-colors cursor-pointer"
            >
              Beranda
            </a>
            <a
              href="/#layanan"
              onClick={(e) => handleNavClick(e, 'layanan')}
              className="hover:text-[#2563EB] transition-colors cursor-pointer"
            >
              Layanan
            </a>
            <a
              href="/#katalog-contoh"
              onClick={(e) => handleNavClick(e, 'katalog-contoh')}
              className="hover:text-[#2563EB] transition-colors cursor-pointer"
            >
              Katalog Contoh
            </a>
            <a
              href="/#cara-kerja"
              onClick={(e) => handleNavClick(e, 'cara-kerja')}
              className="hover:text-[#2563EB] transition-colors cursor-pointer"
            >
              Cara Kerja
            </a>
            <a
              href="/#faq"
              onClick={(e) => handleNavClick(e, 'faq')}
              className="hover:text-[#2563EB] transition-colors cursor-pointer"
            >
              FAQ
            </a>
          </nav>

          {/* Di ujung kanan: Tombol Masuk (#2563EB) */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] shadow-sm transition-all"
            >
              Masuk
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* ─────────────────────────────────────────────────────────────
          4. EXACT LANDING PAGE TOP-CURVED FOOTER:
          - Deep Slate Navy (#0F172A) with prominent curved top border (rounded-t-[2.25rem])
          - Balanced 3-column micro layout
      ───────────────────────────────────────────────────────────── */}
      <footer id="faq-footer" className="mt-16 bg-[#0F172A] text-white rounded-t-[2.25rem] border-t border-slate-800 pt-14 pb-10 px-6 sm:px-8 lg:px-12 shadow-2xl">
        <div className="max-w-7xl mx-auto space-y-10">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-slate-800">
            {/* Column 1 (Branding & Identity) */}
            <div className="md:col-span-5 space-y-3.5">
              <div className="flex items-center gap-2.5">
                <LogoIcon className="w-9 h-9" color="#2563EB" />
                <span className="text-xl font-black text-white tracking-tight">
                  Sukamenak <span className="text-[#2563EB]">Studio</span>
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm font-normal">
                Platform studio visual modern untuk membantu promosi produk UMKM secara mandiri, praktis, dan profesional.
              </p>

              <div className="text-xs text-slate-400 font-medium">
                Sukamenak, Kec. Margahayu, Kab. Bandung
              </div>
            </div>

            {/* Column 2 (Quick Navigation) */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#2563EB]">
                NAVIGASI RINGKAS
              </h4>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                <li>
                  <a
                    href="/#beranda"
                    onClick={(e) => handleNavClick(e, 'beranda')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Beranda
                  </a>
                </li>
                <li>
                  <a
                    href="/#layanan"
                    onClick={(e) => handleNavClick(e, 'layanan')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Layanan
                  </a>
                </li>
                <li>
                  <Link to="/creator/gallery" className="hover:text-white transition-colors">
                    Galeri Template
                  </Link>
                </li>
                <li>
                  <a
                    href="/#faq"
                    onClick={(e) => handleNavClick(e, 'faq')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
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

            {/* Column 3 (Direct Contact Channels) */}
            <div className="md:col-span-4 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#2563EB]">
                HUBUNGI KAMI
              </h4>
              <div className="flex flex-col gap-2.5 text-xs text-slate-300">
                <a
                  href="https://wa.me/6281234567890"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-slate-700 transition-colors w-fit"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>WhatsApp: <strong className="text-white">+62 812-3456-7890</strong></span>
                </a>
                <a
                  href="mailto:kontak@sukamenak.org"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-slate-700 transition-colors w-fit"
                >
                  <Mail className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Email: <strong className="text-white">kontak@sukamenak.org</strong></span>
                </a>
                <a
                  href="https://instagram.com/sukamenak.studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-slate-700 transition-colors w-fit"
                >
                  <Instagram className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Instagram: <strong className="text-white">@sukamenak.studio</strong></span>
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
export default PublicLayout;
