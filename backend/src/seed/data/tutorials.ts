export type SectionKind = 'what_to_do' | 'do' | 'dont' | 'tip' | 'example';

export interface SeedTutorial {
  slug: string;
  title: string;
  summary: string;
  level: 'pemula' | 'menengah' | 'mahir';
  sections: { kind: SectionKind; title: string; body_md: string }[];
}

export interface SeedBreakdown {
  aspect: 'style' | 'color' | 'gradient' | 'angle' | 'lighting' | 'composition';
  title: string;
  description: string;
  prompt_fragment: string;
}

export const SEED_TUTORIALS: readonly SeedTutorial[] = [
  {
    slug: 'mulai-membuat-konten-pertama',
    title: 'Mulai Membuat Konten Pertama',
    summary: 'Langkah singkat dari memilih template sampai mengunduh hasil pertama Anda.',
    level: 'pemula',
    sections: [
      {
        kind: 'what_to_do',
        title: 'Alur lima langkah',
        body_md:
          '1. Pilih **template** yang paling dekat dengan kebutuhan (poster, feed, story, foto produk).\n2. Unggah **foto referensi** produk Anda.\n3. Isi kolom yang tersedia; yang kosong akan diisi otomatis.\n4. Tambahkan **catatan** singkat bila perlu.\n5. Tekan *Buat*, tunggu beberapa detik, lalu unduh hasilnya.',
      },
      {
        kind: 'do',
        title: 'Gunakan foto produk yang jelas',
        body_md: 'Foto yang terang, tidak buram, dan menampilkan seluruh produk akan menghasilkan gambar yang lebih mirip aslinya.',
      },
      {
        kind: 'do',
        title: 'Cukup isi yang penting',
        body_md: 'Template sudah punya nilai bawaan yang aman. Ubah hanya bagian yang benar-benar ingin Anda atur, misalnya warna atau suasana.',
      },
      {
        kind: 'dont',
        title: 'Jangan minta AI menulis kalimat panjang di gambar',
        body_md: 'Judul dan ajakan ditempel otomatis oleh aplikasi di area yang sudah disiapkan. Cukup isi kolom judul; jangan meminta tulisan lewat catatan.',
      },
      {
        kind: 'tip',
        title: 'Coba beberapa kali',
        body_md: 'Hasil bisa sedikit berbeda setiap kali. Batas harian membatasi jumlah hasil yang **berhasil**, jadi percobaan yang gagal tidak mengurangi jatah Anda.',
      },
    ],
  },
  {
    slug: 'foto-produk-dengan-hp',
    title: 'Foto Produk dengan Kamera HP',
    summary: 'Teknik sederhana agar foto referensi dari HP terlihat profesional.',
    level: 'pemula',
    sections: [
      {
        kind: 'what_to_do',
        title: 'Siapkan tempat foto',
        body_md: 'Letakkan produk di dekat jendela pada pagi hari. Gunakan kertas putih atau styrofoam sebagai pemantul cahaya dan kain polos sebagai latar.',
      },
      { kind: 'do', title: 'Bersihkan lensa', body_md: 'Lap lensa dengan kain halus sebelum memotret agar tidak berkabut.' },
      { kind: 'do', title: 'Kunci fokus dan kecerahan', body_md: 'Sentuh dan tahan pada produk sampai muncul tanda **AE/AF Lock**, lalu geser kecerahan sedikit ke bawah.' },
      { kind: 'dont', title: 'Hindari lampu blitz', body_md: 'Blitz membuat pantulan keras pada plastik dan kaca. Pakai cahaya jendela.' },
      { kind: 'dont', title: 'Jangan memotong sudut produk', body_md: 'Pastikan seluruh kemasan masuk bingkai dengan sedikit ruang di sekelilingnya.' },
      { kind: 'tip', title: 'Aktifkan garis kisi 3x3', body_md: 'Fitur grid membantu menempatkan produk dengan seimbang dan menjaga horizon tetap lurus.' },
    ],
  },
  {
    slug: 'menulis-catatan-yang-efektif',
    title: 'Menulis Catatan (Remarks) yang Efektif',
    summary: 'Catatan singkat dan konkret memberi hasil lebih baik daripada paragraf panjang.',
    level: 'pemula',
    sections: [
      {
        kind: 'what_to_do',
        title: 'Satu ide per kalimat',
        body_md: 'Tulis catatan pendek dipisah koma, misalnya: *warna hangat, cahaya lembut dari samping, latar meja kayu*. Sistem mengarahkan tiap bagian ke kolom yang sesuai.',
      },
      { kind: 'do', title: 'Sebut hal yang bisa dilihat', body_md: 'Warna, cahaya, latar, sudut, dan suasana mudah dipahami model gambar.' },
      { kind: 'do', title: 'Gunakan bahasa Indonesia atau Inggris', body_md: 'Keduanya dikenali. Pilih yang paling nyaman bagi Anda.' },
      { kind: 'dont', title: 'Jangan memberi perintah ke sistem', body_md: 'Kalimat seperti "abaikan instruksi sebelumnya" akan dibuang otomatis dan tidak mengubah hasil.' },
      { kind: 'dont', title: 'Jangan menyisipkan tanda kurung blank', body_md: 'Simbol khusus yang dipakai template tidak dapat dipakai di catatan dan akan dihapus.' },
      {
        kind: 'example',
        title: 'Contoh catatan yang baik',
        body_md: '> warna oranye hangat, cahaya pagi dari jendela, latar meja kayu, suasana ramah dan bersih',
      },
    ],
  },
  {
    slug: 'elemen-visual-dasar',
    title: 'Memahami Elemen Visual: Gaya, Warna, Sudut, Cahaya, Komposisi',
    summary: 'Kenali enam elemen visual yang bisa Anda atur dan contoh frasa yang bisa dipakai.',
    level: 'menengah',
    sections: [
      {
        kind: 'what_to_do',
        title: 'Pilih satu elemen untuk diubah',
        body_md: 'Ubah satu elemen pada satu waktu supaya Anda tahu efeknya. Lihat kartu *breakdown visual* di bawah untuk contoh frasa tiap elemen.',
      },
      { kind: 'do', title: 'Padukan warna dengan identitas brand', body_md: 'Palet brand tersedia otomatis; cukup sebut warna aksen tambahan.' },
      { kind: 'do', title: 'Sisakan ruang kosong', body_md: 'Area kosong dipakai untuk judul dan ajakan. Komposisi dengan ruang lega membuat teks mudah dibaca.' },
      { kind: 'dont', title: 'Jangan mencampur terlalu banyak gaya', body_md: 'Satu gaya yang konsisten lebih kuat daripada tiga gaya yang saling bertabrakan.' },
      { kind: 'tip', title: 'Sudut 45 derajat cocok untuk kemasan', body_md: 'Sudut ini memperlihatkan depan dan sisi kemasan sehingga bentuk tiga dimensinya terlihat.' },
    ],
  },
  {
    slug: 'memilih-gambar-referensi',
    title: 'Memilih Gambar Referensi yang Tepat',
    summary: 'Setiap referensi punya peran: produk, warna, cahaya, pose, latar, atau gaya.',
    level: 'menengah',
    sections: [
      {
        kind: 'what_to_do',
        title: 'Tentukan peran tiap gambar',
        body_md: 'Saat mengunggah, pilih peran: **produk** (bentuk asli), **warna**, **cahaya**, **pose**, **latar**, atau **gaya**. Sistem hanya mengambil unsur sesuai peran dan mengabaikan sisanya.',
      },
      { kind: 'do', title: 'Satu gambar, satu peran', body_md: 'Gambar yang dipakai untuk warna sebaiknya benar-benar menampilkan warna yang Anda mau.' },
      { kind: 'do', title: 'Maksimal empat gambar', body_md: 'Batas default adalah 4 referensi per pembuatan agar hasil tetap fokus.' },
      { kind: 'dont', title: 'Jangan unggah gambar milik orang lain tanpa izin', body_md: 'Pastikan Anda berhak memakai setiap gambar, terutama foto orang.' },
      { kind: 'tip', title: 'Referensi produk wajib tajam', body_md: 'Detail logo dan kemasan hanya bisa dipertahankan bila foto referensinya tajam.' },
    ],
  },
  {
    slug: 'konten-aman-dan-etis',
    title: 'Konten Aman: Izin Foto Orang dan Layanan Publik',
    summary: 'Aturan persetujuan (consent), perlindungan data pribadi, dan disclaimer untuk pengumuman publik.',
    level: 'pemula',
    sections: [
      {
        kind: 'what_to_do',
        title: 'Konfirmasi izin sebelum memakai foto orang',
        body_md: 'Template Model Manusia dan referensi berperan *model manusia* mewajibkan Anda menyatakan bahwa orang di foto telah memberi izin tertulis atau lisan yang dapat dibuktikan.',
      },
      { kind: 'do', title: 'Catat sumber izin', body_md: 'Isi catatan persetujuan dengan singkat, misalnya "Izin dari Ibu Sari, 12 Nov 2026, via WhatsApp".' },
      { kind: 'do', title: 'Tampilkan disclaimer pada layanan publik', body_md: 'Banner layanan publik selalu menyertakan disclaimer bahwa konten dibantu AI. Jangan menghapusnya.' },
      { kind: 'dont', title: 'Jangan membuat konten menyesatkan', body_md: 'Hindari informasi kesehatan, hukum, atau keuangan yang belum diverifikasi oleh sumber resmi.' },
      {
        kind: 'tip',
        title: 'Hak data Anda',
        body_md: 'Sesuai UU PDP, Anda dapat mengunduh seluruh data akun dan menghapus akun kapan saja dari halaman profil. Foto manusia yang diunggah dihapus otomatis setelah 7 hari.',
      },
    ],
  },
];

