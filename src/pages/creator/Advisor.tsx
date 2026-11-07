import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  Wand2,
  Sliders,
  Zap,
  BookOpen,
  Camera,
  Sun,
  Layers,
  ShieldAlert,
  Info,
  CheckCircle2,
  XCircle,
  Lightbulb,
  FileText,
  RotateCcw,
} from 'lucide-react';

interface CaseStudy {
  id: string;
  category: string;
  title: string;
  raw: string;
  analysisWaste: string[];
  optimized: string;
  highlights: {
    subject: string;
    lighting: string;
    surface: string;
    restriction: string;
  };
  metrics: {
    rawChars: number;
    optChars: number;
    reduction: string;
  };
}

const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'kuliner',
    category: 'Kuliner UMKM',
    title: 'Keripik Tempe Gurih Daun Jeruk',
    raw: 'Tolong dong buatin foto produk keripik tempe yang sangat bagus sekali renyah dengan daun jeruk segar di piring kayu dengan pencahayaan sinar matahari pagi yang super tajam dan resolusi 8k hd sangat detail tanpa ada tangan manusia yang kelihatan.',
    analysisWaste: [
      'Kata basa-basi: "Tolong dong buatin"',
      'Kata hiperbola tidak terukur: "sangat bagus sekali", "super tajam"',
      'Halusinasi resolusi: "resolusi 8k hd sangat detail" (AI mengabaikan angka resolusi)',
      'Instruksi negatif ambigu: "tanpa ada tangan manusia yang kelihatan"',
    ],
    optimized:
      'Foto kemasan standing pouch keripik tempe renyah taburan daun jeruk di atas meja kayu jati minimalis, pencahayaan studio hangat 45°, fokus tajam komersial 4:5, tanpa subjek tangan manusia.',
    highlights: {
      subject: 'Standing pouch keripik tempe renyah taburan daun jeruk',
      lighting: 'Pencahayaan studio hangat 45°',
      surface: 'Meja kayu jati minimalis',
      restriction: 'Tanpa subjek tangan manusia',
    },
    metrics: {
      rawChars: 247,
      optChars: 172,
      reduction: '30%',
    },
  },
  {
    id: 'kopi',
    category: 'Katalog Minuman',
    title: 'Kopi Robusta Puntang Single Origin',
    raw: 'Bikinin gambar kemasan kopi robusta bubuk warna coklat tua di toples atau bungkus kraft yang keren banget ada biji kopi berantakan di meja warung dengan lampu estetik sinematik jangan buram dan jelas 100 persen.',
    analysisWaste: [
      'Bentuk kemasan tidak pasti: "di toples atau bungkus kraft" (AI bingung memilih)',
      'Kata kiasan abstrak: "keren banget", "lampu estetik sinematik"',
      'Latar kurang rapi: "meja warung dengan biji berantakan"',
      'Instruksi negatif lemah: "jangan buram dan jelas 100 persen"',
    ],
    optimized:
      'Foto produk kemasan kraft pouch kopi robusta dengan taburan biji kopi sangrai di atas alas kain goni dan kayu netral, pencahayaan studio tiga titik terarah, bayangan lembut komersial.',
    highlights: {
      subject: 'Kraft pouch kopi robusta dengan taburan biji kopi sangrai',
      lighting: 'Pencahayaan studio tiga titik terarah',
      surface: 'Alas kain goni dan kayu netral',
      restriction: 'Bayangan lembut komersial tanpa flare berlebih',
    },
    metrics: {
      rawChars: 228,
      optChars: 178,
      reduction: '22%',
    },
  },
  {
    id: 'kriya',
    category: 'Kriya & Kerajinan',
    title: 'Tas Anyaman Rajut Etnik Nusantara',
    raw: 'Saya minta foto tas jinjing anyaman buatan tangan ibu-ibu lokal yang sangat indah bermotif etnik ditaruh di tempat terang estetik profesional jangan ada bayangan hitam pekat dan jangan kelihatan orangnya.',
    analysisWaste: [
      'Narasi tidak teknis: "buatan tangan ibu-ibu lokal yang sangat indah"',
      'Ketiadaan sudut kamera: tidak ditentukan flatlay atau eye-level',
      'Instruksi pencahayaan subjektif: "tempat terang estetik profesional"',
      'Larangan subjek manusia tidak formal: "jangan kelihatan orangnya"',
    ],
    optimized:
      'Foto produk tas jinjing anyaman rajut motif etnik sudut bidik eye-level 45°, latar marmer putih bersih dengan pencahayaan difus lembut studio, tekstur serat tegas, tanpa figur manusia.',
    highlights: {
      subject: 'Tas jinjing anyaman rajut motif etnik',
      lighting: 'Pencahayaan difus lembut studio sudut eye-level 45°',
      surface: 'Latar marmer putih bersih',
      restriction: 'Tekstur serat tegas tanpa figur manusia',
    },
    metrics: {
      rawChars: 221,
      optChars: 181,
      reduction: '18%',
    },
  },
  {
    id: 'fashion',
    category: 'Fashion & Busana',
    title: 'Koleksi Hijab Voal Segi Empat',
    raw: 'Tolong buatkan foto hijab segi empat warna lilac yang sangat lembut dan cantik dilipat rapi kayak katalog olshop terkenal pencahayaan terang bersih tanpa ada debu atau kerutan resolusi tinggi.',
    analysisWaste: [
      'Penyebutan merek tidak spesifik: "kayak katalog olshop terkenal"',
      'Sifat berlebihan: "sangat lembut dan cantik"',
      'Instruksi negatif mikro yang memicu cacat: "tanpa ada debu atau kerutan"',
      'Kata basa-basi: "Tolong buatkan"',
    ],
    optimized:
      'Foto katalog flatlay lipatan hijab segi empat katun voal warna lilac elegan, alas podium linen netral, pencahayaan softbox studio tanpa bayangan tajam, komposisi editorial bersih 4:5.',
    highlights: {
      subject: 'Lipatan hijab segi empat katun voal lilac elegan',
      lighting: 'Pencahayaan softbox studio tanpa bayangan tajam',
      surface: 'Alas podium linen netral',
      restriction: 'Komposisi editorial bersih 4:5 tanpa model peraga',
    },
    metrics: {
      rawChars: 216,
      optChars: 183,
      reduction: '15%',
    },
  },
];

