import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  LayoutTemplate,
  UploadCloud,
  Download,
  Star,
  ChevronDown,
  ChevronUp,
  Printer,
  Layers,
  Monitor,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Clock,
  Flame,
  Check,
  Smartphone,
  Quote,
  Camera,
  Wand2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Share2,
  Heart,
  Image as ImageIcon,
  Globe,
} from 'lucide-react';
import { getFeatureSvg, getLightFeatureIllustration } from '../../services/posterGraphics';

/* ─── Koleksi Template Poster Lokal Siap Pakai (Style Referensi Modern Prompt) ─── */
const TEMPLATES_SHOWCASE = [
  {
    id: 't1',
    title: 'Keripik Tempe Gurih Daun Jeruk',
    category: 'UMKM Kuliner',
    desc: 'Full-shot close-up foto produk keripik tempe renyah di atas piring kayu saji dengan taburan daun jeruk segar, pencahayaan alami studio hangat.',
    image: '/posters/poster-keripik.jpg',
    modelBadge: 'Template Siap Pakai',
    likes: 48,
  },
  {
    id: 't2',
    title: 'Pengajian Rutin Silaturahmi Warga',
    category: 'Pengumuman Resmi',
    desc: 'Format poster pengumuman jadwal pengajian rutin bulanan warga desa dengan kaligrafi islami anggun dan layout tipografi jelas.',
    image: '/posters/poster-pengajian.jpg',
    modelBadge: 'Template Siap Pakai',
    likes: 35,
  },
  {
    id: 't3',
    title: 'Bazar Murah Sembako RT 03',
    category: 'Kegiatan Warga',
    desc: 'Suasana pasar rakyat bazar murah sembako dan festival aneka kuliner warga desa dengan hiasan bendera semarak.',
    image: '/posters/poster-bazar.jpg',
    modelBadge: 'Template Siap Pakai',
    likes: 52,
  },
  {
    id: 't4',
    title: 'Kopi Robusta Pegunungan Sukamenak',
    category: 'Produk Unggulan Desa',
    desc: 'Tampilan premium secangkir kopi hitam panas mengepul dari biji robusta asli perkebunan desa dengan tekstur meja kayu rustic.',
    image: '/posters/poster-kopi.jpg',
    modelBadge: 'Template Siap Pakai',
    likes: 61,
  },
  {
    id: 't5',
    title: 'Tas Rajut & Kriya Kreatif PKK',
    category: 'Kriya & Fashion',
    desc: 'Foto katalog produk tas rajut anyaman tangan karya kelompok kreatif ibu-ibu PKK dengan latar bersih dan detail serat kain rapi.',
    image: '/posters/poster-kriya.jpg',
    modelBadge: 'Template Siap Pakai',
    likes: 29,
  },
];

