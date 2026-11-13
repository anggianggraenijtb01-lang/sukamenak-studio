export interface SlotOption {
  value: string;
  label: string;
}

export interface SlotBase {
  label: string;
  type: 'text' | 'color' | 'select' | 'textarea';
  required?: boolean;
  default_value?: string;
  options?: SlotOption[];
  max_length?: number;
  vision_role?: 'product' | 'human_model' | 'font' | 'color' | 'lighting' | 'pose' | 'background' | 'style';
  source_hint?: string;
}

export interface ZoneSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  align: 'left' | 'center' | 'right';
  font_family?: string;
  font_weight?: number;
  font_size_ratio: number;
  color?: string;
  max_lines: number;
}

export interface OverlaySlot {
  key: string;
  label: string;
  type: 'text' | 'textarea';
  required?: boolean;
  max_length: number;
  default_value?: string;
  zone: ZoneSpec;
}

export interface SeedTemplate {
  slug: string;
  name: string;
  description: string;
  category: 'poster' | 'psa' | 'social_post' | 'product_shot' | 'human_model';
  mode: 'i2i' | 't2i' | 'both';
  subject: 'product' | 'human_model';
  aspect_ratio: string;
  core_prompt_key: string;
  /** File under frontend/public used as the preview image, when present. */
  preview_file?: string;
  /** Per-slot overrides of SLOT_LIBRARY, keyed by slot key (blank slots of the core prompt). */
  slots: Record<string, Partial<SlotBase>>;
  overlay_slots: OverlaySlot[];
  example_references?: { role: 'product'; label: string; file: string }[];
}

const LIGHTING: SlotOption[] = [
  { value: 'soft diffused daylight', label: 'Cahaya siang lembut' },
  { value: 'warm golden-hour light', label: 'Cahaya hangat senja' },
  { value: 'three-point studio softbox lighting', label: 'Studio softbox tiga titik' },
  { value: 'dramatic side light with a soft rim highlight', label: 'Cahaya samping dramatis' },
  { value: 'bright even high-key lighting', label: 'Terang merata (high-key)' },
];

const STYLE: SlotOption[] = [
  { value: 'clean modern commercial', label: 'Komersial modern bersih' },
  { value: 'warm traditional Indonesian village charm', label: 'Hangat khas desa' },
  { value: 'minimalist editorial', label: 'Minimalis editorial' },
  { value: 'vibrant festive', label: 'Meriah dan cerah' },
  { value: 'premium elegant', label: 'Premium elegan' },
];

const COMPOSITION: SlotOption[] = [
  { value: 'centred hero with generous negative space', label: 'Objek di tengah, ruang lega' },
  { value: 'rule-of-thirds with the subject slightly off-centre', label: 'Aturan sepertiga' },
  { value: 'symmetrical frontal framing', label: 'Simetris dari depan' },
  { value: 'dynamic diagonal framing', label: 'Diagonal dinamis' },
];

const ANGLE: SlotOption[] = [
  { value: 'eye-level at a slight 45 degree angle', label: 'Sejajar mata, miring 45 derajat' },
  { value: 'top-down flat lay', label: 'Dari atas (flat lay)' },
  { value: 'low angle hero shot', label: 'Sudut rendah' },
  { value: 'straight-on frontal view', label: 'Lurus dari depan' },
];

const POSE: SlotOption[] = [
  { value: 'standing relaxed, facing the camera', label: 'Berdiri santai menghadap kamera' },
  { value: 'three-quarter turn with a gentle smile', label: 'Menoleh tiga perempat' },
  { value: 'seated naturally, hands resting', label: 'Duduk natural' },
  { value: 'walking naturally', label: 'Berjalan natural' },
];

