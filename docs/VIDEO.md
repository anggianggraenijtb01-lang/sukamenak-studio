# Video — poster menjadi reel 9:16

Fitur ini mengubah **poster yang sudah selesai** (hasil pipeline generasi) menjadi video vertikal 1080×1920
siap untuk Status WhatsApp / Reels / TikTok. Yang dianimasikan adalah poster itu sendiri: tidak ada model
video generatif, tidak ada panggilan LLM di jalur ini, dan core prompt tidak pernah menyentuhnya.

Bukan `capability` model AI: `model_configs.capability` tetap `vision|text|t2i|i2i`. Video adalah **tahap
render** dari hasil yang sudah ada.

## Alur

```
POST /api/v1/generations/:id/video   ->  video_jobs (queued)  ->  Redis queue "videos"
                                                                       |
                                                          video-worker (proses sendiri)
                                                                       |
                                                          video/render.mjs (Remotion + Chrome)
                                                                       |
                                             assets (kind=video, mp4) <- storage
                                                                       |
GET /api/v1/videos/:id  <- poll 2 detik  --------------------------------
```

Endpoint:

| Endpoint | Isi |
|---|---|
| `POST /generations/:id/video` | **202** `{id, status}`. Body `{duration_seconds?: 3..30}` (default 15). Hanya pemilik, hanya generation `done` dengan teks, maks `VIDEO_DAILY_LIMIT` per hari |
| `GET /videos` | Milik sendiri, paginasi, filter `generation_id` |
| `GET /videos/quota` | `{limit, used}` hari ini |
| `GET /videos/:id` | Detail + `video_url` / `thumbnail_url` bertanda tangan |
| `DELETE /videos/:id` | Soft delete + hapus file. Job `queued`/`rendering` ditolak (`VIDEO_STILL_RENDERING`). `DELETE /generations/:id` juga ditolak (`VIDEO_STILL_RENDERING`) selama ada videonya yang aktif; selain itu ikut menghapus semua videonya |

Error: `VIDEO_DISABLED` (503), `VIDEO_NOT_ELIGIBLE` (422), `VIDEO_ALREADY_RUNNING` (409), `VIDEO_STILL_RENDERING` (409),
`VIDEO_DAILY_LIMIT_REACHED` (429), `VIDEO_RENDER_FAILED` (500), `VIDEO_TIMEOUT` (504).

## Menjalankan

```bash
# API (QUEUE_DRIVER=inline merender di proses API: tanpa Redis, untuk dev)
cd backend && npm run dev

# atau, seperti produksi: API + worker generasi + worker video
cd backend
QUEUE_DRIVER=bullmq npm run dev
QUEUE_DRIVER=bullmq npm run worker
QUEUE_DRIVER=bullmq npm run video-worker
```

Renderer perlu sekali: `cd video && npm ci && npx remotion browser ensure`.

## Konfigurasi

Semua di `backend/.env.example` (bagian Video): `VIDEO_ENABLED`, `VIDEO_QUEUE_NAME`,
`VIDEO_WORKER_CONCURRENCY`, `VIDEO_JOB_TIMEOUT_MS` (300000), `VIDEO_DAILY_LIMIT` (3),
`VIDEO_MAX_DURATION_SECONDS` (15), `VIDEO_RETENTION_DAYS` (30), `VIDEO_RENDER_COMMAND`.

`VIDEO_JOB_TIMEOUT_MS` sengaja terpisah dari `JOB_TIMEOUT_MS` (120 detik): satu render 15 detik
memakan 40–60 detik di 2 vCPU.

## Arsip

Retention harian menghapus `video_jobs` dan file mp4-nya setelah `VIDEO_RETENTION_DAYS`, lebih pendek
dari 90 hari generasi karena satu reel ~2 MB.

## Uji manual (renderer asli)

Test suite tidak pernah menjalankan Remotion (butuh browser + ~40–100 detik per video). Untuk membuktikan
jalur nyata, jalankan API lalu skrip probe:

```bash
cd backend
VIDEO_RENDER_COMMAND="$(cd ../video && pwd)/render.mjs" npm run dev

# di terminal lain, dari root repo
BASE=http://127.0.0.1:3000/api/v1 node scripts/e2e-video.mjs
```

Probe itu mendaftar akun `video-e2e-*@test.local`, membuat poster, merender video dengan Remotion asli,
mengunduh mp4 (body penuh + `Range`), lalu memeriksa bentuk response. Akun probe dibiarkan sebagai jejak
(dokumentasi), hapus manual bila mengganggu.

## Dua keputusan desain yang tidak boleh dibalik tanpa alasan

1. **Teks tidak digambar ulang.** Poster sudah melewati tahap `composite`, jadi teks slot sudah menempel di
   gambar. Menggambar teks yang sama lagi di atasnya menghasilkan bayangan ganda (terbukti saat uji render
   pertama). Karena itu tiap zona teks hanya *dibuka*: scrim gelap + blur yang menipis, sehingga teks yang
   sudah ada menajam. `zones[].text` tetap dikirim untuk diagnostik, tidak dirender.
2. **Poster tidak di-crop.** `objectFit: contain`, bukan `cover`: poster template 4:5 dipotong ke 9:16 akan
   kehilangan 21% tiap sisi, tepat di tempat teksnya berada. Sisa kanvas diisi salinan poster yang di-blur
   dan digelapkan, jadi tidak ada pita hitam.

## Angka terukur (Windows, i7-1185G7 8 thread, browser hangat)

| Jalur | Durasi video | Waktu render | Output |
|---|---|---|---|
| inline (`QUEUE_DRIVER=inline`), lewat HTTP | 8 s | 41 s | 1,40 MB |
| inline, lewat HTTP | 15 s | 97 s | 1,18–2,06 MB |
| **BullMQ video worker terpisah** | 8 s | **147 s** | 1,40 MB |

Selisih 41 s vs 147 s bukan regresi: `render.mjs` memanggil `bundle()` di **setiap** job, jadi run
pertama setelah cache esbuild dingin (atau saat CPU dipakai proses lain) jauh lebih lambat. `render_ms`
disimpan di `video_jobs`, jadi angka nyata di tiap lingkungan bisa dibaca dari sana.

Konsekuensi: `VIDEO_JOB_TIMEOUT_MS=300000` (5 menit) bukan angka longgar — 147 s sudah 49% dari batas itu.
Jangan turunkan tanpa mengukur ulang di VPS target. Kalau butuh lebih cepat, satu-satunya perbaikan besar
adalah memakai ulang `bundle()`/`openBrowser()` antar job, bukan menaikkan concurrency.

Chrome Headless Shell: 131 MB unduhan, 303 MB di disk (`video/node_modules/.remotion`). FFmpeg dibundel Remotion.
