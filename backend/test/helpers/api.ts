import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, pool } from '../../src/db/pool.js';
import { TEST_ADMIN_PASSWORD, TEST_DEMO_PASSWORD } from './testEnv.js';

export const ADMIN_EMAIL = 'admin@sukamenak.studio';
export const ADMIN_PASSWORD = TEST_ADMIN_PASSWORD;
export const DEMO_EMAIL = 'demo@sukamenak.studio';
export const DEMO_PASSWORD = TEST_DEMO_PASSWORD;
export const PASSWORD = 'Str0ng-pass-word';

export const app = createApp();
export const api = (): ReturnType<typeof request> => request(app);
export { pool };

/** Call once at the top of an integration spec: closes this file's pool when its tests finish. */
export function useDatabase(): void {
  afterAll(async () => {
    await closePool();
  });
}

export const uniqueEmail = (prefix = 'user'): string => `${prefix}.${randomUUID().slice(0, 8)}@test.local`;

export const bearer = (token: string): { Authorization: string } => ({ Authorization: `Bearer ${token}` });

/** Value of the refresh cookie set (or cleared, giving '') by a response; undefined when not touched. */
export function refreshCookieOf(res: { headers: Record<string, unknown> }): string | undefined {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? (raw as string[]) : typeof raw === 'string' ? [raw] : [];
  const entry = list.find((c) => c.startsWith('refresh_token='));
  return entry?.split(';')[0]?.slice('refresh_token='.length);
}

export const cookieHeader = (value: string): { Cookie: string } => ({ Cookie: `refresh_token=${value}` });

export interface TestSession {
  email: string;
  password: string;
  id: string;
  accessToken: string;
  refreshCookie: string;
}

export async function registerUser(overrides: { email?: string; password?: string; name?: string } = {}): Promise<TestSession> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? PASSWORD;
  const res = await api()
    .post('/api/v1/auth/register')
    .send({ email, password, name: overrides.name ?? 'Test User' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return {
    email,
    password,
    id: res.body.data.user.id,
    accessToken: res.body.data.access_token,
    refreshCookie: refreshCookieOf(res) as string,
  };
}

export async function login(email: string, password: string): Promise<TestSession> {
  const res = await api().post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return {
    email,
    password,
    id: res.body.data.user.id,
    accessToken: res.body.data.access_token,
    refreshCookie: refreshCookieOf(res) as string,
  };
}

/** Collects every object key in a JSON value, at any depth. */
export function collectKeys(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) for (const v of value) collectKeys(v, into);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      into.add(k);
      collectKeys(v, into);
    }
  }
  return into;
}
