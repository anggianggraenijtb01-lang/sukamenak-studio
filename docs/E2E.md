# Uji end-to-end dan smoke

Dua lapisan uji yang dijalankan **terhadap aplikasi yang benar-benar hidup**, berbeda dari unit/integration
test yang memanggil fungsi dan route langsung.

| Berkas | Lapisan | Butuh |
|---|---|---|
| `frontend/e2e/*.spec.ts` | Playwright di browser sungguhan | Postgres (Docker) |
| `scripts/k6-smoke.js` | k6, beban ringan ke endpoint baca | API yang hidup |

## Playwright

```bash
cd frontend
npm ci
npm run test:e2e:install     # sekali per mesin: unduh Chromium (~130 MB)
npm run test:e2e
```

Yang diuji:

| Spec | Alur | Angka yang dijaga |
|---|---|---|
| `creator-flow` | daftar → studio → buat poster → unduh | unduhan berakhir dengan berkas gambar |
| `admin-flow` | masuk sebagai admin → ganti model default | **< 120 detik** (target plan fase H) |

### Cara kerjanya

- `e2e/global-setup.ts` **membangun ulang** database `sukamenak_e2e` sebelum suite: drop, create, migrate,
  seed. Tidak ada sisa data run sebelumnya.
- Nama database **wajib** berakhir `_e2e`. `backend/src/tools/e2eDb.ts` menolak nama lain, supaya salah
  ketik `DATABASE_URL` tidak menghapus database development.
- Playwright menyalakan sendiri API (`backend`, port 3998) dan Vite (port 5173) lewat `webServer`.
  `reuseExistingServer` dimatikan: menempel ke API yang sudah jalan berarti menguji database yang salah.
- Browser memanggil `/api/v1/...` ke origin Vite, diteruskan proxy Vite ke API. Cookie refresh jadi
  same-origin, tidak perlu setelan CORS tambahan.
- Provider **mock** yang jadi default hasil seed, jadi alur generate berjalan tanpa API key dan tanpa biaya.
- Fixture tambahan: `e2eDb` menyisipkan satu model mock aktif kedua per capability, karena tombol
  "Jadikan Default" hanya muncul kalau ada kandidat lain.

### Menunjuk database lain

`E2E_DATABASE_URL` menang. Bila kosong, `DATABASE_URL` dari `backend/.env` dipakai lalu nama databasenya
diganti menjadi `sukamenak_e2e`.

```bash
E2E_DATABASE_URL=postgres://user:pass@host:5432/sukamenak_e2e npm run test:e2e
```

### Memakai browser yang sudah terpasang

Kalau unduhan Chromium Playwright gagal (CDN diblokir, koneksi lambat), jalankan dengan browser yang ada
di mesin. CI tetap memakai Chromium milik Playwright.

```bash
E2E_CHANNEL=chrome npm run test:e2e     # atau msedge
```

### Kalau gagal

`trace` dan screenshot disimpan hanya saat gagal (`frontend/test-results`). Di CI, keduanya diunggah sebagai
artifact `playwright-report`. Buka trace dengan:

```bash
npx playwright show-trace test-results/<folder>/trace.zip
```

## k6 smoke

```bash
# tanpa k6 terpasang (Docker):
docker run --rm -i --network host \
  -e BASE=http://127.0.0.1:3998/api/v1 \
  -v "$PWD/scripts:/scripts:ro" grafana/k6:0.54.0 run /scripts/k6-smoke.js
```

Ambang yang dijaga: `http_req_duration{kind:read}` p95 < 1 detik, keseluruhan p95 < 3 detik, kegagalan
< 1%, checks > 99%.

Skrip ini **tidak pernah menulis**: tidak ada generasi yang dibuat, jadi di staging ia tidak memakan biaya
dan tidak meninggalkan baris data. Alur generate diuji Playwright, bukan di sini. Untuk endpoint ber-sesi,
isi `DEMO_EMAIL` dan `DEMO_PASSWORD`; tanpa itu bagian `/me` dilewati.

Di pipeline, k6 jalan otomatis setelah deploy staging/production berhasil (`deploy.yml`), memakai
`vars.DEPLOY_URL` dan, bila diisi, `vars.SMOKE_DEMO_EMAIL` + `secrets.SMOKE_DEMO_PASSWORD`.
