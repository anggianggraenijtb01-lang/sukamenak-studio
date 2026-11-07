import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Copy,
  Share2,
  ArrowRight,
  Eye,
  Check,
  X,
  Search,
  Image as ImageIcon,
} from 'lucide-react';

export const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = [
    'Semua',
    'Kuliner UMKM',
    'Kriya & Kerajinan',
    'Fashion',
    'Jasa',
    'Katalog Produk',
    'Poster Promo',
  ];

  const templates = [
    {
      id: 't1',
      title: 'Keripik Tempe Gurih Daun Jeruk',
      category: 'Kuliner UMKM',
      desc: 'Full-shot close-up foto produk kemasan keripik tempe renyah dengan taburan daun jeruk segar, pencahayaan alami studio hangat.',
      prompt: 'Foto kemasan produk keripik tempe renyah gurih standing pouch berdiri tegak di atas meja kayu minimalis bersih, pencahayaan studio komersial hangat dengan bayangan lembut alami tanpa flare berlebih.',
      image: '/posters/poster-keripik.jpg',
      badge: 'Kuliner UMKM',
      modelBadge: 'AI Studio',
      price: 'Rp 15.000',
    },
    {
      id: 't2',
      title: 'Kopi Robusta Puntang Single Origin',
      category: 'Katalog Produk',
      desc: 'Visual elegan kemasan standing pouch kopi lokal Puntang dengan biji kopi sangrai tersebar di atas kain goni estetik.',
      prompt: 'Foto studio kemasan standing pouch kraft kopi bubuk robusta Puntang single origin, di sekelilingnya butiran biji kopi panggang harum, background netral slate terang elegan.',
      image: '/posters/poster-kopi.jpg',
      badge: 'Katalog Produk',
      modelBadge: 'AI Studio',
      price: 'Rp 45.000',
    },
    {
      id: 't3',
      title: 'Bazar Murah Sembako Warga RT 03',
      category: 'Poster Promo',
      desc: 'Poster informasi bazar beras, minyak goreng, dan sembako murah dengan susunan tipografi rapi dan jelas.',
      prompt: 'Poster promosi bazar murah sembako desa berlatar susunan komoditas bahan pokok segar, tipografi tegas terbaca jelas, palet warna navy dan royal blue teratur.',
      image: '/posters/poster-bazar.jpg',
      badge: 'Poster Promo',
      modelBadge: 'AI Studio',
      price: 'Gratis Masuk',
    },
    {
      id: 't4',
      title: 'Kue Basah & Jajanan Tradisional',
      category: 'Kuliner UMKM',
      desc: 'Tata letak hidangan kue basah tradisional aneka warna tersusun rapi di atas tampah beralaskan daun pisang segar.',
      prompt: 'Close-up foto aneka jajanan pasar kue basah tradisional di atas nampan anyaman bambu beralaskan daun pisang segar, lighting lembut studio natural, detail tekstur kue tajam.',
      image: '/posters/poster-kue.jpg',
      badge: 'Kuliner UMKM',
      modelBadge: 'AI Studio',
      price: 'Mulai Rp 2.500',
    },
    {
      id: 't5',
      title: 'Tas Rajut & Kriya Kreatif PKK',
      category: 'Kriya & Kerajinan',
      desc: 'Foto katalog produk tas rajut anyaman tangan karya kelompok kreatif ibu-ibu PKK dengan latar bersih dan serat kain rapi.',
      prompt: 'Tas rajut anyaman tangan benang katun rajutan rapi karya kerajinan ibu-ibu PKK, diletakkan di atas lantai kayu minimalis bersih, pencahayaan alami studio terang dan lembut tanpa bayangan tajam.',
      image: '/posters/poster-kriya.jpg',
      badge: 'Kriya & Kerajinan',
      modelBadge: 'AI Studio',
      price: 'Rp 75.000',
    },
    {
      id: 't6',
      title: 'Busana Muslim & Hijab Warga',
      category: 'Fashion',
      desc: 'Katalog lookbook busana muslimah dan hijab lokal karya penjahit kreatif dengan pencahayaan lembut.',
      prompt: 'Katalog display busana muslimah hijab kain katun premium warna navy dan slate, flatlay teratur di atas latar marmer terang, pencahayaan studio softbox lembut.',
      image: '/posters/poster-kriya.jpg',
      badge: 'Fashion',
      modelBadge: 'AI Studio',
      price: 'Rp 120.000',
    },
    {
      id: 't7',
      title: 'Layanan Jasa Servis Elektronik',
      category: 'Jasa',
      desc: 'Poster layanan servis peralatan rumah tangga warga cepat & bergaransi dengan nomor WhatsApp pemesanan jelas.',
      prompt: 'Poster promosi jasa reparasi dan servis elektronik warga desa terpercaya, tata letak modern minimalis dengan ruang nomor kontak WhatsApp jelas.',
      image: '/posters/poster-bazar.jpg',
      badge: 'Jasa',
      modelBadge: 'AI Studio',
      price: 'Konsultasi Gratis',
    },
    {
      id: 't8',
      title: 'Koleksi Aneka Keripik Singkong & Pisang',
      category: 'Kuliner UMKM',
      desc: 'Paket bundling oleh-oleh aneka keripik renyah gurih kemasan standing pouch higienis siap antar.',
      prompt: 'Deretan 3 kemasan standing pouch aneka camilan keripik singkong pedas dan manis, tata letak simetris studio profesional komersial.',
      image: '/posters/poster-keripik.jpg',
      badge: 'Kuliner UMKM',
      modelBadge: 'AI Studio',
      price: 'Rp 20.000',
    },
  ];

  const filteredTemplates = templates.filter((t) => {
    const matchesCategory =
      activeCategory === 'Semua' ||
      t.category.toLowerCase() === activeCategory.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCopyPrompt = (id: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleUseInStudio = (tpl: any) => {
    navigate('/creator/studio');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* MODULE 2: GALERI TEMPLATE - STANDALONE CONTROLS (Floating directly on light slate canvas) */}
      <div className="space-y-4">
        {/* Left: Standalone search bar floating directly on canvas */}
        <div className="relative max-w-xl">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4 text-[#2563EB]" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari inspirasi template promosi..."
            className="w-full pl-11 pr-5 py-3 rounded-full bg-white border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder:text-slate-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all"
          />
        </div>

        {/* Fully Visible Multi-Category Chips: wrapped row (NOT hidden in horizontal scroll) */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                activeCategory === cat
                  ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/25 border border-[#2563EB]'
                  : 'bg-white border border-[#CBD5E1] text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TEMPLATE GRID: High-density 4-column responsive grid
          Each card: 4:5 preview, top-left pill badge, clean 1-line title,
          and bottom action button "Pakai Template →"
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((tpl) => (
          <div
            key={tpl.id}
            className="bg-white rounded-3xl p-3.5 sm:p-4 border border-[#CBD5E1] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1.5 select-none"
          >
            {/* Edge-to-edge 4:5 preview image */}
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-100 mb-3 border border-slate-100">
              <img
                src={tpl.image}
                alt={tpl.title}
                draggable={false}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />

              {/* Top-Left Pill Badge */}
              <div className="absolute top-2.5 left-2.5">
                <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md border border-white text-[10px] font-black text-[#2563EB] shadow-xs">
                  {tpl.badge}
                </span>
              </div>

              {/* Top-Right Preview Trigger */}
              <button
                type="button"
                onClick={() => setPreviewTemplate(tpl)}
                title="Pratinjau Prompt"
                className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Clean 1-Line Title & Description */}
            <div className="px-1 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-sans text-sm sm:text-base font-bold text-[#0F172A] truncate" title={tpl.title}>
                  {tpl.title}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 mt-1 font-normal leading-relaxed">
                  {tpl.desc}
                </p>
              </div>

              {/* Action Buttons: Pakai Template → & Salin Teks */}
              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleUseInStudio(tpl)}
                  className="w-full py-2.5 px-3 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer hover:shadow-md"
                >
                  <span>Pakai Template</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyPrompt(tpl.id, tpl.prompt)}
                  className="w-full py-2.5 px-3 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0F172A] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedId === tpl.id ? (
                    <>
                      <Check className="w-3 h-3 text-[#2563EB]" />
                      <span className="text-[#2563EB]">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-500" />
                      <span>Salin Teks</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL PREVIEW PROMPT
      ───────────────────────────────────────────────────────────── */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-4">
            
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB]">
                  {previewTemplate.category}
                </span>
                <h3 className="text-lg font-black text-[#0F172A] leading-snug">
                  {previewTemplate.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Prompt Text Box */}
            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] font-mono leading-relaxed select-all">
              {previewTemplate.prompt}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleCopyPrompt(previewTemplate.id, previewTemplate.prompt)}
                className="px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-xs font-bold text-slate-700 hover:border-[#2563EB] hover:text-[#2563EB] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedId === previewTemplate.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                    <span>Tersalin ke Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Teks Prompt</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreviewTemplate(null);
                  navigate('/creator/studio');
                }}
                className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition-all cursor-pointer"
              >
                <span>Gunakan di Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Gallery;
