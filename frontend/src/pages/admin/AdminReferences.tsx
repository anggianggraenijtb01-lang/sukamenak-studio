import React, { useState } from 'react';
import {
  FolderArchive,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  Tag,
} from 'lucide-react';

export const AdminReferences: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [search, setSearch] = useState('');

  const references = [
    {
      id: 'ref-1',
      title: 'Keripik Tempe Iris Renyah',
      category: 'Kuliner',
      owner: 'Cantika Anggi',
      image: '/posters/poster-keripik.jpg',
      tags: ['Tempe', 'Crispy', 'Daun Jeruk', 'Studio Warm'],
      usageCount: 142,
    },
    {
      id: 'ref-2',
      title: 'Biji Kopi Panggang Puntang',
      category: 'Komoditas',
      owner: 'Hendra Gunawan',
      image: '/posters/poster-kopi.jpg',
      tags: ['Kopi', 'Robusta', 'Biji Kering', 'Goni'],
      usageCount: 98,
    },
    {
      id: 'ref-3',
      title: 'Bazar Sembako Balai Warga',
      category: 'Kegiatan',
      owner: 'Komunitas Warga',
      image: '/posters/poster-bazar.jpg',
      tags: ['Bazar', 'Beras', 'Minyak', 'Komunitas'],
      usageCount: 87,
    },
    {
      id: 'ref-4',
      title: 'Jajanan Pasar Tradisional',
      category: 'Kuliner',
      owner: 'Warsinah',
      image: '/posters/poster-kue.jpg',
      tags: ['Kue Basah', 'Tradisional', 'Tampah', 'Piring Kayu'],
      usageCount: 114,
    },
  ];

  const filtered = references.filter((r) => {
    const matchCat = activeCategory === 'Semua' || r.category === activeCategory;
    const matchSearch =
      search === '' ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.owner.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/25">
            <FolderArchive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Bank Referensi <span className="text-[#2563EB]">Visual</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
              Koleksi foto produk asli UMKM dan pencahayaan studio komersial.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-black transition-all cursor-pointer shadow-md shadow-blue-500/25 self-start sm:self-center"
        >
          <Upload className="w-4 h-4" />
          <span>Unggah Referensi HD</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari foto referensi produk..."
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
          {['Semua', 'Kuliner', 'Komoditas', 'Kegiatan'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === c
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'bg-[#F8FAFC] text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Reference Assets (Zero-cropping vertical 4:5 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-4 shadow-xs hover:shadow-xl transition-all space-y-3.5 flex flex-col justify-between"
          >
            <div>
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-900 border border-slate-100 mb-3">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-white/95 text-[10px] font-black text-[#2563EB] shadow-xs">
                  {item.category}
                </span>
                <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/60 text-[9px] font-bold text-white">
                  {item.usageCount} Rujukan
                </span>
              </div>

              <h3 className="text-sm font-bold text-[#0F172A] line-clamp-1">
                {item.title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Kontributor: <strong className="text-[#0F172A]">{item.owner}</strong>
              </p>

              <div className="mt-2.5 flex flex-wrap gap-1">
                {item.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-md bg-[#F8FAFC] border border-slate-200 text-slate-600 text-[10px] font-medium"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#2563EB] font-bold">
              <span>Resolusi HD Terverifikasi</span>
              <span className="text-slate-400 font-normal">4:5 Canvas</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default AdminReferences;
