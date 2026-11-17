# Rencana Implementasi Lanjutan — Sukamenak Studio (PKM 2026-2)

> Disusun 17/11/2026, setelah fase backend A–C dan integrasi frontend D selesai (lihat
> [`BACKEND_PLAN.md`](BACKEND_PLAN.md)). Target launch: **31/01/2027** (±10,5 minggu, termasuk libur
> Natal–Tahun Baru). Pembagian kerja per lapisan sesuai PRD §2: FE Anggi, BE Haykal, Testing Darren + Aqila.

---

## 0. Keputusan: lanjutkan kode yang ada, sinkronkan PRD

Kode **tidak** dibangun ulang dari PRD. Perbedaan antara kode dan PRD v3.0 hampir semuanya koreksi atas PRD:

| PRD v3.0 | Kode | Alasan kode dipertahankan |
|----------|------|---------------------------|
| §7: `deepseek-v4.1-flash` sebagai vision | Di-seed sebagai `text` | DeepSeek adalah model teks |
| §7: DALL·E 3, SD, Qwen-Image, DeepFloyd IF sebagai i2i | Di-seed sebagai `t2i` | Di provider yang dipakai hanya tersedia t2i |
| §8: `reference_images[{role, asset_id/url}]`, `publication`, `subject` | `reference_ids[]` (aset hasil upload); subjek dan publikasi dari template | URL bebas membuka risiko SSRF; subjek sudah melekat di template |
| §4: `analysis → compose → image → done` | `analysis → compose → generate → composite → done` | Compositing teks perlu tahap sendiri (metrik p95 < 1,5 detik) |
| §6: "14 tabel" | 22 tabel (termasuk `assets`) | Angka di PRD tidak cocok dengan daftarnya sendiri |
| §13: Q-01/02/03/07 masih Open | Diputuskan di `BACKEND_PLAN.md` §9 | Mock sebagai default, t2i dibangun, batas 10/hari, watermark off |

Tindak lanjut: PRD v3.1 (Fase E).

## 1. Kondisi saat ini (17/11/2026)

**Sudah ada:** auth + RBAC, prompt engine, pipeline 4 tahap dengan provider mock, admin API lengkap + audit, UI creator
dan admin di API asli, tes kebocoran prompt dan RBAC, CI yang memblokir merge ke `main`.

**Belum ada:**

| Gap | Bukti di repo |
|-----|---------------|
| Provider asli belum pernah diuji ke layanan sungguhan | `backend/README.md` §Providers |
| Core prompt asli belum dibuat (masih stand-in `PLACEHOLDER-CORE-PROMPT`) | `backend/src/seed/data/corePrompts.ts`, banner "Pengganti" di dashboard |
| Deploy: tidak ada Dockerfile, Nginx, atau job staging/produksi | `.github/workflows/ci.yml` hanya build + tes |
| Monitoring: Sentry belum terpasang | — |
| Tes E2E (Playwright) dan load test (k6) | — |
| Profil mitra (RW 15 dan UMKM Desa Sukamenak) di PRD | PRD §1 hanya menyebut "organisasi dan UMKM" |

Risiko terbesar adalah **kualitas hasil dari provider asli dan core prompt asli**, karena seluruh nilai produk bergantung
pada keduanya. Karena itu urutan fase di bawah dimulai dari sana.

---

## 2. Fase

### Fase E — Sinkronisasi dokumen dan uji provider asli · 17–23 Nov

| Lapisan | Tugas |
|---------|-------|
| Darren | PRD v3.1: perbaiki §7, samakan §4/§6/§8 dengan kode, tutup Q-01/02/03/07, tambah profil mitra (jumlah UMKM, produk, kontak, bukti masalah), definisikan "activation rate" |
| Haykal | Siapkan key Gemini, ARK (Seedream), fal di environment. Uji tiap adapter (`gemini.ts`, `openaiCompat.ts`, `fal.ts`) dengan satu generate nyata per capability; verifikasi `model_id`/`base_url`; catat latensi dan biaya ke `model_configs`; perbaiki adapter yang gagal |
| Darren + Aqila | Golden set: 10 foto produk asli mitra (`scratch/tempe_eval/` sebagai awal) + 2 foto manusia dengan consent tertulis |