/** Base definition of every blank-bearing slot; templates override labels and defaults. */
export const SLOT_LIBRARY: Record<string, SlotBase> = {
  product: {
    label: 'Produk / objek utama',
    type: 'text',
    required: true,
    max_length: 120,
    default_value: 'a packaged product',
    vision_role: 'product',
    source_hint: 'subject taken from the product reference',
  },
  color: {
    label: 'Warna dominan',
    type: 'color',
    max_length: 80,
    default_value: 'warm orange (#EA580C) with cream and deep navy (#0F172A) accents',
    vision_role: 'color',
    source_hint: 'colour taken from the colour reference',
  },
  background: {
    label: 'Latar & suasana',
    type: 'text',
    max_length: 120,
    default_value: 'a clean, softly blurred setting that suits the subject',
    vision_role: 'background',
    source_hint: 'setting taken from the background reference',
  },
  lighting: {
    label: 'Pencahayaan',
    type: 'select',
    options: LIGHTING,
    default_value: 'soft diffused daylight',
    vision_role: 'lighting',
    source_hint: 'lighting taken from the lighting reference',
  },
  style: {
    label: 'Gaya visual',
    type: 'select',
    options: STYLE,
    default_value: 'clean modern commercial',
    vision_role: 'style',
    source_hint: 'visual style taken from the style reference',
  },
  composition: {
    label: 'Komposisi',
    type: 'select',
    options: COMPOSITION,
    default_value: 'centred hero with generous negative space',
  },
  angle: {
    label: 'Sudut kamera',
    type: 'select',
    options: ANGLE,
    default_value: 'eye-level at a slight 45 degree angle',
  },
  remarks: {
    label: 'Catatan tambahan',
    type: 'textarea',
    max_length: 300,
    default_value: 'keep the scene clean and uncluttered',
  },
  model: {
    label: 'Model',
    type: 'text',
    required: true,
    max_length: 120,
    default_value: 'a friendly adult model with a natural smile',
    vision_role: 'human_model',
    source_hint: 'person taken from the human-model reference',
  },
  outfit: {
    label: 'Busana',
    type: 'text',
    max_length: 120,
    default_value: 'neat casual clothing in a colour that complements the palette',
  },
  pose: {
    label: 'Pose & ekspresi',
    type: 'select',
    options: POSE,
    default_value: 'standing relaxed, facing the camera',
    vision_role: 'pose',
    source_hint: 'pose taken from the pose reference',
  },
};

const TITLE_TOP: ZoneSpec = {
  x: 0.08, y: 0.06, w: 0.84, h: 0.18, align: 'center', font_weight: 800, font_size_ratio: 0.06, color: '#FFFFFF', max_lines: 2,
};
const CTA_BOTTOM: ZoneSpec = {
  x: 0.1, y: 0.86, w: 0.8, h: 0.08, align: 'center', font_weight: 700, font_size_ratio: 0.035, color: '#FFFFFF', max_lines: 1,
};

