import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env.js';
import type * as MailModule from '../src/mail/index.js';
import { api, bearer, cookieHeader, pool, registerUser, uniqueEmail, useDatabase } from './helpers/api.js';

// The route sends mail in the background; capture it instead of writing outbox files.
const sendMail = vi.hoisted(() => vi.fn(async (_message: { to: string; subject: string; text: string }) => undefined));
vi.mock('../src/mail/index.js', async (importOriginal) => ({ ...(await importOriginal<typeof MailModule>()), sendMail }));

useDatabase();

const NEW_PASSWORD = 'Brand-new-pass-9';
const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');

afterEach(() => {
  sendMail.mockClear();
});

/** Asks for a reset link and returns the raw token taken from the emailed link. */
async function requestToken(email: string): Promise<string> {
  const res = await api().post('/api/v1/auth/forgot-password').send({ email });
  expect(res.status).toBe(200);
  expect(res.body.data).toEqual({ sent: true });
  const text = sendMail.mock.calls.at(-1)?.[0].text ?? '';
  const match = /http:\/\/localhost:5173\/reset-password\?token=([A-Za-z0-9_-]+)/.exec(text);
  if (!match?.[1]) throw new Error('no reset link was mailed');
  return match[1];
}

const resetRows = async (userId: string) =>
  (await pool.query<{ token_hash: string; used_at: Date | null }>(
    'SELECT token_hash, used_at FROM password_resets WHERE user_id = $1 ORDER BY created_at',
    [userId],
  )).rows;

describe('POST /auth/forgot-password', () => {
  it('answers 200 for an unknown email without creating a token or sending mail', async () => {
    const before = await pool.query('SELECT count(*)::int AS n FROM password_resets');
    const res = await api().post('/api/v1/auth/forgot-password').send({ email: uniqueEmail('ghost') });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ sent: true });
    const after = await pool.query('SELECT count(*)::int AS n FROM password_resets');
    expect(after.rows[0].n).toBe(before.rows[0].n);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('mails a link to the account and stores only the token hash', async () => {
    const user = await registerUser();
    const token = await requestToken(user.email);
    expect(token).toHaveLength(43);
    expect(sendMail.mock.calls[0]?.[0].to).toBe(user.email);
    const rows = await resetRows(user.id);
    expect(rows).toEqual([{ token_hash: sha256(token), used_at: null }]);
  });

  it('still answers 200 when the mail provider fails', async () => {
    const user = await registerUser();
    sendMail.mockRejectedValueOnce(new Error('provider down'));
    const res = await api().post('/api/v1/auth/forgot-password').send({ email: user.email });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ sent: true });
  });

  it('replaces an older unused token with the new one', async () => {
    const user = await registerUser();
    const first = await requestToken(user.email);
    const second = await requestToken(user.email);
    const rows = await resetRows(user.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.used_at).not.toBeNull();
    expect(rows[1]?.used_at).toBeNull();

    const stale = await api().post('/api/v1/auth/reset-password').send({ token: first, new_password: NEW_PASSWORD });
    expect(stale.status).toBe(400);
    expect(stale.body.error_code).toBe('INVALID_RESET_TOKEN');
    const fresh = await api().post('/api/v1/auth/reset-password').send({ token: second, new_password: NEW_PASSWORD });
    expect(fresh.status).toBe(200);
  });
});

