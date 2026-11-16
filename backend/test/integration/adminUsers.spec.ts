import { describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { updateUser } from '../../src/modules/admin/users/service.js';
import { api, bearer, collectKeys, login, pool, PASSWORD, refreshCookieOf, registerUser, uniqueEmail } from '../helpers/api.js';
import { as, auditFor, createAdminSession, expectNoSecretsInAudit, loginSeedAdmin, uuid, useSeededDatabase } from '../helpers/admin.js';

useSeededDatabase();

/** Runs `fn` while every active admin except `keep` is deactivated; restores them afterwards. */
async function withOnlyAdmins<T>(keep: string[], fn: () => Promise<T>): Promise<T> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE role = 'admin' AND is_active AND deleted_at IS NULL AND NOT (id = ANY($1::uuid[]))`,
    [keep],
  );
  const ids = rows.map((r) => r.id);
  await pool.query('UPDATE users SET is_active = false WHERE id = ANY($1::uuid[])', [ids]);
  try {
    return await fn();
  } finally {
    await pool.query('UPDATE users SET is_active = true WHERE id = ANY($1::uuid[])', [ids]);
  }
}

describe('admin users', () => {
  it('lists with search, role and active filters, paginates, and never exposes hashes', async () => {
    const admin = await loginSeedAdmin();
    const marker = `zq${Date.now().toString(36)}`;
    for (let i = 0; i < 3; i++) {
      expect((await as(admin).post('/users', { email: `${marker}${i}@test.local`, name: `Findable ${marker} ${i}`, password: PASSWORD })).status).toBe(201);
    }
    const res = await as(admin).get(`/users?search=${marker}&limit=2&page=1`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, total_pages: 2 });
    const keys = collectKeys(res.body);
    for (const forbidden of ['password_hash', 'token_hash', 'password', 'sessions_valid_after', 'deleted_at']) expect(keys.has(forbidden)).toBe(false);

    const page2 = await as(admin).get(`/users?search=${marker}&limit=2&page=2`);
    expect(page2.body.data).toHaveLength(1);
    expect((await as(admin).get(`/users?search=${marker}&role=admin`)).body.data).toHaveLength(0);
    expect((await as(admin).get(`/users?search=${marker}&active=false`)).body.data).toHaveLength(0);
    // LIKE wildcards in the search term are escaped, not interpreted.
    expect((await as(admin).get('/users?search=%25')).body.data).toHaveLength(0);
    expect((await as(admin).get('/users?role=owner')).status).toBe(400);
    expect((await as(admin).get('/users?limit=500')).status).toBe(400);
  });

  it('creates creators and admins, generates a temporary password once, and rejects duplicates and bad input', async () => {
    const admin = await loginSeedAdmin();
    const email = uniqueEmail('gen');
    const created = await as(admin).post('/users', { email, name: 'Generated Pass', role: 'admin' });
    expect(created.status).toBe(201);
    const temp = created.body.data.temporary_password as string;
    expect(temp.length).toBeGreaterThanOrEqual(12);
    expect(created.body.data.user).toMatchObject({ email, role: 'admin', is_active: true });
    expect(collectKeys(created.body).has('password_hash')).toBe(false);

    // The temporary password works, and is stored hashed.
    const session = await login(email, temp);
    expect((await as(session).get('/ping')).status).toBe(200);
    const stored = await pool.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [created.body.data.user.id]);
    expect(stored.rows[0]?.password_hash).not.toContain(temp);

    // GET never shows it again; a given password is never echoed.
    expect(JSON.stringify((await as(admin).get(`/users/${created.body.data.user.id}`)).body)).not.toContain(temp);
    const given = await as(admin).post('/users', { email: uniqueEmail('given'), name: 'Given Pass', password: PASSWORD });
    expect(given.status).toBe(201);
    expect(given.body.data.temporary_password).toBeUndefined();
    expect(given.body.data.user.role).toBe('creator');

    const dup = await as(admin).post('/users', { email: email.toUpperCase(), name: 'Dup', password: PASSWORD });
    expect(dup.status).toBe(409);
    expect(dup.body.error_code).toBe('EMAIL_EXISTS');
    for (const bad of [
      { email: 'nope', name: 'Bad Email' },
      { email: uniqueEmail(), name: 'x' },
      { email: uniqueEmail(), name: 'Bad Role', role: 'superuser' },
      { email: uniqueEmail(), name: 'Short Pw', password: 'short' },
      { email: uniqueEmail(), name: 'Extra Key', is_active: false },
    ]) {
      const res = await as(admin).post('/users', bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
      expect(res.body.error_code).toBe('VALIDATION_ERROR');
    }

    const audit = await auditFor(created.body.data.user.id, 'user.create');
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor_id: admin.id, entity: 'user' });
    expect(audit[0]?.ip).toBeTruthy();
    expectNoSecretsInAudit(audit, [temp]);
  });

  it('gets one user with usage, 404s unknown and malformed ids', async () => {
    const admin = await loginSeedAdmin();
    const creator = await registerUser();
    const res = await as(admin).get(`/users/${creator.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: creator.id, role: 'creator', usage: { used_today: 0 } });
    expect((await as(admin).get(`/users/${uuid()}`)).status).toBe(404);
    expect((await as(admin).get('/users/not-a-uuid')).status).toBe(400);
  });

  it('updates name, role, active flag and daily limit; validates input; audits changes', async () => {
    const admin = await loginSeedAdmin();
    const target = await registerUser();
    const res = await as(admin).patch(`/users/${target.id}`, { name: 'Renamed User', daily_limit_override: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Renamed User', daily_limit_override: 3, role: 'creator' });
    const cleared = await as(admin).patch(`/users/${target.id}`, { daily_limit_override: null });
    expect(cleared.body.data.daily_limit_override).toBeNull();
    expect((await as(admin).patch(`/users/${target.id}`, { role: 'admin' })).body.data.role).toBe('admin');

    for (const bad of [{}, { role: 'root' }, { daily_limit_override: -1 }, { password: 'Newpass-123' }, { name: 'x' }]) {
      expect((await as(admin).patch(`/users/${target.id}`, bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await as(admin).patch(`/users/${uuid()}`, { name: 'Ghost User' })).status).toBe(404);

    const audit = await auditFor(target.id, 'user.update');
    expect(audit.length).toBe(3);
    expect(audit[0]?.diff).toMatchObject({ changed: { name: { from: 'Test User', to: 'Renamed User' }, daily_limit_override: { from: null, to: 3 } } });
    expectNoSecretsInAudit(audit);
  });

  it('deactivation takes effect immediately, even through the auth cache, and blocks login and refresh', async () => {
    const admin = await loginSeedAdmin();
    const victim = await createAdminSession(admin, 'creator');
    const previousTtl = env.AUTH_USER_CACHE_TTL_MS;
    env.AUTH_USER_CACHE_TTL_MS = 60_000;
    try {
      expect((await api().get('/api/v1/me').set(bearer(victim.accessToken))).status).toBe(200); // primes the cache
      expect((await as(admin).patch(`/users/${victim.id}`, { is_active: false })).status).toBe(200);
      const after = await api().get('/api/v1/me').set(bearer(victim.accessToken));
      expect(after.status).toBe(403);
      expect(after.body.error_code).toBe('ACCOUNT_INACTIVE');
    } finally {
      env.AUTH_USER_CACHE_TTL_MS = previousTtl;
    }
    const relogin = await api().post('/api/v1/auth/login').send({ email: victim.email, password: victim.password });
    expect(relogin.status).toBe(403);
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', `refresh_token=${victim.refreshCookie}`)).status).toBeGreaterThanOrEqual(401);

    // Re-activation restores access.
    expect((await as(admin).patch(`/users/${victim.id}`, { is_active: true })).status).toBe(200);
    expect((await login(victim.email, victim.password)).accessToken).toBeTruthy();
  });

  it('an admin cannot deactivate, demote or delete themselves, or reset their own password (CANNOT_MODIFY_SELF)', async () => {
    const admin = await createAdminSession();
    for (const attempt of [
      as(admin).patch(`/users/${admin.id}`, { is_active: false }),
      as(admin).patch(`/users/${admin.id}`, { role: 'creator' }),
      as(admin).del(`/users/${admin.id}`),
      as(admin).post(`/users/${admin.id}/reset-password`),
    ]) {
      const res = await attempt;
      expect(res.status).toBe(409);
      expect(res.body.error_code).toBe('CANNOT_MODIFY_SELF');
    }
    // Harmless self edits still work.
    expect((await as(admin).patch(`/users/${admin.id}`, { name: 'Still Me' })).status).toBe(200);
    expect((await as(admin).patch(`/users/${admin.id}`, { role: 'admin', is_active: true })).status).toBe(200);
    const row = await pool.query<{ role: string; is_active: boolean; deleted_at: Date | null }>('SELECT role, is_active, deleted_at FROM users WHERE id = $1', [admin.id]);
    expect(row.rows[0]).toMatchObject({ role: 'admin', is_active: true, deleted_at: null });
  });

  it('the last active admin can never be deactivated, demoted or deleted (LAST_ADMIN) and the response warns', async () => {
    const lonely = await createAdminSession();
    const other = await createAdminSession();
    await withOnlyAdmins([lonely.id], async () => {
      // `other` is not active any more (it was deactivated by the helper); act as a ghost actor, as in a race.
      const ghost = { actorId: uuid(), ip: null };
      for (const patch of [{ is_active: false }, { role: 'creator' as const }]) {
        await expect(updateUser(ghost, lonely.id, patch)).rejects.toMatchObject({ code: 'LAST_ADMIN', status: 409 });
      }
      const { deleteUser } = await import('../../src/modules/admin/users/service.js');
      await expect(deleteUser(ghost, lonely.id)).rejects.toMatchObject({ code: 'LAST_ADMIN' });
      const still = await pool.query<{ is_active: boolean; role: string; deleted_at: Date | null }>('SELECT is_active, role, deleted_at FROM users WHERE id = $1', [lonely.id]);
      expect(still.rows[0]).toMatchObject({ is_active: true, role: 'admin', deleted_at: null });

      const list = await as(lonely).get('/users?limit=1');
      expect(list.body.meta.active_admins).toBe(1);
      expect(list.body.meta.warnings[0]).toContain('1 admin aktif');
    });
    expect(other.id).toBeTruthy();
  });

  it('two admins demoting each other concurrently cannot leave the system without an admin', async () => {
    const a = await createAdminSession();
    const b = await createAdminSession();
    await withOnlyAdmins([a.id, b.id], async () => {
      const [r1, r2] = await Promise.all([
        as(a).patch(`/users/${b.id}`, { role: 'creator' }),
        as(b).patch(`/users/${a.id}`, { role: 'creator' }),
      ]);
      // The loser is refused either by the last-admin guard or, if the winner committed first, by the role check.
      expect([r1.status, r2.status].filter((s) => s === 200)).toHaveLength(1);
      const failed = r1.status === 200 ? r2 : r1;
      expect([403, 409]).toContain(failed.status);
      if (failed.status === 409) expect(failed.body.error_code).toBe('LAST_ADMIN');
      const { rows } = await pool.query<{ n: number }>(`SELECT count(*) AS n FROM users WHERE id = ANY($1::uuid[]) AND role = 'admin' AND is_active`, [[a.id, b.id]]);
      expect(rows[0]?.n).toBe(1);
    });
    await pool.query("UPDATE users SET role = 'admin' WHERE id = ANY($1::uuid[])", [[a.id, b.id]]);
  });

  it('reset-password returns a temporary password once, revokes sessions and kills old tokens at once', async () => {
    const admin = await loginSeedAdmin();
    const victim = await registerUser();
    expect((await api().get('/api/v1/me').set(bearer(victim.accessToken))).status).toBe(200);

    const res = await as(admin).post(`/users/${victim.id}/reset-password`);
    expect(res.status).toBe(200);
    const temp = res.body.data.temporary_password as string;
    expect(temp.length).toBeGreaterThanOrEqual(12);
    expect(collectKeys(res.body).has('password_hash')).toBe(false);

    // Old access token and refresh cookie are dead; old password no longer works; the new one does.
    expect((await api().get('/api/v1/me').set(bearer(victim.accessToken))).status).toBe(401);
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', `refresh_token=${victim.refreshCookie}`)).status).toBe(401);
    expect((await api().post('/api/v1/auth/login').send({ email: victim.email, password: victim.password })).status).toBe(401);
    const fresh = await login(victim.email, temp);
    expect((await api().get('/api/v1/me').set(bearer(fresh.accessToken))).status).toBe(200);

    const stored = await pool.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [victim.id]);
    expect(stored.rows[0]?.password_hash.startsWith('$2')).toBe(true);
    const audit = await auditFor(victim.id, 'user.reset_password');
    expect(audit).toHaveLength(1);
    expectNoSecretsInAudit(audit, [temp]);
    expect((await as(admin).post(`/users/${uuid()}/reset-password`)).status).toBe(404);
  });

  it('revoke-sessions logs the user out everywhere but keeps the account usable', async () => {
    const admin = await loginSeedAdmin();
    const user = await registerUser();
    const res = await as(admin).post(`/users/${user.id}/revoke-sessions`);
    expect(res.status).toBe(200);
    expect(res.body.data.revoked_sessions).toBeGreaterThanOrEqual(1);
    expect((await api().get('/api/v1/me').set(bearer(user.accessToken))).status).toBe(401);
    const refresh = await api().post('/api/v1/auth/refresh').set('Cookie', `refresh_token=${user.refreshCookie}`);
    expect(refresh.status).toBe(401);
    expect(refreshCookieOf(refresh) ?? '').toBe('');
    const again = await login(user.email, user.password);
    expect((await api().get('/api/v1/me').set(bearer(again.accessToken))).status).toBe(200);
    expectNoSecretsInAudit(await auditFor(user.id, 'user.revoke_sessions'));
  });

  it('soft delete anonymises the account, frees the email, and refuses the last admin', async () => {
    const admin = await loginSeedAdmin();
    const victim = await registerUser();
    const res = await as(admin).del(`/users/${victim.id}`);
    expect(res.status).toBe(200);
    expect((await as(admin).get(`/users/${victim.id}`)).status).toBe(404);
    expect((await api().get('/api/v1/me').set(bearer(victim.accessToken))).status).toBe(401);
    expect((await api().post('/api/v1/auth/login').send({ email: victim.email, password: victim.password })).status).toBe(401);
    const row = await pool.query<{ email: string; deleted_at: Date | null; is_active: boolean }>('SELECT email, deleted_at, is_active FROM users WHERE id = $1', [victim.id]);
    expect(row.rows[0]?.email).toContain('@deleted.invalid');
    expect(row.rows[0]?.deleted_at).not.toBeNull();
    // The address can be registered again.
    expect((await registerUser({ email: victim.email })).id).not.toBe(victim.id);
    const audit = await auditFor(victim.id, 'user.delete');
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit[0]?.diff)).not.toContain(victim.email);
  });
});
