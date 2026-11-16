export const SEED_SETTINGS: Record<string, unknown> = {
  language: 'id',
  default_daily_limit: 10,
  watermark_enabled: false,
  max_references: 4,
};

export const SEED_POLICY = {
  name: 'Kebijakan Konten Default',
  moderation_level: 'standard',
  blocked_terms: [
    'pornografi',
    'porno',
    'telanjang',
    'nude',
    'bunuh diri',
    'senjata api',
    'narkoba',
    'sabu',
    'judi online',
    'slot gacor',
    'terorisme',
    'ujaran kebencian',
    'hate speech',
  ],
  disclaimers: {
    psa: 'Konten ini dibuat dengan bantuan AI. Pastikan kebenaran informasi melalui sumber resmi sebelum disebarkan.',
    human_model: 'Gambar ini dihasilkan AI dan bukan foto asli.',
  },
};

export const SEED_BRAND = {
  name: 'Sukamenak Studio',
  palette: ['#1E40AF', '#0F172A', '#0284C7', '#EA580C', '#F8FAFC'],
  font_family: 'Inter',
  disclaimer: null,
};