/* ─── FAQs with Category Tagging (Fokus Galeri Template & Prompt Warga) ──── */
const FAQS = [
  {
    id: 'f1',
    category: 'Galeri Template',
    q: 'Bagaimana cara memilih dan menggunakan template dari Galeri Prompt?',
    a: 'Cukup telusuri koleksi kartu di Galeri Template, lalu klik tombol "Gunakan". Sistem akan otomatis memuat gaya visual, susunan layout, dan pencahayaan template tersebut langsung ke Studio Generator tanpa perlu menyusun desain dari awal.',
  },
  {
    id: 'f2',
    category: 'Cara Pakai Prompt',
    q: 'Apakah warga harus mengerti cara menulis kata kunci (prompt) yang rumit?',
    a: 'Sama sekali tidak perlu! Semua prompt di dalam galeri sudah diatur dan diuji secara otomatis. Warga dan pelaku UMKM cukup memasukkan nama produk, harga, dan foto dari kamera HP biasa, sistem yang akan merapikan tata letak dan komposisinya secara instan.',
  },
  {
    id: 'f3',
    category: 'Kustomisasi Desain',
    q: 'Apakah teks, tulisan promo, dan keterangan pada template bisa diubah bebas?',
    a: 'Sangat bisa. Anda bebas mengganti nama produk, varian rasa, tanggal kegiatan warga, nomor kontak WhatsApp pemesanan, hingga harga promo. Template galeri berfungsi sebagai fondasi visual siap pakai yang fleksibel sesuai kebutuhan usaha Anda.',
  },
  {
    id: 'f4',
    category: 'Galeri Template',
    q: 'Kategori template apa saja yang sudah tersedia di Sukamenak Studio?',
    a: 'Tersedia ragam template yang disesuaikan untuk pelaku UMKM: Kuliner (keripik, kuliner lokal, kue basah), Produk Unggulan (kopi robusta komersial), Spanduk Promo & Bazar Komersial, hingga Kriya & Kerajinan Tangan.',
  },
  {
    id: 'f5',
    category: 'Cara Pakai Prompt',
    q: 'Bagaimana jika foto produk dari kamera HP saya agak redup atau kurang terang?',
    a: 'Prompt visual bawaan template Sukamenak Studio secara otomatis menyempurnakan pencahayaan redup, menonjolkan warna hidangan/kerajinan, serta memberi ruang teks (negative space) yang pas agar tulisan promosi Anda tetap terbaca jelas dan tajam.',
  },
  {
    id: 'f6',
    category: 'Batas Kuota & Lisensi',
    q: 'Apakah melihat dan menyalin template di galeri memotong kuota harian?',
    a: 'Melihat dan menyalin template di Galeri 100% bebas tanpa batas dan tidak memotong kuota. Kuota harian (15 kali generasi gratis/hari) hanya berkurang saat Anda menekan tombol Buat Poster di studio, dan seluruh hasil poster bebas dipakai untuk jualan komersial tanpa royalti.',
  },
];

