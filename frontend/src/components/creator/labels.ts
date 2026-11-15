/**
 * Indonesian labels for the enums the API returns, shared by the creator pages.
 */
import type { GenerationStatus, ReferenceRole, TemplateCategory, TutorialLevel } from '../../api/types';

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  poster: 'Poster',
  psa: 'Layanan Publik',
  social_post: 'Konten Sosmed',
  product_shot: 'Foto Produk',
  human_model: 'Model Manusia',
};

export const CATEGORY_ORDER: TemplateCategory[] = ['poster', 'social_post', 'product_shot', 'psa', 'human_model'];

export const categoryLabel = (category: string | null | undefined): string =>
  (category && CATEGORY_LABELS[category as TemplateCategory]) || 'Template';

export const ROLE_LABELS: Record<ReferenceRole, string> = {
  product: 'Produk',
  human_model: 'Model Manusia',
  color: 'Warna',
  style: 'Gaya',
  background: 'Latar',
  lighting: 'Cahaya',
  pose: 'Pose',
  font: 'Huruf',
};

export const ROLE_ORDER: ReferenceRole[] = ['product', 'human_model', 'color', 'style', 'background', 'lighting', 'pose', 'font'];

export const roleLabel = (role: string): string => ROLE_LABELS[role as ReferenceRole] ?? role;

export const LEVEL_LABELS: Record<TutorialLevel, string> = {
  pemula: 'Pemula',
  menengah: 'Menengah',
  mahir: 'Mahir',
};

export const STATUS_LABELS: Record<GenerationStatus, string> = {
  queued: 'Antre',
  running: 'Diproses',
  done: 'Selesai',
  failed: 'Gagal',
};
