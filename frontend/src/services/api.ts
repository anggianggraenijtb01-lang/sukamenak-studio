/**
 * Unified Frontend & Studio API Service (src/services/api.ts)
 * Menyediakan data template lengkap dengan Gambar Visual 4:5 + Snippet Prompt (display_prompt),
 * kuota harian (12/15), statistik monitoring admin, log trace generasi, dan switcher model LLM.
 */

export interface StudioTemplate {
  id: string;
  name: string;
  category: 'Kuliner UMKM' | 'Kriya & Fashion' | 'Kegiatan RW 15' | 'Katalog Produk';
  subjectMode: 'Produk UMKM' | 'Human Model';
  aspectRatio: '4:5';
  textZonePosition: 'Top Header + Bottom CTA' | 'Bottom Card Overlay' | 'Split Editorial Frame';
  displayPrompt: string;
  lightingStyle: string;
  usageCount: number;
  previewImageUrl: string;
  sampleTitle: string;
  sampleRemarks: string;
}

export interface GenerationTraceLog {
  id: string;
  timestamp: string;
  creatorName: string;
  unit: string;
  mode: 'i2i' | 't2i';
  subject: 'Produk UMKM' | 'Human Model';
  model: string;
  latencyMs: number;
  costUsd: number;
  status: 'SUCCESS' | 'VERIFIED';
}

export interface LlmModelConfig {
  id: string;
  name: string;
  provider: string;
  role: 'Vision + Prompt Synthesis' | 'i2i / t2i Diffusion Engine';
  avgLatency: string;
  costPerRenderUsd: number;
  isDefault: boolean;
}

/**
 * Membuat ilustrasi poster SVG 4:5 (Data URI) yang tajam dan sesuai aturan palet warna
 * (Cobalt Blue #1E40AF, Midnight Navy #0F172A, Sky Cyan #0284C7, Warm Orange #EA580C, Slate #F8FAFC)
 */
