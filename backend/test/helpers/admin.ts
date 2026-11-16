import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { afterAll } from 'vitest';
import { runSeed } from '../../src/seed/index.js';
import { api, ADMIN_EMAIL, ADMIN_PASSWORD, bearer, login, pool, PASSWORD, uniqueEmail, useDatabase, type TestSession } from './api.js';

export const ADMIN = '/api/v1/admin';

/** Empties every table of the test database and seeds again: the state global setup leaves behind. */
export async function resetToSeed(): Promise<void> {
  const { rows } = await pool.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'pgmigrations'`);
  await pool.query(`TRUNCATE TABLE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  await runSeed({ quiet: true, copyAssets: false });
}

/**
 * For specs that create or change shared data (users, models, templates, settings ...): closes the pool at the end
 * like `useDatabase`, after putting the database back to its freshly seeded state so other files are unaffected.
 */
export function useSeededDatabase(): void {
  useDatabase();
  // Hooks of one file run in reverse order of registration: this one runs first, then the pool closes.
  afterAll(async () => {
    await resetToSeed();
  });
}

/** Thin wrapper that adds the Bearer token and the admin prefix. */
export function as(session: TestSession) {
  const h = bearer(session.accessToken);
  return {
    get: (path: string) => api().get(`${ADMIN}${path}`).set(h),
    post: (path: string, body?: object) => api().post(`${ADMIN}${path}`).set(h).send(body ?? {}),
    patch: (path: string, body: object) => api().patch(`${ADMIN}${path}`).set(h).send(body),
    put: (path: string, body: object) => api().put(`${ADMIN}${path}`).set(h).send(body),
    del: (path: string) => api().delete(`${ADMIN}${path}`).set(h),
    upload: (path: string, file: Buffer, fields: Record<string, string> = {}, method: 'post' | 'patch' = 'post') => {
      let req = api()[method](`${ADMIN}${path}`).set(h);
      for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
      return req.attach('file', file, { filename: 'upload.png', contentType: 'image/png' });
    },
  };
}

export const loginSeedAdmin = (): Promise<TestSession> => login(ADMIN_EMAIL, ADMIN_PASSWORD);

/** Creates an active admin through the admin API (as the seeded admin) and logs it in. */
export async function createAdminSession(actor?: TestSession, role: 'admin' | 'creator' = 'admin'): Promise<TestSession> {
  const boss = actor ?? (await loginSeedAdmin());
  const email = uniqueEmail(role === 'admin' ? 'admin' : 'creator');
  const res = await as(boss).post('/users', { email, name: `Test ${role}`, role, password: PASSWORD });
  if (res.status !== 201) throw new Error(`create user failed: ${res.status} ${JSON.stringify(res.body)}`);
  return login(email, PASSWORD);
}

export const uuid = (): string => randomUUID();
export const suffix = (): string => randomUUID().slice(0, 8);

export const png = (color = '#3366cc', width = 320, height = 240): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();

/** Rows of audit_logs for an entity id, oldest first. */
export async function auditFor(entityId: string | null, action?: string) {
  const { rows } = await pool.query<{ id: string; actor_id: string | null; action: string; entity: string; entity_id: string | null; diff: Record<string, unknown>; ip: string | null }>(
    `SELECT id, actor_id, action, entity, entity_id, diff, ip FROM audit_logs
      WHERE ($1::text IS NULL OR entity_id = $1) AND ($2::text IS NULL OR action = $2) ORDER BY created_at, id`,
    [entityId, action ?? null],
  );
  return rows;
}

const SECRET_NEEDLES = ['password', 'hash', 'token', 'ciphertext', 'auth_tag', 'body_iv', 'final_prompt', '$2a$', '$2b$', 'sk-'];

/** Fails when an audit diff mentions anything secret-looking. */
export function expectNoSecretsInAudit(rows: { diff: unknown }[], extra: string[] = []): void {
  for (const row of rows) {
    const text = JSON.stringify(row.diff).toLowerCase();
    for (const needle of [...SECRET_NEEDLES, ...extra]) {
      if (text.includes(needle.toLowerCase())) throw new Error(`audit diff contains "${needle}": ${text.slice(0, 200)}`);
    }
  }
}

/** Valid core prompt body with `blanks` blanks and no glyph words. Distinct per call via `marker`. */
export function coreBody(blanks: number, marker = suffix()): string {
  const parts = Array.from({ length: blanks }, (_, i) => `Feature number ${i + 1} is [___] with careful attention to ${marker} craftsmanship.`);
  return [
    `Create a polished studio artwork in {{aspect_ratio}} format, theme code ${marker}.`,
    ...parts,
    'Keep {{text_zone}} completely clean.',
    'Constraints: {{subject_lock}}; {{negative}}.',
  ].join('\n');
}
