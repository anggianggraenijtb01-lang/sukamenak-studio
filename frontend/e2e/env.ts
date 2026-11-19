import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FRONTEND_DIR = path.resolve(HERE, '..');
export const REPO_ROOT = path.resolve(FRONTEND_DIR, '..');
export const BACKEND_DIR = path.join(REPO_ROOT, 'backend');

export const WEB_URL = 'http://127.0.0.1:5173';
export const API_ORIGIN = 'http://127.0.0.1:3998';
export const API_URL = `${API_ORIGIN}/api/v1`;

/** Generated posters of the run live here, never in the developer's ./storage. */
export const E2E_STORAGE_DIR = path.join(os.tmpdir(), 'sukamenak-studio-e2e-storage');

export const E2E_ADMIN = { email: 'admin@sukamenak.studio', password: 'Admin-e2e-pass-1' } as const;

/** Parses backend/.env so the credentials do not have to be duplicated in this repo. */
function readBackendEnvFile(): Record<string, string> {
  try {
    const text = readFileSync(path.join(BACKEND_DIR, '.env'), 'utf8');
    const out: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      out[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * The suite never touches the developer database: it needs its own, whose name ends with `_e2e`.
 * E2E_DATABASE_URL wins, otherwise the developer DATABASE_URL is redirected to `sukamenak_e2e`.
 */
export function resolveE2eDatabaseUrl(): string {
  const explicit = process.env.E2E_DATABASE_URL;
  const base = explicit ?? process.env.DATABASE_URL ?? readBackendEnvFile().DATABASE_URL;
  if (!base) {
    throw new Error(
      'No database URL: set E2E_DATABASE_URL, or make sure backend/.env defines DATABASE_URL.',
    );
  }
  const url = new URL(base);
  if (!explicit) url.pathname = '/sukamenak_e2e';
  if (!url.pathname.replace(/^\//, '').endsWith('_e2e')) {
    throw new Error(`Refusing "${url.pathname}": the end-to-end database name must end with "_e2e"`);
  }
  return url.toString();
}

/**
 * Everything the API needs for the suite. Only what must differ from backend/.env is overridden: the
 * JWT seeds and the core-prompt key stay as they are, because the seeded core prompts were encrypted
 * with the key from that file.
 */
export function backendEnv(): Record<string, string> {
  return {
    NODE_ENV: 'development',
    PORT: '3998',
    LOG_LEVEL: 'warn',
    DATABASE_URL: resolveE2eDatabaseUrl(),
    QUEUE_DRIVER: 'inline',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: E2E_STORAGE_DIR,
    PUBLIC_BASE_URL: API_ORIGIN,
    // The browser talks to the API on a different port, so the allowlist has to name the exact origin.
    // Signing and a root-relative URL keep working; without this the poster download falls back to
    // opening a new tab and the browser never emits a download event.
    CORS_ORIGIN: WEB_URL,
    COOKIE_SECURE: 'false',
    TRUST_PROXY: '0',
    // The suite generates a handful of posters from one IP; the daily and per-minute limits of a real
    // deployment would throttle it.
    GENERATION_RATE_LIMIT_PER_MINUTE: '1000',
    RATE_LIMIT_PER_MINUTE: '100000',
    AUTH_RATE_LIMIT_PER_MINUTE: '100000',
    MAX_GENERATIONS_PER_DAY: '1000',
  };
}
