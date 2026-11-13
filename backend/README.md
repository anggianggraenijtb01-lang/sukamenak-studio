# Sukamenak Studio - backend

Node 22+ / Express 5 / TypeScript (ESM) / PostgreSQL 16 / BullMQ. The product's core value is a
**hidden core prompt**: it is stored AES-256-GCM encrypted and never leaves the server (no response,
log line, error message or file contains it). Spec: [`../docs/BACKEND_PLAN.md`](../docs/BACKEND_PLAN.md).

Status: Phase A (foundation, auth, prompt engine, catalog), Phase B (storage, references, providers, queue,
generation pipeline, generations API, retention) and Phase C (admin API, audit, dashboard, security specs, CI) are
implemented. Phase D (frontend integration, removing the leaked mock core prompt from `frontend/`) is the frontend lane.
The complete endpoint reference for the frontend team is [`docs/API.md`](docs/API.md).

## Setup

```bash
# 1. infrastructure (postgres on host port 5433, redis 6379, minio 9000/9001)
docker compose up -d            # run from the repository root

# 2. backend
cd backend
npm install
cp .env.example .env            # then fill JWT_*, CORE_PROMPT_KEY (see comments in the file)
npm run migrate                 # applies migrations 1..8
npm run seed                    # 2 admins + demo creator, 10 templates, 5 core prompts, models (mock default) ...
```

`npm run seed` prints generated passwords once (or uses `SEED_ADMIN_PASSWORD` / `SEED_DEMO_PASSWORD`).
The demo creator is `demo@sukamenak.studio`. Create more admins with `npm run create-admin`.

## Running

| Mode | Command | Notes |
|------|---------|-------|
| Dev, everything in one process | `QUEUE_DRIVER=inline npm run dev` | The API runs the pipeline in-process, asynchronously: `POST /generations` still answers 202 immediately. |
| API + worker (production-like) | `QUEUE_DRIVER=bullmq npm run dev` and, in a second terminal, `QUEUE_DRIVER=bullmq npm run worker` | Needs Redis. The worker also runs the daily retention job. |
| Built | `npm run build && npm start` / `npm run start:worker` | `dist/` |

With the default **mock** provider the whole pipeline works with zero API keys: it produces a real PNG
(gradient, every reference image tiled into the free area, the text zones left as flat empty fields) and
the application then pastes the slot text into those zones.

### Scripts

`dev`, `build`, `start`, `worker`, `start:worker`, `typecheck`, `test`, `test:unit` (no database), `test:coverage`
(full suite with v8 coverage and a 70% line threshold), `migrate`, `migrate:down`, `seed`, `create-admin`,
`retention` (one retention pass).

### Configuration

Everything is validated at startup (`src/config/env.ts`); `.env.example` documents every variable. The
ones that matter for Phase B:

- `QUEUE_DRIVER=inline|bullmq`, `WORKER_CONCURRENCY`, `JOB_TIMEOUT_MS` (default 120 s -> `JOB_TIMEOUT`),
  `JOB_MAX_ATTEMPTS` / `JOB_BACKOFF_MS` (BullMQ retries; only transient provider errors are retried).
- `STORAGE_DRIVER=local|s3`, `STORAGE_LOCAL_DIR`, `S3_*`, `FILE_SIGNING_SECRET` (required in production),
  `FILE_URL_TTL_SECONDS`.
- `GENERATION_RATE_LIMIT_PER_MINUTE` (10), `MAX_REFERENCES_PER_USER`, `RETENTION_*`.
- Provider keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `FAL_KEY`, `DEEPSEEK_API_KEY`, `ARK_API_KEY`): a
  `model_configs` row stores only the variable NAME in `api_key_env`.

## API (Phase B additions)

All under `/api/v1`, envelope `{status, message, data, meta?}` / `{status:"error", message, error_code, errors?}`.

