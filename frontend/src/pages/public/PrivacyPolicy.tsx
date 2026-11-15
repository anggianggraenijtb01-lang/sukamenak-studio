import React from 'react';
import { Link } from 'react-router-dom';
import { LegalDocument, Todo, type LegalSection } from './LegalDocument';

/**
 * Kebijakan Privasi (draf). Every statement follows what the code does today:
 *  - backend/src/modules/references (consent, 7 days, EXIF stripped, 2048 px)
 *  - backend/src/retention (7 days for human-model photos, 90 days for prompts / remarks)
 *  - backend/src/modules/me (export, anonymisation on delete)
 * Anything the code cannot answer is marked with <Todo>.
 */
const sections: LegalSection[] = [
  {
    id: 'pengantar',
    title: 'Siapa kami dan untuk apa dokumen ini',
    body: (
      <>
        <p>
          Sukamenak Studio adalah layanan pembuat materi promosi visual berbantuan AI untuk pengurus RW 15 dan pelaku UMKM Desa Sukamenak, Kec. Margahayu, Kab. Bandung. Kebijakan ini menjelaskan data pribadi apa yang kami
          proses, untuk apa, berapa lama disimpan, dan hak Anda sesuai Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).
        </p>
        <p>
          Pengendali data: pengelola Sukamenak Studio. <Todo>nama badan atau penanggung jawab resmi pengendali data dan alamat korespondensinya</Todo>
        </p>
      </>
    ),
  },
  {
    id: 'data-dikumpulkan',
    title: 'Data yang kami kumpulkan',
    body: (
      <>
        <ul>
          <li>
            <strong>Data akun:</strong> alamat email, nama, kata sandi (disimpan hanya dalam bentuk hash, tidak pernah sebagai teks asli), peran akun, serta waktu pendaftaran dan masuk terakhir.
          </li>
          <li>
            <strong>Foto referensi yang Anda unggah:</strong> berkas gambar, peran foto (misalnya produk, model manusia, warna), label, dan catatan persetujuan untuk foto orang.
          </li>
          <li>
            <strong>Isian dan catatan:</strong> isian template, teks yang ditempel pada gambar, catatan/deskripsi visual (remarks), prompt yang Anda simpan, dan teks yang Anda masukkan ke Prompt Advisor beserta hasil rapiannya.
          </li>
          <li>
            <strong>Hasil desain:</strong> gambar hasil dan miniaturnya, status pembuatan, lama proses, dan apakah foto referensi dipakai langsung.
          </li>
          <li>
            <strong>Data pemakaian:</strong> jumlah desain yang berhasil dibuat per hari (untuk batas harian).
          </li>
          <li>
            <strong>Data teknis:</strong> sesi masuk Anda memakai satu cookie sesi (httpOnly, berlaku 7 hari) yang diperlukan agar Anda tetap masuk; alamat IP diproses untuk membatasi jumlah permintaan per menit.{' '}
            <Todo>apakah log server menyimpan alamat IP dan berapa lama; apakah ada analitik atau cookie lain</Todo>
          </li>
        </ul>
        <p>Kami tidak meminta nomor telepon, alamat, atau data identitas lain untuk membuat akun.</p>
      </>
    ),
  },
  {
    id: 'foto-orang',
    title: 'Foto orang dan persetujuan',
    body: (
      <>
        <p>
          Foto yang memperlihatkan orang (peran &quot;Model Manusia&quot;) dan template bergambar orang hanya dapat dipakai bila Anda menyatakan sudah mendapat persetujuan dari orang yang tampil. Kotak persetujuan di Studio tidak
          dicentang sejak awal dan wajib Anda centang sendiri.
        </p>
        <ul>
          <li>Foto model manusia yang Anda unggah dihapus otomatis 7 hari setelah diunggah.</li>
          <li>Pernyataan persetujuan Anda dicatat bersama foto dan permintaan pembuatan desainnya.</li>
          <li>Jangan mengunggah foto anak atau orang lain tanpa izin yang sah dari mereka atau walinya.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'metadata-foto',
    title: 'Metadata foto (EXIF dan lokasi)',
    body: (
      <p>
        Saat foto diunggah, data tersembunyi di dalamnya (EXIF, termasuk koordinat GPS, model perangkat, dan waktu pemotretan) dihapus, dan gambar diperkecil hingga maksimal 2048 piksel. Gambar hasil yang Anda unduh juga bebas
        metadata.
      </p>
    ),
  },
  {
    id: 'tujuan',
    title: 'Untuk apa data dipakai',
    body: (
      <ul>
        <li>Membuat akun dan menjaga Anda tetap masuk.</li>
        <li>Membuat desain sesuai isian, catatan, dan foto referensi Anda, serta menampilkan riwayatnya.</li>
        <li>Menerapkan batas harian dan batas permintaan untuk mencegah penyalahgunaan, serta menegakkan kebijakan konten.</li>
        <li>Menjaga keamanan dan memperbaiki kesalahan layanan.</li>
      </ul>
    ),
  },
  {
    id: 'penyedia-ai',
    title: 'Pemrosesan oleh penyedia model AI',
    body: (
      <>
        <p>
          Untuk menganalisis foto, merapikan prompt, dan menghasilkan gambar, server kami dapat mengirim isian, catatan, dan foto referensi Anda ke penyedia model AI yang dipilih admin (penyedia pihak ketiga, dapat berada di luar
          Indonesia). Admin mengatur model yang aktif; selama model uji internal dipakai, tidak ada data yang keluar dari server kami.
        </p>
        <p>
          Sukamenak Studio sendiri tidak melatih model AI memakai data Anda. Cara penyedia pihak ketiga memperlakukan data tersebut (termasuk apakah dipakai untuk pelatihan) mengikuti ketentuan penyedia itu.{' '}
          <Todo>daftar penyedia yang dipakai saat rilis, negara lokasi pemrosesan, dan bukti bahwa data API tidak dipakai untuk melatih model mereka</Todo>
        </p>
      </>
    ),
  },
  {
    id: 'akses-admin',
    title: 'Siapa yang dapat melihat data Anda',
    body: (
      <ul>
        <li>
          <strong>Admin Sukamenak Studio</strong> dapat melihat data akun (nama, email), status teknis dan gambar hasil pada log pembuatan untuk memoderasi penyalahgunaan, serta menandai hasil yang bermasalah. Catatan dan isian Anda
          tidak ditampilkan pada log tersebut.
        </li>
        <li>
          Admin dapat memilih hasil desain yang sudah jadi untuk ditampilkan di Galeri sebagai inspirasi; gambar disalin ke galeri bersama deskripsi yang dibuat dari isian dan catatan terkait. Menghapus desain Anda atau akun Anda
          menyembunyikan entri galeri yang berasal darinya.{' '}
          <Todo>apakah perlu persetujuan terpisah dari pengguna sebelum hasil dipajang di Galeri publik</Todo>
        </li>
        <li>Pengguna lain tidak dapat melihat foto, desain, atau prompt pribadi Anda. Tautan gambar bersifat sementara (kedaluwarsa dalam sekitar 15 menit) dan terikat pada berkas tertentu.</li>
        <li>Kami tidak menjual data Anda.</li>
      </ul>
    ),
  },
  {
    id: 'retensi',
    title: 'Berapa lama data disimpan',
    body: (
      <>
        <ul>
          <li>
            <strong>Foto model manusia:</strong> dihapus otomatis 7 hari setelah diunggah.
          </li>
          <li>
            <strong>Catatan, isian template, daftar foto referensi, dan prompt gabungan pada data pembuatan desain:</strong> dihapus otomatis setelah 90 hari. Gambar hasilnya tetap ada sampai Anda menghapusnya.
          </li>
          <li>
            <strong>Foto referensi non-manusia dan hasil desain:</strong> disimpan sampai Anda menghapusnya atau akun Anda dihapus (batas jumlah foto tersimpan berlaku per akun).
          </li>
          <li>
            <strong>Prompt yang Anda simpan dan riwayat Prompt Advisor:</strong> disimpan sampai Anda menghapusnya atau akun Anda dihapus.{' '}
            <Todo>riwayat Prompt Advisor saat ini tidak ikut dihapus otomatis pada hari ke-90; tentukan apakah perlu</Todo>
          </li>
          <li>
            <strong>Akun:</strong> disimpan selama Anda memakai layanan. Setelah akun dihapus, email dan nama dianonimkan, prompt dan foto referensi dihapus, dan berkas gambar dihapus dari penyimpanan oleh proses pembersihan
            terjadwal.
          </li>
        </ul>
        <p>Angka 7 hari dan 90 hari adalah pengaturan standar sistem dan dapat diubah pengelola; perubahan akan dicantumkan di halaman ini.</p>
      </>
    ),
  },
  {
    id: 'keamanan',
    title: 'Keamanan',
    body: (
      <p>
        Kata sandi disimpan dalam bentuk hash; token akses disimpan di memori peramban, bukan di penyimpanan lokal; cookie sesi tidak dapat dibaca skrip; tautan gambar bertanda tangan dan kedaluwarsa; dan setiap permintaan
        dibatasi lajunya. Tidak ada sistem yang sepenuhnya aman. Bila terjadi kebocoran data pribadi yang berisiko bagi Anda, kami akan memberitahukannya sesuai UU PDP.{' '}
        <Todo>prosedur dan jangka waktu pemberitahuan kebocoran data</Todo>
      </p>
    ),
  },
  {
    id: 'hak-anda',
    title: 'Hak Anda',
    body: (
      <>
        <p>Sesuai UU PDP, Anda berhak mendapat informasi tentang pemrosesan data Anda, mengakses dan mendapat salinannya, memperbaikinya, menghapusnya, menarik persetujuan, serta mengajukan keberatan. Cara menggunakannya:</p>
        <ul>
          <li>
            <strong>Akses dan salin data:</strong> menu <Link to="/creator/profile">Profil Saya</Link>, tombol &quot;Unduh Data Saya (JSON)&quot;.
          </li>
          <li>
            <strong>Perbaiki data:</strong> ubah nama dan kata sandi di <Link to="/creator/profile">Profil Saya</Link>. Untuk mengganti email, hubungi kami.{' '}
            <Todo>fitur ganti email belum tersedia</Todo>
          </li>
          <li>
            <strong>Hapus data:</strong> hapus tiap desain di <Link to="/creator/history">Riwayat</Link>, hapus foto unggahan di Studio, atau hapus seluruh akun lewat tombol &quot;Hapus Akun Saya&quot; di Profil Saya.
          </li>
          <li>
            <strong>Tarik persetujuan foto orang, atau ajukan keberatan dan pertanyaan lain:</strong> hubungi kami di kontak@sukamenak.org atau WhatsApp +62 812-3456-7890.{' '}
            <Todo>batas waktu tanggapan atas permintaan hak subjek data</Todo>
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'anak',
    title: 'Anak-anak',
    body: (
      <p>
        Layanan ditujukan bagi pengguna dewasa. <Todo>batas usia minimum dan mekanisme persetujuan orang tua/wali bila pengguna di bawah umur diizinkan</Todo>
      </p>
    ),
  },
  {
    id: 'perubahan',
    title: 'Perubahan kebijakan dan kontak',
    body: (
      <>
        <p>
          Bila kebijakan ini berubah secara berarti, kami akan memperbarui tanggal di bagian atas halaman dan, bila perlu, memberi tahu Anda di dalam aplikasi. Pertanyaan: kontak@sukamenak.org. Lihat juga{' '}
          <Link to="/syarat">Syarat Layanan</Link>.
        </p>
      </>
    ),
  },
];

export const PrivacyPolicy: React.FC = () => (
  <LegalDocument
    title="Kebijakan Privasi"
    intro="Penjelasan singkat dan jujur tentang data yang kami simpan, mengapa, berapa lama, dan bagaimana Anda mengendalikannya."
    updated="14 November 2026"
    sections={sections}
    other={{ to: '/syarat', label: 'Baca Syarat Layanan' }}
  />
);

export default PrivacyPolicy;
