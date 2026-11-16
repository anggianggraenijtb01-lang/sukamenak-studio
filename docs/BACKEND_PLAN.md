# Backend Plan — Sukamenak Studio (PKM 2026-2)

> Sumber: PRD v3.0 (`PRD_PKM2026-2.md`) + analisis repo per 12/11/2026.
> Dokumen ini adalah **spesifikasi kerja** untuk eksekusi backend. Bila ada konflik,
> PRD menang; bila PRD diam, keputusan di dokumen ini yang berlaku.

---

## 0. Hasil Analisis Repo (kondisi awal)

| Temuan | Dampak |
|--------|--------|
| `backend/src/*` (7 file) **bukan server** — salinan kode browser: `window.crypto`, `document.createElement('canvas')`, `delay()` sebagai pengganti pipeline, AES key hardcoded `SUKAMENAK-STUDIO-AES256-GCM-KEY!` | Dibuang total, diganti backend Express sungguhan |
| `backend/package.json` tanpa dependency; `backend/node_modules` ter-track git dan isinya **salinan deps frontend** (vite, react) | Hapus & untrack, install ulang deps backend |
| Frontend `frontend/src/{controllers,pipelines,workers,services/aesEncryption.ts}` berisi **core prompt default + AES key** → ikut ke bundle `dist/assets/*.js` | **Melanggar PRD §5 #2 & §9** — wajib dihapus dari frontend setelah backend jalan (prompt-leak test akan merah) |
| Semua data frontend mock (`StudioContext` + `services/api.ts`), login admin = cek string `email.includes('admin')` + password hardcoded, generate = `setTimeout` | Backend harus menyediakan semua kontrak §4 di bawah |
| Studio Generator tidak memilih template / slot / role referensi / consent | Kontrak `POST /generations` tetap mengikuti PRD; FE perlu menyesuaikan (lane Anggi) |
| Root repo (`src/`, `public/`, `index.html`, `vite.config.ts`, `package.json`) = duplikat `frontend/` (hanya `ProfilePage.tsx` beda); `node_modules` + `dist` ter-track (13k file) | Bersih-bersih repo (butuh persetujuan tim, **tidak** dieksekusi otomatis) |
| Docker + Compose tersedia, Node 24 lokal (target 22 LTS — kompatibel) | Postgres/Redis/MinIO via `docker-compose.yml` |

---

## 1. Prinsip Non-Negotiable (dari PRD "AI Context Note")

1. **Core prompt tidak pernah keluar server** — tidak di response (termasuk admin), log, error, CSV, bundle. Disimpan AES-256-GCM (`node:crypto`), key dari env `CORE_PROMPT_KEY` (32 byte base64).
2. **DTO allowlist**: setiap response dibentuk oleh serializer eksplisit (`toTemplateDTO`, `toGenerationDTO`, …), **tidak pernah** `res.json(row)`.
3. **Maks 2 layer model** per generasi: vision (analysis) + image (i2i/t2i). Compose **deterministik**, tanpa LLM.
4. Referensi dikirim ke model image **sebagai gambar** (semua referensi); simpan `used_reference_image` jujur.
5. **Model tidak menulis teks**: teks dari slot ditempel aplikasi (`sharp` + SVG) di `text_zones`. Core prompt menyebut zona sebagai *"flat empty colour field"*, dilarang kata text/typography/headline.
6. Tidak ada monetisasi/billing/langganan. Batas harian = anti-abuse.
7. Semua `/api/v1/admin/*` di balik `requireAuth` + `requireRole('admin')` di server.
8. Hanya 2 peran: `creator`, `admin`. Register publik selalu `creator`; admin via seed/CLI.

---

## 2. Stack & Struktur

**Stack:** Node 22 + Express 5 + TypeScript (ESM) · Zod · `pg` + SQL mentah · `node-pg-migrate` · BullMQ + ioredis · `@aws-sdk/client-s3` (MinIO/R2) · `sharp` · `jsonwebtoken` + `bcryptjs` (cost 12, tanpa native build di Windows) · `pino` + `pino-http` · `helmet`, `cors`, `express-rate-limit` · `multer` (upload) · Vitest + Supertest · `tsx` (dev).

**Driver yang bisa diganti via env** (agar dev/test tanpa infrastruktur penuh):
- `QUEUE_DRIVER=bullmq|inline` — `inline` menjalankan pipeline di proses API (test & dev cepat).
- `STORAGE_DRIVER=s3|local` — `local` menulis ke `./storage`, disajikan lewat `GET /files/:key` dengan signed token.
- Provider model `mock` — menghasilkan gambar deterministik dengan `sharp` (komposit referensi + gradien) sehingga pipeline end-to-end jalan **tanpa API key**.

