import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import {
  PASSWORD,
  api,
  bearer,
  cookieHeader,
  login,
  pool,
  refreshCookieOf,
  registerUser,
  uniqueEmail,
  useDatabase,
} from '../helpers/api.js';
import { testEnv } from '../helpers/testEnv.js';

useDatabase();

describe('POST /auth/register', () => {
  it('creates a creator, returns an access token and sets an httpOnly refresh cookie', async () => {
    const email = uniqueEmail('reg');
    const res = await api().post('/api/v1/auth/register').send({ email, password: PASSWORD, name: 'Reg User' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.user).toMatchObject({ email, name: 'Reg User', role: 'creator' });
    expect(res.body.data.access_token).toEqual(expect.any(String));
    expect(res.body.data.token_type).toBe('Bearer');
    // Refresh token only in the cookie, never in the body.
    expect(JSON.stringify(res.body)).not.toMatch(/refresh/i);
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('refresh_token='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
  });

  it('ignores a client-supplied role: public registration is always creator', async () => {
    const email = uniqueEmail('esc');
    const res = await api().post('/api/v1/auth/register').send({ email, password: PASSWORD, name: 'Sneaky', role: 'admin', is_active: false });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('creator');
    const { rows } = await pool.query('SELECT role, is_active FROM users WHERE email = $1', [email]);
    expect(rows[0]).toEqual({ role: 'creator', is_active: true });
  });

  it('never returns the password hash and stores only a hash', async () => {
    const email = uniqueEmail('hash');
    const res = await api().post('/api/v1/auth/register').send({ email, password: PASSWORD, name: 'Hash User' });
    expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/i);
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [email]);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
    expect(rows[0].password_hash).not.toContain(PASSWORD);
  });

  it('rejects duplicate emails case-insensitively with EMAIL_EXISTS', async () => {
    const email = uniqueEmail('dup');
    await registerUser({ email });
    const res = await api().post('/api/v1/auth/register').send({ email: email.toUpperCase(), password: PASSWORD, name: 'Again' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ status: 'error', error_code: 'EMAIL_EXISTS' });
  });

  it('validates input with field-level errors', async () => {
    const res = await api().post('/api/v1/auth/register').send({ email: 'not-an-email', password: 'short', name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('VALIDATION_ERROR');
    const fields = (res.body.errors as { field: string }[]).map((e) => e.field).sort();
    expect(fields).toEqual(['email', 'name', 'password']);
  });
});

describe('POST /auth/login', () => {
  it('logs in with valid credentials and updates last_login_at', async () => {
    const user = await registerUser();
    await pool.query('UPDATE users SET last_login_at = NULL WHERE id = $1', [user.id]);
    const res = await api().post('/api/v1/auth/login').send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(refreshCookieOf(res)).toBeTruthy();
    const { rows } = await pool.query('SELECT last_login_at FROM users WHERE id = $1', [user.id]);
    expect(rows[0].last_login_at).not.toBeNull();
  });

  it('returns the same INVALID_CREDENTIALS for a wrong password and an unknown email', async () => {
    const user = await registerUser();
    const wrong = await api().post('/api/v1/auth/login').send({ email: user.email, password: 'Wrong-password-1' });
    const unknown = await api().post('/api/v1/auth/login').send({ email: uniqueEmail('ghost'), password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error_code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an inactive user with ACCOUNT_INACTIVE (and no session)', async () => {
    const user = await registerUser();
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);
    const res = await api().post('/api/v1/auth/login').send({ email: user.email, password: user.password });
    expect(res.status).toBe(403);
    expect(res.body.error_code).toBe('ACCOUNT_INACTIVE');
    expect(refreshCookieOf(res)).toBeUndefined();
  });
});

describe('POST /auth/refresh (rotation + reuse detection)', () => {
  it('rotates the refresh token and issues a working access token', async () => {
    const user = await registerUser();
    const res = await api().post('/api/v1/auth/refresh').set(cookieHeader(user.refreshCookie));
    expect(res.status).toBe(200);
    const next = refreshCookieOf(res) as string;
    expect(next).toBeTruthy();
    expect(next).not.toBe(user.refreshCookie);
    const me = await api().get('/api/v1/me').set(bearer(res.body.data.access_token));
    expect(me.status).toBe(200);
    expect(me.body.data.user.id).toBe(user.id);
  });

  it('keeps one family across rotations and chains replaced_by', async () => {
    const user = await registerUser();
    const second = await api().post('/api/v1/auth/refresh').set(cookieHeader(user.refreshCookie));
    const third = await api().post('/api/v1/auth/refresh').set(cookieHeader(refreshCookieOf(second) as string));
    expect(third.status).toBe(200);
    const { rows } = await pool.query(
      'SELECT family_id, revoked_at, replaced_by FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at',
      [user.id],
    );
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.family_id)).size).toBe(1);
    expect(rows.filter((r) => r.revoked_at === null)).toHaveLength(1);
    expect(rows[0].replaced_by).not.toBeNull();
  });

  it('treats reuse of a rotated token as theft: 401 and the whole family is revoked', async () => {
    const user = await registerUser();
    const rotated = await api().post('/api/v1/auth/refresh').set(cookieHeader(user.refreshCookie));
    const legitimate = refreshCookieOf(rotated) as string;

    const replay = await api().post('/api/v1/auth/refresh').set(cookieHeader(user.refreshCookie));
    expect(replay.status).toBe(401);
    expect(replay.body.error_code).toBe('UNAUTHORIZED');

    // The legitimate, newest token is dead too.
    const afterTheft = await api().post('/api/v1/auth/refresh').set(cookieHeader(legitimate));
    expect(afterTheft.status).toBe(401);
    const { rows } = await pool.query('SELECT count(*)::int AS live FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);
    expect(rows[0].live).toBe(0);
  });

  it('does not touch other sessions (families) of the same user on reuse', async () => {
    const first = await registerUser();
    const other = await login(first.email, first.password);
    const rotated = await api().post('/api/v1/auth/refresh').set(cookieHeader(first.refreshCookie));
    expect(rotated.status).toBe(200);
    await api().post('/api/v1/auth/refresh').set(cookieHeader(first.refreshCookie)); // replay -> family revoked
    const stillGood = await api().post('/api/v1/auth/refresh').set(cookieHeader(other.refreshCookie));
    expect(stillGood.status).toBe(200);
  });

  it('rejects a missing, forged or garbage cookie', async () => {
    expect((await api().post('/api/v1/auth/refresh')).status).toBe(401);
    expect((await api().post('/api/v1/auth/refresh').set(cookieHeader('garbage'))).status).toBe(401);
    const forged = jwt.sign({ fam: 'x' }, 'some-other-secret-that-is-long-enough-123456', { subject: 'u', jwtid: 'j', issuer: 'sukamenak-studio' });
    expect((await api().post('/api/v1/auth/refresh').set(cookieHeader(forged))).status).toBe(401);
  });

  it('refuses to refresh for a user deactivated after login', async () => {
    const user = await registerUser();
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);
    const res = await api().post('/api/v1/auth/refresh').set(cookieHeader(user.refreshCookie));
    expect(res.status).toBe(403);
    expect(res.body.error_code).toBe('ACCOUNT_INACTIVE');
  });

  it('rejects an expired stored token', async () => {
    const user = await registerUser();
    await pool.query("UPDATE refresh_tokens SET expires_at = now() - interval '1 minute' WHERE user_id = $1", [user.id]);
    expect((await api().post('/api/v1/auth/refresh').set(cookieHeader(user.refreshCookie))).status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the token family and clears the cookie', async () => {
    const user = await registerUser();
    const out = await api().post('/api/v1/auth/logout').set(cookieHeader(user.refreshCookie));
    expect(out.status).toBe(200);
    expect(refreshCookieOf(out)).toBe('');
    const after = await api().post('/api/v1/auth/refresh').set(cookieHeader(user.refreshCookie));
    expect(after.status).toBe(401);
  });

  it('is idempotent and harmless without a cookie', async () => {
    const res = await api().post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('access tokens', () => {
  it('rejects missing, malformed, expired, alg=none and refresh-secret tokens with 401', async () => {
    const user = await registerUser();
    expect((await api().get('/api/v1/me')).status).toBe(401);
    expect((await api().get('/api/v1/me').set('Authorization', 'Bearer not.a.jwt')).status).toBe(401);
    expect((await api().get('/api/v1/me').set('Authorization', user.accessToken)).status).toBe(401);

    const expired = jwt.sign({ role: 'creator' }, testEnv.JWT_ACCESS_SECRET as string, {
      subject: user.id,
      issuer: 'sukamenak-studio',
      expiresIn: -10,
    });
    expect((await api().get('/api/v1/me').set(bearer(expired))).status).toBe(401);

    const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const nonePayload = Buffer.from(JSON.stringify({ sub: user.id, role: 'admin', iss: 'sukamenak-studio' })).toString('base64url');
    expect((await api().get('/api/v1/me').set(bearer(`${noneHeader}.${nonePayload}.`))).status).toBe(401);

    const wrongSecret = jwt.sign({ role: 'creator' }, testEnv.JWT_REFRESH_SECRET as string, { subject: user.id, issuer: 'sukamenak-studio' });
    expect((await api().get('/api/v1/me').set(bearer(wrongSecret))).status).toBe(401);
  });

  it('takes the role from the database, not from the token', async () => {
    const user = await registerUser();
    const forged = jwt.sign({ role: 'admin' }, testEnv.JWT_ACCESS_SECRET as string, { subject: user.id, issuer: 'sukamenak-studio', expiresIn: 60 });
    const res = await api().get('/api/v1/admin/ping').set(bearer(forged));
    expect(res.status).toBe(403);
  });

  it('rejects a user who was deactivated after the token was issued', async () => {
    const user = await registerUser();
    expect((await api().get('/api/v1/me').set(bearer(user.accessToken))).status).toBe(200);
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);
    const res = await api().get('/api/v1/me').set(bearer(user.accessToken));
    expect(res.status).toBe(403);
    expect(res.body.error_code).toBe('ACCOUNT_INACTIVE');
  });
});
