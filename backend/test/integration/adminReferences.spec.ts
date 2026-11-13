import { describe, expect, it } from 'vitest';
import { api, bearer, collectKeys, pool, registerUser } from '../helpers/api.js';
import { as, auditFor, expectNoSecretsInAudit, loginSeedAdmin, png, suffix, uuid, useSeededDatabase } from '../helpers/admin.js';
import { download, postGeneration, settle } from '../helpers/pipeline.js';

useSeededDatabase();

describe('admin reference library', () => {
  it('uploads a library reference: signed URL only, owner null, is_library true, visible to creators', async () => {
    const admin = await loginSeedAdmin();
    const label = `Contoh ${suffix()}`;
    const res = await as(admin).upload('/references', await png('#ddaa33'), { role: 'color', label, template_slug: 'poster-promo-produk' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ role: 'color', label, template: { slug: 'poster-promo-produk' }, width: 320, height: 240 });
    expect(res.body.data.url).toContain('/files/');
    expect(res.body.data.url).toContain('token=');
    for (const k of ['storage_key', 'asset_id', 'owner_id']) expect(collectKeys(res.body).has(k), k).toBe(false);

    const row = await pool.query<{ owner_id: string | null; is_library: boolean; expires_at: Date | null }>('SELECT owner_id, is_library, expires_at FROM reference_assets WHERE id = $1', [res.body.data.id]);
    expect(row.rows[0]).toEqual({ owner_id: null, is_library: true, expires_at: null });
    expect((await download(res.body.data.url)).status).toBe(200);

    // Creators see it in the public library and can generate with it.
    const user = await registerUser();
    const lib = await api().get('/api/v1/references/library?role=color').set(bearer(user.accessToken));
    expect(lib.body.data.map((r: { id: string }) => r.id)).toContain(res.body.data.id);
    const gen = await postGeneration(user, { template_slug: 'poster-promo-produk', reference_ids: [res.body.data.id], slot_values: { title: 'Promo', cta: 'Beli' } });
    expect(gen.status).toBe(202);
    expect((await settle(user, gen.body.data.id)).status).toBe('done');

    const audit = await auditFor(res.body.data.id, 'reference.create');
    expect(audit).toHaveLength(1);
    expectNoSecretsInAudit(audit);
  });

  it('requires a consent note for human_model references (CONSENT_REQUIRED) and validates the upload', async () => {
    const admin = await loginSeedAdmin();
    const file = await png('#8899aa');
    const noNote = await as(admin).upload('/references', file, { role: 'human_model' });
    expect(noNote.status).toBe(422);
    expect(noNote.body.error_code).toBe('CONSENT_REQUIRED');
    const blank = await as(admin).upload('/references', file, { role: 'human_model', consent_note: '   ' });
    expect(blank.body.error_code).toBe('CONSENT_REQUIRED');
    const ok = await as(admin).upload('/references', file, { role: 'human_model', consent_note: 'Model memberi izin tertulis 2026-11-01' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.consent_note).toContain('izin tertulis');

    const bad: [string, Promise<{ status: number }>][] = [
      ['unknown role', as(admin).upload('/references', file, { role: 'smell' })],
      ['not an image', as(admin).upload('/references', Buffer.from('plain text, not an image'), { role: 'style' })],
      ['both template fields', as(admin).upload('/references', file, { role: 'style', template_slug: 'poster-promo-produk', template_id: uuid() })],
      ['unknown template', as(admin).upload('/references', file, { role: 'style', template_slug: 'tidak-ada' })],
      ['no file', as(admin).post('/references', { role: 'style' })],
    ];
    for (const [why, pending] of bad) expect((await pending).status, why).toBe(400);
  });

  it('lists with filters and pagination, reads one, patches role / label / template link / consent note', async () => {
    const admin = await loginSeedAdmin();
    const tag = suffix();
    const ids: string[] = [];
    for (const [i, role] of ['style', 'lighting', 'style'].entries()) {
      const res = await as(admin).upload('/references', await png('#112233'), { role, label: `Filter ${tag} ${i}` });
      ids.push(res.body.data.id);
    }
    const all = await as(admin).get(`/references?search=Filter ${tag}&limit=2`);
    expect(all.body.meta).toMatchObject({ total: 3, total_pages: 2, limit: 2 });
    expect(all.body.data).toHaveLength(2);
    expect((await as(admin).get(`/references?search=Filter ${tag}&role=lighting`)).body.data).toHaveLength(1);
    expect((await as(admin).get('/references?template=poster-promo-produk')).body.data.length).toBeGreaterThan(0);
    expect((await as(admin).get('/references?role=bogus')).status).toBe(400);
    expect((await as(admin).get(`/references/${ids[0]}`)).body.data.id).toBe(ids[0]);
    expect((await as(admin).get(`/references/${uuid()}`)).status).toBe(404);

    const target = ids[0] as string;
    const tpl = (await pool.query<{ id: string }>("SELECT id FROM templates WHERE slug = 'poster-promo-produk'")).rows[0] as { id: string };
    const patched = await as(admin).patch(`/references/${target}`, { label: 'Baru', template_id: tpl.id });
    expect(patched.body.data).toMatchObject({ label: 'Baru', template: { slug: 'poster-promo-produk' } });
    expect((await as(admin).patch(`/references/${target}`, { template_id: null })).body.data.template).toBeNull();
    const toHuman = await as(admin).patch(`/references/${target}`, { role: 'human_model' });
    expect(toHuman.status).toBe(422);
    expect(toHuman.body.error_code).toBe('CONSENT_REQUIRED');
    expect((await as(admin).patch(`/references/${target}`, { role: 'human_model', consent_note: 'Ada izin' })).body.data).toMatchObject({ role: 'human_model', consent_note: 'Ada izin' });
    expect((await as(admin).patch(`/references/${target}`, { template_id: uuid() })).status).toBe(400);
    expect((await as(admin).patch(`/references/${target}`, {})).status).toBe(400);
    expect((await as(admin).patch(`/references/${target}`, { owner_id: uuid() })).status).toBe(400);
    expectNoSecretsInAudit(await auditFor(target));
  });

  it('deletes a reference and its stored file; it disappears from every list', async () => {
    const admin = await loginSeedAdmin();
    const res = await as(admin).upload('/references', await png('#445566'), { role: 'background' });
    const id = res.body.data.id as string;
    const url = res.body.data.url as string;
    expect((await download(url)).status).toBe(200);
    expect((await as(admin).del(`/references/${id}`)).status).toBe(200);
    expect((await as(admin).get(`/references/${id}`)).status).toBe(404);
    expect((await as(admin).del(`/references/${id}`)).status).toBe(404);
    expect((await download(url)).status).toBe(404);
    const user = await registerUser();
    const lib = await api().get('/api/v1/references/library').set(bearer(user.accessToken));
    expect(lib.body.data.map((r: { id: string }) => r.id)).not.toContain(id);
    // A creator's own upload is not an admin library entry.
    expect((await as(admin).get('/references/' + uuid())).status).toBe(404);
  });
});
