import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Camera,
  PenTool,
  Download,
  Link2,
  Check,
  ArrowRight,
  Clock,
  Layers,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const recentPosters = [
    {
      id: 'rp-1',
      title: 'Keripik Tempe Gurih Renyah',
      category: 'Kuliner UMKM',
      image: '/posters/poster-keripik.jpg',
      date: 'Hari ini, 14:20',
      badge: 'Rasio 4:5 HD',
    },
    {
      id: 'rp-2',
      title: 'Kopi Robusta Puntang Single Origin',
      category: 'Produk Unggulan',
      image: '/posters/poster-kopi.jpg',
      date: 'Kemarin, 09:15',
      badge: 'Rasio 4:5 HD',
    },
    {
      id: 'rp-3',
      title: 'Bazar Murah Sembako Warga RT 03',
      category: 'Kegiatan Warga',
      image: '/posters/poster-bazar.jpg',
      date: '3 Nov 2026',
      badge: 'Rasio 4:5 HD',
    },
    {
      id: 'rp-4',
      title: 'Kue Basah & Jajanan Tradisional',
      category: 'Kuliner UMKM',
      image: '/posters/poster-kue.jpg',
      date: '1 Nov 2026',
      badge: 'Rasio 4:5 HD',
    },
  ];

  const handleShareLink = (poster: typeof recentPosters[0]) => {
    const url = `${window.location.origin}${poster.image}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedId(poster.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* 1. DYNAMIC HERO BANNER (Vibrant Royal Blue #2563EB infused with electric blue lighting) */}
      <div className="bg-gradient-to-r from-[#2563EB] via-[#1D4ED8] to-[#3B82F6] rounded-3xl p-6 sm:p-8 text-white border border-blue-400/40 shadow-xl relative overflow-hidden">
        {/* Electric blue lighting curves and translucent geometric glass shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute -bottom-20 left-1/3 w-80 h-80 bg-[#60A5FA]/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-white/5 rounded-3xl rotate-12 backdrop-blur-md pointer-events-none border border-white/20" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>Halo, Cantika Anggi</span>
              <span className="text-3xl animate-bounce">👋</span>
            </h1>
            <p className="text-sm sm:text-base text-blue-100 font-normal leading-relaxed">
              Siap membuat materi promosi produk usaha hari ini?
            </p>
          </div>

          {/* Frosted Pill Badge */}
          <div className="flex-shrink-0 self-start sm:self-center">
            <div className="px-5 py-2.5 rounded-full bg-white/15 border border-white/30 backdrop-blur-md shadow-lg flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span className="text-xs sm:text-sm font-black text-white tracking-wide">
                28 Poster Telah Dibuat
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. REFRESHED QUICK ACTION LAUNCHERS (2 Modern Frosted Glass Cards with duotone glowing icons) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-[#0F172A] tracking-tight">
            Akses Cepat <span className="text-[#2563EB]">Buat Desain</span>
          </h2>
          <span className="text-xs font-semibold text-[#64748B]">
            Pilih metode yang paling nyaman untuk Anda
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Modern duotone camera icon in glowing circle */}
          <Link
            to="/creator/studio?mode=i2i"
            className="group p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-[#CBD5E1] hover:border-[#2563EB] shadow-xs hover:shadow-xl transition-all duration-300 flex items-start gap-5 hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <Camera className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="text-base sm:text-lg font-black text-[#1E40AF] group-hover:text-[#2563EB] transition-colors">
                Foto Produk Langsung
              </h3>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                Unggah foto HP, otomatis ditata pencahayaan &amp; studionya.
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-50 group-hover:bg-[#2563EB] text-[#2563EB] group-hover:text-white text-xs font-bold transition-all shadow-xs">
                  <span>Buka Kamera / Unggah &rarr;</span>
                </span>
              </div>
            </div>
          </Link>

          {/* Card 2: Modern duotone magic wand icon in glowing circle */}
          <Link
            to="/creator/studio?mode=t2i"
            className="group p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-[#CBD5E1] hover:border-[#2563EB] shadow-xs hover:shadow-xl transition-all duration-300 flex items-start gap-5 hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E3A8A] text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-900/30 group-hover:scale-105 transition-transform">
              <PenTool className="w-7 h-7 text-[#38BDF8]" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="text-base sm:text-lg font-black text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                Buat dari <span className="text-[#2563EB]">Teks</span>
              </h3>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                Ketik ide promosi tanpa perlu foto produk terlebih dahulu.
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-50 group-hover:bg-[#2563EB] text-[#2563EB] group-hover:text-white text-xs font-bold transition-all shadow-xs">
                  <span>Mulai Ketik Ide &rarr;</span>
                </span>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* 3. RECENT CREATIONS  CAROUSEL (4-column row of vertical 4:5 cards) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#0F172A] tracking-tight">
              Poster Hasil Buatan Terakhir
            </h2>
            <p className="text-xs text-[#64748B]">
              Koleksi karya promosi produk UMKM yang telah siap diunduh &amp; dibagikan
            </p>
          </div>
          <Link
            to="/creator/history"
            className="text-xs font-bold text-[#2563EB] hover:underline flex items-center gap-1"
          >
            <span>Lihat Semua Riwayat</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {recentPosters.map((poster) => (
            <div
              key={poster.id}
              className="bg-white rounded-3xl border border-[#CBD5E1] p-3.5 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col justify-between hover:-translate-y-1"
            >
              <div>
                {/* 4:5 Frame */}
                <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 mb-3 border border-slate-100">
                  <img
                    src={poster.image}
                    alt={poster.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Top Pill Badge */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md border border-white text-[10px] font-black text-[#2563EB] shadow-xs">
                      {poster.category}
                    </span>
                  </div>
                  {/* Bottom Format Badge */}
                  <div className="absolute bottom-2.5 right-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-bold text-white">
                      {poster.badge}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-[#0F172A] line-clamp-1 leading-snug">
                  {poster.title}
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] mt-0.5">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{poster.date}</span>
                </div>
              </div>

              {/* Quick Action Row (Download HD, Share Link) */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <a
                  href={poster.image}
                  download={poster.title}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-[#2563EB] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh HD</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleShareLink(poster)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0F172A] hover:text-[#2563EB] transition-colors cursor-pointer"
                  title="Salin tautan poster"
                >
                  {copiedId === poster.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-blue-600">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Share Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
