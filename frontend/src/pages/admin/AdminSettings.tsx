import React, { useState } from 'react';
import {
  Sliders,
  Sparkles,
  Save,
  CheckCircle2,
  Phone,
  Mail,
  Instagram,
  Layers,
  ShieldCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  GripVertical,
  Upload,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'landing' | 'quota' | 'identity'>('landing');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Tab 1: Landing Page CMS States (Diselaraskan 100% dengan LandingPage.tsx)
  const [heroHeadline, setHeroHeadline] = useState('Generator Konten AI Instan Sukamenak Studio');
  const [heroSubtitle, setHeroSubtitle] = useState(
    'Solusi cepat dan praktis untuk seluruh pelaku UMKM Sukamenak dalam menciptakan materi promosi digital profesional.'
  );
  const [heroCta, setHeroCta] = useState('Mulai Buat Poster');

  const [features, setFeatures] = useState([
    {
      id: 'f1',
      title: 'Pilihan Template Siap Pakai',
      desc: 'Tersedia beragam susunan poster untuk jualan makanan, produk kerajinan, hingga pengumuman. Tinggal tunjuk yang disukai tanpa harus menata dari awal.',
      expanded: true,
    },
    {
      id: 'f2',
      title: 'Penyesuaian Foto Praktis',
      desc: 'Cukup ambil foto produk lewat kamera HP biasa. Komposisi dan pencahayaannya otomatis diselaraskan agar dagangan tampil rapi dan menggugah selera.',
      expanded: false,
    },
    {
      id: 'f3',
      title: 'Akses Mudah',
      desc: 'Langsung dibuka melalui peramban di HP maupun laptop tanpa perlu pasang aplikasi tambahan. Bebas digunakan kapan saja tanpa biaya langganan.',
      expanded: false,
    },
  ]);

  const [faqs, setFaqs] = useState([
    {
      id: 'q1',
      question: 'Bagaimana cara memilih dan menggunakan template dari Galeri Prompt?',
      answer:
        'Cukup telusuri koleksi kartu di Galeri Template, lalu klik tombol "Gunakan". Sistem akan otomatis memuat gaya visual, susunan layout, dan pencahayaan template tersebut langsung ke Studio Generator tanpa perlu menyusun desain dari awal.',
      expanded: true,
    },
    {
      id: 'q2',
      question: 'Apakah harus mengerti cara menulis kata kunci (prompt) yang rumit?',
      answer:
        'Sama sekali tidak perlu! Semua prompt di dalam galeri sudah diatur dan diuji secara otomatis. Pelaku UMKM cukup memasukkan nama produk, harga, dan foto dari kamera HP biasa, sistem yang akan merapikan tata letak dan komposisinya secara instan.',
      expanded: false,
    },
    {
      id: 'q3',
      question: 'Apakah teks, tulisan promo, dan keterangan pada template bisa diubah bebas?',
      answer:
        'Sangat bisa. Anda bebas mengganti nama produk, varian rasa, nomor kontak WhatsApp pemesanan, hingga harga promo. Template galeri berfungsi sebagai fondasi visual siap pakai yang fleksibel sesuai kebutuhan usaha Anda.',
      expanded: false,
    },
    {
      id: 'q4',
      question: 'Kategori template apa saja yang sudah tersedia di Sukamenak Studio?',
      answer:
        'Tersedia ragam template yang disesuaikan untuk pelaku UMKM: Kuliner (keripik, kuliner lokal, kue basah), Produk Unggulan (kopi robusta komersial), Spanduk Promo & Bazar Komersial, hingga Kriya & Kerajinan Tangan.',
      expanded: false,
    },
    {
      id: 'q5',
      question: 'Bagaimana jika foto produk dari kamera HP saya agak redup atau kurang terang?',
      answer:
        'Prompt visual bawaan template Sukamenak Studio secara otomatis menyempurnakan pencahayaan redup, menonjolkan warna hidangan/kerajinan, serta memberi ruang teks (negative space) yang pas agar tulisan promosi Anda tetap terbaca jelas dan tajam.',
      expanded: false,
    },
    {
      id: 'q6',
      question: 'Apakah melihat dan menyalin template di galeri memotong kuota harian?',
      answer:
        'Melihat dan menyalin template di Galeri 100% bebas tanpa batas dan tidak memotong kuota. Kuota harian (15 kali generasi gratis/hari) hanya berkurang saat Anda menekan tombol Buat Poster di studio, dan seluruh hasil poster bebas dipakai untuk jualan komersial tanpa royalti.',
      expanded: false,
    },
  ]);

  const [contactWa, setContactWa] = useState('+62 812-3456-7890');
  const [contactEmail, setContactEmail] = useState('kontak@sukamenak.org');
  const [contactIg, setContactIg] = useState('@sukamenak.studio');

  // Tab 2: Policy & Quota States
  const [defaultDailyQuota, setDefaultDailyQuota] = useState(15);
  const [requireWatermark, setRequireWatermark] = useState(true);
  const [filterSensitivity, setFilterSensitivity] = useState(85);

  // Tab 3: Studio Identity States
  const [studioBrandName, setStudioBrandName] = useState('Sukamenak Studio');
  const [studioTagline, setStudioTagline] = useState('Platform Desain Visual Usaha Cerdas');
  const [footerCopyright, setFooterCopyright] = useState(
    '© 2026 Sukamenak Studio • Inisiatif Digital RW 15 Desa Sukamenak. Bebas Biaya untuk Kemajuan Bersama.'
  );

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const toggleFeatureExpand = (id: string) => {
    setFeatures((prev) =>
      prev.map((f) => (f.id === id ? { ...f, expanded: !f.expanded } : f))
    );
  };

  const updateFeature = (id: string, field: 'title' | 'desc', val: string) => {
    setFeatures((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: val } : f))
    );
  };

  const toggleFaqExpand = (id: string) => {
    setFaqs((prev) =>
      prev.map((q) => (q.id === id ? { ...q, expanded: !q.expanded } : q))
    );
  };

  const updateFaq = (id: string, field: 'question' | 'answer', val: string) => {
    setFaqs((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: val } : q))
    );
  };

  const addFaqItem = () => {
    const newId = `q${Date.now()}`;
    setFaqs((prev) => [
      ...prev,
      {
        id: newId,
        question: 'Pertanyaan baru mengenai layanan studio...',
        answer: 'Jawaban penjelasan praktis untuk pengguna.',
        expanded: true,
      },
    ]);
  };

  const removeFaqItem = (id: string) => {
    setFaqs((prev) => prev.filter((q) => q.id !== id));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. HEADER BANNER */}
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] px-6 py-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/25">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Pengaturan Global &amp; <span className="text-[#2563EB]">Konten Studio</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
              Sesuaikan teks landing page, kebijakan penggunaan sistem, dan identitas resmi studio secara langsung.
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-bold text-[#2563EB] shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
            <span>Perubahan berhasil disimpan &amp; disinkronkan!</span>
          </div>
        )}
      </div>

      {/* 2. SEGMENTED FROSTED GLASS TAB BAR */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-[#BFDBFE] p-1.5 shadow-xs flex items-center gap-1.5 max-w-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('landing')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'landing'
              ? 'bg-[#2563EB] text-white shadow-xs'
              : 'text-slate-600 hover:text-[#0F172A] hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Konten Landing Page</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('quota')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'quota'
              ? 'bg-[#2563EB] text-white shadow-xs'
              : 'text-slate-600 hover:text-[#0F172A] hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Kebijakan &amp; Kuota</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('identity')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'identity'
              ? 'bg-[#2563EB] text-white shadow-xs'
              : 'text-slate-600 hover:text-[#0F172A] hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Identitas Studio</span>
        </button>
      </div>

      {/* 3. TAB 1: KONTEN LANDING PAGE */}
      {activeTab === 'landing' && (
        <div className="space-y-6 max-w-4xl">
            {/* Card A: Hero Section Editor */}
            <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-[#BFDBFE] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center font-black text-xs">
                    A
                  </div>
                  <h3 className="text-sm font-extrabold text-[#0F172A]">
                    Seksi Utama <span className="text-[#2563EB]">(Hero Banner)</span>
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-400">Tampilan Paling Atas</span>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Judul Utama (Headline):
                  </label>
                  <input
                    type="text"
                    value={heroHeadline}
                    onChange={(e) => setHeroHeadline(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs sm:text-sm font-bold text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Sub-judul Ajakan:
                  </label>
                  <textarea
                    rows={2}
                    value={heroSubtitle}
                    onChange={(e) => setHeroSubtitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs text-[#0F172A] leading-relaxed focus:bg-white focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Teks Tombol Aksi (CTA):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={heroCta}
                      onChange={(e) => setHeroCta(e.target.value)}
                      className="flex-1 px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs font-bold text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                    />
                    <div className="px-3.5 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold flex items-center gap-1 shadow-xs">
                      <span>Pratinjau: {heroCta}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card B: Seksi Fitur & Layanan */}
            <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-[#BFDBFE] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center font-black text-xs">
                    B
                  </div>
                  <h3 className="text-sm font-extrabold text-[#0F172A]">
                    Seksi Fitur &amp; <span className="text-[#2563EB]">Keunggulan Studio</span>
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-400">3 Poin Layanan Utama</span>
              </div>

              <div className="space-y-3">
                {features.map((f, idx) => (
                  <div
                    key={f.id}
                    className="rounded-2xl border border-slate-200 bg-[#F8FAFC] overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFeatureExpand(f.id)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-100/60 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-blue-100 text-[#2563EB] flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-[#0F172A]">{f.title}</span>
                      </div>
                      {f.expanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {f.expanded && (
                      <div className="p-4 border-t border-slate-200 bg-white space-y-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Judul Fitur:
                          </label>
                          <input
                            type="text"
                            value={f.title}
                            onChange={(e) => updateFeature(f.id, 'title', e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs font-bold text-[#0F172A]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Deskripsi Singkat (2 Baris):
                          </label>
                          <textarea
                            rows={2}
                            value={f.desc}
                            onChange={(e) => updateFeature(f.id, 'desc', e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs text-[#0F172A] leading-relaxed"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Card C: Kelola Tanya Jawab (FAQ) */}
            <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-[#BFDBFE] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center font-black text-xs">
                    C
                  </div>
                  <h3 className="text-sm font-extrabold text-[#0F172A]">
                    Kelola Tanya Jawab <span className="text-[#2563EB]">(FAQ)</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={addFaqItem}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#2563EB] text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Pertanyaan</span>
                </button>
              </div>

              <div className="space-y-3">
                {faqs.map((q, idx) => (
                  <div
                    key={q.id}
                    className="rounded-2xl border border-slate-200 bg-[#F8FAFC] overflow-hidden"
                  >
                    <div className="px-4 py-3 flex items-center justify-between gap-2 bg-[#F8FAFC]">
                      <div className="flex items-center gap-2.5 flex-1">
                        <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                        <span className="text-xs font-bold text-[#0F172A] truncate">
                          {q.question}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleFaqExpand(q.id)}
                          className="p-1 rounded-lg hover:bg-slate-200 text-slate-500"
                        >
                          {q.expanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        {faqs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFaqItem(q.id)}
                            className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {q.expanded && (
                      <div className="p-4 border-t border-slate-200 bg-white space-y-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Pertanyaan:
                          </label>
                          <input
                            type="text"
                            value={q.question}
                            onChange={(e) => updateFaq(q.id, 'question', e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs font-bold text-[#0F172A]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Jawaban Penjelasan:
                          </label>
                          <textarea
                            rows={2}
                            value={q.answer}
                            onChange={(e) => updateFaq(q.id, 'answer', e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs text-[#0F172A] leading-relaxed"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Card D: Kontak & Saluran Bantuan */}
            <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-[#BFDBFE] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center font-black text-xs">
                    D
                  </div>
                  <h3 className="text-sm font-extrabold text-[#0F172A]">
                    Kontak &amp; <span className="text-[#2563EB]">Saluran Bantuan</span>
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-400">Ditampilkan di Footer</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>WhatsApp Pengelola</span>
                  </label>
                  <input
                    type="text"
                    value={contactWa}
                    onChange={(e) => setContactWa(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs font-bold text-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Email Resmi</span>
                  </label>
                  <input
                    type="text"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs font-bold text-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                    <Instagram className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Instagram Resmi</span>
                  </label>
                  <input
                    type="text"
                    value={contactIg}
                    onChange={(e) => setContactIg(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs font-bold text-[#0F172A]"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handleSave()}
                className="px-6 py-3 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-extrabold shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Perubahan Landing Page</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHeroHeadline('Generator Konten AI Instan Sukamenak Studio');
                  setHeroSubtitle(
                    'Solusi cepat dan praktis untuk seluruh pelaku UMKM Sukamenak dalam menciptakan materi promosi digital profesional.'
                  );
                  setHeroCta('Mulai Buat Poster');
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
        </div>
      )}

      {/* 4. TAB 2: KEBIJAKAN & KUOTA */}
      {activeTab === 'quota' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-[#BFDBFE] p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A]">
                Kebijakan Kuota &amp; <span className="text-[#2563EB]">Proteksi Generasi</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Atur batasan alokasi harian per akun dan perlindungan hak cipta visual studio.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Batas Kuota Pembuatan Harian Bawaan:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={defaultDailyQuota}
                    onChange={(e) => setDefaultDailyQuota(Number(e.target.value))}
                    className="w-24 px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-sm font-extrabold text-[#0F172A] text-center"
                  />
                  <span className="text-xs font-bold text-slate-600">Desain / Akun / Hari</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold text-[#0F172A]">
                    Wajib Watermark Logo Studio
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Sematkan cap tipis "Sukamenak Studio" di sudut hasil desain poster.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRequireWatermark(!requireWatermark)}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${
                    requireWatermark ? 'bg-[#2563EB] justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                </button>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-[#0F172A] mb-1">
                  <span>Sensitivitas Filter Konten Terlarang:</span>
                  <span className="text-[#2563EB]">{filterSensitivity}% (Ketat)</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={filterSensitivity}
                  onChange={(e) => setFilterSensitivity(Number(e.target.value))}
                  className="w-full accent-[#2563EB] cursor-pointer"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Mencegah otomatis penyalahgunaan konten berbau judi, kekerasan, atau pelanggaran etika.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleSave()}
                className="w-full py-3 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-extrabold shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Kebijakan &amp; Kuota</span>
              </button>
            </div>
          </div>

          {/* Side Info Card */}
          <div className="bg-gradient-to-br from-white to-blue-50/40 rounded-3xl border border-[#BFDBFE] p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-[#2563EB]">
              <ShieldAlert className="w-5 h-5" />
              <h4 className="text-sm font-extrabold text-[#0F172A]">Informasi Kepatuhan Sistem</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Seluruh parameter kebijakan kuota dan filter diterapkan secara real-time pada seluruh sesi pengguna UMKM yang aktif. Pelanggaran berulang terhadap filter sensitivitas akan masuk dalam antrean log audit keamanan.
            </p>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span>Total Pengguna Terdampak:</span>
                <strong className="text-[#0F172A]">540 Akun</strong>
              </div>
              <div className="flex justify-between">
                <span>Status Filter:</span>
                <strong className="text-[#2563EB]">Aktif &bull; Level Proteksi A+</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 3: IDENTITAS STUDIO */}
      {activeTab === 'identity' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-[#BFDBFE] p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A]">
                Identitas Resmi <span className="text-[#2563EB]">Sukamenak Studio</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola nama merk studio, logo glyph, dan tanda hak cipta resmi.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Nama Resmi Studio:
                </label>
                <input
                  type="text"
                  value={studioBrandName}
                  onChange={(e) => setStudioBrandName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs sm:text-sm font-bold text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Tagline Studio:
                </label>
                <input
                  type="text"
                  value={studioTagline}
                  onChange={(e) => setStudioTagline(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Teks Hak Cipta Footer:
                </label>
                <textarea
                  rows={2}
                  value={footerCopyright}
                  onChange={(e) => setFooterCopyright(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs text-[#0F172A] leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Logo Glyph Studio:
                </label>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200">
                  <div className="w-12 h-12 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center font-black text-xl shadow-md shadow-blue-500/25">
                    ✦
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#0F172A]">Glyph Logo Vektor Aktif</div>
                    <div className="text-[11px] text-slate-500">Format SVG/PNG transparan 512x512</div>
                  </div>
                  <button
                    type="button"
                    className="ml-auto px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-[#2563EB] text-xs font-bold text-[#0F172A] transition-colors"
                  >
                    Ganti Logo
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSave()}
                className="w-full py-3 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-extrabold shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Identitas Studio</span>
              </button>
            </div>
          </div>

          {/* Preview Identity Card */}
          <div className="bg-gradient-to-br from-[#0F172A] via-[#111C38] to-[#1E3A8A] text-white rounded-3xl p-6 shadow-xl space-y-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 block">
              Pratinjau Wordmark Studio
            </span>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/25">
                ✦
              </div>
              <div>
                <div className="text-lg font-black tracking-tight">{studioBrandName}</div>
                <div className="text-xs text-sky-300">{studioTagline}</div>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-xs text-slate-300 leading-relaxed">
              {footerCopyright}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