export const SEED_TEMPLATES: readonly SeedTemplate[] = [
  {
    slug: 'poster-promo-produk',
    name: 'Poster Promo Produk',
    description: 'Poster promosi produk UMKM dengan ruang judul di atas dan ajakan bertindak di bawah.',
    category: 'poster',
    mode: 'i2i',
    subject: 'product',
    aspect_ratio: '4:5',
    core_prompt_key: 'product.poster',
    preview_file: 'posters/poster-keripik-proper.jpg',
    slots: {
      product: { label: 'Produk yang dipromosikan', default_value: 'a packaged Indonesian snack product' },
      background: { default_value: 'a warm kitchen-table setting with soft bokeh' },
    },
    overlay_slots: [
      { key: 'title', label: 'Judul poster', type: 'text', required: true, max_length: 60, zone: TITLE_TOP },
      {
        key: 'subtitle', label: 'Sub-judul', type: 'text', max_length: 90,
        zone: { x: 0.08, y: 0.25, w: 0.84, h: 0.08, align: 'center', font_weight: 500, font_size_ratio: 0.03, color: '#FFFFFF', max_lines: 2 },
      },
      { key: 'cta', label: 'Ajakan bertindak', type: 'text', max_length: 40, zone: CTA_BOTTOM },
    ],
    example_references: [{ role: 'product', label: 'Contoh foto produk (kemasan pouch)', file: 'kemasan_tempe_pouch.jpg' }],
  },
  {
    slug: 'poster-kegiatan-organisasi',
    name: 'Poster Kegiatan Organisasi',
    description: 'Poster pengumuman kegiatan RW, PKK, karang taruna, atau organisasi desa lainnya.',
    category: 'poster',
    mode: 'both',
    subject: 'product',
    aspect_ratio: '4:5',
    core_prompt_key: 'product.poster',
    preview_file: 'posters/poster-bazar.jpg',
    slots: {
      product: {
        label: 'Objek / suasana kegiatan',
        required: false,
        default_value: 'festive community-event props such as bunting, woven mats and flower arrangements',
      },
      background: { default_value: 'an open-air village hall courtyard in soft morning light' },
      lighting: { default_value: 'warm golden-hour light' },
      style: { default_value: 'warm traditional Indonesian village charm' },
    },
    overlay_slots: [
      { key: 'title', label: 'Nama kegiatan', type: 'text', required: true, max_length: 60, zone: TITLE_TOP },
      {
        key: 'date_venue', label: 'Tanggal & lokasi', type: 'text', required: true, max_length: 90,
        zone: { x: 0.08, y: 0.78, w: 0.84, h: 0.1, align: 'center', font_weight: 600, font_size_ratio: 0.035, color: '#FFFFFF', max_lines: 2 },
      },
      { key: 'cta', label: 'Ajakan / kontak', type: 'text', max_length: 40, zone: CTA_BOTTOM },
    ],
  },
  {
    slug: 'banner-pengumuman-layanan-publik',
    name: 'Banner Pengumuman Layanan Publik',
    description: 'Banner layanan masyarakat yang tenang dan mudah dibaca. Wajib menampilkan disclaimer.',
    category: 'psa',
    mode: 'both',
    subject: 'product',
    aspect_ratio: '16:9',
    core_prompt_key: 'product.psa',
    preview_file: 'posters/poster-pengajian.jpg',
    slots: {
      product: {
        label: 'Gagasan visual utama',
        required: false,
        default_value: 'a simple symbolic scene of clean water, a tidy neighbourhood and a healthy household',
      },
      color: { default_value: 'calm blue (#1E40AF) and sky cyan (#0284C7) with white' },
      background: { default_value: 'a calm, softly graded background' },
      lighting: { default_value: 'bright even high-key lighting' },
      remarks: { default_value: 'keep a calm and reassuring tone' },
    },
    overlay_slots: [
      {
        key: 'title', label: 'Judul pengumuman', type: 'text', required: true, max_length: 70,
        zone: { x: 0.05, y: 0.08, w: 0.9, h: 0.22, align: 'left', font_weight: 800, font_size_ratio: 0.07, color: '#FFFFFF', max_lines: 2 },
      },
      {
        key: 'message', label: 'Isi pengumuman', type: 'textarea', required: true, max_length: 140,
        zone: { x: 0.05, y: 0.34, w: 0.6, h: 0.4, align: 'left', font_weight: 500, font_size_ratio: 0.04, color: '#FFFFFF', max_lines: 4 },
      },
      {
        key: 'contact', label: 'Kontak / sumber resmi', type: 'text', max_length: 60,
        zone: { x: 0.05, y: 0.82, w: 0.9, h: 0.1, align: 'left', font_weight: 600, font_size_ratio: 0.035, color: '#FFFFFF', max_lines: 1 },
      },
    ],
  },
  {
    slug: 'konten-feed-produk-4-5',
    name: 'Konten Feed Produk 4:5',
    description: 'Visual feed Instagram/Facebook rasio 4:5 untuk produk dengan ruang pesan singkat.',
    category: 'social_post',
    mode: 'i2i',
    subject: 'product',
    aspect_ratio: '4:5',
    core_prompt_key: 'product.social_post',
    preview_file: 'posters/keripik-crispy.jpg',
    slots: {
      background: { default_value: 'a styled tabletop with soft natural props' },
    },
    overlay_slots: [
      { key: 'title', label: 'Pesan utama', type: 'text', required: true, max_length: 60, zone: TITLE_TOP },
      { key: 'cta', label: 'Ajakan bertindak', type: 'text', max_length: 40, zone: CTA_BOTTOM },
    ],
    example_references: [{ role: 'product', label: 'Contoh foto produk (kemasan pouch)', file: 'kemasan_tempe_pouch.jpg' }],
  },
  {
    slug: 'story-promo-9-16',
    name: 'Story Promo 9:16',
    description: 'Visual story vertikal 9:16 untuk promo kilat, dengan zona pesan di atas dan bawah.',
    category: 'social_post',
    mode: 'i2i',
    subject: 'product',
    aspect_ratio: '9:16',
    core_prompt_key: 'product.social_post',
    preview_file: 'posters/poster-kopi.jpg',
    slots: {
      color: { default_value: 'bold orange (#EA580C) and white' },
      background: { default_value: 'a smooth vivid colour gradient backdrop' },
      style: { default_value: 'vibrant festive' },
    },
    overlay_slots: [
      {
        key: 'title', label: 'Pesan utama', type: 'text', required: true, max_length: 50,
        zone: { x: 0.08, y: 0.1, w: 0.84, h: 0.14, align: 'center', font_weight: 800, font_size_ratio: 0.05, color: '#FFFFFF', max_lines: 2 },
      },
      {
        key: 'cta', label: 'Ajakan bertindak', type: 'text', max_length: 40,
        zone: { x: 0.1, y: 0.84, w: 0.8, h: 0.06, align: 'center', font_weight: 700, font_size_ratio: 0.03, color: '#FFFFFF', max_lines: 1 },
      },
    ],
  },
  {
    slug: 'foto-produk-latar-putih',
    name: 'Foto Produk Latar Putih',
    description: 'Foto katalog produk di atas latar putih bersih, cocok untuk marketplace.',
    category: 'product_shot',
    mode: 'i2i',
    subject: 'product',
    aspect_ratio: '1:1',
    core_prompt_key: 'product.product_shot',
    preview_file: 'posters/real-keripik-tempe.jpg',
    slots: {
      background: { default_value: 'a pure seamless white studio backdrop with a soft natural contact shadow' },
      lighting: { default_value: 'bright even high-key lighting' },
      angle: { default_value: 'straight-on frontal view' },
      color: { default_value: 'true-to-life product colours with neutral white props' },
      remarks: { default_value: 'product only, no props' },
    },
    overlay_slots: [],
    example_references: [{ role: 'product', label: 'Contoh foto produk (kemasan pouch)', file: 'kemasan_tempe_pouch.jpg' }],
  },
  {
    slug: 'foto-produk-gaya-hidup',
    name: 'Foto Produk Gaya Hidup',
    description: 'Foto produk dalam suasana sehari-hari yang hangat untuk konten media sosial.',
    category: 'product_shot',
    mode: 'i2i',
    subject: 'product',
    aspect_ratio: '4:5',
    core_prompt_key: 'product.product_shot',
    preview_file: 'posters/keripik-bowl.jpg',
    slots: {
      background: { default_value: 'an everyday lifestyle scene on a wooden table near a window' },
      color: { default_value: 'warm earthy tones with soft greens' },
    },
    overlay_slots: [],
  },
  {
    slug: 'model-manusia-studio',
    name: 'Model Manusia - Studio',
    description: 'Potret model di studio dengan latar polos dan pencahayaan profesional. Wajib persetujuan (consent).',
    category: 'human_model',
    mode: 'i2i',
    subject: 'human_model',
    aspect_ratio: '4:5',
    core_prompt_key: 'human_model.portrait',
    preview_file: 'avatars/avatar-ibu-sari.jpg',
    slots: {
      background: { default_value: 'a seamless light-grey studio backdrop' },
      lighting: { default_value: 'three-point studio softbox lighting' },
    },
    overlay_slots: [],
  },
  {
    slug: 'model-manusia-outdoor',
    name: 'Model Manusia - Outdoor',
    description: 'Potret model di luar ruangan dengan cahaya alami dan suasana desa. Wajib persetujuan (consent).',
    category: 'human_model',
    mode: 'i2i',
    subject: 'human_model',
    aspect_ratio: '4:5',
    core_prompt_key: 'human_model.portrait',
    preview_file: 'avatars/avatar-pak-hendra.jpg',
    slots: {
      background: { default_value: 'a sunlit village garden with soft greenery' },
      lighting: { default_value: 'warm golden-hour light' },
      style: { default_value: 'warm traditional Indonesian village charm' },
      pose: { default_value: 'walking naturally' },
    },
    overlay_slots: [],
  },
  {
    slug: 'ucapan-selamat-greeting',
    name: 'Ucapan Selamat / Greeting',
    description: 'Kartu ucapan hari raya, ulang tahun, atau syukuran dengan dekorasi yang hangat.',
    category: 'social_post',
    mode: 'both',
    subject: 'product',
    aspect_ratio: '1:1',
    core_prompt_key: 'product.social_post',
    preview_file: 'posters/poster-kue.jpg',
    slots: {
      product: {
        label: 'Objek dekoratif utama',
        default_value: 'festive ornaments, flowers and a decorative ribbon arrangement',
      },
      color: { default_value: 'soft gold (#D4AF37) and deep green' },
      background: { default_value: 'an elegant softly lit backdrop with gentle sparkles' },
      style: { default_value: 'premium elegant' },
      remarks: { default_value: 'a celebratory and warm mood' },
    },
    overlay_slots: [
      {
        key: 'title', label: 'Ucapan', type: 'text', required: true, max_length: 50,
        zone: { x: 0.1, y: 0.12, w: 0.8, h: 0.2, align: 'center', font_weight: 800, font_size_ratio: 0.07, color: '#FFFFFF', max_lines: 2 },
      },
      {
        key: 'subtitle', label: 'Pesan singkat', type: 'text', max_length: 90,
        zone: { x: 0.1, y: 0.72, w: 0.8, h: 0.12, align: 'center', font_weight: 500, font_size_ratio: 0.04, color: '#FFFFFF', max_lines: 2 },
      },
    ],
  },
];
