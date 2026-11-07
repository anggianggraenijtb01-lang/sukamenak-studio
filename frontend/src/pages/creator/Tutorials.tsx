import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  X,
  Sparkles,
  Copy,
  Sun,
  Layers,
  Camera,
  Palette,
  Lightbulb,
  Smartphone,
  ShieldCheck,
  Zap,
  CheckCircle2,
  XCircle,
  Eye,
  Sliders,
} from 'lucide-react';

export const Tutorials: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tutorial' | 'breakdown' | 'hacks'>('tutorial');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const handleCopySnippet = (snippet: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(snippet);
      setCopiedSnippet(snippet);
      setTimeout(() => setCopiedSnippet(null), 2000);
    }
  };

  const doDontGuidelines = [
    {
      topic: 'Pemotretan Foto Produk HP',
      doText: 'Ambil foto di dekat jendela pagi (07.00 - 10.00) dengan alas meja polos atau kain bersih tanpa corak ramai.',
      dontText: 'Jangan memotret di ruangan gelap memakai lampu flash HP langsung yang menimbulkan bayangan hitam keras dan pantulan plastik.',
    },
    {
      topic: 'Komposisi Kemasan & Objek Utama',
      doText: 'Letakkan produk tegak di tengah (center framing) dengan jarak sekitar 40-60 cm agar label kemasan terbaca tajam.',
      dontText: 'Jangan memotong tepi kemasan atau memotret dari jarak terlalu jauh sehingga produk tenggelam oleh latar.',
    },
    {
      topic: 'Penataan Cahaya & Bayangan Alami',
      doText: 'Gunakan selembar styrofoam putih atau kertas HVS di sisi berlawanan cahaya untuk memantulkan cahaya lembut (fill light).',
      dontText: 'Jangan memotret melawan arah sinar matahari langsung (backlight ekstrem) yang membuat produk jadi siluet gelap.',
    },
    {
      topic: 'Penyusunan Teks & Judul Promo',
      doText: 'Tuliskan nama produk dan keunggulan utama dalam 3–6 kata ringkas agar poster enak dibaca sekilas dalam 2 detik.',
      dontText: 'Jangan menumpuk paragraf deskripsi panjang di dalam gambar poster; simpan detail di caption WhatsApp.',
    },
    {
      topic: 'Pemilihan Material Meja & Latar Saji',
      doText: 'Gunakan alas netral seperti kayu jati serat halus, marmer putih, atau kain linen netral yang menonjolkan warna produk.',
      dontText: 'Jangan memakai sprei bermotif batik/bunga ramai atau karpet bulu tebal yang mengaburkan bentuk fisik kemasan.',
    },
    {
      topic: 'Props & Aksesoris Pelengkap',
      doText: 'Sandingkan 1-2 bahan mentah asli (misal: 2 lembar daun jeruk segar, 5 butir biji kopi) di dekat kemasan produk.',
      dontText: 'Jangan meletakkan terlalu banyak barang dekorasi unrelated (vas bunga raksasa, mainan, jam tangan) yang membingungkan fokus pembeli.',
    },
    {
      topic: 'Mencegah Halusinasi Jari & Tangan AI',
      doText: 'Kunci prompt dengan kalimat restriksi: "tanpa subjek tangan manusia, fokus objek produk komersial 4:5".',
      dontText: 'Hindari instruksi "ada tangan yang memegang kemasan", karena model AI generatif rentan menghasilkan jemari terdistorsi.',
    },
    {
      topic: 'Rasio Vertikal 4:5 & Safe Zone Medsos',
      doText: 'Sisakan 15-20% ruang kosong di atas dan bawah gambar agar stempel nama toko, nomor WhatsApp, dan harga muat rapi.',
      dontText: 'Jangan menaruh produk mepet hingga ujung frame atas atau bawah kanvas karena bisa terpotong saat diunggah ke status medsos.',
    },
  ];

  const styleBreakdowns = [
    {
      title: 'Sudut Bidik: Flatlay vs Eye-Level 45°',
      category: 'Sudut Kamera',
      icon: Camera,
      analysis: 'Sudut 45 derajat (eye-level) sangat ideal untuk produk standing pouch dan botol agar bentuk 3 dimensi kemasan terlihat kokoh. Sudut Flatlay (tegak lurus dari atas 90°) tepat untuk kriya anyaman dan piring saji camilan.',
      snippet: 'eye-level 45 degree angle commercial studio shot, sharp depth of field, product centered',
    },
    {
      title: 'Pencahayaan: Softbox Studio & Rim Highlight',
      category: 'Tata Cahaya',
      icon: Sun,
      analysis: 'Pencahayaan difus studio menghilangkan bayangan kasar dan pantulan plastik yang menyilaukan label, sementara rim light tipis di tepi kemasan memisahkan objek dari latar belakang.',
      snippet: 'soft studio diffuse lighting, gentle fill light, subtle rim edge highlight, warm morning natural tones',
    },
    {
      title: 'Harmoni Warna: Palet Slate & Aksen Royal Blue',
      category: 'Keseimbangan Warna',
      icon: Palette,
      analysis: 'Latar belakang netral slate terang (#F8FAFC) menonjolkan warna keemasan keripik atau cokelat biji kopi secara alami tanpa saling bertabrakan dengan warna kemasan produk Anda.',
      snippet: 'clean neutral slate canvas background, high color contrast, crisp vibrant commercial product styling',
    },
    {
      title: 'Zona Aman Tipografi (Negative Space 4:5)',
      category: 'Tata Letak',
      icon: Layers,
      analysis: 'Rasio 4:5 menyisakan 20% ruang kosong di sekeliling produk untuk penempatan otomatis badge harga, nama toko, dan nomor WhatsApp agar tidak menutupi visual barang dagangan.',
      snippet: 'generous negative space around product, balanced composition for vertical commercial poster 4:5',
    },
    {
      title: 'Fotografi Makro: Tekstur Renyah & Gurih',
      category: 'Detail Tekstur',
      icon: Sparkles,
      analysis: 'Fokus jarak dekat (macro focus) menonjolkan tekstur gurih renyah keripik, butiran gula, atau kehalusan tenun kain kriya untuk membangkitkan selera makan dan kesan premium.',
      snippet: 'macro close-up product texture focus, crisp edible appetizing detail, shallow depth of field background blur',
    },
    {
      title: 'Botol Kaca & Cairan: Anti Pantulan Silau',
      category: 'Refleksi Kaca',
      icon: Eye,
      analysis: 'Untuk madu murni, sirup, atau kopi botol, pencahayaan dari belakang samping (back-side lighting) membuat cairan terlihat berkilau keemasan tanpa pantulan lampu menyilaukan di kaca.',
      snippet: 'back-rim translucent liquid illumination, clean glass reflection control, premium beverage bottle styling',
    },
    {
      title: 'Kemasan Standing Pouch & Kantong Kraft',
      category: 'Bentuk Kemasan',
      icon: Sliders,
      analysis: 'Tampilkan lipatan bawah pouch yang tegak simetris dengan sudut pencahayaan 45 derajat agar label merek di bagian depan tampak rata dan terbaca jelas oleh calon pembeli.',
      snippet: 'standing pouch packaging standing upright, clean flat label visibility, professional studio tabletop display',
    },
    {
      title: 'Komposisi Minimalis & Golden Ratio',
      category: 'Komposisi Seni',
      icon: Lightbulb,
      analysis: 'Menempatkan produk utama sedikit di sepertiga frame (Rule of Thirds) dengan 1 elemen pelengkap kecil di sisi berseberangan menciptakan keseimbangan dinamis yang memikat mata.',
      snippet: 'rule of thirds composition, minimalist aesthetic studio balance, clean negative space, commercial advertisement',
    },
  ];

  const smartphoneHacks = [
    {
      number: '01',
      title: 'Bersihkan Lensa Kamera HP dengan Kain Halus',
      desc: 'Minyak dari sidik jari di lensa kamera adalah penyebab utama foto terlihat buram dan berkabut. Usap dengan kain mikrofiber sebelum memotret.',
      tag: 'Ketajaman Maksimal',
    },
    {
      number: '02',
      title: 'Kunci Titik Fokus & Kecerahan (AE/AF Lock)',
      desc: 'Sentuh dan tahan layar HP di bagian label produk hingga muncul tanda "AE/AF LOCK", lalu geser ikon matahari sedikit ke bawah agar label tidak silau.',
      tag: 'Fokus & Kontras',
    },
    {
      number: '03',
      title: 'Reflektor Murah Meriah Selembar Styrofoam',
      desc: 'Letakkan sepotong styrofoam putih atau kardus berlapis kertas HVS putih di sisi produk yang gelap untuk memantulkan cahaya dan menghilangkan bayangan pekat.',
      tag: 'Trik Cahaya Murah',
    },
    {
      number: '04',
      title: 'Manfaatkan Cahaya Jendela Pagi (Natural Softbox)',
      desc: 'Jendela rumah di pagi hari pukul 08.00–10.00 memberikan cahaya alami paling lembut setara softbox studio jutaan rupiah tanpa biaya listrik.',
      tag: 'Pencahayaan Alami',
    },
    {
      number: '05',
      title: 'Gunakan Sudut Ketinggian Mata (Eye-Level)',
      desc: 'Posisikan kamera HP sejajar dengan bagian tengah produk (bukan terlalu menunduk dari atas), agar proporsi botol atau kemasan tampak tinggi dan gagah.',
      tag: 'Proporsi Kemasan',
    },
    {
      number: '06',
      title: 'Gunakan Fitur Grid (Garis Kisi 3x3) di Kamera HP',
      desc: 'Aktifkan pengaturan "Grid" di kamera HP Anda agar garis meja tegak lurus dan posisi produk tidak miring ke kiri atau kanan.',
      tag: 'Simetri & Kerapian',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* ── HEADER BANNER ── */}
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
            Edukasi <span className="text-[#2563EB]">Visual</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-1 font-normal">
            Panduan praktis pencahayaan studio dan fotografi produk UMKM.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex p-1.5 rounded-2xl bg-white/80 border border-[#BFDBFE] self-start sm:self-center shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('tutorial')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'tutorial'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#0F172A]'
            }`}
          >
            Anjuran &amp; Larangan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('breakdown')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'breakdown'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#0F172A]'
            }`}
          >
            Gaya Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hacks')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'hacks'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#0F172A]'
            }`}
          >
            Trik Kamera HP
          </button>
        </div>
      </div>

      {/* ── TAB 1: DO & DON'T (8 TOPIK LENGKAP) ── */}
      {activeTab === 'tutorial' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-lg font-black text-[#0F172A]">
              Panduan Praktis <span className="text-[#2563EB]">Yang Dianjurkan (Do) &amp; Hindari (Don't)</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">8 Topik Fotografi Komersial</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {doDontGuidelines.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl border border-[#CBD5E1] p-6 shadow-sm space-y-4 hover:shadow-md transition-shadow"
              >
                <h3 className="text-sm font-black text-[#1E40AF] border-b border-blue-100 pb-2.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                  <span>{item.topic}</span>
                </h3>

                <div className="space-y-3">
                  {/* DO CARD */}
                  <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#2563EB] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB] block">
                        YANG DIANJURKAN
                      </span>
                      <p className="text-xs text-slate-700 mt-1 leading-relaxed font-medium">
                        {item.doText}
                      </p>
                    </div>
                  </div>

                  {/* DONT CARD */}
                  <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <X className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block">
                        YANG PERLU DIHINDARI
                      </span>
                      <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                        {item.dontText}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 2: BEDAH GAYA VISUAL (8 PRESET & SNIPPET PROMPT) ── */}
      {activeTab === 'breakdown' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-lg font-black text-[#0F172A]">
              Bedah Gaya Visual Studio &amp; <span className="text-[#2563EB]">Snippet Prompt Siap Pakai</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">8 Parameter Fotografi Studio</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
            {styleBreakdowns.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-3xl border border-[#CBD5E1] p-6 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-black uppercase text-[#2563EB]">
                        {item.category}
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-center text-[#2563EB]">
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>

                    <h3 className="text-sm sm:text-base font-black text-[#1E40AF]">
                      {item.title}
                    </h3>

                    <p className="text-xs text-slate-600 leading-relaxed font-normal">
                      {item.analysis}
                    </p>
                  </div>

                  {/* Snippet box */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Teks Prompt Siap Pakai:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopySnippet(item.snippet)}
                        className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedSnippet === item.snippet ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-blue-600" />
                            <span>Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin Teks</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[11px] font-mono text-[#0F172A] whitespace-pre-wrap leading-relaxed select-all">
                      {item.snippet}
                    </pre>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 3: SMARTPHONE HACKS (6 TRIK FOTO HP PRAKTIS) ── */}
      {activeTab === 'hacks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-lg font-black text-[#0F172A]">
              Trik Fotografi Smartphone <span className="text-[#2563EB]">Tanpa Alat Mahal</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">6 Tips Khusus Kamera HP</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {smartphoneHacks.map((hack) => (
              <div
                key={hack.number}
                className="bg-white rounded-3xl border border-blue-200/80 p-6 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-xl bg-[#2563EB] text-white text-xs font-black flex items-center justify-center shadow-xs">
                      {hack.number}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[10px] font-bold text-[#2563EB] border border-blue-200">
                      {hack.tag}
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-[#0F172A] leading-snug">
                    {hack.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {hack.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-[#2563EB]">
                  <Lightbulb className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Trik Teruji untuk UMKM</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
export default Tutorials;