- `POST /references` (multipart: `file`, `role`, optional `label`, `consent_confirmed`, `consent_note`),
  `GET /references/mine`, `GET /references/library`, `DELETE /references/:id`.
  JPEG/PNG/WebP by magic bytes, max 8 MB, EXIF/GPS stripped, downscaled to 2048 px. `human_model` needs
  `consent_confirmed=true` (`CONSENT_REQUIRED`) and expires after 7 days.
- `POST /generations` -> **202** `{id, status}`; `GET /generations/:id` (poll every ~2 s), `GET /generations`,
  `DELETE /generations/:id`, `POST /generations/:id/archive`.
  Body: `template_slug` or `template_id`, optional `mode` (`i2i`/`t2i`; inferred), `slot_values`, `remarks`,
  `reference_ids`, `consent_confirmed`.
  Checks, in order: schema -> template published and mode allowed -> slot values (required, max_length,
  select options) -> content policy -> daily limit (`successes today + in flight < limit`) -> reference
  rules (`TOO_MANY_REFERENCES`, ownership or library) -> consent -> 10 jobs/min -> insert + enqueue.
  Someone else's generation is a 404, never a 403. Responses are built by an explicit allowlist
  (`modules/generations/dto.ts`): no prompt, analysis, ciphertext, cost or model fields.
- `GET /files/*key?token=` serves local-driver files only with a valid, unexpired HMAC token bound to that
  key. With `STORAGE_DRIVER=s3` clients receive presigned bucket URLs instead.

Result/thumbnail/reference URLs in any response are signed and expire (`FILE_URL_TTL_SECONDS`).

## Generation pipeline

`analysis -> compose -> generate -> composite -> done`, one `generation_events` row per stage (duration,
cost, model, status `started|ok|degraded|failed`, sanitised error), `generations.progress_step` updated live.

1. **analysis** - one vision call per reference ("extract ONLY <role>, ignore the rest"; roles that no slot
   listens to are skipped). A vision failure never fails the job: slots keep their defaults, the event is
   `degraded` and `generations.degraded=true`.
2. **compose** - deterministic (no LLM): `engine/promptComposer` fills the decrypted core prompt; remarks go
   through `sanitizeRemark`. The final prompt is stored only as AES-GCM ciphertext (AAD bound to the row).
3. **generate** - i2i sends ALL references as images; t2i sends none. `used_reference_image` and
   `reference_count_used` record what the adapter actually sent. Models are tried default first, then by
   `priority`; none usable -> `NO_MODEL_AVAILABLE`. At most two model layers per generation (vision + image).
4. **composite** - sharp pastes the slot text into the template's `text_zones` (wrap to `max_lines`, shrink to
   fit, truncate with an ellipsis, contrast guard), optional watermark (`app_settings.watermark_enabled`),
   metadata stripped, thumbnail created, `composited_text=true`.

Failures set `status=failed` + `error_code` and never touch `usage_counters`; success increments today's
counter atomically with marking the job done. Stored codes: `JOB_TIMEOUT`, `NO_MODEL_AVAILABLE`,
`CORE_PROMPT_REQUIRED`, `PROVIDER_TIMEOUT|RATE_LIMITED|UNAVAILABLE|AUTH|BAD_REQUEST|CONTENT_BLOCKED|BAD_RESPONSE`,
`REFERENCE_UNAVAILABLE`, `TEMPLATE_UNAVAILABLE`, `INTERNAL_ERROR`.

### Fonts

