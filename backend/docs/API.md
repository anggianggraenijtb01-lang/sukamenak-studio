# Sukamenak Studio API reference (v1, Phases A to C)

Base URL: `http://localhost:3000/api/v1` in development. All bodies are JSON unless noted (`multipart/form-data`
for uploads). Field names are `snake_case`. Timestamps are ISO 8601 UTC. "Dates" in filters (`from`, `to`) are
calendar dates `YYYY-MM-DD` in the server's `APP_TIMEZONE` (default `Asia/Jakarta`).

For frontend developers, the three rules that matter most:

1. **The hidden core prompt never reaches you.** No endpoint returns a core prompt body, a composed ("final") prompt,
   ciphertext or an encryption key, not even to admins. `GET /admin/core-prompts` is metadata only and the dry run
   `POST /admin/core-prompts/test-render` answers with a mask (`[HIDDEN_CORE_PROMPT]`). Do not build UI that expects
   to display one.
2. Every image URL is **signed and expires** (default 15 minutes). Never store URLs; store ids and re-fetch.
3. Every response uses the envelope below, and every error has a stable `error_code`.

---

## 1. Conventions

### 1.1 Envelope

Success:

```json
{ "status": "success", "message": "Daftar template", "data": { }, "meta": { } }
```

`meta` is present only for paginated lists (and for the admin warnings described below). `message` is a human readable
Indonesian string meant for toasts; **do not branch on it**.

Error:

```json
{
  "status": "error",
  "message": "Data yang dikirim tidak valid",
  "error_code": "VALIDATION_ERROR",
  "errors": [{ "field": "slot_values.title", "message": "Wajib diisi" }]
}
```

`errors` (field level) is present for validation-like errors. Branch on `error_code` (and the HTTP status).
Error messages never contain prompts, tokens, SQL or stack traces.

### 1.2 Pagination

List endpoints take `page` (from 1) and `limit` (per-endpoint default and maximum) and answer with:

```json
"meta": { "page": 1, "limit": 20, "total": 134, "total_pages": 7 }
```

### 1.3 Error codes

| `error_code` | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body, query or path parameter is invalid; also malformed JSON and unknown fields. `errors[]` lists the fields. |
| `EMAIL_EXISTS` | 409 | Email is already registered. |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password (also wrong current password). |
| `UNAUTHORIZED` | 401 | Missing, malformed, expired or revoked token / session. |
| `FORBIDDEN` | 403 | Authenticated, but the role is not allowed (for example a creator calling `/admin/*`). |
| `ACCOUNT_INACTIVE` | 403 | The account is deactivated. Takes effect immediately for existing tokens. |
| `NOT_FOUND` | 404 | Unknown route or resource. Other people's private resources also answer 404. |
| `TOO_MANY_REFERENCES` | 400 | Too many references stored, or sent with one generation. |
| `CONTENT_POLICY_VIOLATION` | 422 | Text matches the blocked terms, or (admin) a template/text violates a policy rule. The matched term is never echoed. |
| `CONSENT_REQUIRED` | 422 | Photos of people need a consent confirmation (creators) or a consent note (admin library). |
| `DAILY_LIMIT_REACHED` | 429 | The daily generation allowance is used up. |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests per minute (global per IP, auth, generation, uploads, admin tests). |
| `NO_MODEL_AVAILABLE` | 503 | No active model for a capability (generation time). The admin API also uses it with HTTP **409** when an action would leave a capability without a usable model. |
| `BLANK_SLOT_MISMATCH` | 422 | Core prompt blank count differs from the template's blank slots. |
| `UNKNOWN_PLACEHOLDER` | 422 | A core prompt uses a `{{placeholder}}` outside the whitelist. |
| `CORE_PROMPT_REQUIRED` | 422 | The template has no active core prompt for its `core_prompt_key`. |
| `JOB_TIMEOUT` | 504 | A generation ran past the job timeout (stored on the generation as `error_code`). |
| `CANNOT_MODIFY_SELF` | 409 | An admin tried to deactivate, demote or delete themselves (or reset their own password via admin). |
| `LAST_ADMIN` | 409 | The change would remove the last active admin. (Added in Phase C.) |
| `INTERNAL_ERROR` | 500 | Unexpected failure. Also `/health` answers 503 with this code when a dependency is down. |

