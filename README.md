# Sukamenak Studio

AI content generator for the RW 15 board and the small businesses (UMKM) of Desa Sukamenak. A creator picks a
template, fills in a few slots and optionally adds reference photos; the server composes the prompt, generates the image
and pastes the text onto it.

The product's core value is a **hidden core prompt**. It is stored AES-256-GCM encrypted on the server and must never
reach a browser, a response, a log line or an error message. Several automated checks enforce this (see
[Security](#security)).

## Repository layout

| Path | What it is |
|------|------------|
| [`backend/`](backend/README.md) | Node 22, Express 5, TypeScript, PostgreSQL 16, BullMQ. API, prompt engine, generation pipeline, admin API. |
| [`frontend/`](frontend) | Vite 6, React 19, TypeScript, Tailwind 4, TanStack Query. Creator and admin UI on the real API. |
| [`video/`](video/README.md) | Remotion renderer: turns a finished poster into a 9:16 reel. Separate worker, separate image. |
| [`docs/VIDEO.md`](docs/VIDEO.md) | Video feature: endpoints, configuration, retention. |
| [`docs/E2E.md`](docs/E2E.md) | Playwright (creator and admin flows) and the k6 smoke test. |
| [`docs/BACKEND_PLAN.md`](docs/BACKEND_PLAN.md) | The backend spec and the delivery phases (A to D). |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | The plan from here to launch (phases E to J): real providers, real core prompts, deploy, beta. |
| [`backend/docs/API.md`](backend/docs/API.md) | Endpoint reference for the frontend. |
| `docker-compose.yml` | Local PostgreSQL (host port 5433), Redis and MinIO. Development only. |
| [`deploy/`](deploy/README.md) | Staging/production stack (Caddy, Nginx, API, worker), deploy verification and backups. |
| `.github/workflows/ci.yml` | CI: backend, frontend and the prompt-leak checks. |
| `scratch/tempe_eval/` | Sample photos (tempe, packaging) from the initial commit. Nothing in the code references them. |

There is no `package.json` at the root: `backend/` and `frontend/` are installed and run separately.

## Run it locally

You need Node 22+ and Docker.

```bash
# 1. infrastructure (postgres :5433, redis :6379, minio :9000, and the "sukamenak" bucket)
docker compose up -d

# 2. backend (http://localhost:3000)
cd backend
npm install
cp .env.example .env        # fill JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, CORE_PROMPT_KEY (see the comments in the file)
npm run migrate
npm run seed                # prints the generated passwords once
npm run dev                 # QUEUE_DRIVER defaults to "inline": the API runs the pipeline in-process

# 3. frontend (http://localhost:5173), in a second terminal
cd frontend
npm install
npm run dev
```

The dev server proxies `/api` to `http://localhost:3000` (override with `VITE_DEV_API_TARGET`), so the refresh cookie
works without any CORS setup.

The seed creates `admin@sukamenak.studio` and the creator `demo@sukamenak.studio`. With the default **mock** image
provider the whole pipeline works without any API key. Real providers (OpenAI-compatible, Gemini, fal) only activate when
their key is set in the server environment, and **have not been exercised against the live services yet**; see
[`backend/README.md`](backend/README.md#providers).

## Tests

```bash
# backend: needs `docker compose up -d` and a frontend build (cd frontend && npm ci && npm run build)
cd backend
npm run test:ci          # unit + integration + security, 70% line coverage, fails on any skipped test

# frontend
cd frontend
npm run typecheck && npm test && npm run build
```

A test that needs Redis, MinIO or a built frontend **fails** when it is missing; it never passes by skipping. If you really
have no Docker, `TEST_ALLOW_SKIP=1` skips them loudly (CI refuses it). On Windows, run coverage from PowerShell or cmd, not
Git Bash; details in [`backend/README.md`](backend/README.md#ci).

## Security

- `backend/test/security/prompt-leak.spec.ts` checks every response and log line, and the built frontend bundle
  (`frontend/dist/assets/*.js`), for core prompt text and the old AES key.
- `backend/test/security/frontend-source-leak.spec.ts` does the same for `frontend/src`.
- `backend/test/security/rbac.spec.ts` calls every admin route as anonymous, as a creator and as a deactivated admin.
- Never commit secrets. `.env` is ignored; the values in `ci.yml` and `docker-compose.yml` are throwaway.
- **The real core prompts are not in this repository.** It is public, so `backend/src/seed/data/corePrompts.ts` holds only
  neutral stand-ins (marked `PLACEHOLDER-CORE-PROMPT`). Enter the real prompts in the admin Core Prompt Manager; they live
  only, encrypted, in the database. A test fails if a committed prompt is not a stand-in. See
  [`backend/README.md`](backend/README.md#core-prompts-stand-ins-in-the-repository-real-ones-in-the-database).

## CI

`.github/workflows/ci.yml` runs on every branch push and on pull requests to `main`: **backend** (typecheck, migrate,
tests with PostgreSQL, Redis and MinIO, coverage, build), **frontend** (typecheck, tests, build) and **prompt-leak-bundle**.
All three must be green before merging to `main`.
