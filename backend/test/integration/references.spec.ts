import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { api, bearer, collectKeys, pool, registerUser, useDatabase } from '../helpers/api.js';
import { createReferenceId, download, solidImage, uploadReference } from '../helpers/pipeline.js';

useDatabase();

describe('POST /references', () => {
  it('uploads an image, stores a sanitised copy and answers with a signed URL, never a storage key', async () => {
    const user = await registerUser();
    const withExif = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#aa5500' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Copyright: 'private-owner-name' } })
      .toBuffer();
    const res = await uploadReference(user, { role: 'product', label: 'Kemasan' }, { buffer: withExif, filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    const ref = res.body.data;
    expect(ref).toMatchObject({ role: 'product', label: 'Kemasan', expires_at: null });
    expect([ref.width, ref.height]).toEqual([200, 300]); // EXIF orientation applied
    expect(collectKeys(res.body)).not.toContain('storage_key');
    // The storage path only appears inside the signed url itself.
    expect(JSON.stringify({ ...ref, url: null })).not.toContain('refs/');
    expect(ref.url).toMatch(/\/api\/v1\/files\/refs\/\d{4}-\d{2}\/[0-9a-f-]+\.jpg\?token=\d+\./);

    const file = await download(ref.url);
    expect(file.status).toBe(200);
    expect(file.type).toBe('image/jpeg');
    const meta = await sharp(file.body).metadata();
    expect(meta.exif).toBeUndefined();
    expect(file.body.includes(Buffer.from('private-owner-name'))).toBe(false);
  });

  it('requires authentication', async () => {
    const res = await api().post('/api/v1/references').field('role', 'product').attach('file', await solidImage('#fff'), 'a.png');
    expect(res.status).toBe(401);
  });

  it('rejects an unknown role, a missing file and non-image content with VALIDATION_ERROR', async () => {
    const user = await registerUser();
    const badRole = await uploadReference(user, { role: 'logo' });
    expect(badRole.status).toBe(400);
    expect(badRole.body.error_code).toBe('VALIDATION_ERROR');

    const noFile = await api().post('/api/v1/references').set(bearer(user.accessToken)).field('role', 'product');
    expect(noFile.status).toBe(400);
    expect(noFile.body.error_code).toBe('VALIDATION_ERROR');

    const text = await uploadReference(user, { role: 'product' }, { buffer: Buffer.from('hello, not an image'), filename: 'evil.png', contentType: 'image/png' });
    expect(text.status).toBe(400);
    const svg = await uploadReference(user, { role: 'product' }, { buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'), filename: 'a.png', contentType: 'image/png' });
    expect(svg.status).toBe(400);
    const gif = await uploadReference(user, { role: 'product' }, { buffer: Buffer.from('GIF89a\u0001\u0000\u0001\u0000\u0000\u0000\u0000;'), filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(gif.status).toBe(400);
  });

  it('rejects files over 8 MB', async () => {
    const user = await registerUser();
    const res = await uploadReference(user, { role: 'product' }, { buffer: Buffer.alloc(8 * 1024 * 1024 + 1024, 0xff), filename: 'big.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('VALIDATION_ERROR');
  });

  it('requires consent for human_model photos (CONSENT_REQUIRED) and expires them after 7 days', async () => {
    const user = await registerUser();
    const without = await uploadReference(user, { role: 'human_model' });
    expect(without.status).toBe(422);
    expect(without.body.error_code).toBe('CONSENT_REQUIRED');
    const explicitFalse = await uploadReference(user, { role: 'human_model', consent_confirmed: false });
    expect(explicitFalse.body.error_code).toBe('CONSENT_REQUIRED');

    const ok = await uploadReference(user, { role: 'human_model', consent_confirmed: true, consent_note: 'Ibu Sari setuju difoto' });
    expect(ok.status).toBe(201);
    const days = (new Date(ok.body.data.expires_at).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
    const row = (await pool.query<{ owner_id: string; consent_note: string }>('SELECT owner_id, consent_note FROM reference_assets WHERE id = $1', [ok.body.data.id])).rows[0];
    expect(row?.owner_id).toBe(user.id);
    expect(row?.consent_note).toBe('Ibu Sari setuju difoto');
    expect(JSON.stringify(ok.body)).not.toContain('Ibu Sari');
  });

  it('applies a per-user cap on stored references', async () => {
    const user = await registerUser();
    const id = await createReferenceId(user, 'color');
    expect(id).toBeTruthy();
    await pool.query(
      `INSERT INTO reference_assets (owner_id, role, asset_id)
       SELECT $1, 'color', r.asset_id FROM reference_assets r CROSS JOIN generate_series(1, $3::int) WHERE r.id = $2`,
      [user.id, id, env.MAX_REFERENCES_PER_USER],
    );
    const res = await uploadReference(user, { role: 'color' });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('TOO_MANY_REFERENCES');
  });
});

describe('GET /references/mine, DELETE /references/:id', () => {
  it('lists only the caller\'s own references, newest first, paginated', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const a1 = await createReferenceId(a, 'color');
    const a2 = await createReferenceId(a, 'lighting');
    await createReferenceId(b, 'product');

    const mine = await api().get('/api/v1/references/mine').set(bearer(a.accessToken));
    expect(mine.status).toBe(200);
    expect(mine.body.data.map((r: { id: string }) => r.id)).toEqual([a2, a1]);
    expect(mine.body.meta).toMatchObject({ page: 1, total: 2 });
    expect(collectKeys(mine.body)).not.toContain('storage_key');

    const filtered = await api().get('/api/v1/references/mine?role=color').set(bearer(a.accessToken));
    expect(filtered.body.data.map((r: { id: string }) => r.id)).toEqual([a1]);
    expect((await api().get('/api/v1/references/mine?role=bogus').set(bearer(a.accessToken))).status).toBe(400);
  });

  it('hides expired human-model references from the list', async () => {
    const user = await registerUser();
    const id = (await uploadReference(user, { role: 'human_model', consent_confirmed: true })).body.data.id as string;
    await pool.query("UPDATE reference_assets SET expires_at = now() - interval '1 minute' WHERE id = $1", [id]);
    const mine = await api().get('/api/v1/references/mine').set(bearer(user.accessToken));
    expect(mine.body.data).toEqual([]);
  });

  it('lets only the owner delete (404 for others and for library items) and removes the file', async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const id = await createReferenceId(owner, 'product');
    const url = ((await api().get('/api/v1/references/mine').set(bearer(owner.accessToken))).body.data[0] as { url: string }).url;
    expect((await download(url)).status).toBe(200);

    expect((await api().delete(`/api/v1/references/${id}`).set(bearer(other.accessToken))).status).toBe(404);
    const lib = (await pool.query<{ id: string }>('SELECT id FROM reference_assets WHERE is_library LIMIT 1')).rows[0];
    expect((await api().delete(`/api/v1/references/${lib?.id}`).set(bearer(owner.accessToken))).status).toBe(404);
    expect((await api().delete('/api/v1/references/not-a-uuid').set(bearer(owner.accessToken))).status).toBe(400);

    const del = await api().delete(`/api/v1/references/${id}`).set(bearer(owner.accessToken));
    expect(del.status).toBe(200);
    expect((await download(url)).status).toBe(404);
    expect((await api().get('/api/v1/references/mine').set(bearer(owner.accessToken))).body.data).toEqual([]);
    expect((await api().delete(`/api/v1/references/${id}`).set(bearer(owner.accessToken))).status).toBe(404);
    const asset = (await pool.query<{ deleted_at: Date | null; file_deleted_at: Date | null }>(
      'SELECT a.deleted_at, a.file_deleted_at FROM reference_assets r JOIN assets a ON a.id = r.asset_id WHERE r.id = $1',
      [id],
    )).rows[0];
    expect(asset?.deleted_at).not.toBeNull();
    expect(asset?.file_deleted_at).not.toBeNull();
  });
});

describe('GET /references/library', () => {
  it('lists admin-curated references with signed URLs only', async () => {
    const user = await registerUser();
    const res = await api().get('/api/v1/references/library').set(bearer(user.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const item of res.body.data) {
      expect(item.url).toMatch(/token=/);
      expect(item.role).toBeTruthy();
    }
    const keys = collectKeys(res.body);
    for (const forbidden of ['storage_key', 'owner_id', 'consent_note', 'asset_id', 'is_library']) expect(keys).not.toContain(forbidden);
    expect(JSON.stringify(res.body.data.map((i: Record<string, unknown>) => ({ ...i, url: null })))).not.toMatch(/seed\/|\.jpg/);

    const filtered = await api().get('/api/v1/references/library?role=lighting').set(bearer(user.accessToken));
    expect(filtered.body.data).toEqual([]);
    expect((await api().get('/api/v1/references/library')).status).toBe(401);
  });

  it('does not list user uploads', async () => {
    const user = await registerUser();
    const id = await createReferenceId(user, 'product');
    const lib = await api().get('/api/v1/references/library').set(bearer(user.accessToken));
    expect(lib.body.data.map((r: { id: string }) => r.id)).not.toContain(id);
  });
});

describe('GET /files/*', () => {
  it('serves only with a valid, unexpired token bound to that exact key', async () => {
    const user = await registerUser();
    await createReferenceId(user, 'product');
    const { url } = (await api().get('/api/v1/references/mine').set(bearer(user.accessToken))).body.data[0] as { url: string };
    const u = new URL(url);

    expect((await api().get(u.pathname)).status).toBe(401);
    expect((await api().get(`${u.pathname}?token=garbage`)).status).toBe(401);
    expect((await api().get(`${u.pathname}?token=${Date.now() + 100000}.AAAA`)).status).toBe(401);
    const expired = `${Math.floor(Date.now() / 1000) - 10}.${u.searchParams.get('token')!.split('.')[1]}`;
    expect((await api().get(`${u.pathname}?token=${expired}`)).status).toBe(401);
    // A token issued for another key does not unlock this one.
    const otherUser = await registerUser();
    await createReferenceId(otherUser, 'product');
    const otherUrl = new URL(((await api().get('/api/v1/references/mine').set(bearer(otherUser.accessToken))).body.data[0] as { url: string }).url);
    expect((await api().get(`${u.pathname}?token=${otherUrl.searchParams.get('token')}`)).status).toBe(401);

    const ok = await api().get(`${u.pathname}${u.search}`);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toBe('image/png');
    expect(String(ok.headers['cache-control'])).toContain('private');
  });

  it('refuses path traversal and unknown keys', async () => {
    expect((await api().get('/api/v1/files/..%2F..%2F.env?token=1.x')).status).toBeGreaterThanOrEqual(400);
    expect((await api().get('/api/v1/files/refs/2026-01/nope.png?token=1.x')).status).toBe(401);
    expect((await api().get('/api/v1/files/')).status).toBe(404);
  });
});