```
docker-compose.yml                 # postgres:16, redis:7, minio (+ bucket init)
backend/
  package.json  tsconfig.json  vitest.config.ts  .env.example  .gitignore
  migrations/                      # node-pg-migrate (SQL)
  src/
    server.ts  app.ts  worker.ts
    config/env.ts                  # Zod-validated env, fail-fast
    db/pool.ts  db/tx.ts
    lib/  crypto.ts  jwt.ts  password.ts  errors.ts  response.ts  logger.ts  csv.ts
    middleware/  auth.ts  requireRole.ts  validate.ts  rateLimit.ts  errorHandler.ts  requestId.ts
    engine/  promptComposer.ts  sanitizeRemark.ts  slotHints.ts  placeholders.ts  policy.ts
    pipeline/  runGeneration.ts  stages/{analysis,compose,generate,composite}.ts  events.ts
    providers/  types.ts  registry.ts  mock.ts  openaiCompat.ts  gemini.ts  fal.ts
    queue/  index.ts  bullmq.ts  inline.ts
    storage/  index.ts  s3.ts  local.ts  image.ts   # strip EXIF, thumbnail
    modules/
      auth/ me/ templates/ gallery/ generations/ prompts/ tutorials/ health/ files/
      admin/ users/ models/ corePrompts/ templates/ references/ settings/
             generations/ gallery/ audit/ dashboard/
      # tiap modul: routes.ts · service.ts · schemas.ts (Zod) · dto.ts
    seed/  index.ts  data/*.ts  createAdmin.ts (CLI)
  test/
    helpers/  unit/  integration/
    security/  prompt-leak.spec.ts  rbac.spec.ts
```

---

## 3. Database (PostgreSQL 16)

Konvensi: UUID PK (`gen_random_uuid()`), snake_case, `created_at`/`updated_at`, `created_by`/`updated_by` (nullable FK users), soft delete `deleted_at` pada entitas yang dikelola admin.

| Tabel | Kolom kunci |
|-------|-------------|
| `users` | email (citext unique), password_hash, name, role `creator\|admin`, is_active, daily_limit_override, last_login_at |
| `refresh_tokens` | user_id, token_hash (sha256), family_id, expires_at, revoked_at, replaced_by — rotation + reuse detection |
| `core_prompts` | key (mis. `product.poster`), version, subject, publication, **body_ciphertext / iv / auth_tag (SECRET)**, blank_count, is_active (unik aktif per key) |
| `templates` | slug, name, description, category `poster\|psa\|social_post\|product_shot\|human_model`, mode `i2i\|t2i\|both`, subject `product\|human_model`, aspect_ratio, core_prompt_key, status `draft\|published\|archived`, preview_asset_id, sort_order |
| `template_slots` | template_id, key, label, type `text\|color\|select\|textarea`, blank_index, required, default_value, options jsonb, max_length, vision_role (role referensi yang mengisi slot ini, nullable), source_hint (*"colour taken from the colour reference"*) |
| `text_zones` | template_id, slot_key, x/y/w/h (fraksi 0–1), align, font_family, font_weight, font_size_ratio, color, max_lines |
| `reference_assets` | owner_id (null = library admin), role `product\|human_model\|font\|color\|lighting\|pose\|background\|style`, asset_id, consent_note (wajib untuk human_model), is_library, expires_at (retensi foto manusia 7 hari untuk upload creator) |
| `model_configs` | name, provider `mock\|openai_compat\|gemini\|fal`, capability `vision\|text\|t2i\|i2i`, model_id, base_url, api_key_env (nama var, **bukan** key), is_default (partial unique per capability), is_active, priority, cost_per_call_usd, timeout_ms, last_test_at, last_test_ok |
| `app_settings` | key/value jsonb (language, default_daily_limit, watermark_enabled, max_references, …) |
| `brand_identities` | logo_asset_id, palette jsonb, font_family, disclaimer |
| `content_policies` | blocked_terms text[], moderation_level, disclaimers jsonb per kategori (wajib `psa`) |
| `usage_counters` | user_id, date, success_count (unik user+date) |
| `generations` | user_id, template_id, mode, subject, publication, status `queued\|running\|done\|failed`, progress_step `analysis\|compose\|generate\|composite\|done`, slot_values jsonb, remarks, reference_inputs jsonb, **final_prompt_ciphertext/iv/auth_tag (SECRET)**, used_reference_image, reference_count_used, composited_text, degraded, result_asset_id, thumbnail_asset_id, model_vision_id, model_image_id, total_cost_usd, duration_ms, error_code, consent_confirmed, archived_at, deleted_at |
| `generation_events` | generation_id, stage, status `started\|ok\|degraded\|failed`, duration_ms, cost_usd, model_config_id, error_code, error_message (disanitasi) |
| `gallery_items` | generation_id (nullable), template_id, image_asset_id, title, display_prompt (**slot + remarks saja**), is_featured, is_hidden, sort_order |
| `user_prompts` | user_id, title, body, source `manual\|imported` |
| `prompt_improvements` | user_id, input_text, output_text, score_before, score_after, model_config_id |
| `tutorials` | slug, title, summary, level, status, sort_order |
| `tutorial_sections` | tutorial_id, kind `what_to_do\|do\|dont\|tip\|example`, title, body_md, sort_order |
| `visual_breakdowns` | tutorial_id (nullable), aspect `style\|color\|gradient\|angle\|lighting\|composition`, title, description, prompt_fragment, example_asset_id |
| `audit_logs` | actor_id, action, entity, entity_id, diff jsonb (**tanpa field SECRET**), ip, created_at |
| `assets` | storage_key, mime, bytes, width, height, owner_id, kind — tabel file generik (direferensi tabel lain) |