Text is rendered with the bundled **Inter** (SIL OFL, `assets/fonts/`, licence in `OFL-Inter.txt`). On startup
`src/pipeline/fonts.ts` writes a small `fonts.conf` and sets `FONTCONFIG_FILE` (this is what resolves the
family on Linux/Docker), and every text render also passes the font file explicitly (sharp's `fontfile`),
because libvips on Windows ignores fontconfig and silently falls back to a system serif font. Deploy `assets/`
next to `dist/` (the fonts are resolved relative to the compiled files).

## Providers

`src/providers/`: `mock` (default, key-less), `openaiCompat` (chat-completions vision/text,
`/images/generations`, `/images/edits` multipart with repeated `image[]`/`image`), `gemini`
(`generateContent`, Imagen `:predict`), `fal` (queue REST, or sync `fal.run`). A model config is usable only
when the environment variable named in its `api_key_env` is set; timeouts come from `timeout_ms`; errors are
mapped to fixed, sanitised messages (never the key, URL, prompt or response body); `cost_usd` comes from
`cost_per_call_usd`.

**The real adapters are written against the providers' public documentation and unit-tested against a mocked
`fetch`; they have not been exercised against the live services.** Verify `model_id` / `base_url` and test
each model before enabling it. Turn a model on through the admin API: set its key variable in the server
environment, then `POST /api/v1/admin/models/:id/test`, `.../activate` and `.../set-default` (no SQL needed).

## Retention

`runRetention()` (`src/retention/`) deletes human-model reference photos past `expires_at`, wipes remarks,
slot values, reference list and the encrypted final prompt of generations older than 90 days
(`generations.purged_at`), and removes files of soft-deleted assets. It runs daily in the worker (or in the
API with the inline driver) and on demand with `npm run retention`; a Postgres advisory lock makes parallel
runs harmless.

## Admin API (Phase C)

Everything under `/api/v1/admin/*` sits behind `requireAuth` + `requireRole('admin')`, applied once on the admin router
(`src/modules/admin/routes.ts`), so a route added to any sub-router cannot forget it. Layout: `src/modules/admin/<area>/`
with `routes.ts`, `service.ts`, `schemas.ts` (Zod, unknown fields rejected) and `dto.ts` (explicit allowlists, never
`res.json(row)`). Areas: `users`, `models`, `corePrompts`, `templates`, `references`, `settings` (settings, brand identity,
content policy), `generations` (log, flag, CSV export), `gallery`, `audit`, `dashboard`. The contract for the frontend team
is in [`docs/API.md`](docs/API.md).

Rules to keep when changing anything here:

- **Core prompts are write-only.** `GET /admin/core-prompts` reads `CORE_PROMPT_META_SELECT` (no body or ciphertext column).
  `POST /admin/core-prompts/test-render` decrypts and composes on the server but answers with `[HIDDEN_CORE_PROMPT]`, per-blank
  filled/empty status and the sanitised values the admin typed. No endpoint, error message, audit row, CSV or log carries a
  body, a fragment of one, or the composed prompt.
- **Every mutation writes an `audit_logs` row in the same transaction.** Diffs come from
  `buildDiff(allowlist, before, after)` (`src/modules/admin/auditLog.ts`): fields not on the allowlist are never read, and a
  second filter drops any key that looks secret (password, hash, token, ciphertext, body, api_key, ...).
  `GET /admin/audit` is read-only and scrubs again on output.
- **Never query the pool inside a transaction.** Inside `withTx(fn)` always pass the `client`: a pool query there deadlocks as soon
  as concurrent requests exhaust the pool (the concurrency tests catch it).
- **Users:** an admin cannot deactivate, demote or delete themselves (`CANNOT_MODIFY_SELF`); the last active admin is protected
  by `LAST_ADMIN` under an advisory lock; deactivation, password reset and "revoke sessions" take effect at once
  (`invalidateUserCache` plus `users.sessions_valid_after`, compared with the millisecond `iam` claim of the access token).
- **Models:** `api_key_env` holds a variable NAME (Zod mirrors the DB CHECK) and the DTO exposes `api_key_configured` only.
  `set-default` runs in one transaction that locks the capability's rows. Providers are resolved from the database on every
  generation, so a new default applies to the next job without a restart.
- **Templates:** publishing, and every edit of a published template, goes through `collectIssues` (active core prompt, blank
  count, text zones, psa disclaimer); a failing edit rolls back as a whole.
- **Settings and policy** invalidate the in-process caches on write; a separate worker process sees them within 15 s.

Migration `1794000000008_admin_hardening.sql` adds `generations.flagged_at|flagged_by|flag_note`,
`users.sessions_valid_after` and an `audit_logs (action, created_at)` index. New env var: `ADMIN_TEST_RATE_LIMIT_PER_MINUTE`
(model tests and core prompt test renders per admin, default 10).

## Security specs

`test/security/`, all part of `npm test`:

- `rbac.spec.ts` walks the live Express stack, builds the route table of the admin router and its mounts, fails when a router is
  mounted outside `ADMIN_MOUNTS`, then calls **every** admin route with no token (401), a garbage token (401), a creator (403),
  a deactivated admin (401/403) and an active admin (never 401/403/5xx). It also proves public registration can never create an
  admin. A route added without the guard cannot pass.
- `prompt-leak.spec.ts` seeds distinctive core prompt text, requests every GET endpoint (enumerated from the stack, so a new GET
  without a fixture fails) and a representative set of admin mutations, then asserts that no response body or captured log line
  contains a 20-character run of any core prompt or final prompt (raw or JSON-escaped), `[___]`, `{{`, `body_ciphertext`,
  `final_prompt`, `auth_tag`, or any hex/base64 form of the stored ciphertext, IVs, tags or key material. Phrases that are already
  public (slot options, tutorials, the creator's own text) are excluded so coincidences cannot trip it. It carries a positive
  control. It also scans `frontend/dist/assets/*.js` for the old AES key string, the leaked mock prompt and 40-character runs of the
  seeded prompts, **only if that directory exists** (otherwise the test is skipped with a message naming the reason).
- `frontend-source-leak.spec.ts` scans `frontend/src` for the same markers. Skipped unless `CHECK_FRONTEND_SOURCE=1`; today it
  fails on `frontend/src/services/aesEncryption.ts` (hard-coded AES key and a mock core prompt), which Phase D removes.

Admin specs (`test/integration/admin*.spec.ts`) restore the test database to its seeded state when they finish
(`useSeededDatabase`), so they do not disturb the Phase A/B specs.

## CI

`.github/workflows/ci.yml` (at the repository root):

- job **backend**: Node 22, services `postgres:16` and `redis:7` with health checks, then `npm ci`, `typecheck`, `migrate`,
  `npm run test:coverage` (unit + integration + security, 70% line threshold) and `build`. MinIO is not started: the s3 driver spec
  probes `localhost:9000` and **skips itself** when it is unreachable (add a MinIO service and the `S3_*` variables to run it).
- job **prompt-leak-bundle**: builds `frontend/` and runs `prompt-leak.spec.ts` against `frontend/dist`. It is
  `continue-on-error: true` until Phase D removes the leaked mock prompt and key from the frontend; then remove that flag to make it blocking.

Run the backend job locally (needs the docker-compose stack):

```bash
docker compose up -d                 # repository root
cd backend && npm ci
npm run typecheck && npm run migrate
npm run test:coverage                # text summary, coverage/ (html + lcov)
npm run build
```

To reproduce the bundle job: `cd frontend && npm install && npm run build`, then in `backend/`
`npx vitest run test/security/prompt-leak.spec.ts`.

## Tests

```bash
npm run typecheck
npm run test:unit    # no database: crypto, composer, sanitizer, providers (mocked fetch), compositor, storage, csv, audit helpers ...
npm test             # unit + integration + security (needs postgres on DATABASE_URL_TEST; redis/minio tests skip when absent)
npm run test:coverage  # the same with v8 coverage; fails below 70% lines
npm run build
```

Integration tests use `DATABASE_URL_TEST` (the database name must end in `_test`; it is truncated and
re-seeded on every run), a temp directory for storage, the mock provider and the inline queue. The BullMQ
smoke test and the s3-driver test talk to the real Redis / MinIO from docker-compose and skip themselves
when those are unreachable.
