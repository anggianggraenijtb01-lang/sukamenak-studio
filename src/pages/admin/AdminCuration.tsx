import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  XCircle,
  Star,
  Eye,
  Check,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react';

export const AdminCuration: React.FC = () => {
  const [curatedPosters, setCuratedPosters] = useState([
    {
      id: 'cp-1',
      title: 'Keripik Tempe Bu Cantika',
      author: 'Cantika Anggi (RT 03)',
      category: 'Kuliner UMKM',
      image: '/posters/poster-keripik.jpg',
      featured: true,
      score: '96 / 100',
      lightingRating: 'Sempurna (Studio Warm 45°)',
    },
    {
      id: 'cp-2',
      title: 'Kopi Robusta Puntang Single Origin',
      author: 'Hendra Gunawan (RT 01)',
      category: 'Produk Unggulan',
      image: '/posters/poster-kopi.jpg',
      featured: true,
      score: '94 / 100',
      lightingRating: 'Sangat Baik (Soft Key Light)',
    },
    {
      id: 'cp-3',
      title: 'Bazar Murah Sembako Warga RT 03',
      author: 'Pengurus RT 03',
      category: 'Kegiatan Warga',
      image: '/posters/poster-bazar.jpg',
      featured: false,
      score: '91 / 100',
      lightingRating: 'Baik (Natural Daylight)',
    },
    {
      id: 'cp-4',
      title: 'Kue Basah & Jajanan Tradisional',
      author: 'Warsinah (RT 04)',
      category: 'Kuliner UMKM',
      image: '/posters/poster-kue.jpg',
      featured: false,
      score: '92 / 100',
      lightingRating: 'Sangat Baik (Overhead Diffused)',
    },
  ]);

  const [notification, setNotification] = useState<string | null>(null);

  const toggleFeatured = (id: string) => {
    setCuratedPosters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, featured: !p.featured } : p))
    );
    setNotification('Status etalase beranda berhasil diperbarui.');
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/25">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Kurasi <span className="text-[#2563EB]">Galeri Unggulan UMKM</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
              Pilih dan tetapkan karya promosi terbaik UMKM Studio untuk ditampilkan di etalase beranda dan katalog resmi.
            </p>
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs font-bold text-[#2563EB] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span>{notification}</span>
        </div>
      )}

      {/* 3 Kartu Berwarna Menarik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-blue-50/80 via-white to-blue-50/30 rounded-3xl border-2 border-[#BFDBFE] p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB] block">
            Poster Unggulan Beranda
          </span>
          <div className="text-3xl font-black text-[#0F172A] mt-2">
            12 <span className="text-xs font-semibold text-slate-500">Materi Terpilih</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ditampilkan di etalase inspirasi publik
          </p>
        </div>

        <div className="bg-gradient-to-br from-sky-50/80 via-white to-sky-50/30 rounded-3xl border-2 border-[#BAE6FD] p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#0284C7] block">
            Antrean Usulan Baru
          </span>
          <div className="text-3xl font-black text-[#0F172A] mt-2">
            4 <span className="text-xs font-semibold text-slate-500">Menunggu Review</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Karya baru diunggah kreator warga pekan ini
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-100/90 via-white to-slate-50/50 rounded-3xl border-2 border-slate-300 p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
            Rata-rata Skor Kualitas Visual
          </span>
          <div className="text-3xl font-black text-[#0F172A] mt-2">
            94.8 <span className="text-xs font-semibold text-slate-500">/ 100</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Standar komposisi komersial UMKM Sukamenak Studio
          </p>
        </div>
      </div>

      {/* Grid of Posters for Curation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {curatedPosters.map((poster) => (
          <div
            key={poster.id}
            className="bg-white rounded-3xl border border-[#CBD5E1] p-4 shadow-xs hover:shadow-xl transition-all space-y-3.5 flex flex-col justify-between"
          >
            <div>
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 border border-slate-100 mb-3">
                <img
                  src={poster.image}
                  alt={poster.title}
                  className="w-full h-full object-cover"
                />
                {poster.featured && (
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-[#2563EB] text-white text-[10px] font-black flex items-center gap-1 shadow-md">
                    <Star className="w-3 h-3 fill-white" />
                    <span>Etalase Utama</span>
                  </span>
                )}
                <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/60 text-[9px] font-bold text-white">
                  Skor: {poster.score}
                </span>
              </div>

              <h3 className="text-sm font-bold text-[#0F172A] line-clamp-1">
                {poster.title}
              </h3>
              <p className="text-xs text-[#2563EB] font-bold mt-0.5">
                {poster.author}
              </p>
              <div className="mt-2 text-[11px] text-slate-500">
                Pencahayaan: <strong className="text-slate-700">{poster.lightingRating}</strong>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => toggleFeatured(poster.id)}
                className={`w-full py-2 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  poster.featured
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${poster.featured ? 'text-amber-500 fill-amber-500' : 'text-white'}`} />
                <span>{poster.featured ? 'Lepas dari Etalase' : 'Tampilkan di Beranda'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default AdminCuration;