---

## 4. Kontrak API (`/api/v1`)

Envelope: sukses `{ status:"success", message, data, meta? }` · error `{ status:"error", message, error_code, errors? }`.

**Publik / creator** — sesuai PRD §8:
`POST /auth/register|login|refresh|logout` · `GET/PATCH /me` (+ `GET /me/export`, `DELETE /me` — hak UU PDP) · `GET /templates`, `/templates/:slug` (slots + zones + contoh referensi, **tanpa field prompt**) · `GET /gallery` · `POST /generations` → **202** `{id, status}` · `GET /generations/:id` (polling 2 s), `GET /generations`, `DELETE /generations/:id`, `POST /generations/:id/archive` · `POST /references` (upload multipart, role, consent) · `POST /prompts/improve`, `POST /prompts/analyze`, CRUD `/prompts` · `GET /tutorials`, `/tutorials/:slug` · `GET /health`, `/meta/version` · `GET /files/:key?token=` (driver local).

**Admin** `/api/v1/admin/*` — sesuai PRD §8 (users, models + set-default + test, core-prompts write-only + versions + test-render `[HIDDEN]`, templates + slots + text-zones + publish, references, settings / brand-identity / policy, generations + `:id` trace + flag + `export.csv`, gallery, audit, dashboard).

**Error codes**: `VALIDATION_ERROR, EMAIL_EXISTS, INVALID_CREDENTIALS, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, ACCOUNT_INACTIVE, TOO_MANY_REFERENCES, CONTENT_POLICY_VIOLATION, CONSENT_REQUIRED, DAILY_LIMIT_REACHED, RATE_LIMIT_EXCEEDED, NO_MODEL_AVAILABLE, BLANK_SLOT_MISMATCH, UNKNOWN_PLACEHOLDER, CORE_PROMPT_REQUIRED, JOB_TIMEOUT, CANNOT_MODIFY_SELF, INTERNAL_ERROR`.

---

## 5. Prompt Engine (inti nilai produk)

