import React, { useEffect, useRef, useState } from 'react';
import {
  UploadCloud,
  Download,
  MessageCircle,
  Sparkles,
  Zap,
  Check,
  Camera,
  Layers,
  Sliders,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { useStudio } from '../../components/common/StudioContext';
import { handleStudioGenerateRequest } from '../../controllers/generationController';

export const StudioGenerator: React.FC = () => {
  const {
    quotaRemaining,
    consumeQuota,
  } = useStudio();

    type AspectRatio = '4:5' | '1:1' | '9:16' | '16:9';

  const RATIO_OPTIONS = [
    { id: '4:5', label: '4:5 Vertikal', desc: 'Feed Medsos', resolution: '1080 x 1350', aspectClass: 'aspect-[4/5]' },
    { id: '1:1', label: '1:1 Persegi', desc: 'Katalog & WhatsApp', resolution: '1080 x 1080', aspectClass: 'aspect-square' },
    { id: '9:16', label: '9:16 Story', desc: 'Story & Status', resolution: '1080 x 1920', aspectClass: 'aspect-[9/16] max-h-[460px] mx-auto' },
    { id: '16:9', label: '16:9 Banner', desc: 'Lanskap Web', resolution: '1920 x 1080', aspectClass: 'aspect-video' },
  ];

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('4:5');
  const selectedRatio = RATIO_OPTIONS.find((r) => r.id === aspectRatio) || RATIO_OPTIONS[0];

  const [generatorMode, setGeneratorMode] = useState<'photo' | 'text'>('photo');
  const [title, setTitle] = useState('Keripik Tempe Gurih Daun Jeruk');
  const [promptText, setPromptText] = useState(() => {
    const saved = localStorage.getItem('sukamenak_active_prompt');
    if (saved) {
      localStorage.removeItem('sukamenak_active_prompt');
      return saved;
    }
    return 'Full-shot close-up foto produk keripik tempe renyah di atas piring kayu saji dengan taburan daun jeruk segar, pencahayaan alami studio hangat.';
  });
  const [priceTag, setPriceTag] = useState('Rp 15.000');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(4); // 1: Analisis, 2: Komposisi, 3: Render, 4: Selesai
  const [posterImage, setPosterImage] = useState<string>('/posters/poster-keripik.jpg');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Compactness calculation
  const compactnessScore = Math.min(
    98,
    Math.max(65, Math.round(100 - (promptText.length / 300) * 25))
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPosterImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quotaRemaining <= 0) {
      alert('Kuota harian Anda habis. Silakan reset kuota demo di header.');
      return;
    }

    setIsGenerating(true);
    setActiveStep(1);

    setTimeout(() => {
      setActiveStep(2);
    }, 700);

    setTimeout(() => {
      setActiveStep(3);
    }, 1500);

    setTimeout(() => {
      setActiveStep(4);
      setIsGenerating(false);
      consumeQuota();
    }, 2400);
  };

  const handleDownloadHD = () => {
    const link = document.createElement('a');
    link.href = posterImage;
    link.download = `poster-${title.toLowerCase().replace(/\s+/g, '-')}-hd.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(
      `*${title}*\n${promptText}\nHarga: ${priceTag}\n\nDibuat dengan Sukamenak Studio`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* ═══════════════════════════════════════════════════════════════════
          GREETING BANNER (Direct greeting without honorifics)
      ═══════════════════════════════════════════════════════════════════ */}
      {/* ─────────────────────────────────────────────────────────────
          MODULE 3: STUDIO GENERATOR - FUNCTIONAL HEADER
          (Strictly NO "Halo" or personal greetings here)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 sm:p-7 shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
            Studio <span className="text-[#2563EB]">Generator</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-1 font-normal">
            Generator visual promosi komersial mandiri untuk UMKM &amp; kreator pengguna Sukamenak Studio.
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION B: STUDIO GENERATOR WORKSPACE (2 Columns)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ── LEFT COLUMN: CONTROLS & COMPACTNESS METER (7 COLS) ── */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-8 shadow-sm space-y-6">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-lg font-black text-[#0F172A] tracking-tight flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#2563EB]" />
              <span>Pengaturan Desain Poster</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">Langkah Praktis</span>
          </div>

          <form onSubmit={handleGenerate} className="space-y-5">
            
            {/* Pill Toggle between 'Foto ke Gambar' and 'Teks ke Gambar' */}
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-2">
                Metode Pembuatan
              </label>
              <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-[#F8FAFC] border border-[#CBD5E1]">
                <button
                  type="button"
                  onClick={() => setGeneratorMode('photo')}
                  className={`px-5 py-2 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                    generatorMode === 'photo'
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-slate-600 hover:text-[#0F172A]'
                  }`}
                >
                  Foto ke Gambar (Utama)
                </button>
                <button
                  type="button"
                  onClick={() => setGeneratorMode('text')}
                  className={`px-5 py-2 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                    generatorMode === 'text'
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-slate-600 hover:text-[#0F172A]'
                  }`}
                >
                  Teks ke Gambar
                </button>
              </div>
            </div>

            {/* Pilihan Ukuran & Rasio Gambar Bebas */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#0F172A]">
                  Pilihan Ukuran &amp; Rasio Desain
                </label>
                <span className="text-[10px] font-mono text-[#2563EB] font-bold">
                  Resolusi: {selectedRatio.resolution}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {RATIO_OPTIONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setAspectRatio(r.id as AspectRatio)}
                    className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                      aspectRatio === r.id
                        ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB] shadow-xs ring-1 ring-blue-500/20'
                        : 'bg-[#F8FAFC] border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-black">{r.label}</div>
                    <div className="text-[9px] text-slate-400">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Compact Dashed Dropzone for Smartphone Product Photos */}
            {generatorMode === 'photo' && (
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Foto Produk dari Kamera HP
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl border-2 border-dashed border-[#BFDBFE] hover:border-[#2563EB] bg-[#EFF6FF]/40 hover:bg-[#EFF6FF]/70 p-5 text-center flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group"
                >
                  <div className="w-11 h-11 rounded-full bg-white text-[#2563EB] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <Camera className="w-5 h-5 text-[#2563EB]" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-[#2563EB]">
                      Klik untuk Ambil Foto Kamera HP
                    </span>
                    <span className="text-xs text-slate-500"> atau seret gambar ke sini</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Format JPG atau PNG (Otomatis ditata komposisi &amp; pencahayaannya)
                  </span>
                </div>
              </div>
            )}

            {/* Textarea with Real-Time Horizontal Compactness Meter Bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#0F172A]">
                  Deskripsi Visual &amp; Petunjuk Prompt
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {promptText.length} Karakter
                  </span>
                  <span className="text-[10px] font-bold text-[#2563EB]">
                    {compactnessScore}% Efektif
                  </span>
                </div>
              </div>

              <textarea
                rows={3}
                required
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Tuliskan gambaran foto produk yang diinginkan..."
                className="w-full p-3.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs text-[#0F172A] leading-relaxed resize-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all"
              />

              {/* Horizontal Compactness Meter Bar */}
              <div className="mt-2 space-y-1">
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-[#2563EB] rounded-full transition-all duration-300"
                    style={{ width: `${compactnessScore}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>Ringkas &amp; Padat</span>
                  <span>Optimal untuk AI Image Synthesis</span>
                </div>
              </div>
            </div>

            {/* Solid Royal Blue CTA 'Buat Poster Instan' */}
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-4 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-500/25 transition-all hover:shadow-2xl hover:shadow-blue-500/35 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-70 disabled:pointer-events-none"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGenerating ? 'Sedang Memproses Poster...' : 'Buat Poster Instan'}</span>
            </button>
          </form>

        </div>

        {/* ── RIGHT COLUMN: 4:5 POSTER PREVIEW & ASYNC TRACKER (5 COLS) ── */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-8 shadow-sm space-y-5">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB] block">
                PRATINJAU HASIL
              </span>
              <h3 className="text-base font-black text-[#0F172A]">
                Draf Poster Rasio 4:5
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#0F172A] text-white text-[10px] font-mono font-bold">
              4:5 HD (1080x1350)
            </span>
          </div>

          {/* 4:5 Poster Preview Canvas with Realistic Render Card */}
          <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-slate-900 group">
            <img
              src={posterImage}
              alt={title}
              className={`w-full h-full object-cover transition-all duration-700 ${
                isGenerating ? 'scale-105 filter blur-xs' : 'scale-100'
              }`}
            />

            {/* Top Badge Overlay */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider border border-white/20">
                KULINER UMKM
              </span>
            </div>

            {/* Bottom Title & Price Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 text-white">
              <span className="inline-block px-2 py-0.5 rounded bg-[#2563EB] text-[10px] font-black uppercase mb-1">
                Katalog Siap Cetak
              </span>
              <h4 className="font-black text-lg leading-tight drop-shadow-sm">
                {title}
              </h4>
              <p className="text-xs text-blue-200 mt-1 font-semibold flex items-center justify-between">
                <span>{priceTag}</span>
                <span className="text-[11px] text-white/80 font-normal">Sukamenak Studio</span>
              </p>
            </div>

            {/* Generation Spinner Overlay */}
            {isGenerating && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-3 p-6 text-center">
                <div className="w-10 h-10 border-4 border-white/20 border-t-[#2563EB] rounded-full animate-spin" />
                <span className="text-sm font-bold">Menyusun Komposisi AI...</span>
              </div>
            )}
          </div>

          {/* 4-Step Horizontal Async Progress Tracker */}
          <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-slate-200">
            <div className="grid grid-cols-4 gap-2 text-center select-none">
              
              <div className="flex flex-col items-center gap-1">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${
                    activeStep >= 1 ? 'bg-[#2563EB] text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  ✓
                </span>
                <span className={`text-[10px] ${activeStep >= 1 ? 'font-black text-[#0F172A]' : 'text-slate-400'}`}>
                  Analisis
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${
                    activeStep >= 2 ? 'bg-[#2563EB] text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  ✓
                </span>
                <span className={`text-[10px] ${activeStep >= 2 ? 'font-black text-[#0F172A]' : 'text-slate-400'}`}>
                  Komposisi
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${
                    activeStep >= 3 ? 'bg-[#2563EB] text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  ✓
                </span>
                <span className={`text-[10px] ${activeStep >= 3 ? 'font-black text-[#0F172A]' : 'text-slate-400'}`}>
                  Render
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${
                    activeStep >= 4 ? 'bg-[#2563EB] text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  ✓
                </span>
                <span className={`text-[10px] ${activeStep >= 4 ? 'font-black text-[#2563EB]' : 'text-slate-400'}`}>
                  Selesai
                </span>
              </div>

            </div>
          </div>

          {/* Single Direct Action Button: Unduh HD */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleDownloadHD}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/25 active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Gambar HD ({selectedRatio.resolution})</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