export const LandingPage: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<string | null>('f1');
  const [activeFaqCategory, setActiveFaqCategory] = useState<string>('Semua');
  const cardScrollRef = React.useRef<HTMLDivElement>(null);

  const scrollCards = (direction: 'left' | 'right') => {
    if (cardScrollRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      cardScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const filteredFaqs =
    activeFaqCategory === 'Semua'
      ? FAQS
      : FAQS.filter((f) => f.category === activeFaqCategory);

  return (
    <div className="bg-[#F8FAFC] text-[#0F172A] selection:bg-[#1E40AF] selection:text-white">

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 — HERO SECTION
          Ciri Khas: "Moving Frosted Glass & Dynamic Fan Showcase"
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        id="beranda"
        className="relative bg-gradient-to-b from-[#EFF6FF] via-[#F8FAFC] to-[#F8FAFC] pt-24 sm:pt-28 pb-48 sm:pb-56 overflow-hidden min-h-[76vh] flex flex-col justify-center"
      >
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#1E40AF 1px, transparent 1px), linear-gradient(90deg, #1E40AF 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* ── Moving Frosted Glass Glow Orbs (Kaya glass yang bergerak-gerak di background) ── */}
        <div className="absolute top-10 left-10 w-96 h-96 rounded-full bg-gradient-to-br from-[#0284C7]/20 to-[#1E40AF]/15 blur-3xl animate-pulse-glow pointer-events-none" />
        <div className="absolute top-28 right-10 w-[420px] h-[420px] rounded-full bg-gradient-to-bl from-[#60A5FA]/20 to-[#1E40AF]/10 blur-3xl animate-float-slow pointer-events-none" />
        <div className="absolute bottom-20 left-1/3 w-80 h-80 rounded-full bg-gradient-to-tr from-[#38BDF8]/15 to-[#0F172A]/5 blur-3xl animate-float-reverse pointer-events-none" />

        {/* ── Main Hero Content ── */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          {/* Top Capsule Badge with Glass Border */}
          <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full glass-panel shadow-sm text-xs font-extrabold text-[#1E40AF] mb-8 border border-white/80 hover:border-[#BFDBFE] transition-colors">
            <span className="w-2 h-2 rounded-full bg-[#1E40AF] animate-ping" />
            <span>Platform Kreatif Digital UMKM Sukamenak</span>
          </div>

          {/* Headline Utama */}
          <h1 className="text-[#0F172A] leading-[1.08] mb-6 tracking-tight">
            <span className="block text-4xl sm:text-5xl lg:text-6xl font-black">
              Generator Konten AI Instan
            </span>
            <span className="block text-4xl sm:text-5xl lg:text-6xl font-black text-[#1E40AF] mt-2">
              Sukamenak Studio
            </span>
          </h1>

          {/* Sub-headline Deskriptif (Tanpa kata 100% gratis) */}
          <p className="text-base sm:text-lg text-[#475569] max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
            Solusi cepat dan praktis untuk seluruh pelaku UMKM Sukamenak dalam menciptakan materi promosi digital profesional.
          </p>

          {/* Tombol Aksi CTA Ganda */}
          <div className="flex flex-wrap justify-center items-center gap-4">
            <Link
              to="/creator/studio"
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#1E40AF] hover:bg-[#1E3A8A] text-white font-extrabold text-base shadow-xl shadow-blue-500/25 transition-all hover:shadow-2xl hover:shadow-blue-500/35 hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Mulai Buat Poster</span>
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>

            <a
              href="#cara-kerja"
              className="inline-flex items-center gap-2 px-7 py-4 rounded-full glass-panel hover:bg-white text-[#0F172A] font-bold text-base transition-all hover:border-[#1E40AF]"
            >
              Lihat Cara Kerja
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 — CARA KERJA
          Ciri Khas: "Blueprint Flow & Connected Glowing Step Rail"
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="cara-kerja" className="relative bg-white py-28 px-6 overflow-hidden">
        {/* Characteristic Accent: Blueprint subtle line watermark */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-[#EFF6FF] -mr-20 -mt-20 blur-2xl pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          {/* Kiri: Giant Editorial Typography & Mission Statement */}
          <div className="lg:col-span-5 space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0F172A] tracking-tight leading-tight whitespace-nowrap">
              Cara <span className="text-[#1E40AF]">Kerja</span>
            </h2>

            <p className="text-base text-[#475569] leading-relaxed">
              Dirancang khusus untuk pelaku UMKM dan kreator yang awam desain grafis. Tidak perlu belajar Photoshop atau aplikasi rumit, cukup foto dan ketik keterangan, AI yang bekerja merapikannya.
            </p>
          </div>

          {/* Kanan: Connected Step Rail with Interactive Simulation Card */}
          <div className="lg:col-span-7 space-y-6 relative">
            {/* Connected Vertical Gradient Rail */}
            <div className="absolute left-[31px] top-8 bottom-8 w-1 bg-gradient-to-b from-[#132247] via-[#1E3A8A] to-[#60A5FA] rounded-full hidden sm:block" />

            {[
              {
                n: '01',
                Icon: LayoutTemplate,
                title: 'Pilih Contoh Desain atau Tulis Ide',
                desc: 'Pilih model desain yang sudah disiapkan, atau cukup ketik gambaran gambar yang diinginkan.',
              },
              {
                n: '02',
                Icon: UploadCloud,
                title: 'Sistem Otomatis Merapikan',
                desc: 'Sistem pintar kami akan langsung mengatur susunan gambar, tulisan, dan pencahayaan agar terlihat menarik dan rapi.',
              },
              {
                n: '03',
                Icon: Download,
                title: 'Simpan Gambar Kualitas Jernih',
                desc: 'Gambar siap dalam hitungan detik dengan hasil yang tidak pecah. Langsung siap dikirim ke grup WhatsApp atau media sosial lainnya.',
              },
            ].map(({ n, title, desc }) => (
              <div
                key={n}
                className="relative rounded-3xl p-6 sm:p-7 sm:ml-8 transition-all duration-300 group bg-gradient-to-r from-[#132247] to-[#1E3A8A] text-white shadow-xl shadow-blue-950/20 border border-blue-400/25 hover:border-white/60 hover:shadow-2xl hover:shadow-blue-900/35 hover:-translate-y-1 overflow-hidden"
              >
                {/* Pendaran Aksen Halus di Sudut Kartu */}
                <div className="absolute -top-10 -right-10 w-36 h-36 bg-blue-400/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white text-[#132247] border border-white/80 flex items-center justify-center font-black text-xl flex-shrink-0 shadow-md transition-transform group-hover:scale-105">
                      {n}
                    </div>
                    <div>
                      <h3 className="font-black text-lg sm:text-xl text-white mb-1.5 leading-snug">
                        {title}
                      </h3>
                      <p className="text-sm leading-relaxed text-blue-100/90 font-normal">
                        {desc}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3 — KEMUDAHAN LAYANAN (FEATURE SECTION)
          Gaya: Background Putih Bersih dengan Kartu Gelap Beraksen Neon
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="layanan" className="relative bg-white py-24 sm:py-28 px-6 overflow-hidden border-y border-slate-100">
        {/* Latar Belakang Kanvas Dot Matrix Halus pada Background Putih */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#CBD5E1 1.2px, transparent 1.2px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Ambient Glowing Color Auras Lembut di Balik Masing-Masing Kartu */}
        <div className="absolute top-1/2 left-[15%] -translate-y-1/2 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-[15%] -translate-y-1/2 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Header Bagian (Tengah) - Tipografi Gelap Bersih pada Kanvas Putih */}
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0F172A] tracking-tight leading-[1.12]">
              Fasilitas Mandiri untuk Usaha
            </h2>

            <p className="text-base sm:text-lg text-[#475569] leading-relaxed max-w-2xl mx-auto font-normal">
              Seluruh fasilitas dirancang agar pengurus lingkungan dan pelaku usaha desa bisa langsung membuat materi promosi rapi tanpa keahlian khusus.
            </p>
          </div>

          {/* Barisan 3 Kartu Berdampingan (Grid 3 Kolom - Warna Deep Navy Tua dengan Aksen Shape Vektor di atas Kanvas Putih) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Kartu 1: Pilihan Template Siap Pakai (Deep Navy Tua dengan Aksen Shape) */}
            <div className="bg-gradient-to-b from-[#132247] to-[#1E3A8A] rounded-3xl border border-blue-400/25 hover:border-white/60 p-6 sm:p-7 shadow-2xl shadow-blue-950/20 hover:shadow-2xl hover:shadow-blue-900/35 hover:-translate-y-2 transition-all duration-300 group relative overflow-hidden">
              
              {/* Latar Belakang Dekorasi Shape Vektor Fluida & Geometri */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Wavy Blob Shape */}
                <svg
                  className="absolute -bottom-10 -right-10 w-48 h-48 text-sky-400/15 group-hover:scale-110 transition-transform duration-700"
                  viewBox="0 0 200 200"
                  fill="currentColor"
                >
                  <path d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,79.6,-45.8C87.4,-32.6,90,-16.3,88.5,-0.9C86.9,14.6,81.2,29.1,72.6,41.9C64,54.7,52.5,65.7,39.1,72.4C25.7,79.1,10.3,81.5,-4.7,79.7C-19.7,77.9,-34.3,71.9,-46.9,63.1C-59.5,54.3,-70.1,42.7,-76.8,29C-83.6,15.3,-86.6,-0.5,-83.8,-15.4C-81,-30.3,-72.4,-44.3,-60.7,-52.7C-49,-61.1,-34.2,-63.9,-20.1,-71.1C-6,-78.3,7.4,-89.9,22.1,-89.6C36.8,-89.3,52.8,-77.1,44.7,-76.4Z" transform="translate(100 100)" />
                </svg>

                {/* Kluster Segitiga Geometris di Sudut */}
                <div className="absolute top-4 right-5 flex items-center gap-1.5 opacity-35">
                  <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[7px] border-b-sky-300" />
                  <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[7px] border-b-sky-300" />
                  <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[7px] border-b-sky-300" />
                </div>

                {/* Pendaran Aksen Halus */}
                <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-blue-400/15 blur-xl pointer-events-none" />
              </div>

              {/* Visual Header Mockup */}
              <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-white aspect-[16/10] mb-5 shadow-lg shadow-black/25 group/thumb z-10">
                <img
                  src="/features/feature-laptop-gallery.jpg"
                  alt="Pilihan Template Siap Pakai di Layar Laptop"
                  className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-500"
                />
                {/* Floating Pill Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md border border-white text-xs font-black text-[#1E40AF] shadow-sm">
                    <LayoutTemplate className="w-3.5 h-3.5 text-[#1E40AF]" />
                    <span>Template Desain</span>
                  </span>
                </div>
              </div>

              {/* Judul & Deskripsi */}
              <div className="relative z-10">
                <h3 className="text-lg sm:text-xl font-bold text-white leading-snug mb-2">
                  Pilihan Template Siap Pakai
                </h3>

                <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed font-normal">
                  Tersedia beragam susunan poster untuk jualan makanan, produk kerajinan, hingga pengumuman warga. Tinggal tunjuk yang disukai tanpa harus menata dari awal.
                </p>
              </div>
            </div>

            {/* Kartu 2: Penyesuaian Foto Praktis (Deep Navy Tua dengan Aksen Shape) */}
            <div className="bg-gradient-to-b from-[#132247] to-[#1E3A8A] rounded-3xl border border-blue-400/25 hover:border-white/60 p-6 sm:p-7 shadow-2xl shadow-blue-950/20 hover:shadow-2xl hover:shadow-blue-900/35 hover:-translate-y-2 transition-all duration-300 group relative overflow-hidden">
              
              {/* Latar Belakang Dekorasi Shape Vektor Fluida & Geometri */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Wavy Blob Shape */}
                <svg
                  className="absolute -bottom-10 -right-10 w-48 h-48 text-sky-400/15 group-hover:scale-110 transition-transform duration-700"
                  viewBox="0 0 200 200"
                  fill="currentColor"
                >
                  <path d="M38.1,-63.9C49.9,-58.4,60.2,-48.9,67.8,-37.2C75.4,-25.6,80.3,-11.8,79.6,1.9C78.9,15.6,72.6,29.2,64,40.9C55.4,52.6,44.5,62.4,32,68.2C19.5,74,-4.6,75.8,-21.8,70.6C-39,65.4,-49.3,53.2,-57.8,40.1C-66.3,27,-73,13,-73.4,-1.2C-73.8,-15.4,-67.9,-29.8,-58.6,-40.8C-49.3,-51.8,-36.6,-59.4,-23.6,-64.1C-10.6,-68.8,2.7,-70.6,15.2,-69.4C27.7,-68.2,39.4,-64,38.1,-63.9Z" transform="translate(100 100)" />
                </svg>

                {/* Kluster Segitiga Geometris di Sudut */}
                <div className="absolute top-4 right-5 flex items-center gap-1.5 opacity-35">
                  <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[7px] border-b-sky-300" />
                  <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[7px] border-b-sky-300" />
                  <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[7px] border-b-sky-300" />
                </div>

                {/* Pendaran Aksen Halus */}
                <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-blue-400/15 blur-xl pointer-events-none" />
              </div>

              {/* Visual Header Mockup */}
              <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-white aspect-[16/10] mb-5 shadow-lg shadow-black/25 group/thumb z-10">
                <img
                  src="/posters/poster-keripik.jpg"
                  alt="Foto Keripik Produk UMKM Profesional"
                  className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-500"
                />
                {/* Floating Pill Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md border border-white text-xs font-black text-[#EA580C] shadow-sm">
                    <Camera className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span>Kamera HP</span>
                  </span>
                </div>
              </div>

              {/* Judul & Deskripsi */}
              <div className="relative z-10">
                <h3 className="text-lg sm:text-xl font-bold text-white leading-snug mb-2">
                  Penyesuaian Foto Praktis
                </h3>

                <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed font-normal">
                  Cukup ambil foto produk lewat kamera HP biasa. Komposisi dan pencahayaannya otomatis diselaraskan agar dagangan tampil rapi dan menggugah selera.
                </p>
              </div>
            </div>

            {/* Kartu 3: Akses Mudah (Deep Navy Tua dengan Aksen Shape) */}
            <div className="bg-gradient-to-b from-[#132247] to-[#1E3A8A] rounded-3xl border border-blue-400/25 hover:border-white/60 p-6 sm:p-7 shadow-2xl shadow-blue-950/20 hover:shadow-2xl hover:shadow-blue-900/35 hover:-translate-y-2 transition-all duration-300 group relative overflow-hidden">
              
              {/* Latar Belakang Dekorasi Shape Vektor Fluida & Geometri */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Wavy Blob Shape */}
                <svg
                  className="absolute -bottom-10 -right-10 w-48 h-48 text-sky-400/15 group-hover:scale-110 transition-transform duration-700"
                  viewBox="0 0 200 200"
                  fill="currentColor"
                >
                  <path d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,79.6,-45.8C87.4,-32.6,90,-16.3,88.5,-0.9C86.9,14.6,81.2,29.1,72.6,41.9C64,54.7,52.5,65.7,39.1,72.4C25.7,79.1,10.3,81.5,-4.7,79.7C-19.7,77.9,-34.3,71.9,-46.9,63.1C-59.5,54.3,-70.1,42.7,-76.8,29C-83.6,15.3,-86.6,-0.5,-83.8,-15.4C-81,-30.3,-72.4,-44.3,-60.7,-52.7C-49,-61.1,-34.2,-63.9,-20.1,-71.1C-6,-78.3,7.4,-89.9,22.1,-89.6C36.8,-89.3,52.8,-77.1,44.7,-76.4Z" transform="translate(100 100)" />
                </svg>

                {/* Kluster Segitiga Geometris di Sudut */}
                <div className="absolute top-4 right-5 flex items-center gap-1.5 opacity-35">
                  <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[7px] border-b-sky-300" />
                  <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[7px] border-b-sky-300" />
                  <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[7px] border-b-sky-300" />
                </div>

                {/* Pendaran Aksen Halus */}
                <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-blue-400/15 blur-xl pointer-events-none" />
              </div>

              {/* Visual Header Mockup */}
              <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-white aspect-[16/10] mb-5 shadow-lg shadow-black/25 group/thumb z-10">
                <img
                  src="/features/feature-browser.jpg"
                  alt="Akses Mudah Langsung di Browser"
                  className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-500"
                />
                {/* Floating Pill Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md border border-white text-xs font-black text-[#0284C7] shadow-sm">
                    <Globe className="w-3.5 h-3.5 text-[#0284C7]" />
                    <span>Web Browser</span>
                  </span>
                </div>
              </div>

              {/* Judul & Deskripsi */}
              <div className="relative z-10">
                <h3 className="text-lg sm:text-xl font-bold text-white leading-snug mb-2">
                  Akses Mudah
                </h3>

                <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed font-normal">
                  Langsung dibuka melalui peramban di HP maupun laptop tanpa perlu pasang aplikasi tambahan. Bebas digunakan kapan saja tanpa biaya langganan.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4 — TEMPLATE POSTER
          Ciri Khas: "Interactive Template Showcase & Smooth Horizontal Rail"
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="katalog-contoh" className="relative bg-white py-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#0F172A] tracking-tight leading-[1.05]">
              Template <span className="text-[#1E40AF]">Gambar</span>
            </h2>
            <p className="text-sm sm:text-base text-[#475569]">
              Pilih template gambar yang sesuai dengan kegiatan warga dan usaha Anda. Foto dan teks otomatis tertata rapi siap cetak.
            </p>
          </div>

          {/* Slider Controls Bar */}
          <div className="flex items-center justify-between gap-4 mb-6 px-2">
            <div className="text-xs sm:text-sm font-bold text-slate-500 flex items-center gap-2">
              <span>← Geser kartu untuk melihat template lainnya →</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollCards('left')}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 text-[#0F172A] hover:bg-[#EFF6FF] hover:border-[#1E40AF] hover:text-[#1E40AF] flex items-center justify-center shadow-xs transition-all active:scale-95"
                title="Geser ke kiri"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollCards('right')}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 text-[#0F172A] hover:bg-[#EFF6FF] hover:border-[#1E40AF] hover:text-[#1E40AF] flex items-center justify-center shadow-xs transition-all active:scale-95"
                title="Geser ke kanan"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Horizontal Scroll Rail (Style Referensi Modern Card) */}
          <div
            ref={cardScrollRef}
            className="flex gap-6 overflow-x-auto pb-8 pt-2 scroll-smooth no-scrollbar scrollbar-none px-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {TEMPLATES_SHOWCASE.map((tpl) => (
              <div
                key={tpl.id}
                className="w-[290px] sm:w-[320px] flex-shrink-0 bg-white rounded-3xl p-3.5 sm:p-4 shadow-lg shadow-slate-200/50 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1.5 select-none outline-none focus:outline-none active:outline-none ring-0 focus:ring-0 active:ring-0"
              >
                {/* Top Image Container: Clean rounded photo without dirty gradient lines */}
                <div className="relative aspect-[4/4.5] rounded-2xl overflow-hidden bg-slate-50 select-none">
                  <img
                    src={tpl.image}
                    alt={tpl.title}
                    draggable={false}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none select-none"
                    loading="lazy"
                  />

                  {/* Top Badges (Image & AI Studio) */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/95 backdrop-blur-md text-[11px] font-bold text-slate-700 shadow-xs">
                      <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                      <span>Image</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#EFF6FF]/95 backdrop-blur-md text-[11px] font-bold text-[#1E40AF] shadow-xs">
                      <Sparkles className="w-3.5 h-3.5 text-[#0284C7]" />
                      <span>{tpl.modelBadge}</span>
                    </span>
                  </div>
                </div>

                {/* Card Content (Clean Modern Typography) */}
                <div className="px-1.5 pt-3.5 pb-1 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-sans text-[16px] sm:text-[17px] font-bold text-[#1E40AF] leading-snug line-clamp-2">
                      {tpl.title}
                    </h3>
                    <p className="text-[12px] sm:text-[13px] text-slate-500 leading-relaxed line-clamp-3 mt-1.5 font-normal">
                      {tpl.desc}
                    </p>
                  </div>

                  {/* Card Footer Action Row: Copy & Share (Like dihapus) */}
                  <div className="mt-4 pt-2 flex items-center justify-between text-xs text-slate-600 font-semibold">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(tpl.desc);
                            alert(`Prompt "${tpl.title}" berhasil disalin!`);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-[#1E40AF] hover:text-[#1E3A8A] transition-colors font-bold cursor-pointer"
                        title="Salin deskripsi prompt"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#1E40AF]" />
                        <span>Copy</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(window.location.origin + '/creator/studio');
                            alert('Tautan berhasil disalin!');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-slate-600 hover:text-[#1E40AF] transition-colors cursor-pointer"
                        title="Bagikan tautan template"
                      >
                        <Share2 className="w-3.5 h-3.5 text-slate-400 hover:text-[#1E40AF]" />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5 — FAQ
          Ciri Khas: "Interactive FAQ Accordion with Topic Category Filter"
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="faq" className="relative bg-[#F8FAFC] py-28 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10 space-y-3">
            <h2 className="text-5xl sm:text-7xl font-black text-[#0F172A] tracking-tight leading-[0.95]">
              FAQ
            </h2>
            <p className="text-sm sm:text-base text-[#475569]">
              Pertanyaan yang sering diajukan warga seputar pemilihan template, pemakaian prompt galeri, dan pembuatan poster.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap justify-center items-center gap-2 mb-8">
            {['Semua', 'Galeri Template', 'Cara Pakai Prompt', 'Kustomisasi Desain', 'Batas Kuota & Lisensi'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveFaqCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  activeFaqCategory === cat
                    ? 'bg-[#1E40AF] text-white shadow-md'
                    : 'bg-white border border-[#CBD5E1] text-[#475569] hover:border-[#1E40AF]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Accordion List */}
          <div className="space-y-3">
            {filteredFaqs.map((faq) => {
              const isOpen = openFaq === faq.id;
              return (
                <button
                  key={faq.id}
                  onClick={() => setOpenFaq(isOpen ? null : faq.id)}
                  className={`w-full text-left rounded-2xl px-5 py-4 sm:px-6 sm:py-4.5 flex items-start justify-between gap-4 transition-all duration-200 cursor-pointer ${
                    isOpen
                      ? 'bg-[#1E40AF] text-white shadow-xl shadow-blue-500/20 ring-2 ring-[#1E40AF]'
                      : 'bg-white border border-[#E2E8F0] text-[#0F172A] hover:border-[#93C5FD] hover:shadow-md'
                  }`}
                >
                  <div className="space-y-1">
                    <span
                      className={`inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1 ${
                        isOpen
                          ? 'bg-white/20 text-white'
                          : 'bg-[#EFF6FF] text-[#1E40AF]'
                      }`}
                    >
                      {faq.category}
                    </span>
                    <div className="font-bold text-sm sm:text-base leading-snug">
                      {faq.q}
                    </div>
                    {isOpen && (
                      <div className="mt-2 text-xs sm:text-sm text-blue-100 leading-relaxed font-normal pt-2 border-t border-white/20">
                        {faq.a}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 mt-2">
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-white" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 6 — CTA BANNER
          Ciri Khas: "Cinematic Dark Horizon with 3D Giant Watermark & Glowing Portal"
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#0F172A] py-32 px-6 overflow-hidden text-center">
        {/* Giant 3D Watermark behind content */}
        <div
          className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
          aria-hidden="true"
        >
          <span className="text-[9rem] sm:text-[15rem] font-black text-white/[0.035] tracking-tighter whitespace-nowrap">
            SUKAMENAK
          </span>
        </div>

        {/* Ambient Glowing Portal Light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-gradient-to-r from-[#1E40AF]/25 to-[#0284C7]/20 blur-3xl pointer-events-none animate-pulse-glow" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-8">
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight uppercase">
            TEMUKAN INSPIRASI
            <br />
            <span className="text-[#60A5FA]">PROMPT DI SINI</span>
          </h2>

          <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed">
            Tersedia banyak contoh prompt siap pakai untuk produk UMKM, kerajinan, hingga poster jualan.
          </p>

          <div className="flex flex-wrap justify-center items-center gap-4 pt-2">
            <Link
              to="/creator/gallery"
              className="inline-flex items-center gap-3 px-10 py-5 rounded-full bg-[#1E40AF] hover:bg-[#2563EB] text-white font-black text-lg shadow-2xl shadow-blue-500/30 transition-all hover:scale-105 active:scale-100"
            >
              <span>Mulai Sekarang</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
};