export function createTemplatePosterSvgDataUri(params: {
  badge: string;
  headline: string;
  subline: string;
  footerText: string;
  theme: 'kuliner' | 'kriya' | 'rw15' | 'katalog';
}): string {
  const { badge, headline, subline, footerText, theme } = params;

  const bgPrimary =
    theme === 'kuliner'
      ? '#0F172A'
      : theme === 'kriya'
        ? '#1E3A8A'
        : theme === 'rw15'
          ? '#1E40AF'
          : '#0F172A';

  const accentColor =
    theme === 'kuliner' || theme === 'katalog' ? '#EA580C' : '#0284C7';

  // Ilustrasi tengah berbeda untuk tiap kategori
  const centerIllustration =
    theme === 'kuliner'
      ? `
      <!-- Piring & Keripik Tempe/Singkong UMKM -->
      <circle cx="200" cy="235" r="78" fill="#FFF7ED" stroke="#EA580C" stroke-width="4"/>
      <circle cx="200" cy="235" r="62" fill="#FFEDD5"/>
      <ellipse cx="182" cy="222" rx="22" ry="15" transform="rotate(-18 182 222)" fill="#EA580C" opacity="0.85"/>
      <ellipse cx="218" cy="225" rx="24" ry="16" transform="rotate(14 218 225)" fill="#C2410C" opacity="0.9"/>
      <ellipse cx="195" cy="248" rx="26" ry="16" transform="rotate(6 195 248)" fill="#F97316"/>
      <ellipse cx="212" cy="240" rx="20" ry="13" transform="rotate(-12 212 240)" fill="#FB923C"/>
      <rect x="245" y="162" width="54" height="26" rx="13" fill="#EA580C"/>
      <text x="272" y="179" text-anchor="middle" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="11" font-weight="800">RENYAH</text>
    `
      : theme === 'kriya'
        ? `
      <!-- Produk Kriya / Tas Rajut & Batik Warga -->
      <rect x="135" y="168" width="130" height="135" rx="22" fill="#F0F9FF" stroke="#0284C7" stroke-width="4"/>
      <path d="M170 168 C170 138, 230 138, 230 168" stroke="#1E40AF" stroke-width="8" fill="none" stroke-linecap="round"/>
      <rect x="155" y="192" width="90" height="86" rx="14" fill="#1E40AF"/>
      <path d="M165 215 L235 215 M165 235 L235 235 M165 255 L235 255" stroke="#BAE6FD" stroke-width="3" stroke-dasharray="6 4"/>
      <circle cx="200" cy="235" r="14" fill="#EA580C"/>
    `
        : theme === 'rw15'
          ? `
      <!-- Pengumuman Kegiatan Warga RW 15 -->
      <rect x="120" y="162" width="160" height="145" rx="20" fill="#F8FAFC" stroke="#0284C7" stroke-width="4"/>
      <rect x="140" y="182" width="120" height="28" rx="8" fill="#1E40AF"/>
      <text x="200" y="200" text-anchor="middle" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="11" font-weight="800">WARGA RW 15</text>
      <rect x="140" y="220" width="120" height="10" rx="5" fill="#CBD5E1"/>
      <rect x="140" y="238" width="96" height="10" rx="5" fill="#CBD5E1"/>
      <rect x="140" y="262" width="120" height="26" rx="8" fill="#EA580C"/>
      <text x="200" y="279" text-anchor="middle" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="10" font-weight="800">MINGGU • 07.00 WIB</text>
    `
          : `
      <!-- Kemasan Standing Pouch Kopi & Herbal Desa -->
      <rect x="148" y="154" width="104" height="156" rx="18" fill="#FFFFFF" stroke="#EA580C" stroke-width="4"/>
      <rect x="164" y="142" width="72" height="14" rx="5" fill="#0284C7"/>
      <rect x="162" y="180" width="76" height="72" rx="10" fill="#0F172A"/>
      <text x="200" y="212" text-anchor="middle" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="12" font-weight="800">KOPI DESA</text>
      <text x="200" y="230" text-anchor="middle" fill="#FED7AA" font-family="Inter, sans-serif" font-size="10" font-weight="700">SUKAMENAK</text>
      <rect x="172" y="266" width="56" height="20" rx="6" fill="#EA580C"/>
      <text x="200" y="280" text-anchor="middle" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="9" font-weight="800">100% ASLI</text>
    `;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" fill="none">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="400" y2="500" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="${bgPrimary}"/>
        <stop offset="100%" stop-color="#1E293B"/>
      </linearGradient>
    </defs>
    <rect width="400" height="500" fill="url(#bg)"/>
    <circle cx="200" cy="235" r="145" fill="${accentColor}" opacity="0.16"/>
    
    <!-- Top Header Safe Zone -->
    <rect x="28" y="24" width="190" height="32" rx="16" fill="${accentColor}"/>
    <text x="44" y="44" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="11" font-weight="800">${badge}</text>
    <rect x="308" y="24" width="64" height="32" rx="16" fill="#FFFFFF" opacity="0.15"/>
    <text x="340" y="44" text-anchor="middle" fill="#FFFFFF" font-family=" monospace" font-size="11" font-weight="700">4:5 HD</text>

    <!-- Stage Frame -->
    <rect x="28" y="72" width="344" height="292" rx="20" fill="#F8FAFC" opacity="0.08" stroke="#0284C7" stroke-width="1.5"/>
    ${centerIllustration}

    <!-- Bottom Sharp Typography Card -->
    <rect x="28" y="382" width="344" height="94" rx="16" fill="#FFFFFF"/>
    <rect x="42" y="398" width="6" height="62" rx="3" fill="${accentColor}"/>
    <text x="58" y="420" fill="#0F172A" font-family="Inter, sans-serif" font-size="15" font-weight="800">${headline}</text>
    <text x="58" y="440" fill="#475569" font-family="Inter, sans-serif" font-size="11" font-weight="600">${subline}</text>
    <text x="58" y="460" fill="#1E40AF" font-family="Inter, sans-serif" font-size="10" font-weight="800">${footerText}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const INITIAL_TEMPLATES: StudioTemplate[] = [
  {
    id: 'tpl-umkm-01',
    name: 'Katalog Kuliner Khas Sukamenak',
    category: 'Kuliner UMKM',
    subjectMode: 'Produk UMKM',
    aspectRatio: '4:5',
    textZonePosition: 'Top Header + Bottom CTA',
    displayPrompt:
      'Foto studio komersial [Produk Kuliner UMKM] di atas meja bersih, pencahayaan hangat 45 derajat, detail tekstur renyah tajam, rasio 4:5 dengan ruang teks promosi di bagian atas dan bawah.',
    lightingStyle: 'Softbox 45° + Rim Highlight',
    usageCount: 342,
    sampleTitle: 'Keripik Tempe Renyah Gurih UMKM RW 15',
    sampleRemarks:
      'Kedelai pilihan tanpa pengawet, kemasan higienis 250 gram siap pesan antar Desa Sukamenak.',
    previewImageUrl: createTemplatePosterSvgDataUri({
      badge: 'KULINER UMKM RW 15',
      headline: 'KERIPIK TEMPE SUKAMENAK',
      subline: 'Gurih Renyah • Kemasan Higienis 250gr',
      footerText: 'PESAN ANTAR WARGA RW 15 • 100% HALAL',
      theme: 'kuliner',
    }),
  },
  {
    id: 'tpl-umkm-02',
    name: 'Lookbook Fashion & Kriya Warga',
    category: 'Kriya & Fashion',
    subjectMode: 'Human Model',
    aspectRatio: '4:5',
    textZonePosition: 'Bottom Card Overlay',
    displayPrompt:
      'Potret katalog [Produk Kriya / Busana Warga] dengan pencahayaan alami lembut, latar belakang slate bersih, fokus tajam pada detail serat kain, rasio vertikal 4:5.',
    lightingStyle: 'Diffused Daylight Portrait',
    usageCount: 218,
    sampleTitle: 'Tas Rajut & Batik Tulis Karya Ibu PKK RW 15',
    sampleRemarks:
      'Jahitan tangan rapi berkualitas premium, tersedia berbagai motif khas Desa Sukamenak.',
    previewImageUrl: createTemplatePosterSvgDataUri({
      badge: 'KRIYA & FASHION WARGA',
      headline: 'TAS RAJUT & BATIK PKK',
      subline: 'Karya Asli Warga RW 15 Desa Sukamenak',
      footerText: 'KUALITAS PREMIUM • BISA PESAN CUSTOM',
      theme: 'kriya',
    }),
  },
  {
    id: 'tpl-rw15-03',
    name: 'Poster Pengumuman & Kegiatan RW 15',
    category: 'Kegiatan RW 15',
    subjectMode: 'Human Model',
    aspectRatio: '4:5',
    textZonePosition: 'Split Editorial Frame',
    displayPrompt:
      'Desain poster pengumuman resmi [Kegiatan Warga RW 15 Desa Sukamenak], tata letak modern bersih, kontras tinggi mudah dibaca orang tua, area judul tegas di atas dan info waktu di bawah.',
    lightingStyle: 'Clean Studio Balanced',
    usageCount: 189,
    sampleTitle: 'Kerja Bakti & Bazar UMKM Minggu Pagi RW 15',
    sampleRemarks:
      'Minggu pukul 07.00 WIB di Lapangan Balai Warga RW 15 Desa Sukamenak. Mari hadir bersama!',
    previewImageUrl: createTemplatePosterSvgDataUri({
      badge: 'PENGUMUMAN PENGURUS RW 15',
      headline: 'KERJA BAKTI & BAZAR WARGA',
      subline: 'Lapangan Balai RW 15 Desa Sukamenak',
      footerText: 'MINGGU PAGI 07.00 WIB • TERBUKA UNTUK UMUM',
      theme: 'rw15',
    }),
  },
  {
    id: 'tpl-umkm-04',
    name: 'Kemasan Produk Herbal & Kopi Desa',
    category: 'Katalog Produk',
    subjectMode: 'Produk UMKM',
    aspectRatio: '4:5',
    textZonePosition: 'Top Header + Bottom CTA',
    displayPrompt:
      'Tampilan produk kemasan [Kopi / Herbal Desa Sukamenak] di atas podium minimalis, pencahayaan studio tiga titik, bayangan lembut elegan, siap cetak dan katalog WhatsApp 4:5.',
    lightingStyle: 'Three-Point Product Studio',
    usageCount: 276,
    sampleTitle: 'Kopi Bubuk Arabika & Jamu Seduh Sukamenak',
    sampleRemarks:
      'Biji kopi pilihan sangrai tradisional dengan aroma khas pegunungan, kemasan standing pouch rapat.',
    previewImageUrl: createTemplatePosterSvgDataUri({
      badge: 'KATALOG PRODUK DESA',
      headline: 'KOPI & HERBAL SUKAMENAK',
      subline: 'Kemasan Standing Pouch Kedap Udara',
      footerText: 'PRODUK UNGGULAN UMKM DESA SUKAMENAK',
      theme: 'katalog',
    }),
  },
];

export const INITIAL_TRACE_LOGS: GenerationTraceLog[] = [
  {
    id: 'TRC-9041',
    timestamp: '2026-11-04 07:14:22',
    creatorName: 'Bu Hj. Rina (UMKM Keripik Tempe)',
    unit: 'Sentra Kuliner Sukamenak',
    mode: 'i2i',
    subject: 'Produk UMKM',
    model: 'Gemini 2.5 Flash Vision + Imagen 3 Studio',
    latencyMs: 2140,
    costUsd: 0.018,
    status: 'SUCCESS',
  },
  {
    id: 'TRC-9040',
    timestamp: '2026-11-04 07:09:10',
    creatorName: 'Kang Dedi (Kopi Robusta Puntang)',
    unit: 'Kreator Kopi & Minuman',
    mode: 't2i',
    subject: 'Human Model',
    model: 'Gemini 2.5 Flash Vision + Imagen 3 Studio',
    latencyMs: 2380,
    costUsd: 0.021,
    status: 'VERIFIED',
  },
  {
    id: 'TRC-9039',
    timestamp: '2026-11-04 06:55:48',
    creatorName: 'Teh Sari (Batik & Rajut Sukamenak)',
    unit: 'Fashion & Kriya Mandiri',
    mode: 'i2i',
    subject: 'Human Model',
    model: 'Flux.1 Dev Pro i2i + Sharp Overlay',
    latencyMs: 2490,
    costUsd: 0.024,
    status: 'SUCCESS',
  },
  {
    id: 'TRC-9038',
    timestamp: '2026-11-04 06:41:05',
    creatorName: 'Pak Hendra (Keripik Singkong Barokah)',
    unit: 'Produksi Camilan Tradisional',
    mode: 'i2i',
    subject: 'Produk UMKM',
    model: 'Gemini 2.5 Flash Vision + Imagen 3 Studio',
    latencyMs: 1980,
    costUsd: 0.018,
    status: 'SUCCESS',
  },
];

export const INITIAL_MODELS: LlmModelConfig[] = [
  {
    id: 'mdl-gemini-imagen',
    name: 'Gemini 2.5 Flash Vision + Imagen 3 Studio',
    provider: 'Google Cloud Vertex AI',
    role: 'Vision + Prompt Synthesis',
    avgLatency: '2.1s',
    costPerRenderUsd: 0.018,
    isDefault: true,
  },
  {
    id: 'mdl-flux-i2i',
    name: 'Flux.1 Dev ControlNet i2i + Sharp Engine',
    provider: 'Sukamenak Dedicated Inference Node',
    role: 'i2i / t2i Diffusion Engine',
    avgLatency: '2.4s',
    costPerRenderUsd: 0.022,
    isDefault: false,
  },
  {
    id: 'mdl-sdxl-lightning',
    name: 'SDXL Lightning UMKM Fine-Tuned v3',
    provider: 'Local Edge GPU Cluster',
    role: 'i2i / t2i Diffusion Engine',
    avgLatency: '1.4s',
    costPerRenderUsd: 0.009,
    isDefault: false,
  },
];

export function evaluatePromptCompactness(promptText: string): {
  score: number;
  wordCount: number;
  tokenEstimate: number;
  statusLabel: 'Terlalu Singkat' | 'Optimal & Padat' | 'Terlalu Panjang';
  suggestions: string[];
} {
  const words = promptText
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const wordCount = words.length;
  const tokenEstimate = Math.ceil(wordCount * 1.35);

  if (wordCount === 0) {
    return {
      score: 0,
      wordCount: 0,
      tokenEstimate: 0,
      statusLabel: 'Terlalu Singkat',
      suggestions: [
        'Masukkan nama produk UMKM atau konteks kegiatan RW 15.',
        'Tambahkan detail pencahayaan (misal: studio terang, cahaya alami pagi).',
      ],
    };
  }

  if (wordCount < 6) {
    return {
      score: 45,
      wordCount,
      tokenEstimate,
      statusLabel: 'Terlalu Singkat',
      suggestions: [
        'Tambahkan detail tekstur atau kemasan produk agar analisis Vision lebih tajam.',
        'Sebutkan suasana latar (misal: meja bersih atau latar minimalis slate).',
      ],
    };
  }

  if (wordCount <= 28) {
    return {
      score: 94,
      wordCount,
      tokenEstimate,
      statusLabel: 'Optimal & Padat',
      suggestions: [
        'Kalimat promosi sangat padat dan siap diinjeksikan ke [HIDDEN_CORE_PROMPT].',
        'Keseimbangan kata optimal untuk hasil gambar yang tajam dan rapi.',
      ],
    };
  }

  return {
    score: 68,
    wordCount,
    tokenEstimate,
      statusLabel: 'Terlalu Panjang',
    suggestions: [
      'Ringkas kalimat berulang agar fokus produk utama tetap menonjol.',
      'Gunakan kata kunci visual langsung (produk, kemasan, pencahayaan).',
    ],
  };
}
