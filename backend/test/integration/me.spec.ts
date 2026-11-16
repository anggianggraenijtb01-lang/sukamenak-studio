import { describe, expect, it } from 'vitest';
import { PASSWORD, api, bearer, cookieHeader, login, pool, refreshCookieOf, registerUser, useDatabase, ADMIN_EMAIL, ADMIN_PASSWORD } from '../helpers/api.js';

useDatabase();

describe('GET /me', () => {
  it('requires authentication', async () => {
    expect((await api().get('/api/v1/me')).status).toBe(401);
  });

  it('returns the profile and the remaining daily allowance (default limit 10)', async () => {
    const user = await registerUser({ name: 'Profil Saya' });
    const res = await api().get('/api/v1/me').set(bearer(user.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: user.id, email: user.email, name: 'Profil Saya', role: 'creator' });
    expect(res.body.data.usage).toMatchObject({ daily_limit: 10, used_today: 0, in_flight: 0, remaining_today: 10 });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('honours daily_limit_override and subtracts successes and in-flight jobs', async () => {
    const user = await registerUser();
    await pool.query('UPDATE users SET daily_limit_override = 5 WHERE id = $1', [user.id]);
    await pool.query(
      "INSERT INTO usage_counters (user_id, date, success_count) VALUES ($1, (now() AT TIME ZONE 'Asia/Jakarta')::date, 2)",
      [user.id],
    );
    await pool.query(
      "INSERT INTO generations (user_id, mode, subject, publication, status) VALUES ($1, 't2i', 'product', 'poster', 'running')",
      [user.id],
    );
    const res = await api().get('/api/v1/me').set(bearer(user.accessToken));
    expect(res.body.data.usage).toMatchObject({ daily_limit: 5, used_today: 2, in_flight: 1, remaining_today: 2 });
  });

  it('never reports a negative allowance', async () => {
    const user = await registerUser();
    await pool.query('UPDATE users SET daily_limit_override = 0 WHERE id = $1', [user.id]);
    const res = await api().get('/api/v1/me').set(bearer(user.accessToken));
    expect(res.body.data.usage.remaining_today).toBe(0);
  });
});

describe('PATCH /me', () => {
  it('updates the name', async () => {
    const user = await registerUser();
    const res = await api().patch('/api/v1/me').set(bearer(user.accessToken)).send({ name: 'Nama Baru' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Nama Baru');
    const me = await api().get('/api/v1/me').set(bearer(user.accessToken));
    expect(me.body.data.user.name).toBe('Nama Baru');
  });

  it('cannot change role, email or limits through PATCH', async () => {
    const user = await registerUser();
    const res = await api()
      .patch('/api/v1/me')
      .set(bearer(user.accessToken))
      .send({ name: 'Tetap Creator', role: 'admin', email: 'x@y.z', daily_limit_override: 9999 });
    expect(res.status).toBe(200);
    const { rows } = await pool.query('SELECT role, email, daily_limit_override FROM users WHERE id = $1', [user.id]);
    expect(rows[0]).toEqual({ role: 'creator', email: user.email, daily_limit_override: null });
  });

  it('rejects an empty update and a password change without the current password', async () => {
    const user = await registerUser();
    expect((await api().patch('/api/v1/me').set(bearer(user.accessToken)).send({})).status).toBe(400);
    const noCurrent = await api().patch('/api/v1/me').set(bearer(user.accessToken)).send({ new_password: 'Another-pass-123' });
    expect(noCurrent.status).toBe(400);
    const wrong = await api()
      .patch('/api/v1/me')
      .set(bearer(user.accessToken))
      .send({ current_password: 'Not-my-password-1', new_password: 'Another-pass-123' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error_code).toBe('INVALID_CREDENTIALS');
  });

  it('changes the password, revokes old sessions and returns a fresh one', async () => {
    const user = await registerUser();
    const res = await api()
      .patch('/api/v1/me')
      .set(bearer(user.accessToken))
      .send({ current_password: user.password, new_password: 'Another-pass-123' });
    expect(res.status).toBe(200);
    expect(res.body.data.session.access_token).toEqual(expect.any(String));
    const freshCookie = refreshCookieOf(res) as string;
    expect(freshCookie).toBeTruthy();

    expect((await api().post('/api/v1/auth/refresh').set(cookieHeader(user.refreshCookie))).status).toBe(401);
    expect((await api().post('/api/v1/auth/refresh').set(cookieHeader(freshCookie))).status).toBe(200);
    expect((await api().post('/api/v1/auth/login').send({ email: user.email, password: user.password })).status).toBe(401);
    expect((await api().post('/api/v1/auth/login').send({ email: user.email, password: 'Another-pass-123' })).status).toBe(200);
  });
});

describe('GET /me/export', () => {
  it('exports the user data without secrets, hashes or final prompts', async () => {
    const user = await registerUser();
    await api().post('/api/v1/prompts').set(bearer(user.accessToken)).send({ title: 'Prompt saya', body: 'keripik tempe renyah, latar kayu' });
    await pool.query(
      `INSERT INTO generations (user_id, mode, subject, publication, status, slot_values, remarks,
                                final_prompt_ciphertext, final_prompt_iv, final_prompt_auth_tag)
       VALUES ($1, 't2i', 'product', 'poster', 'done', '{"product":"tempe"}', 'catatan saya', '\\x0102', '\\x0304', '\\x0506')`,
      [user.id],
    );
    const res = await api().get('/api/v1/me/export').set(bearer(user.accessToken));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    const data = res.body.data;
    expect(data.profile.email).toBe(user.email);
    expect(data.saved_prompts).toHaveLength(1);
    expect(data.generations).toHaveLength(1);
    expect(data.generations[0].remarks).toBe('catatan saya');
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/password|ciphertext|auth_tag|final_prompt|\$2[aby]\$/i);
  });

  it('requires authentication', async () => {
    expect((await api().get('/api/v1/me/export')).status).toBe(401);
  });
});

describe('DELETE /me', () => {
  it('requires the password', async () => {
    const user = await registerUser();
    const res = await api().delete('/api/v1/me').set(bearer(user.accessToken)).send({ password: 'Wrong-password-1' });
    expect(res.status).toBe(401);
    expect((await api().delete('/api/v1/me').set(bearer(user.accessToken)).send({})).status).toBe(400);
    expect((await api().get('/api/v1/me').set(bearer(user.accessToken))).status).toBe(200);
  });

  it('soft-deletes and anonymises the account and its personal content', async () => {
    const user = await registerUser({ name: 'Orang Asli' });
    await api().post('/api/v1/prompts').set(bearer(user.accessToken)).send({ title: 'Pribadi', body: 'isi pribadi' });
    await pool.query(
      `INSERT INTO generations (user_id, mode, subject, publication, status, slot_values, remarks)
       VALUES ($1, 't2i', 'product', 'poster', 'done', '{"product":"rahasia"}', 'catatan pribadi')`,
      [user.id],
    );

    const res = await api().delete('/api/v1/me').set(bearer(user.accessToken)).send({ password: user.password });
    expect(res.status).toBe(200);
    expect(refreshCookieOf(res)).toBe('');

    const { rows } = await pool.query('SELECT email, name, is_active, deleted_at, password_hash FROM users WHERE id = $1', [user.id]);
    expect(rows[0].email).toMatch(/^deleted-.*@deleted\.invalid$/);
    expect(rows[0].name).toBe('Pengguna Terhapus');
    expect(rows[0].is_active).toBe(false);
    expect(rows[0].deleted_at).not.toBeNull();
    expect((await pool.query('SELECT 1 FROM user_prompts WHERE user_id = $1', [user.id])).rowCount).toBe(0);
    const gen = await pool.query('SELECT remarks, slot_values, deleted_at FROM generations WHERE user_id = $1', [user.id]);
    expect(gen.rows[0].remarks).toBeNull();
    expect(gen.rows[0].slot_values).toEqual({});
    expect(gen.rows[0].deleted_at).not.toBeNull();

    // The old credentials, token and refresh cookie are all dead; the email is free again.
    expect((await api().post('/api/v1/auth/login').send({ email: user.email, password: user.password })).status).toBe(401);
    expect((await api().get('/api/v1/me').set(bearer(user.accessToken))).status).toBe(401);
    expect((await api().post('/api/v1/auth/refresh').set(cookieHeader(user.refreshCookie))).status).toBe(401);
    const again = await registerUser({ email: user.email, password: PASSWORD });
    expect(again.id).not.toBe(user.id);
  });

  it('does not let an admin delete their own account through /me', async () => {
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await api().delete('/api/v1/me').set(bearer(admin.accessToken)).send({ password: ADMIN_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error_code).toBe('FORBIDDEN');
  });
});