- **Token blank**: `[___]` (sama dengan UI CorePromptManager yang ada). Diisi **berurutan** sesuai `template_slots.blank_index`.
- **Placeholder bernama** (whitelist): `{{subject_lock}}`, `{{negative}}`, `{{text_zone}}`, `{{aspect_ratio}}`, `{{brand_palette}}`. Placeholder di luar whitelist → `UNKNOWN_PLACEHOLDER` saat simpan.
- **Validasi**: `blank_count(core_prompt) === jumlah slot template ber-blank_index` saat publish template → `BLANK_SLOT_MISMATCH`.
- **Subject lock** (aturan VibeContent #2): product → `"no human, no face, no hands"`; human_model → `"exactly one human model, no additional people"`.
- **Nilai eksplisit menimpa blank** (aturan #5) — bukan menambah kalimat di akhir.
- **SLOT_HINTS** (deterministik): peta kata kunci remarks → slot (warna → slot `color`, cahaya/lighting → `lighting`, latar → `background`, …). Remarks yang tidak terpetakan masuk blank `remarks` bila ada, kalau tidak di-drop.
- **`sanitizeRemark()`**: membuang upaya injeksi (mis. "ignore previous instructions", placeholder palsu `[___]`/`{{…}}`, kata text/typography/headline, blocked terms) + batas panjang.
- Core prompt **tanpa** remarks tetap menghasilkan prompt valid (PRD §5 #6) — diuji unit test.
- Vision ditanya *"extract ONLY <role>, ignore the rest"* per referensi; gagal → slot pakai default, event `degraded`, generate jalan terus.

## 6. Pipeline Generasi (1 job)

`validate (sync, di API) → analysis (vision per referensi) → compose (deterministik) → generate (i2i/t2i, multipart semua referensi) → composite (sharp: teks slot ke text_zones + watermark opsional + strip EXIF + thumbnail) → done`

- Tiap tahap menulis `generation_events` (durasi, biaya, model, error tersanitasi) dan meng-update `progress_step`.
- Provider fallback berdasarkan `priority` bila default gagal; tidak ada model aktif → `NO_MODEL_AVAILABLE`.
- Timeout job (default 120 s) → `JOB_TIMEOUT`. Retry BullMQ 2× untuk error transient provider.
- `usage_counters` hanya bertambah saat **sukses** (job gagal tidak mengurangi batas). Cek batas saat enqueue: `success_today + in_flight < limit`.
- Validasi di `POST /generations`: Zod → policy (blocked terms di slot+remarks) → limit → max referensi (`TOO_MANY_REFERENCES`) → consent wajib bila subject `human_model` atau ada referensi role `human_model` (`CONSENT_REQUIRED`) → enqueue.

## 7. Keamanan & Observability

- JWT access 60 m (Bearer) + refresh 7 d (httpOnly cookie, rotation, reuse → revoke family). User nonaktif ditolak di `requireAuth` (cek DB, cache singkat).
- Rate limit 60 req/menit/IP global; 10 job/menit/user di `POST /generations`.
- `pino` redact: `password`, `token`, `authorization`, `cookie`, `*.body_ciphertext`, `*prompt*`. Error handler tidak pernah mengembalikan stack/pesan internal di production.
- Upload: MIME allowlist (jpeg/png/webp), maks 8 MB, strip EXIF/GPS via `sharp().rotate()`; retensi foto manusia 7 hari + prompt/remarks 90 hari (job cleanup harian).
- Audit log untuk setiap aksi admin (diff tanpa field SECRET).

## 8. Tahapan Eksekusi

| Fase | Isi | Selesai bila |
|------|-----|--------------|
| **A — Fondasi, Auth & Prompt Engine** | Bersihkan `backend/` (hapus mock, untrack node_modules), scaffold TS/Express, `docker-compose.yml`, env Zod, migrations semua tabel §3, lib (crypto AES-GCM, errors, response, logger), auth + refresh rotation + `requireRole`, `/me` (+export/delete), `/health`, `/meta/version`, `engine/*` (composer, placeholders, slotHints, policy, **sanitizeRemark = diisi manual oleh tim BE**), read API `/templates` `/gallery` `/tutorials` `/prompts/*`, seed (2 admin, settings, policy, brand, model_configs mock + kandidat PRD §7 nonaktif, 10 template PRD §14, 5 core prompt terenkripsi, 6 tutorial + visual_breakdowns, item galeri), CLI `create-admin` | `typecheck` + test hijau: unit crypto & composer, integrasi auth/me/templates |
| **B — Pipeline & Generations** | storage (local+s3), assets, `/references` upload, providers (mock lengkap; openai_compat/gemini/fal ditulis sesuai docs, aktif hanya bila env key ada), queue (inline+bullmq), `worker.ts`, 4 stage + events, compositor teks sharp/SVG, `/generations/*`, limit & consent, cleanup retensi | Integrasi: generate end-to-end dengan provider mock + `QUEUE_DRIVER=inline` menghasilkan PNG dengan teks tertempel, `used_reference_image=true` |
| **C — Admin API & Hardening** | Semua `/admin/*` + audit + dashboard stats + export CSV (tanpa prompt), larangan nonaktifkan diri sendiri, `prompt-leak.spec.ts` (scan semua response + log + `frontend/dist/assets/*.js` bila ada), `rbac.spec.ts` (setiap route admin → 403 untuk creator), GitHub Actions CI, `backend/README.md` | Semua test hijau, coverage unit > 70%, leak + rbac hijau |
| **D — Integrasi FE** *(lane Anggi, tidak dieksekusi di sini)* | `frontend/src/services/apiClient.ts`, ganti `StudioContext` mock dengan TanStack Query, hapus `controllers/ pipelines/ workers/ services/aesEncryption.ts` dari frontend | Bundle FE bebas core prompt |

## 9. Keputusan Default untuk Open Questions (PRD §13)

Q-01 model produksi → `model_configs` default = `mock`; kandidat PRD §7 di-seed nonaktif. · Q-02 t2i → diimplementasikan (satu cabang di stage generate). · Q-03 batas harian → default **10**, ubah via `app_settings`. · Q-07 watermark → flag `watermark_enabled` default `false`.
