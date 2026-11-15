/** Display helpers shared by the admin pages. Dates follow the server's APP_TIMEZONE (Asia/Jakarta by default). */
import { messageForCode } from '../../api/errors';

const TZ = 'Asia/Jakarta';

const dateTimeFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ });
const dateFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: TZ, hour12: false });

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : dateTimeFmt.format(d);
};

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d);
};

export const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : timeFmt.format(d);
};

/** Short `dd/MM` label of a `YYYY-MM-DD` calendar date. */
export const formatDayMonth = (date: string): string => {
  const [, m, d] = date.split('-');
  return m && d ? `${d}/${m}` : date;
};

export const formatNumber = (n: number | null | undefined): string => (n == null ? '-' : n.toLocaleString('id-ID'));

export const formatPercent = (ratio: number | null | undefined): string =>
  ratio == null ? '-' : `${(ratio * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;

export const formatUsd = (n: number | null | undefined, digits = 4): string => (n == null ? '-' : `$${n.toFixed(digits)}`);

export const formatDuration = (ms: number | null | undefined): string => {
  if (ms == null) return '-';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} dtk`;
};

/** First eight characters of an id, for compact tables. */
export const shortId = (id: string | null | undefined): string => (id ? id.slice(0, 8) : '-');

/** Short Indonesian labels of the generation failure codes (dashboard, logs). */
const FAILURE_LABELS: Record<string, string> = {
  PROVIDER_TIMEOUT: 'Penyedia model terlalu lama merespons',
  PROVIDER_RATE_LIMITED: 'Penyedia model membatasi permintaan',
  PROVIDER_UNAVAILABLE: 'Penyedia model tidak tersedia',
  PROVIDER_AUTH: 'Autentikasi ke penyedia model gagal (cek API key)',
  PROVIDER_BAD_REQUEST: 'Permintaan ditolak penyedia model',
  PROVIDER_CONTENT_BLOCKED: 'Diblokir filter konten penyedia model',
  PROVIDER_BAD_RESPONSE: 'Respons penyedia model tidak valid',
  REFERENCE_UNAVAILABLE: 'Foto referensi tidak tersedia',
  TEMPLATE_UNAVAILABLE: 'Template tidak tersedia',
  JOB_TIMEOUT: 'Proses melewati batas waktu',
  NO_MODEL_AVAILABLE: 'Tidak ada model aktif',
  CONTENT_POLICY_VIOLATION: 'Melanggar kebijakan konten',
  INTERNAL_ERROR: 'Kesalahan internal server',
};

export const failureLabel = (code: string | null | undefined): string => {
  if (!code) return '-';
  return FAILURE_LABELS[code] ?? messageForCode(code);
};

export const CAPABILITY_LABELS = {
  vision: 'Vision (analisis foto)',
  text: 'Text (teks & prompt)',
  t2i: 'T2I (teks ke gambar)',
  i2i: 'I2I (foto ke gambar)',
} as const;

export const CATEGORY_LABELS = {
  poster: 'Poster',
  psa: 'PSA (layanan masyarakat)',
  social_post: 'Postingan sosial',
  product_shot: 'Foto produk',
  human_model: 'Model manusia',
} as const;

export const REFERENCE_ROLE_LABELS = {
  product: 'Produk',
  human_model: 'Model manusia',
  font: 'Font',
  color: 'Warna',
  lighting: 'Pencahayaan',
  pose: 'Pose',
  background: 'Latar',
  style: 'Gaya',
} as const;

export const GENERATION_STATUS_LABELS = {
  queued: 'Antre',
  running: 'Berjalan',
  done: 'Selesai',
  failed: 'Gagal',
} as const;

export const STAGE_LABELS = {
  analysis: 'Analisis',
  compose: 'Komposisi',
  generate: 'Generasi',
  composite: 'Komposit teks',
} as const;