describe('POST /auth/reset-password', () => {
  it('sets the new password, rejects the old one and marks the token used', async () => {
    const user = await registerUser();
    const token = await requestToken(user.email);

    const res = await api().post('/api/v1/auth/reset-password').send({ token, new_password: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ reset: true });

    const oldLogin = await api().post('/api/v1/auth/login').send({ email: user.email, password: user.password });
    expect(oldLogin.status).toBe(401);
    expect(oldLogin.body.error_code).toBe('INVALID_CREDENTIALS');
    const newLogin = await api().post('/api/v1/auth/login').send({ email: user.email, password: NEW_PASSWORD });
    expect(newLogin.status).toBe(200);

    const rows = await resetRows(user.id);
    expect(rows[0]?.used_at).not.toBeNull();
  });

  it('rejects a second use of the same token', async () => {
    const user = await registerUser();
    const token = await requestToken(user.email);
    expect((await api().post('/api/v1/auth/reset-password').send({ token, new_password: NEW_PASSWORD })).status).toBe(200);

    const again = await api().post('/api/v1/auth/reset-password').send({ token, new_password: 'Another-pass-77' });
    expect(again.status).toBe(400);
    expect(again.body.error_code).toBe('INVALID_RESET_TOKEN');
  });

  it('rejects an expired token', async () => {
    const user = await registerUser();
    const token = await requestToken(user.email);
    await pool.query("UPDATE password_resets SET expires_at = now() - interval '1 minute' WHERE token_hash = $1", [sha256(token)]);

    const res = await api().post('/api/v1/auth/reset-password').send({ token, new_password: NEW_PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('INVALID_RESET_TOKEN');
    const login = await api().post('/api/v1/auth/login').send({ email: user.email, password: user.password });
    expect(login.status).toBe(200);
  });

  it('rejects an unknown token', async () => {
    const res = await api()
      .post('/api/v1/auth/reset-password')
      .send({ token: 'x'.repeat(43), new_password: NEW_PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('INVALID_RESET_TOKEN');
  });

  it('validates the new password with the registration rules', async () => {
    const res = await api().post('/api/v1/auth/reset-password').send({ token: 'x'.repeat(43), new_password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('VALIDATION_ERROR');
  });

  it('revokes existing refresh tokens and access tokens', async () => {
    const user = await registerUser();
    const token = await requestToken(user.email);
    expect((await api().post('/api/v1/auth/reset-password').send({ token, new_password: NEW_PASSWORD })).status).toBe(200);

    const { rows } = await pool.query<{ open: number }>(
      'SELECT count(*)::int AS open FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
      [user.id],
    );
    expect(rows[0]?.open).toBe(0);
    const refreshed = await api().post('/api/v1/auth/refresh').set(cookieHeader(user.refreshCookie));
    expect(refreshed.status).toBe(401);
    const me = await api().get('/api/v1/me').set(bearer(user.accessToken));
    expect(me.status).toBe(401);
  });
});

describe('sendMail dev outbox', () => {
  it('writes the full message to var/outbox when RESEND_API_KEY is unset', async () => {
    const actual = await vi.importActual<typeof MailModule>('../src/mail/index.js');
    const to = uniqueEmail('outbox');
    const logSpy = vi.spyOn((await import('../src/lib/logger.js')).logger, 'info');
    await actual.sendMail({ to, subject: 'Subjek', text: 'Isi pesan' });
    const file = (logSpy.mock.calls.at(-1)?.[0] as { file: string }).file;
    logSpy.mockRestore();
    expect(file.startsWith(actual.OUTBOX_DIR)).toBe(true);
    expect(existsSync(file)).toBe(true);
    const content = readFileSync(file, 'utf8');
    expect(content).toContain(`To: ${to}`);
    expect(content).toContain('Isi pesan');
    rmSync(file);
  });

  it('throws MailDeliveryError when Resend answers non-2xx', async () => {
    const actual = await vi.importActual<typeof MailModule>('../src/mail/index.js');
    const fetchMock = vi.fn(async () => new Response('{"message":"bad"}', { status: 422 }));
    vi.stubGlobal('fetch', fetchMock);
    const previous = env.RESEND_API_KEY;
    env.RESEND_API_KEY = 're_test_key';
    try {
      await expect(actual.sendMail({ to: 'a@test.local', subject: 's', text: 't' })).rejects.toMatchObject({
        name: 'MailDeliveryError',
        status: 422,
      });
      expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST' }));
    } finally {
      env.RESEND_API_KEY = previous;
      vi.unstubAllGlobals();
    }
  });
});