Generation failures stored in `generations.error_code` (returned as `error_code` of a failed generation) also include
`PROVIDER_TIMEOUT`, `PROVIDER_RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `PROVIDER_AUTH`, `PROVIDER_BAD_REQUEST`,
`PROVIDER_CONTENT_BLOCKED`, `PROVIDER_BAD_RESPONSE`, `REFERENCE_UNAVAILABLE`, `TEMPLATE_UNAVAILABLE`.

### 1.4 Authentication and the refresh cookie

* `POST /auth/register` and `POST /auth/login` return `data.access_token` (JWT, `Bearer`, lifetime `data.expires_in`
  seconds, default 3600) and set the **refresh token as an `httpOnly` cookie** named `refresh_token`
  (`SameSite=Lax`, `Secure` in production, `Path=/api/v1/auth`, 7 days). JavaScript cannot read it.
* Send the access token as `Authorization: Bearer <token>` on every protected call. Keep it in memory, not in
  `localStorage`.
* When a call answers `401 UNAUTHORIZED`, call `POST /auth/refresh` **with credentials** (`fetch(..., { credentials: 'include' })`;
  the server's CORS allows credentials only for the origins in `CORS_ORIGIN`). It rotates the cookie and returns a new
  `access_token`. Retry the original call once. If refresh answers 401, the session is over: send the user to login.
* Refresh tokens rotate on every use. Replaying an old one revokes the whole token family (the user must log in again).
* `POST /auth/logout` revokes the token family and clears the cookie.
* The role and the active flag are re-read from the database on every request. A deactivated user gets
  `403 ACCOUNT_INACTIVE` immediately; an admin password reset or "revoke sessions" makes older access tokens answer
  `401` at once.

### 1.5 File URLs (signed)

Every image in a response (`result_url`, `thumbnail_url`, `preview_url`, `image_url`, `url`, `logo_url`, ...) is a
time-limited URL, never a storage key. With the local storage driver it looks like
`/api/v1/files/<key>?token=<exp>.<hmac>`; with S3/MinIO/R2 it is a presigned bucket URL. The token is bound to one key
and an expiry (`FILE_URL_TTL_SECONDS`, default 900 s). A bad or expired token answers `401`, an unknown file `404`.
Re-fetch the resource to get a fresh URL; do not cache URLs beyond their lifetime.

### 1.6 Rate limits

Global 60 requests/minute/IP; auth endpoints 20/min; `POST /generations` 10/min/user; reference uploads 20/min/user;
`POST /prompts/improve` 10/min/user; admin `POST /models/:id/test` and `POST /core-prompts/test-render` 10/min/admin.
Exceeding answers `429 RATE_LIMIT_EXCEEDED` (limits are configurable, see `.env.example`).

### 1.7 Caching

Admin responses and `/generations*` carry `Cache-Control: no-store`.

---

## 2. Public and creator endpoints (Phases A and B)

Legend for **Auth**: none = public, creator = any logged in user (admins included), admin = admin only.

### 2.1 System

| Method and path | Auth | Notes |
|---|---|---|
| `GET /health` | none | `data: { status: "ok", uptime_seconds, checks: { database, redis } }` (`redis` is `skipped` unless `QUEUE_DRIVER=bullmq`). 503 with `INTERNAL_ERROR` when a dependency is down. |
| `GET /meta/version` | none | `data: { name, version, api: "v1", environment }`. |
| `GET /files/*key?token=` | token | Local storage driver only. See 1.5. |

### 2.2 Auth

| Method and path | Body | Response |
|---|---|---|
| `POST /auth/register` | `{ email, password (8-72 bytes), name (2-80) }` | **201** `data: { user, access_token, token_type: "Bearer", expires_in }`. Always creates a `creator`: any `role` in the body is ignored. Errors: `EMAIL_EXISTS`, `VALIDATION_ERROR`. |
| `POST /auth/login` | `{ email, password }` | 200 same `data`. Errors: `INVALID_CREDENTIALS`, `ACCOUNT_INACTIVE`. |
| `POST /auth/refresh` | none (cookie) | 200 new session `data`, rotated cookie. `UNAUTHORIZED` clears the cookie. |
| `POST /auth/logout` | none (cookie) | 200 `{ logged_out: true }`. Always succeeds. |

`user`: `{ id, email, name, role: "creator" | "admin", last_login_at, created_at }`.

### 2.3 Profile (creator)

| Method and path | Body | Response |
|---|---|---|
| `GET /me` | | `data: { user, usage: { date, daily_limit, used_today, in_flight, remaining_today } }`. |
| `PATCH /me` | `{ name? , current_password?, new_password? }` (at least `name` or `new_password`; `new_password` needs `current_password`) | `data: { user }`. When the password changed: also `session` (a fresh session; all other sessions are revoked) and a new cookie. |
| `GET /me/export` | | Downloadable JSON of everything stored about the user (UU PDP). |
| `DELETE /me` | `{ password }` | Anonymises the account. Admins get `FORBIDDEN` (use the admin API). |

### 2.4 Catalog (public)

| Method and path | Response |
|---|---|
| `GET /templates?category=&mode=&subject=&search=` | Array of `{ id, slug, name, description, category, mode, subject, aspect_ratio, requires_consent, preview_url }` (published templates only). |
| `GET /templates/:slug` | The list item plus `slots[]` (`{ key, label, type: text\|color\|select\|textarea, target: image\|overlay, required, default_value, options, max_length, reference_role }`), `text_zones[]` (`{ slot_key, x, y, w, h, align, font_family, font_weight, font_size_ratio, color, max_lines }`, fractions 0 to 1), `example_references[]` (`{ id, role, label, url }`) and `disclaimer`. No prompt fields, blank indexes or core prompt keys. |
| `GET /gallery?page=&limit=(<=50)&template=<slug>&featured=true` | Paginated `{ id, title, image_url, display_prompt, is_featured, template: { slug, name, category } \| null, created_at }`. `display_prompt` is built from slot values and remarks only. Hidden items are never listed. |
| `GET /tutorials?level=pemula\|menengah\|mahir` | Array of `{ id, slug, title, summary, level }`. |
| `GET /tutorials/:slug` | Tutorial plus `sections[]` (`{ id, kind, title, body_md }`) and `visual_breakdowns[]` (`{ id, aspect, title, description, prompt_fragment, example_url }`). |

### 2.5 Prompt tools (creator)

| Method and path | Body | Response |
|---|---|---|
| `POST /prompts/analyze` | `{ text (1-4000) }` | Deterministic analysis: `{ score, word_count, char_count, breakdown, filler_words, repeated_terms, covered_aspects, missing_aspects, suggestions }`. |
| `POST /prompts/improve` | `{ text }` | `{ improved_text, score_before, score_after, source: "model" \| "heuristic", suggestions }`. Falls back to the heuristic when no text model works. Blocked terms: `CONTENT_POLICY_VIOLATION`. |
| `GET /prompts?page=&limit=(<=50)` | | Paginated saved prompts `{ id, title, body, source, created_at, updated_at }`. |
| `POST /prompts` | `{ title, body, source?: "manual" \| "imported" }` | **201** the prompt. Max 200 per user. |
| `GET /prompts/:id`, `PATCH /prompts/:id` (`{ title?, body? }`), `DELETE /prompts/:id` | | Own prompts only; other users' ids answer 404. |

### 2.6 References (creator)

| Method and path | Body | Response |
|---|---|---|
| `POST /references` | multipart: `file` (jpeg/png/webp, max 8 MB), `role`, `label?`, `consent_confirmed?`, `consent_note?` | **201** `{ id, role, label, url, width, height, expires_at, created_at }`. Roles: `product, human_model, font, color, lighting, pose, background, style`. `human_model` needs `consent_confirmed=true` (`CONSENT_REQUIRED`) and expires after 7 days. EXIF/GPS is stripped, the image is downscaled to 2048 px. `TOO_MANY_REFERENCES` at the per-user cap. |
| `GET /references/mine?role=&page=&limit=` | | Paginated own references. |
| `GET /references/library?role=&template=<slug>` | | Admin curated references any creator may reuse: `{ id, role, label, url, width, height, template_slug }`. |
| `DELETE /references/:id` | | Own references only. |

### 2.7 Generations (creator)

`POST /generations` answers **202** `data: { id, status: "queued" }`; poll `GET /generations/:id` about every 2 seconds
until `status` is `done` or `failed`.

Body: `{ template_slug | template_id (exactly one), mode?: "i2i" | "t2i", slot_values?: { [slotKey]: string }, remarks?: string (<=1000), reference_ids?: uuid[] (<=12), consent_confirmed?: boolean }`.
Checks, in order: schema, template published and mode allowed, slot values (required, `max_length`, select options),
content policy, daily limit, reference rules, consent (subject `human_model` or a `human_model` reference), per-minute
rate. Errors: `VALIDATION_ERROR`, `CONTENT_POLICY_VIOLATION`, `DAILY_LIMIT_REACHED`, `TOO_MANY_REFERENCES`,
`CONSENT_REQUIRED`, `RATE_LIMIT_EXCEEDED`, `NOT_FOUND`.

Generation object (`GET /generations/:id`, items of the list):

```json
{
  "id": "uuid", "status": "queued|running|done|failed",
  "progress_step": "analysis|compose|generate|composite|done|null",
  "template": { "id": "uuid", "slug": "poster-promo-produk", "name": "..." },
  "mode": "i2i", "subject": "product", "publication": "poster",
  "slot_values": { }, "remarks": "...", "references": [{ "id": "uuid", "role": "product" }],
  "used_reference_image": true, "reference_count_used": 1, "composited_text": true, "degraded": false,
  "error_code": null, "result_url": "signed", "thumbnail_url": "signed", "width": 1080, "height": 1350,
  "duration_ms": 1830, "archived": false, "created_at": "...", "updated_at": "..."
}
```

`result_url`, `thumbnail_url`, `width` and `height` are set only when `status` is `done`; `error_code` only when `failed`.
There is no prompt, analysis, cost or model field.

| Method and path | Notes |
|---|---|
| `GET /generations?page=&limit=(<=50)&status=&archived=true\|false\|all` | Own generations, paginated. |
| `GET /generations/:id` | Owner only (404 otherwise). |
| `POST /generations/:id/archive` | Archives. |
| `DELETE /generations/:id` | Soft delete; removes the files and hides gallery entries made from it. |

---

## 3. Admin endpoints (Phase C)

Everything below lives under **`/api/v1/admin`** and requires `Authorization: Bearer <admin access token>`.
Anonymous calls answer `401`, creators `403 FORBIDDEN`, deactivated admins `403 ACCOUNT_INACTIVE`. The guard is
applied once on the admin router, so there is no unguarded admin route. All bodies are validated with Zod; **unknown
fields are rejected** with `VALIDATION_ERROR`. Every mutation writes an audit row (section 3.11). `GET /admin/ping`
returns `{ pong: true, actor_id }`.

### 3.1 Users

| Method and path | Body / query | Response and rules |
|---|---|---|
| `GET /users` | `page, limit (<=100), search (name/email), role, active (true\|false)` | Paginated `AdminUser`. |
| `POST /users` | `{ email, name, role?: "creator" \| "admin" (default creator), password?, daily_limit_override? }` | **201** `{ user, temporary_password? }`. Without `password` a random one is generated and returned **once**. `EMAIL_EXISTS`. |
| `GET /users/:id` | | `AdminUser` plus `usage` (same as `GET /me`). |
| `PATCH /users/:id` | any of `{ name, role, is_active, daily_limit_override (int or null) }` | `AdminUser`. Deactivating takes effect on the very next request and revokes refresh tokens. |
| `POST /users/:id/reset-password` | none | `{ user, temporary_password }` shown once; stored hashed; **all sessions are revoked** (older access tokens answer 401). Not on yourself. |
| `POST /users/:id/revoke-sessions` | none | `{ id, revoked_sessions }`; the user must log in again. |
| `DELETE /users/:id` | none | Soft delete + anonymisation (email freed, personal content removed). |

`AdminUser`: `{ id, email, name, role, is_active, daily_limit_override, last_login_at, created_at, updated_at }`
(never a password hash or token).

Guards: an admin cannot deactivate, demote or delete themselves, nor reset their own password (`409 CANNOT_MODIFY_SELF`);
the last active admin can never be removed, deactivated or demoted (`409 LAST_ADMIN`, enforced under a lock so two admins
cannot demote each other at the same time). When fewer than two active admins remain, user list / create / update /
delete responses carry `meta: { active_admins, warnings: ["..."] }`.

### 3.2 Models (`model_configs`)

`AdminModel`: `{ id, name, provider: mock|openai_compat|gemini|fal, capability: vision|text|t2i|i2i, model_id, base_url,
api_key_env, requires_api_key, api_key_configured, is_default, is_active, usable, priority, cost_per_call_usd, timeout_ms,
last_test_at, last_test_ok, notes, created_at, updated_at }`. `api_key_env` is the **name** of the server environment
variable; `api_key_configured` only says whether it is set. A key value is never read into, or returned by, the API.

| Method and path | Body / query | Response and rules |
|---|---|---|
| `GET /models` | `page, limit (<=100, default 50), capability, provider, active` | Paginated. |
| `POST /models` | `{ name, provider, capability, model_id, base_url?, api_key_env?, priority?, cost_per_call_usd?, timeout_ms?, notes?, is_active? }` | **201**. `api_key_env` must look like a variable name (`^[A-Z][A-Z0-9_]*$`, mirrors the DB CHECK), so pasting a key is rejected. Non-mock providers require it; `openai_compat` requires `base_url` (http/https, no credentials or query). `is_active: true` needs the variable to be set. |
| `GET /models/:id` | | `AdminModel`. |
| `PATCH /models/:id` | any of `name, model_id, base_url, api_key_env, priority, cost_per_call_usd, timeout_ms, notes` | `provider` and `capability` are immutable (delete and recreate). |
| `DELETE /models/:id` | | Soft delete. The default model cannot be deleted (`409 NO_MODEL_AVAILABLE`). |
| `POST /models/:id/set-default` | none | One transaction: exactly one default per capability, concurrency safe. The target must be active (`400 VALIDATION_ERROR`). Takes effect for the next generation without a restart. |
| `POST /models/:id/activate` | none | Needs the key variable to be set for non-mock providers. |
| `POST /models/:id/deactivate` | `{ new_default_id? }` | Deactivating the default needs `new_default_id` (another active model of the same capability, `400` otherwise) and is refused with `409 NO_MODEL_AVAILABLE` if it is the only active one. |
| `POST /models/:id/test` | none | Runs one tiny real call through the provider adapter (the mock provider passes). `data: { ok, latency_ms, error_code, error, tested_at, model }`; `error` is a fixed sanitised sentence, never a provider body, URL or key. Updates `last_test_at` / `last_test_ok`. Real providers may bill a very small amount per test. Rate limited. |

### 3.3 Core prompts (write-only)

`CorePromptMeta`: `{ id, key, version, subject, publication, blank_count, is_active, templates_using, created_at, created_by: { id, name } | null }`.
**There is no field for the body, a preview of it, or ciphertext, and there is no endpoint to read one.**

| Method and path | Body / query | Response and rules |
|---|---|---|
| `GET /core-prompts` | `page, limit (<=100), key, active` | Paginated metadata. |
| `GET /core-prompts/versions?key=` | `key` required | All versions of a key, newest first. |
| `GET /core-prompts/:id` | | Metadata. |
| `POST /core-prompts` | `{ key (e.g. product.poster), subject: product\|human_model, publication: poster\|psa\|social_post\|product_shot\|human_model, body (20-8000 chars) }` | **201** metadata of the new version (inactive; version auto-increments; subject/publication must match earlier versions of the key). The body is validated and AES-256-GCM encrypted: at least one `[___]` blank (`VALIDATION_ERROR`), only whitelisted `{{subject_lock}} {{negative}} {{text_zone}} {{aspect_ratio}} {{brand_palette}}` (`422 UNKNOWN_PLACEHOLDER`), no near-miss blank tokens, and none of the glyph words the image model would try to draw (text, typography, headline, caption, font, ...). Errors never echo the submitted text. |
| `POST /core-prompts/:id/activate` | none | Exactly one active version per key. Refused with `422 BLANK_SLOT_MISMATCH` when a published template using the key would no longer match. Idempotent. |
| `POST /core-prompts/test-render` | `{ key \| id (exactly one), template_slug?, slot_values?: { [slotKey]: string }, remarks? }` | Dry run on the server. Without a template, blanks are addressed as `blank_1`, `blank_2`, .... Response: `{ masked_prompt: "[HIDDEN_CORE_PROMPT]", core_prompt: { id, key, version, blank_count }, template, blanks: [{ index, slot_key, status: "filled"\|"empty", source }], filled_count, empty_count, sanitized_values, sanitized_remarks, remarks_dropped }`. The decrypted text, any piece of it and the composed prompt are never returned. Rate limited. |

### 3.4 Templates

`AdminTemplate`: `{ id, slug, name, description, category, mode, subject, aspect_ratio, core_prompt_key, status:
draft\|published\|archived, sort_order, preview_url, slot_count, zone_count, created_at, updated_at }`.
`core_prompt_key` is only the key name.

| Method and path | Body / query | Response and rules |
|---|---|---|
| `GET /templates` | `page, limit, status, category, search` | Paginated `AdminTemplate`. |
| `POST /templates` | `{ slug, name, description?, category, mode: i2i\|t2i\|both, subject, aspect_ratio? (default 4:5), core_prompt_key, sort_order? }` | **201** detail; created as `draft`. Duplicate slug: `400` with `errors[0].field = "slug"`. |
| `GET /templates/:id` | | `AdminTemplate` plus `slots[]` (`{ id, key, label, type, blank_index, required, default_value, options, max_length, vision_role, source_hint, sort_order }`), `text_zones[]` (`{ id, slot_key, x, y, w, h, align, font_family, font_weight, font_size_ratio, color, max_lines }`) and `readiness: { publishable, issues: [{ code, message }] }`. |
| `PATCH /templates/:id` | any create field | A **published** template is re-validated on save; a failing edit is rolled back with the publish error code. |
| `DELETE /templates/:id` | none | Only unpublished templates (`400` otherwise); the slug is freed. |
| `POST /templates/:id/publish` | none | Requires: an active core prompt for `core_prompt_key` (`422 CORE_PROMPT_REQUIRED`); number of slots with `blank_index` equal to the core prompt's `blank_count` (`422 BLANK_SLOT_MISMATCH`); every text zone references an existing slot (`VALIDATION_ERROR`); for category `psa`, a non-empty `psa` disclaimer in the content policy (`422 CONTENT_POLICY_VIOLATION`). Live immediately, no deploy. |
| `POST /templates/:id/unpublish` | none | Back to `draft`. |
| `POST /templates/:id/archive` | none | |
| `POST /templates/:id/preview` | multipart `file` | Preview image (shared image validation, EXIF stripped); replaces the previous one. |
| `POST /templates/:id/slots` | `{ key, label, type?, blank_index?, required?, default_value?, options? ([{value,label}], required for select), max_length?, vision_role?, source_hint?, sort_order? }` | **201** slot. `blank_index` is unique per template; slot keys are unique. |
| `PATCH /templates/:id/slots/:slotId`, `DELETE ...` | any slot field | Deleting a slot deletes its text zone. Re-validated when the template is published. |
| `POST /templates/:id/text-zones` | `{ slot_key, x, y, w, h (fractions, x+w<=1, y+h<=1), align?, font_family? (letters, digits, space, _ -), font_weight?, font_size_ratio?, color? (#rgb, #rrggbb, brand, brand:N), max_lines? }` | **201**; one zone per slot. |
| `PATCH /templates/:id/text-zones/:zoneId`, `DELETE ...` | | |

### 3.5 Reference library

`AdminReference`: `{ id, role, label, consent_note, template: { id, slug, name } | null, url (signed), width, height, bytes, created_at }`.
Entries are `is_library = true` with no owner.

| Method and path | Body / query | Response and rules |
|---|---|---|
| `GET /references` | `page, limit, role, template (slug), search (label)` | Paginated. |
| `POST /references` | multipart: `file`, `role`, `label?`, `consent_note?`, `template_id? \| template_slug?` | **201**. `human_model` requires a non-empty `consent_note` (`422 CONSENT_REQUIRED`). |
| `GET /references/:id`, `PATCH /references/:id` (`{ role?, label?, consent_note?, template_id? (uuid or null) }`), `DELETE /references/:id` | | Changing the role to `human_model` without a consent note: `422 CONSENT_REQUIRED`. Delete removes the stored file. |

### 3.6 Settings, brand identity and content policy

| Method and path | Body | Response and rules |
|---|---|---|
| `GET /settings` | | `data: { settings: { language, default_daily_limit, watermark_enabled, max_references }, schema, updated_at }`. |
| `PATCH /settings` | any of `language ("id"\|"en")`, `default_daily_limit (int 0-1000)`, `watermark_enabled (bool)`, `max_references (int 1-12)` | Each key has its own schema; **unknown keys are rejected**. Applies on the next request. |
| `GET /brand-identity` | | `{ id, name, palette: ["#rrggbb"], font_family, disclaimer, logo_url, updated_at }`. |
| `PATCH /brand-identity` | any of `name, palette (<=12 hex colours), font_family, disclaimer (nullable)` | |
| `POST /brand-identity/logo` | multipart `file` | Replaces the logo. |
| `GET /policy` | | `{ id, name, blocked_terms[], moderation_level: lenient\|standard\|strict, disclaimers: { [category]: string }, updated_at }`. |
| `PATCH /policy` | any of `blocked_terms (<=1000, normalised: trimmed, lower-cased, whitespace collapsed, de-duplicated)`, `moderation_level`, `disclaimers ({ poster?, psa?, social_post?, product_shot?, human_model?: string \| null })` | `null` or empty removes a category's disclaimer, except `psa` which can never be empty (`400`). Takes effect on the next generation request. |

Caches are invalidated in the serving process when a setting or the policy changes. Other processes (for example a
separate worker) pick the change up within 15 seconds.

### 3.7 Generations log

`AdminGeneration` (list item): `{ id, status, progress_step, user: { id, name, email }, template, mode, subject,
publication, used_reference_image, reference_count_used, composited_text, degraded, error_code, total_cost_usd,
duration_ms, models: { vision, image }, flagged, created_at }`. **No prompt, final prompt, ciphertext, raw vision
analysis, slot values or remarks, ever.**

| Method and path | Query / body | Response |
|---|---|---|
| `GET /generations` | `page, limit (<=100), status, user (uuid), template (uuid), model (uuid, vision or image), mode, from, to, degraded, flagged` | Paginated `AdminGeneration`, newest first. `from` after `to` is `400`. |
| `GET /generations/:id` | | The item plus `consent_confirmed, reference_roles[], flag_note, flagged_at, archived, purged, deleted_by_user, result_url, thumbnail_url, width, height, updated_at` and `timeline[]`: `{ stage: analysis\|compose\|generate\|composite, status: started\|ok\|degraded\|failed, duration_ms, cost_usd, model: { id, name } \| null, error_code, error_message (sanitised), at }`. |
| `POST /generations/:id/flag` | `{ flagged: boolean, note? (<=500) }` | The detail object. Unflagging clears the note. |
| `GET /generations/export.csv` | same filters as the list | `text/csv; charset=utf-8`, streamed, attachment. Columns: `id, created_at, user_id, template_slug, mode, subject, publication, status, progress_step, error_code, degraded, used_reference_image, reference_count_used, composited_text, total_cost_usd, duration_ms, model_vision, model_image, flagged`. Cells starting with `= + - @ TAB CR` are prefixed with `'` (formula injection guard). Capped at 100 000 rows; narrow the filters to export more. |

### 3.8 Gallery curation

`AdminGalleryItem`: `{ id, title, display_prompt, image_url, is_featured, is_hidden, sort_order, generation_id, template, created_at, updated_at }`.

| Method and path | Body / query | Response and rules |
|---|---|---|
| `GET /gallery` | `page, limit (<=100), hidden, featured, template (slug), search (title)` | Paginated, **including hidden** items. |
| `POST /gallery` | JSON `{ generation_id, title, is_featured?, is_hidden?, sort_order? }` or multipart `file + template_id\|template_slug + title + slot_values (JSON string) + remarks? + flags` | **201**. The only way items are created. `display_prompt` is built from slot values and remarks and cannot be supplied. The image is copied, so it outlives the creator's generation. From a generation: it must be `done` and not purged. |
| `PATCH /gallery/:id` | any of `title, display_prompt, is_featured, is_hidden, sort_order` | `display_prompt` and `title` are re-validated: no `[___]` or `{{...}}`, no run of 20+ characters of an active core prompt, no blocked terms (`400` / `422 CONTENT_POLICY_VIOLATION`). |
| `DELETE /gallery/:id` | | Removes the item and its image copy. |

### 3.9 Dashboard

`GET /dashboard?days=30` (1 to 90). Single round of SQL aggregates over the window (local midnight `days - 1` days ago until now):

```json
{
  "window": { "days": 30, "timezone": "Asia/Jakarta" },
  "totals": { "generations": 0, "done": 0, "failed": 0, "in_progress": 0, "success_rate": null,
              "total_cost_usd": 0, "avg_cost_usd": 0, "avg_duration_ms": null,
              "used_reference_image_rate": null, "degraded_rate": null, "active_users": 0 },
  "failures_by_error_code": [{ "error_code": "PROVIDER_UNAVAILABLE", "count": 3 }],
  "daily": [{ "date": "2026-11-12", "generations": 0, "done": 0, "failed": 0, "success_rate": null,
              "cost_usd": 0, "avg_duration_ms": null, "active_users": 0 }],
  "models": [{ "capability": "i2i", "active_count": 1,
               "default": { "id": "uuid", "name": "...", "provider": "mock", "model_id": "...", "last_test_at": null, "last_test_ok": null } }],
  "counts": { "published_templates": 10, "published_tutorials": 6, "active_admins": 2, "active_creators": 1 }
}
```

`success_rate = done / (done + failed)`; `used_reference_image_rate` is over `done` generations; `degraded_rate` over all;
`avg_cost_usd` is total cost divided by all generations in the window. Rates are `null` when there is nothing to divide.
`daily` has one entry per day, zero filled.

### 3.10 Errors specific to the admin API (recap)

`LAST_ADMIN`, `CANNOT_MODIFY_SELF`, `CORE_PROMPT_REQUIRED`, `BLANK_SLOT_MISMATCH`, `UNKNOWN_PLACEHOLDER`, `CONSENT_REQUIRED`,
`CONTENT_POLICY_VIOLATION` (psa disclaimer, gallery text), `NO_MODEL_AVAILABLE` (409 when a model action would leave a
capability without a usable model).

### 3.11 Audit log (read only)

`GET /audit?page=&limit(<=100)&actor=<uuid>&action=&entity=&entity_id=&from=&to=` returns, newest first:
`{ id, actor: { id, name, email } | null, action, entity, entity_id, diff, ip, created_at }`. There is no endpoint that
writes or deletes audit rows. Every admin mutation writes one in the same transaction as the change.

`diff` holds changed field names with `{ from, to }` values for an allowlist of fields per entity, plus a few non-secret
facts (for example `{ key, version, blank_count }` for core prompts). It **never** contains password hashes, temporary
passwords, tokens, API keys, core prompt bodies or ciphertext, and is scrubbed again when read.
Actions: `user.create|update|reset_password|revoke_sessions|delete`, `model.create|update|delete|activate|deactivate|set_default|test`,
`core_prompt.create|activate|test_render`, `template.create|update|delete|publish|unpublish|archive|preview_upload`,
`template_slot.create|update|delete`, `template_zone.create|update|delete`, `reference.create|update|delete`,
`settings.update`, `brand.update|logo_upload`, `policy.update`, `generation.flag|export`, `gallery.create|update|delete`.
