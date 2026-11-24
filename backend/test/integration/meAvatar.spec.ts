import { describe, expect, it } from 'vitest';
import { api, bearer, pool, registerUser, useDatabase, type TestSession } from '../helpers/api.js';
import { download, solidImage } from '../helpers/pipeline.js';

useDatabase();

const putAvatar = (session: TestSession, buffer: Buffer, contentType = 'image/png', field = 'avatar') =>
  api()
    .put('/api/v1/me/avatar')
    .set(bearer(session.accessToken))
    .attach(field, buffer, { filename: 'avatar.png', contentType });

const avatarAssetId = async (userId: string): Promise<string | null> => {
  const { rows } = await pool.query<{ avatar_asset_id: string | null }>('SELECT avatar_asset_id FROM users WHERE id = $1', [userId]);
  return rows[0]?.avatar_asset_id ?? null;
};

const assetRow = async (id: string) => {
  const { rows } = await pool.query<{ kind: string; owner_id: string; deleted_at: Date | null; file_deleted_at: Date | null }>(
    'SELECT kind, owner_id, deleted_at, file_deleted_at FROM assets WHERE id = $1',
    [id],
  );
  return rows[0];
};

describe('PUT /me/avatar', () => {
  it('requires authentication', async () => {
    const res = await api().put('/api/v1/me/avatar').attach('avatar', await solidImage('#123456'), 'a.png');
    expect(res.status).toBe(401);
  });

  it('stores the photo and GET /me returns a signed avatar_url', async () => {
    const user = await registerUser({ name: 'Punya Foto' });
    const fresh = await api().get('/api/v1/me').set(bearer(user.accessToken));
    expect(fresh.body.data.user.avatar_url).toBeNull();

    const res = await putAvatar(user, await solidImage('#3366cc'));
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: user.id, name: 'Punya Foto' });
    expect(res.body.data.user.avatar_url).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toMatch(/storage_key|avatar_asset_id|password/);

    const assetId = await avatarAssetId(user.id);
    expect(assetId).not.toBeNull();
    expect(await assetRow(assetId!)).toMatchObject({ kind: 'avatar', owner_id: user.id, deleted_at: null });

    const me = await api().get('/api/v1/me').set(bearer(user.accessToken));
    expect(me.body.data.user.avatar_url).toEqual(expect.any(String));
    const file = await download(me.body.data.user.avatar_url);
    expect(file.status).toBe(200);
    expect(file.type).toMatch(/image\/png/);
  });

  it('replacing the photo soft-deletes the previous asset and removes its file', async () => {
    const user = await registerUser();
    const first = await putAvatar(user, await solidImage('#aa0000'));
    const firstId = await avatarAssetId(user.id);

    const second = await putAvatar(user, await solidImage('#00aa00', 200, 200, 'jpeg'), 'image/jpeg');
    expect(second.status).toBe(200);
    const secondId = await avatarAssetId(user.id);
    expect(secondId).not.toBe(firstId);
    expect(second.body.data.user.avatar_url).not.toBe(first.body.data.user.avatar_url);

    const old = await assetRow(firstId!);
    expect(old?.deleted_at).not.toBeNull();
    expect(old?.file_deleted_at).not.toBeNull();
    expect((await download(first.body.data.user.avatar_url)).status).toBe(404);
    expect((await assetRow(secondId!))?.deleted_at).toBeNull();
  });

  it('rejects a file that is not an image and keeps the current photo', async () => {
    const user = await registerUser();
    await putAvatar(user, await solidImage('#999999'));
    const before = await avatarAssetId(user.id);

    const res = await putAvatar(user, Buffer.from('bukan gambar, hanya teks biasa'), 'image/png');
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('VALIDATION_ERROR');
    expect(await avatarAssetId(user.id)).toBe(before);
    const { rows } = await pool.query('SELECT id FROM assets WHERE owner_id = $1 AND kind = $2', [user.id, 'avatar']);
    expect(rows).toHaveLength(1);
  });

  it('rejects files larger than 5 MB', async () => {
    const user = await registerUser();
    const big = Buffer.alloc(5 * 1024 * 1024 + 1, 0);
    const res = await putAvatar(user, big);
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('Ukuran file maksimal 5 MB');
    expect(await avatarAssetId(user.id)).toBeNull();
  });

  it('requires the file on the "avatar" field', async () => {
    const user = await registerUser();
    const res = await putAvatar(user, await solidImage('#abcdef'), 'image/png', 'file');
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('VALIDATION_ERROR');
    expect(await avatarAssetId(user.id)).toBeNull();
  });
});

describe('DELETE /me/avatar', () => {
  it('clears the column and soft-deletes the asset', async () => {
    const user = await registerUser();
    await putAvatar(user, await solidImage('#445566'));
    const assetId = await avatarAssetId(user.id);

    const res = await api().delete('/api/v1/me/avatar').set(bearer(user.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: user.id, avatar_url: null });
    expect(await avatarAssetId(user.id)).toBeNull();
    expect((await assetRow(assetId!))?.deleted_at).not.toBeNull();

    const me = await api().get('/api/v1/me').set(bearer(user.accessToken));
    expect(me.body.data.user.avatar_url).toBeNull();
  });

  it('succeeds when there is no photo', async () => {
    const user = await registerUser();
    const res = await api().delete('/api/v1/me/avatar').set(bearer(user.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.user.avatar_url).toBeNull();
  });

  it("never touches another user's photo", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    await putAvatar(owner, await solidImage('#112233'));
    const ownerAsset = await avatarAssetId(owner.id);

    await putAvatar(other, await solidImage('#332211'));
    await putAvatar(other, await solidImage('#221133'));
    await api().delete('/api/v1/me/avatar').set(bearer(other.accessToken));

    expect(await avatarAssetId(owner.id)).toBe(ownerAsset);
    expect((await assetRow(ownerAsset!))?.deleted_at).toBeNull();
    const me = await api().get('/api/v1/me').set(bearer(owner.accessToken));
    expect((await download(me.body.data.user.avatar_url)).status).toBe(200);
  });
});