const QUICK_KEYWORDS = [
  { tag: 'softbox studio 45°', cat: 'Cahaya' },
  { tag: 'pencahayaan alami pagi', cat: 'Cahaya' },
  { tag: 'rim light tepi objek', cat: 'Cahaya' },
  { tag: 'sudut eye-level 45°', cat: 'Sudut' },
  { tag: 'sudut flatlay 90° atas', cat: 'Sudut' },
  { tag: 'makro fokus detail tekstur', cat: 'Sudut' },
  { tag: 'meja kayu jati minimalis', cat: 'Latar' },
  { tag: 'marmer putih bersih', cat: 'Latar' },
  { tag: 'alas linen krem netral', cat: 'Latar' },
  { tag: 'tanpa subjek tangan manusia', cat: 'Larangan' },
  { tag: 'tanpa teks buatan AI', cat: 'Larangan' },
  { tag: 'zona aman teks 4:5', cat: 'Larangan' },
];

export const Advisor: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCase, setSelectedCase] = useState<string>('kuliner');
  const [activeFormulaTab, setActiveFormulaTab] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  // Workbench state
  const [rawPrompt, setRawPrompt] = useState<string>(
    'Tolong dong buatin foto produk keripik tempe yang sangat bagus sekali renyah dengan daun jeruk segar di piring kayu dengan pencahayaan sinar matahari pagi yang super tajam dan resolusi 8k hd sangat detail tanpa ada tangan manusia yang kelihatan.'
  );

  // Real-time Optimization Engine
  const { optimizedResult, detectedWaste, compactnessScore, wordSavings } = useMemo(() => {
    let text = rawPrompt.trim();
    if (!text) {
      return {
        optimizedResult: 'Ketik atau tempelkan ide prompt di panel kiri untuk melihat hasil optimasi studio secara langsung.',
        detectedWaste: [],
        compactnessScore: 0,
        wordSavings: 0,
      };
    }

    const wasteFound: string[] = [];
    const wastePatterns = [
      { pattern: /tolong\s+(dong\s+)?(buatin|buatkan|bikin|bikinin)?/gi, label: 'Basa-basi (Tolong buatkan)' },
      { pattern: /saya\s+mau\s+(foto|gambar)?/gi, label: 'Kalimat pembuka mubazir' },
      { pattern: /sangat\s+(bagus|indah|cantik|keren|enak|lezat|mantap)\s*(sekali|banget)?/gi, label: 'Kata sifat subjektif' },
      { pattern: /super\s+(tajam|bagus|detail|keren)/gi, label: 'Hiperbola (Super tajam)' },
      { pattern: /(resolusi\s+)?8k\s*(hd)?/gi, label: 'Buzzword palsu (8k HD)' },
      { pattern: /resolusi\s+(tinggi|ultra|maksimal)/gi, label: 'Buzzword resolusi' },
      { pattern: /kayak\s+katalog\s+olshop\s+terkenal/gi, label: 'Perbandingan abstrak' },
      { pattern: /jelas\s+100\s*(persen|%)/gi, label: 'Penekanan tidak terukur' },
    ];

    let cleaned = text;
    wastePatterns.forEach((w) => {
      if (w.pattern.test(cleaned)) {
        wasteFound.push(w.label);
        cleaned = cleaned.replace(w.pattern, ' ');
      }
    });

    // Clean whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Standardize structure if needed
    if (!/tanpa\s+(subjek\s+)?tangan/i.test(cleaned)) {
      cleaned += ', tanpa subjek tangan manusia';
    }
    if (!/4:5/i.test(cleaned)) {
      cleaned += ', komposisi komersial 4:5';
    }

    const rawWordCount = text.split(/\s+/).filter(Boolean).length;
    const cleanWordCount = cleaned.split(/\s+/).filter(Boolean).length;
    const score = Math.min(98, Math.max(70, Math.round(100 - (wasteFound.length * 6))));
    const savings = Math.max(0, Math.round(((text.length - cleaned.length) / Math.max(1, text.length)) * 100));

    return {
      optimizedResult: cleaned,
      detectedWaste: wasteFound,
      compactnessScore: score,
      wordSavings: savings,
    };
  }, [rawPrompt]);

  const currentCase = useMemo(() => {
    return CASE_STUDIES.find((c) => c.id === selectedCase) || CASE_STUDIES[0];
  }, [selectedCase]);

  const handleApplyCaseToWorkbench = (caseItem: CaseStudy) => {
    setRawPrompt(caseItem.raw);
    const element = document.getElementById('workbench-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleInsertKeyword = (keyword: string) => {
    setRawPrompt((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}, ${keyword}` : keyword;
    });
  };

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(optimizedResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUseInStudio = () => {
    localStorage.setItem('sukamenak_active_prompt', optimizedResult);
    navigate('/creator/studio');
  };

  const formulaComponents = [
    {
      step: '01',
      title: 'Subjek & Kemasan Produk',
      icon: Layers,
      color: 'blue',
      summary: 'Spesifikasikan wadah kemasan fisik, wujud produk, dan pelengkap visual.',
      rule: 'Sebutkan jenis wadah kemasan (standing pouch, jar kaca, botol botolan, craft box) bukan sekadar nama hidangan. AI membutuhkan orientasi objek 3 dimensi.',
      goodExample: '"Standing pouch keripik tempe gurih dengan taburan daun jeruk segar..."',
      badExample: '"Foto makanan ringan enak banget..." (Bentuk fisik kemasan tidak diketahui AI)',
    },
    {
      step: '02',
      title: 'Tata Cahaya & Sudut Kamera',
      icon: Sun,
      color: 'amber',
      summary: 'Kunci arah pencahayaan komersial dan sudut pandang kamera (45° vs flatlay).',
      rule: 'Gunakan istilah teknis studio seperti "pencahayaan studio 45°", "softbox diffuse", atau "rim light tepi". Hindari kata "lampu estetik" yang membingungkan.',
      goodExample: '"Pencahayaan studio hangat sudut 45 derajat, bayangan lembut difus..."',
      badExample: '"Cahayanya terang benderang kayak matahari siang..." (Overexposed & silau)',
    },
    {
      step: '03',
      title: 'Latar & Alas Meja Saji',
      icon: Camera,
      color: 'sky',
      summary: 'Material alas meja netral yang menonjolkan produk tanpa distraksi warna.',
      rule: 'Pilih material bertekstur netral: kayu jati minimalis, marmer putih, kain linen krem. Pastikan ada ruang negatif (negative space) untuk stempel teks harga/logo.',
      goodExample: '"Di atas meja kayu jati minimalis bersih dengan latar belakang lembut bergradasi..."',
      badExample: '"Di warung ramai banyak orang lalu lalang..." (Objek produk tenggelam)',
    },
    {
      step: '04',
      title: 'Restriksi & Larangan Visual',
      icon: ShieldAlert,
      color: 'rose',
      summary: 'Cegah halusinasi jari tangan terdistorsi, artefak teks acak, dan watermark.',
      rule: 'Model difusi sering merusak visual saat mencoba menggambarkan jemari memegang produk. Kunci prompt dengan kalimat restriksi tegas.',
      goodExample: '"Fokus produk tajam komersial 4:5, tanpa subjek tangan manusia, tanpa watermark."',
      badExample: '"Ada tangan orang yang lagi megang keripik..." (90% risiko jari terdistorsi/aneh)',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      
      {/* ── TOP HEADER BANNER ── */}
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
            Panduan &amp; Optimasi <span className="text-[#2563EB]">Prompt</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-1 font-normal">
            Sederhanakan teks ide menjadi instruksi visual yang ringkas, tajam, dan efisien.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            document.getElementById('workbench-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-black shadow-md shadow-blue-500/25 transition-all cursor-pointer self-start sm:self-center hover:scale-105"
        >
          <Wand2 className="w-4 h-4" />
          <span>Uji Prompt &darr;</span>
        </button>
      </div>

      {/* ── SECTION 1: ANATOMI RUMUS BAKU (4 KOMPONEN ARSITEKTUR) ── */}
      <section className="bg-white rounded-3xl border border-[#BFDBFE] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB]">
              MODUL 1 &bull; ANATOMI &amp; RUMUS BAKU
            </span>
            <h2 className="text-lg sm:text-xl font-black text-[#0F172A] mt-0.5">
              Rumus Baku <span className="text-[#2563EB]">Prompt Komersial</span> Sukamenak Studio
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Formula 4 Blok: Subjek + Cahaya + Latar + Larangan
          </span>
        </div>

        {/* 4 Interactive Formula Step Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {formulaComponents.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeFormulaTab === idx;
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => setActiveFormulaTab(idx)}
                className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  isActive
                    ? 'bg-[#EFF6FF] border-[#2563EB] shadow-md ring-2 ring-blue-500/20'
                    : 'bg-[#F8FAFC] border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-[#2563EB] text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {item.step}
                  </span>
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#2563EB]' : 'text-slate-400'}`} />
                </div>
                <div>
                  <h4 className={`text-xs font-black ${isActive ? 'text-[#2563EB]' : 'text-[#0F172A]'}`}>{item.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-snug">
                    {item.summary}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Deep Dive Detail on Active Formula Component */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#F8FAFC] to-blue-50/40 border border-blue-200/80 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Info className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-[#1E40AF]">
                Panduan Komponen {formulaComponents[activeFormulaTab].step}: {formulaComponents[activeFormulaTab].title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {formulaComponents[activeFormulaTab].rule}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3.5 rounded-xl bg-white border border-blue-200 space-y-1 shadow-2xs">
              <span className="text-[10px] font-black uppercase text-[#2563EB] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2563EB]" />
                Contoh Tepat (Do):
              </span>
              <p className="text-slate-700 font-semibold italic">
                {formulaComponents[activeFormulaTab].goodExample}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-red-200 space-y-1 shadow-2xs">
              <span className="text-[10px] font-black uppercase text-red-600 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5 text-red-600" />
                Hindari (Don't):
              </span>
              <p className="text-slate-500 italic">
                {formulaComponents[activeFormulaTab].badExample}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: STUDI KASUS MULTI-KATEGORI (SEBELUM VS SESUDAH) ── */}
      <section className="bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB]">
              MODUL 2 &bull; KOMPARASI SEBELUM VS SESUDAH
            </span>
            <h2 className="text-lg sm:text-xl font-black text-[#0F172A] mt-0.5">
              Studi Kasus <span className="text-[#2563EB]">Bedah Prompt Nyata UMKM</span>
            </h2>
          </div>
          
          {/* Category Switcher Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200">
            {CASE_STUDIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCase(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedCase === c.id
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#0F172A]'
                }`}
              >
                {c.category}
              </button>
            ))}
          </div>
        </div>

        {/* Active Case Study Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-black text-[#0F172A] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
              Kasus: <span className="text-[#2563EB]">{currentCase.title}</span>
            </h3>
            <span className="text-xs font-bold text-slate-500">
              Penghematan Panjang: <strong className="text-[#2563EB]">{currentCase.metrics.reduction}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            
            {/* Box 1: Prompt Mentah (Sebelum) */}
            <div className="p-5 rounded-2xl bg-red-50/50 border border-red-200 flex flex-col justify-between space-y-4 shadow-2xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-600 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    Sebelum (Terlalu Panjang &amp; Berulang)
                  </span>
                  <span className="text-[10px] font-mono text-red-500 font-bold">
                    {currentCase.metrics.rawChars} Karakter
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic bg-white p-3.5 rounded-xl border border-red-100">
                  "{currentCase.raw}"
                </p>

                {/* Analysis of waste */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Bedah Kesalahan &amp; Pemborosan Token:
                  </span>
                  <ul className="space-y-1 text-xs text-red-700">
                    {currentCase.analysisWaste.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-red-500 font-bold">&times;</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Box 2: Prompt Teroptimasi (Sesudah) */}
            <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-200 flex flex-col justify-between space-y-4 shadow-2xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Sesudah (Ringkas, Padat, Terarah)
                  </span>
                  <span className="text-[10px] font-mono text-[#2563EB] font-bold">
                    {currentCase.metrics.optChars} Karakter
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[#0F172A] leading-relaxed font-semibold bg-white p-3.5 rounded-xl border border-blue-200">
                  "{currentCase.optimized}"
                </p>

                {/* Breakdown of clean structure */}
                <div className="space-y-1.5 pt-1 text-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Parameter Visual yang Terkunci:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <div className="p-2 rounded-lg bg-white border border-blue-100">
                      <span className="text-[10px] font-bold text-slate-400 block">Subjek:</span>
                      <span className="text-[11px] font-semibold text-[#0F172A]">{currentCase.highlights.subject}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-blue-100">
                      <span className="text-[10px] font-bold text-slate-400 block">Cahaya:</span>
                      <span className="text-[11px] font-semibold text-[#0F172A]">{currentCase.highlights.lighting}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-blue-100">
                      <span className="text-[10px] font-bold text-slate-400 block">Latar:</span>
                      <span className="text-[11px] font-semibold text-[#0F172A]">{currentCase.highlights.surface}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-blue-100">
                      <span className="text-[10px] font-bold text-slate-400 block">Proteksi:</span>
                      <span className="text-[11px] font-semibold text-[#0F172A]">{currentCase.highlights.restriction}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action: Apply to Workbench */}
              <div className="pt-2 border-t border-blue-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => handleApplyCaseToWorkbench(currentCase)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-all shadow-xs cursor-pointer hover:shadow-md"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Uji Contoh Ini &darr;</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 3: KAMUS KATA KUNCI CEPAT (STUDIO KEYWORD BANK) ── */}
      <section className="bg-white rounded-3xl border border-[#CBD5E1] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-xs sm:text-sm font-black text-[#0F172A]">
              Kamus Kata Kunci <span className="text-[#2563EB]">Studio Terverifikasi</span> (Klik untuk Sisipkan)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">12 Preset Terverifikasi</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_KEYWORDS.map((k, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleInsertKeyword(k.tag)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F8FAFC] hover:bg-[#EFF6FF] text-[#0F172A] hover:text-[#2563EB] border border-slate-200 hover:border-blue-300 text-xs font-bold transition-all cursor-pointer group shadow-2xs"
            >
              <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-600 font-mono">
                {k.cat}
              </span>
              <span>+ {k.tag}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── SECTION 4: DUAL-BOX OPTIMIZER WORKBENCH ── */}
      <section id="workbench-section" className="space-y-4">
        <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#2563EB] text-white text-[10px] font-black uppercase">
              AREA UJI SIMULATOR
            </span>
            <h2 className="text-lg sm:text-xl font-black text-[#0F172A]">
              Simulator Pembersih <span className="text-[#2563EB]">Prompt Real-Time</span>
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            Otomatis menyaring kata mubazir &amp; menyusun formula 4:5
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          
          {/* Left Box: Raw / External Prompt Input */}
          <div className="bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-7 shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-[#1E40AF] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#2563EB]" />
                  Prompt Mentah / Ide Awal Anda
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {rawPrompt.length} Karakter &bull; {rawPrompt.split(/\s+/).filter(Boolean).length} Kata
                </span>
              </div>

              <textarea
                rows={7}
                value={rawPrompt}
                onChange={(e) => setRawPrompt(e.target.value)}
                placeholder="Tempelkan kalimat prompt mentah dari medsos atau ide bebas di sini..."
                className="w-full p-4 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all leading-relaxed resize-none font-sans"
              />

              {/* Detected waste indicator */}
              {detectedWaste.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs space-y-1">
                  <span className="text-[10px] font-black uppercase text-amber-700 flex items-center gap-1">
                    <Info className="w-3 h-3 text-amber-600" />
                    Terdeteksi {detectedWaste.length} pola kata mubazir yang disaring otomatis:
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {detectedWaste.map((w, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-white border border-amber-300 text-[10px] font-semibold text-amber-800">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
              <span>Filter otomatis kata mubazir &amp; instruksi ganda</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRawPrompt(CASE_STUDIES[0].raw)}
                  className="font-bold text-[#2563EB] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Isi Contoh</span>
                </button>
                <span>&bull;</span>
                <button
                  type="button"
                  onClick={() => setRawPrompt('')}
                  className="font-bold text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                >
                  Kosongkan
                </button>
              </div>
            </div>
          </div>

          {/* Right Box: Output card showing optimized prompt & compactness score */}
          <div className="bg-white rounded-3xl border border-[#2563EB]/40 p-6 sm:p-7 shadow-md flex flex-col justify-between space-y-4 relative overflow-hidden">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-[#2563EB] flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span className="bg-gradient-to-r from-[#2563EB] to-[#0284C7] bg-clip-text text-transparent">Hasil Prompt Ringkas &amp; Teroptimasi</span>
                </span>
                
                {/* Compactness Score Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-black text-[#2563EB]">
                  <Zap className="w-3.5 h-3.5 fill-[#2563EB]" />
                  <span>Efisiensi: {compactnessScore}% Terarah</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] font-mono leading-relaxed min-h-[160px] select-all">
                {optimizedResult}
              </div>

              {/* Optimization stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-blue-50/50 border border-blue-100">
                  <span className="text-[10px] text-slate-500 block">Karakter Output:</span>
                  <span className="font-bold text-[#0F172A]">{optimizedResult.length} Karakter</span>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50/50 border border-blue-100">
                  <span className="text-[10px] text-slate-500 block">Penghematan Panjang:</span>
                  <span className="font-bold text-[#2563EB]">{wordSavings}% Lebih Ringkas</span>
                </div>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-xs font-bold text-slate-700 hover:border-[#2563EB] hover:text-[#2563EB] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Prompt</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleUseInStudio}
                className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition-all cursor-pointer hover:shadow-lg"
              >
                <span>Gunakan di Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
};
export default Advisor;
