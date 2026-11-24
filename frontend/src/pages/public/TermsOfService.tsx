import React from 'react';
import { Link } from 'react-router-dom';
import { LegalDocument, Todo, type LegalSection } from './LegalDocument';

/**
 * Syarat Layanan (draf). Behaviour described here is what the system does today (daily limit that counts
 * successful designs, content policy with blocked terms, consent for photos of people, text pasted by the app).
 * Anything the code cannot answer is marked with <Todo>.
 */
const sections: LegalSection[] = [
  {
    id: 'penerimaan',
    title: 'Penerimaan syarat',
    body: (
      <p>
        Dengan membuat akun atau memakai Sukamenak Studio, Anda menyatakan telah membaca dan menyetujui syarat ini serta <Link to="/privasi">Kebijakan Privasi</Link>. Bila tidak setuju, mohon tidak memakai layanan.
      </p>
    ),
  },
  {
    id: 'layanan',
    title: 'Layanan dan batas harian',
    body: (
      <>
        <p>
          Sukamenak Studio membantu membuat poster, konten media sosial, dan foto produk dari template, isian, dan foto referensi dengan bantuan AI. Layanan ini dapat dipakai tanpa biaya.
        </p>
        <p>
          Untuk mencegah penyalahgunaan dan menjaga layanan tetap adil, setiap akun memiliki batas jumlah desain per hari. Hanya desain yang berhasil dibuat yang dihitung, sedangkan percobaan yang gagal tidak mengurangi jatah.
          Besar batas ditetapkan admin dan dapat berubah; sisa jatah Anda tampil di Studio dan Dashboard. Permintaan juga dibatasi per menit.
        </p>
      </>
    ),
  },
  {
    id: 'akun',
    title: 'Akun Anda',
    body: (
      <ul>
        <li>Berikan data yang benar dan jaga kerahasiaan kata sandi Anda; kegiatan di akun Anda menjadi tanggung jawab Anda.</li>
        <li>Satu akun dipakai oleh satu orang atau satu usaha.</li>
        <li>Admin dapat menonaktifkan akun yang melanggar syarat ini atau membahayakan layanan.</li>
        <li>Anda dapat menghapus akun sendiri kapan saja di Profil Saya.</li>
      </ul>
    ),
  },
  {
    id: 'konten-anda',
    title: 'Konten Anda dan hasil desain',
    body: (
      <>
        <ul>
          <li>Anda tetap memegang hak atas foto, teks, dan materi yang Anda unggah.</li>
          <li>
            Anda menyatakan memiliki hak atau izin atas materi tersebut, termasuk persetujuan dari setiap orang yang tampil, dan bahwa materi itu tidak melanggar hak pihak lain (hak cipta, merek, privasi).
          </li>
          <li>
            Anda memberi kami izin terbatas untuk menyimpan dan memproses materi itu (termasuk melalui penyedia model AI) semata-mata untuk menjalankan layanan bagi Anda, sebagaimana dijelaskan di Kebijakan Privasi.
          </li>
          <li>
            Hasil desain dipakai atas tanggung jawab Anda. Anda boleh memakainya untuk promosi usaha Anda; hasil AI bisa mirip dengan karya lain dan keunikannya tidak kami jamin.{' '}
            <Todo>pernyataan kepemilikan dan lisensi hasil desain, termasuk ketentuan penyedia model yang dipakai</Todo>
          </li>
          <li>
            Admin dapat memilih hasil desain yang sudah jadi untuk ditampilkan di Galeri sebagai inspirasi. <Todo>apakah memerlukan persetujuan pengguna yang terpisah</Todo>
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'konten-terlarang',
    title: 'Konten yang tidak diizinkan',
    body: (
      <>
        <p>Sistem menyaring teks isian dan catatan terhadap daftar istilah terlarang yang dikelola admin. Anda tidak boleh memakai layanan untuk membuat atau menyebarkan, antara lain:</p>
        <ul>
          <li>konten yang melanggar hukum Indonesia, termasuk penipuan, pornografi, kekerasan, ujaran kebencian, dan SARA;</li>
          <li>gambar yang meniru atau menyalahgunakan wajah, nama, atau identitas orang tanpa persetujuannya, atau yang menyesatkan;</li>
          <li>materi yang melanggar hak cipta, merek, atau data pribadi orang lain;</li>
          <li>upaya menembus pembatasan, membebani, atau mengakses layanan secara tidak sah.</li>
        </ul>
        <p>
          Permintaan yang cocok dengan istilah terlarang akan ditolak. Admin dapat menandai hasil yang bermasalah dan menonaktifkan akun yang berulang kali melanggar.{' '}
          <Todo>rincian kategori konten terlarang dan prosedur keberatan/banding</Todo>
        </p>
      </>
    ),
  },
  {
    id: 'foto-orang',
    title: 'Foto orang dan persetujuan',
    body: (
      <p>
        Bila Anda memakai template bergambar orang atau mengunggah foto orang, Anda wajib mencentang pernyataan bahwa Anda sudah mendapat persetujuan dari orang yang tampil. Pernyataan itu dicatat. Foto model manusia dihapus
        otomatis setelah 7 hari. Pernyataan yang tidak benar menjadi tanggung jawab Anda sepenuhnya.
      </p>
    ),
  },
  {
    id: 'sifat-ai',
    title: 'Sifat hasil AI dan tanggung jawab Anda',
    body: (
      <>
        <ul>
          <li>Hasil dibuat oleh AI dan dapat mengandung kekeliruan atau tidak persis sama dengan foto referensi. Selalu periksa hasilnya sebelum dipublikasikan atau dicetak.</li>
          <li>
            Teks pada gambar (judul, ajakan, harga) ditempel otomatis oleh aplikasi dari isian yang Anda tulis; periksa ejaan dan kebenarannya sebelum dipakai.
          </li>
          <li>
            Untuk konten layanan publik (misalnya pengumuman), pastikan kebenaran informasinya melalui sumber resmi sebelum disebarkan. Beberapa template menambahkan keterangan bahwa gambar dibuat dengan bantuan AI; jangan
            menghapusnya bila template mewajibkan.
          </li>
          <li>Tautan gambar hasil bersifat sementara (kedaluwarsa dalam beberapa menit). Buka Riwayat untuk mendapat tautan baru dan unduh desain yang ingin Anda simpan.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'ketersediaan',
    title: 'Ketersediaan dan batas tanggung jawab',
    body: (
      <p>
        Layanan diberikan sebagaimana adanya. Kami berusaha menjaganya tetap berjalan, tetapi layanan dapat terhenti sementara, berubah, atau berakhir, termasuk karena gangguan pada penyedia model AI pihak ketiga. Sejauh diizinkan
        hukum, pengelola tidak bertanggung jawab atas kerugian tidak langsung akibat pemakaian atau ketidaktersediaan layanan.{' '}
        <Todo>rumusan batas tanggung jawab sesuai nasihat hukum</Todo>
      </p>
    ),
  },
  {
    id: 'perubahan',
    title: 'Perubahan syarat, hukum yang berlaku, dan kontak',
    body: (
      <>
        <p>
          Syarat ini dapat diperbarui; tanggal di bagian atas halaman menunjukkan versi terbaru, dan perubahan penting akan diberitahukan di dalam aplikasi. Syarat ini tunduk pada hukum Republik Indonesia.{' '}
          <Todo>pilihan penyelesaian sengketa dan pengadilan yang berwenang</Todo>
        </p>
        <p>Pertanyaan: kontak@sukamenak.org.</p>
      </>
    ),
  },
];

export const TermsOfService: React.FC = () => (
  <LegalDocument
    title="Syarat Layanan"
    intro="Aturan main yang sederhana agar Sukamenak Studio tetap aman, adil, dan bermanfaat bagi semua warga dan pelaku usaha."
    updated="14 November 2026"
    sections={sections}
    other={{ to: '/privasi', label: 'Baca Kebijakan Privasi' }}
  />
);

export default TermsOfService;
