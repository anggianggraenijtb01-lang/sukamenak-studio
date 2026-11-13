export interface SeedGalleryItem {
  title: string;
  template_slug: string;
  /** File under frontend/public, copied into local storage as the gallery image. */
  image_file: string;
  slot_values: Record<string, string>;
  remarks?: string;
  is_featured?: boolean;
}

/** Examples shown on the public gallery. `display_prompt` is derived from slot_values + remarks only. */
export const SEED_GALLERY: readonly SeedGalleryItem[] = [
  {
    title: 'Keripik Tempe Renyah',
    template_slug: 'poster-promo-produk',
    image_file: 'posters/poster-keripik-proper.jpg',
    slot_values: {
      product: 'keripik tempe renyah dalam kemasan standing pouch',
      color: 'oranye hangat dan krem',
      lighting: 'soft diffused daylight',
      title: 'Keripik Tempe Sukamenak',
    },
    remarks: 'suasana hangat, kemasan bersih dan higienis',
    is_featured: true,
  },
  {
    title: 'Bazar UMKM RW 15',
    template_slug: 'poster-kegiatan-organisasi',
    image_file: 'posters/poster-bazar.jpg',
    slot_values: {
      background: 'halaman balai warga di pagi hari',
      style: 'warm traditional Indonesian village charm',
      title: 'Bazar UMKM RW 15',
      date_venue: 'Minggu 07.00 WIB, Balai Warga',
    },
    remarks: 'meriah, penuh umbul-umbul',
    is_featured: true,
  },
  {
    title: 'Kopi Desa Sukamenak',
    template_slug: 'konten-feed-produk-4-5',
    image_file: 'posters/poster-kopi.jpg',
    slot_values: {
      product: 'kopi bubuk arabika dalam standing pouch',
      color: 'cokelat tua dan krem',
      background: 'meja kayu dengan biji kopi',
      title: 'Kopi Pegunungan',
    },
  },
  {
    title: 'Kriya Anyaman Warga',
    template_slug: 'foto-produk-gaya-hidup',
    image_file: 'posters/poster-kriya.jpg',
    slot_values: {
      product: 'tas anyaman pandan buatan ibu-ibu PKK',
      background: 'meja kayu dekat jendela',
      angle: 'top-down flat lay',
    },
    remarks: 'warna alami, cahaya jendela lembut',
  },
  {
    title: 'Kue Lebaran',
    template_slug: 'ucapan-selamat-greeting',
    image_file: 'posters/poster-kue.jpg',
    slot_values: {
      product: 'toples kue kering dan bunga melati',
      color: 'emas lembut dan hijau tua',
      title: 'Selamat Hari Raya',
    },
    remarks: 'hangat dan penuh syukur',
    is_featured: true,
  },
  {
    title: 'Pengajian Akbar',
    template_slug: 'poster-kegiatan-organisasi',
    image_file: 'posters/poster-pengajian.jpg',
    slot_values: {
      background: 'masjid kampung saat senja',
      lighting: 'warm golden-hour light',
      title: 'Pengajian Akbar',
    },
  },
];
