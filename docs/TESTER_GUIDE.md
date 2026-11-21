# Panduan penguji — Sukamenak Studio

Dokumen ini untuk orang yang diminta mencoba aplikasi di komputernya sendiri. Waktu setup sekitar 20–30 menit
(sebagian besar mengunduh).

## 1. Yang perlu ada di komputer

- Git, **Node 22 atau lebih baru**, dan **Docker Desktop** (harus sedang berjalan).
- Koneksi internet (untuk `npm install`, image Docker, dan Cloudflare).

## 2. Ambil kodenya

```bash
git clone https://github.com/anggianggraenijtb01-lang/sukamenak-studio.git
cd sukamenak-studio
```

Semua kode, migrasi, dan data awal sudah ada di branch `main`.

## 3. Siapkan `backend/.env`

Pemilik proyek mengirim dua nilai Cloudflare **lewat pesan pribadi**: `CF_ACCOUNT_ID` dan `CF_API_TOKEN`.
Jangan menaruhnya di chat grup, issue, screenshot, atau commit.

```bash
cd backend
cp .env.example .env
```

Buka `backend/.env` dan isi:

| Variabel | Isi |
|---|---|
| `JWT_ACCESS_SECRET` | teks acak, minimal 32 karakter |
| `JWT_REFRESH_SECRET` | teks acak lain, minimal 32 karakter, **berbeda** dari di atas |
| `CORE_PROMPT_KEY` | 32 byte acak dalam base64 (cara membuatnya ada di komentar `.env.example`) |
| `CF_ACCOUNT_ID` | dari pemilik proyek |
| `CF_API_TOKEN` | dari pemilik proyek |

Variabel lain boleh dibiarkan bawaan. `.env` tidak ikut git, jadi aman dari commit tidak sengaja, tetapi tetap jangan
dibagikan lagi.

## 4. Jalankan

```bash
# terminal 1, dari root repo
docker compose up -d

# terminal 1 lanjut, di backend
cd backend
npm install
npm run migrate
npm run seed        # mencetak kata sandi admin dan demo SEKALI: salin sekarang
npm run dev         # API di http://localhost:3000

# terminal 2
cd frontend
npm install
npm run dev         # buka http://localhost:5173
```

Akun dari seed: `admin@sukamenak.studio` (panel admin) dan `demo@sukamenak.studio` (kreator). Kata sandinya yang
dicetak `npm run seed`. Anda juga bebas mendaftar akun kreator baru di halaman Daftar.

### Fitur video (opsional)

```bash
cd video
npm ci
npx remotion browser ensure     # mengunduh Chrome sekitar 131 MB
```

Satu video 8 detik butuh sekitar 40–150 detik untuk dirender.

## 5. Memakai gambar asli (Cloudflare)

Secara bawaan semua model **Mock**: gambar contoh, tanpa AI sungguhan. Untuk memakai Cloudflare:

1. Masuk sebagai admin, buka **Model LLM**.
2. Di bagian **T2I**, pada kartu *Cloudflare FLUX.1 schnell* (awalnya **Nonaktif**): klik **Aktifkan**, lalu
   **Uji Koneksi** (harus "Koneksi berhasil"), lalu **Jadikan Default**.
3. Di bagian **I2I**, lakukan hal yang sama pada *Cloudflare FLUX.2 klein*.
4. Untuk kembali ke contoh tanpa AI, jadikan default lagi model *Mock*.

Kalau **Aktifkan** ditolak, periksa bahwa `CF_API_TOKEN` dan `CF_ACCOUNT_ID` sudah terisi di `backend/.env` dan API
sudah dijalankan ulang sesudah mengisinya.

Batasan yang perlu diketahui:

- Kuota gratis Cloudflare sekitar **57 gambar per hari untuk semua orang yang memakai token yang sama**. Pakai seperlunya.
- Foto referensi yang **sama** kadang ditolak Cloudflare ("output flagged"). Itu perilaku filter mereka, bukan error
  aplikasi. Coba foto atau teks lain.
- Core prompt di instalasi baru masih **stand-in** (pengganti), jadi hasilnya wajar terlihat generik. Prompt asli
  disimpan terenkripsi oleh pemilik dan tidak ikut repo.

## 6. Yang perlu dicoba

Catat setiap yang tidak sesuai: apa yang diklik, apa yang diharapkan, apa yang terjadi, dan screenshot bila ada.

**Sebagai kreator**
- Daftar, keluar, masuk lagi; coba kata sandi salah.
- Studio: pilih template, isi teks, buat poster (mode teks ke gambar). Unduh hasilnya.
- Studio: unggah foto produk sebagai referensi (mode foto ke gambar), buat poster, unduh.
- Riwayat: lihat detail, arsipkan, hapus.
- Dari detail poster: **Jadikan video 9:16**, tunggu selesai, putar dan unduh (perlu langkah video di atas).
- Galeri template: cari, filter kategori, **Pakai Template**.
- Prompt Advisor: **Isi Contoh**, **Rapikan Prompt**, simpan, pakai di Studio.
- Tutorial: buka semua.
- Profil: ganti nama, ganti kata sandi, **Unduh Data Saya**, hapus akun (pakai akun uji!).

**Sebagai admin**
- Pengguna: tambah, ubah, reset sandi, nonaktifkan, hapus.
- Model: uji koneksi, jadikan default, tambah dan hapus model uji.
- Template: buat template baru dengan slot dan zona teks, terbitkan, lalu coba dari akun kreator.
- Referensi dan kurasi galeri: unggah, ubah, sembunyikan, hapus.
- Kebijakan konten: tambah kata terlarang, lalu coba kirim teks yang memuatnya dari akun kreator (harus ditolak).
- Log generasi dan audit: buka detail, ekspor CSV.

**Tampilan**
- Coba di layar sempit (lebar HP) dan layar lebar. Cari teks terpotong, tombol tak terjangkau, atau halaman
  yang bisa digeser ke samping.
- Coba navigasi hanya dengan keyboard (Tab dan Enter).

## 7. Kalau macet

| Gejala | Coba |
|---|---|
| `npm run migrate` gagal menyambung | Pastikan Docker Desktop berjalan dan `docker compose up -d` sudah selesai |
| Port 5433, 6379, atau 3000 dipakai | Hentikan program yang memakainya, atau ubah port di `.env` dan `docker-compose.yml` |
| Login terus ditolak | Kata sandi seed hanya tercetak sekali; jalankan ulang `npm run seed` hanya bila perlu data baru |
| Video gagal | Pastikan `npx remotion browser ensure` sudah selesai tanpa error |
| Tes dijalankan di Windows | Pakai PowerShell, bukan Git Bash |

Laporkan temuan ke pemilik proyek beserta isi terminal API (terminal 1) di sekitar waktu masalah terjadi. **Jangan
menyertakan isi `.env`.**