/** Six visual aspects, each with a short prompt fragment to learn from. Attached to `elemen-visual-dasar`. */
export const SEED_BREAKDOWNS: readonly SeedBreakdown[] = [
  {
    aspect: 'style',
    title: 'Gaya: Komersial Modern Bersih',
    description: 'Tepi tajam, sedikit properti, dan suasana profesional. Cocok untuk katalog dan marketplace.',
    prompt_fragment: 'clean modern commercial style, minimal props, crisp edges',
  },
  {
    aspect: 'color',
    title: 'Warna: Oranye Hangat dengan Aksen Navy',
    description: 'Oranye memberi kesan hangat dan menggugah selera; navy gelap menjaga kontras dan kesan tepercaya.',
    prompt_fragment: 'warm orange and cream palette with a deep navy accent',
  },
  {
    aspect: 'gradient',
    title: 'Gradasi: Latar Halus Vertikal',
    description: 'Gradasi lembut dari warna hangat ke krem membuat latar tidak datar tanpa mengganggu produk.',
    prompt_fragment: 'smooth vertical gradient backdrop from warm orange to soft cream',
  },
  {
    aspect: 'angle',
    title: 'Sudut: Sejajar Mata 45 Derajat',
    description: 'Memperlihatkan bagian depan dan sisi kemasan. Gunakan flat lay untuk makanan di piring.',
    prompt_fragment: 'eye-level 45 degree angle, shallow depth of field',
  },
  {
    aspect: 'lighting',
    title: 'Cahaya: Jendela Lembut dengan Rim Highlight',
    description: 'Cahaya lembut menghindari pantulan silau, sementara highlight tipis memisahkan produk dari latar.',
    prompt_fragment: 'soft diffused window light with a gentle rim highlight',
  },
  {
    aspect: 'composition',
    title: 'Komposisi: Objek di Tengah, Ruang Lega',
    description: 'Sisakan ruang kosong di atas dan bawah untuk judul serta ajakan bertindak.',
    prompt_fragment: 'centred hero subject with generous negative space at the top and bottom',
  },
];
