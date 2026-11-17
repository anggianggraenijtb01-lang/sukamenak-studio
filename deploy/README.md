# Deploy (Fase G)

Satu VPS menjalankan staging dan production sebagai dua project Docker Compose terpisah
(`sukamenak-staging`, `sukamenak-production`). Hanya Caddy yang terbuka ke internet.

```
internet ──443──> caddy (TLS otomatis, security headers)
                    └──> web  (Nginx: SPA + proxy /api)
                           └──> api ──> postgres, redis
                                worker (BullMQ) ──> postgres, redis
                    volume "storage" dipakai bersama oleh api, worker, tools
```

Perbedaan dari PRD §6: PM2 tidak dipakai. Restart policy Docker sudah menjalankan peran yang sama.

## Persiapan server (sekali)

1. VPS Linux dengan Docker Engine + compose plugin. DNS `staging.sukamenak.org` (dan nanti `sukamenak.org`)
   mengarah ke IP server.
2. User deploy yang boleh menjalankan `docker`, dengan public key dari `DEPLOY_SSH_KEY`.
3. Folder per environment, misalnya `/srv/sukamenak/staging`. Salin `deploy/.env.production.example` ke sana
   sebagai `.env` dan isi semua secret dengan nilai baru. Simpan `CORE_PROMPT_KEY` juga di password manager tim.
4. Kalau package GHCR privat, login sekali di server: `docker login ghcr.io` dengan token `read:packages`.
   Image tidak berisi secret (core prompt asli hanya ada terenkripsi di database), jadi package boleh publik.

## Konfigurasi GitHub (sekali)

Di **Settings > Environments**, buat `staging` dan `production`. `production` diberi *required reviewers*.

| Jenis | Nama | Isi |
|-------|------|-----|
| secret | `DEPLOY_SSH_KEY` | private key user deploy |
| secret | `DEPLOY_KNOWN_HOSTS` | output `ssh-keyscan <host>` |
| variable | `DEPLOY_HOST`, `DEPLOY_USER` | host dan user SSH |
| variable | `DEPLOY_PATH` | mis. `/srv/sukamenak/staging` |
| variable | `DEPLOY_URL` | mis. `https://staging.sukamenak.org` |

## Alur deploy

- **Staging:** otomatis setiap CI hijau di push ke `main`.
- **Production:** Actions > Deploy > Run workflow > `production`.

Workflow (`.github/workflows/deploy.yml`) membangun tiga image bertag commit SHA (`sukamenak-backend`,
`sukamenak-backend-tools`, `sukamenak-web`), menyalin file deploy ke server, menjalankan `pull` + `up -d`
(migrasi jalan otomatis lewat service `migrate`), lalu `verify-deploy.mjs` memastikan:

1. `/api/v1/health` sehat;
2. `/api/v1/meta/version` melaporkan commit yang baru di-deploy;
3. `/version.json` dari web juga commit itu;
4. bundle JS yang benar-benar disajikan lolos `checkBundle`.

## Deploy pertama

```bash
cd /srv/sukamenak/staging
export IMAGE_TAG=<sha>   # IMAGE_PREFIX diisi di .env
docker compose -f docker-compose.prod.yml --env-file .env up -d
docker compose -f docker-compose.prod.yml --env-file .env run --rm tools npm run seed
```

Seed mencetak password admin dan demo sekali. Setelah itu hapus `SEED_*` dari `.env`, masuk sebagai admin,
dan ganti core prompt stand-in di Core Prompt Manager. Di production, generasi dengan stand-in ditolak
(`CORE_PROMPT_REQUIRED`).

## Alat Fase E dan F di server

```bash
c="docker compose -f docker-compose.prod.yml --env-file .env run --rm tools"
$c npm run models:smoke                                   # uji tiap model yang key-nya diatur
$c npm run benchmark -- --refs ./golden/product --out ./benchmark-results/run1
```

Benchmark mengganti model default i2i selama berjalan. Jalankan **hanya di staging**. Foto golden set
diletakkan di `golden/product/` (dan `golden/human/`) di folder environment di server, tidak masuk git.
Container berjalan sebagai user `node` (uid 1000), jadi siapkan foldernya dulu:
`mkdir -p golden/product benchmark-results && sudo chown 1000:1000 benchmark-results`.

## Backup dan restore

Cron harian: `15 2 * * * /srv/sukamenak/staging/backup.sh`. Hasilnya `backups/db-*.dump` dan
`backups/storage-*.tar.gz`, disimpan 14 hari, hanya bisa dibaca pemiliknya (`umask 077`). Isinya data
pengguna (email, hash password, foto), jadi **enkripsi dulu sebelum disalin ke luar server**, misalnya
`age -r <public-key> db-<ts>.dump > db-<ts>.dump.age`, dan simpan private key-nya terpisah dari backup.

Restore (latihan wajib sebelum launch, PRD §12):

```bash
c="docker compose -f docker-compose.prod.yml --env-file .env"
$c stop api worker
$c exec -T postgres pg_restore -U sukamenak -d sukamenak --clean --if-exists < backups/db-<ts>.dump
$c run --rm -T --no-deps --entrypoint sh api -c 'rm -rf /app/backend/storage/* && tar xzf - -C /app/backend' < backups/storage-<ts>.tar.gz
$c start api worker
```

`.env` yang dipakai harus memiliki `CORE_PROMPT_KEY` yang sama dengan saat backup dibuat.