**Selesai bila:** minimal satu model vision dan satu model i2i asli lulus "test" di panel admin.

### Fase F — Core prompt asli dan benchmark · 24 Nov–7 Des

| Lapisan | Tugas |
|---------|-------|
| Haykal | Tulis 4–5 core prompt asli lewat Core Prompt Manager (tidak ke repo) sampai `placeholder_active_keys` kosong. Benchmark 3 kandidat i2i (Seedream, FLUX dev i2i, Nano Banana) × 10 template × golden set |
| Darren + Aqila | Nilai hasil benchmark dengan checklist DoD AI: huruf rusak? manusia muncul di mode product? referensi benar-benar dipakai? biaya dan waktu per generasi |
| Anggi | Rapikan UX composer dari hasil nyata: badge referensi, progress per tahap, preview zona teks |

**Selesai bila:** Q-01 ditutup (model default produksi dipilih), ada data biaya dan latensi untuk metrik PRD §10.

### Fase G — Deploy dan staging · 8–20 Des

| Lapisan | Tugas |
|---------|-------|
| Haykal | Dockerfile untuk api, worker, frontend; `docker-compose.prod.yml`; Nginx + TLS; staging di VPS dengan `QUEUE_DRIVER=bullmq` dan `STORAGE_DRIVER=s3` |
| Haykal | Job deploy di CI: staging otomatis dari `main`, produksi manual. Cek pasca-deploy PRD §9: health 200, hash asset baru, grep string fitur di bundle yang disajikan |
| Haykal + Anggi | Sentry (BE dan FE), alert biaya harian, script backup `pg_dump` + bucket MinIO |

**Selesai bila:** staging bisa dipakai seluruh tim dengan core prompt asli.

### Fase H — Pengujian dan konten · 15 Des–3 Jan (sebagian bertepatan libur)

| Lapisan | Tugas |
|---------|-------|
| Darren + Aqila | Playwright untuk alur utama (register → generate → download; admin ganti model < 2 menit), k6 smoke, rencana uji manual |
| Semua | ≥ 10 template published, 6 tutorial final, galeri diisi hasil generate asli (bukan mock), privacy policy dan ToS ditinjau ulang |

### Fase I — Beta dengan mitra · 4–18 Jan

- 20 tester dari pengurus RW 15 dan UMKM, sebaiknya sesi tatap muka. Kumpulkan SUS dan wawancara singkat.
- Perbaiki bug dan setel core prompt berdasarkan `generation_events` (generasi gagal, degraded, biaya).

### Fase J — Launch dan laporan PKM · 19–31 Jan

- Deploy produksi, smoke test, latihan backup-restore, minimal 2 akun admin aktif.
- Rekap metrik PRD §10 dari data nyata; slide, laporan PKM, demo.

---

## 3. Prioritas bila waktu mepet

1. **Wajib:** E → F → G. Tanpa provider asli, core prompt asli, dan staging, tidak ada yang bisa di-beta-kan.
2. **Bisa dipadatkan:** H dan I (gabungkan uji E2E dengan sesi beta).
3. **Bisa diturunkan ke nice-to-have:** Prompt Advisor (F-08) dan jalur t2i (F-05). Ini sekaligus menjawab Q-02.

## 4. Catatan

- Provider `mock` tetap dipakai CI: pipeline end-to-end diuji tanpa key dan tanpa biaya. Uji provider asli dijalankan
  manual atau terjadwal, terpisah dari setiap push.
- Core prompt asli tidak pernah masuk repo (repo publik). Tes di CI akan gagal bila prompt yang di-commit bukan stand-in.
