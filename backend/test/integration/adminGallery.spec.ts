import { describe, expect, it } from 'vitest';
import { SEED_CORE_PROMPTS } from '../../src/seed/data/corePrompts.js';
import { api, pool, registerUser } from '../helpers/api.js';
import { as, auditFor, expectNoSecretsInAudit, loginSeedAdmin, png, suffix, uuid, useSeededDatabase } from '../helpers/admin.js';
import { download, postGeneration, settle } from '../helpers/pipeline.js';

useSeededDatabase();

const publicIds = async (): Promise<string[]> => ((await api().get('/api/v1/gallery?limit=50')).body.data as { id: string }[]).map((g) => g.id);

describe('admin gallery curation', () => {
  it('lists every item including hidden ones, with filters and pagination', async () => {
    const admin = await loginSeedAdmin();
    const seededCount = (await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM gallery_items')).rows[0]?.n as number;
    const all = await as(admin).get('/gallery?limit=100');
    expect(all.status).toBe(200);
    expect(all.body.meta.total).toBe(seededCount);
    expect(all.body.data[0]).toMatchObject({ image_url: expect.stringContaining('/files/'), is_hidden: false });

    const target = all.body.data[0].id as string;
    expect((await as(admin).patch(`/gallery/${target}`, { is_hidden: true })).status).toBe(200);
    expect((await as(admin).get('/gallery?hidden=true')).body.data.map((g: { id: string }) => g.id)).toContain(target);
    expect((await as(admin).get('/gallery?hidden=false&limit=100')).body.data.map((g: { id: string }) => g.id)).not.toContain(target);
    expect(await publicIds()).not.toContain(target);
    await as(admin).patch(`/gallery/${target}`, { is_hidden: false });
    expect(await publicIds()).toContain(target);

    expect((await as(admin).get('/gallery?featured=true')).body.data.every((g: { is_featured: boolean }) => g.is_featured)).toBe(true);
    expect((await as(admin).get('/gallery?limit=2&page=2')).body.meta).toMatchObject({ page: 2, limit: 2 });
    expect((await as(admin).get('/gallery?template=tidak-ada')).body.data).toHaveLength(0);
    expect((await as(admin).get('/gallery?limit=500')).status).toBe(400);
  });

  it('creates an item from a finished generation: the display prompt comes from slot values and remarks only', async () => {
    const admin = await loginSeedAdmin();
    const user = await registerUser();
    const created = await postGeneration(user, {
      template_slug: 'poster-kegiatan-organisasi',
      slot_values: { title: 'Bazar Ramadan', date_venue: 'Balai Desa' },
      remarks: 'suasana hangat dan ramah',
    });
    const state = await settle(user, created.body.data.id);
    expect(state.status).toBe('done');

    const res = await as(admin).post('/gallery', { generation_id: created.body.data.id, title: `Poster promo ${suffix()}`, is_featured: true });
    expect(res.status).toBe(201);
    const item = res.body.data;
    expect(item).toMatchObject({ is_featured: true, is_hidden: false, generation_id: created.body.data.id, template: { slug: 'poster-kegiatan-organisasi' } });
    expect(item.display_prompt).toContain('Bazar Ramadan');
    expect(item.display_prompt).toContain('Catatan: suasana hangat dan ramah');
    expect(item.display_prompt).not.toMatch(/\[___\]|\{\{/);
    for (const core of SEED_CORE_PROMPTS) expect(item.display_prompt).not.toContain(core.body.slice(0, 30));

    // The gallery owns a copy: it differs from the creator's file and survives the creator deleting theirs.
    const own = (await pool.query<{ storage_key: string }>('SELECT a.storage_key FROM gallery_items g JOIN assets a ON a.id = g.image_asset_id WHERE g.id = $1', [item.id])).rows[0];
    const theirs = (await pool.query<{ storage_key: string }>('SELECT a.storage_key FROM generations g JOIN assets a ON a.id = g.result_asset_id WHERE g.id = $1', [created.body.data.id])).rows[0];
    expect(own?.storage_key).not.toBe(theirs?.storage_key);
    expect((await download(item.image_url)).status).toBe(200);
    expect(await publicIds()).toContain(item.id);
    const pub = (await api().get('/api/v1/gallery?limit=50')).body.data.find((g: { id: string }) => g.id === item.id);
    expect(pub.display_prompt).toBe(item.display_prompt);
    await api().delete(`/api/v1/generations/${created.body.data.id}`).set('Authorization', `Bearer ${user.accessToken}`);
    expect((await download((await as(admin).get('/gallery?limit=100')).body.data.find((g: { id: string }) => g.id === item.id).image_url)).status).toBe(200);

    const audit = await auditFor(item.id, 'gallery.create');
    expect(audit).toHaveLength(1);
    expectNoSecretsInAudit(audit);

    // Not-finished or unknown generations cannot be curated.
    const gone = await as(admin).post('/gallery', { generation_id: created.body.data.id, title: 'Sudah dihapus' });
    expect(gone.status).toBe(400);
    expect((await as(admin).post('/gallery', { generation_id: uuid(), title: 'Hantu' })).status).toBe(404);
  });

  it('creates an item from an uploaded image plus a template; display_prompt can never be supplied directly', async () => {
    const admin = await loginSeedAdmin();
    const title = `Unggahan ${suffix()}`;
    const res = await as(admin).upload('/gallery', await png('#ee9944', 400, 500), {
      title,
      template_slug: 'poster-promo-produk',
      slot_values: JSON.stringify({ title: 'Diskon 50', product: 'sepatu kulit' }),
      remarks: 'latar sederhana',
      is_hidden: 'true',
      sort_order: '7',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ title, is_hidden: true, sort_order: 7, template: { slug: 'poster-promo-produk' }, generation_id: null });
    expect(res.body.data.display_prompt).toContain('sepatu kulit');
    expect(res.body.data.display_prompt).toContain('Catatan: latar sederhana');
    expect(await publicIds()).not.toContain(res.body.data.id); // created hidden

    const f = await png();
    const bad: [string, Promise<{ status: number }>][] = [
      ['no template', as(admin).upload('/gallery', f, { title: 'x' })],
      ['unknown template', as(admin).upload('/gallery', f, { title: 'x', template_slug: 'tidak-ada' })],
      ['slot_values not json', as(admin).upload('/gallery', f, { title: 'x', template_slug: 'poster-promo-produk', slot_values: '{oops' })],
      ['display_prompt supplied', as(admin).upload('/gallery', f, { title: 'x', template_slug: 'poster-promo-produk', display_prompt: 'bebas' })],
      ['file is not an image', as(admin).upload('/gallery', Buffer.from('plain text'), { title: 'x', template_slug: 'poster-promo-produk' })],
      ['no title', as(admin).upload('/gallery', f, { template_slug: 'poster-promo-produk' })],
      ['neither source', as(admin).post('/gallery', { title: 'Tanpa sumber' })],
      ['both sources', as(admin).post('/gallery', { generation_id: uuid(), template_slug: 'poster-promo-produk', title: 'Dua sumber' })],
      ['json display_prompt', as(admin).post('/gallery', { generation_id: uuid(), title: 'x', display_prompt: 'bebas' })],
    ];
    for (const [why, pending] of bad) expect((await pending).status, why).toBe(400);
  });

  it('re-validates display_prompt on edit: no placeholders, no core prompt text, no blocked terms', async () => {
    const admin = await loginSeedAdmin();
    const seeded = (await as(admin).get('/gallery?limit=1')).body.data[0] as { id: string; display_prompt: string; title: string };
    const original = seeded.display_prompt;
    const ok = await as(admin).patch(`/gallery/${seeded.id}`, { display_prompt: 'Warna: biru langit | Catatan: sederhana', title: 'Judul baru', sort_order: 3, is_featured: true });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ display_prompt: 'Warna: biru langit | Catatan: sederhana', title: 'Judul baru', sort_order: 3, is_featured: true });

    const corePiece = (SEED_CORE_PROMPTS[0]?.body.split(/\[___\]|\{\{[^}]*\}\}/).find((p) => p.trim().length > 60) ?? '').trim().slice(0, 60);
    expect(corePiece.length).toBeGreaterThan(40);
    const cases: [string, string, number, string][] = [
      ['blank token', 'Gambar [___] indah', 400, 'VALIDATION_ERROR'],
      ['named placeholder', 'Gambar {{subject_lock}} indah', 400, 'VALIDATION_ERROR'],
      ['core prompt text', `Hasil: ${corePiece}`, 400, 'VALIDATION_ERROR'],
      ['core prompt text, different case and spacing', `HASIL:   ${corePiece.toUpperCase().replace(/ /g, '   ')}`, 400, 'VALIDATION_ERROR'],
      ['blocked term', 'Promo judi online terbesar', 422, 'CONTENT_POLICY_VIOLATION'],
    ];
    for (const [why, text, status, code] of cases) {
      const res = await as(admin).patch(`/gallery/${seeded.id}`, { display_prompt: text });
      expect(res.status, why).toBe(status);
      expect(res.body.error_code, why).toBe(code);
      expect(res.text, why).not.toContain(corePiece.slice(0, 30));
      expect(res.text, why).not.toContain('judi online');
    }
    expect((await as(admin).patch(`/gallery/${seeded.id}`, { title: corePiece })).status).toBe(400);
    expect((await as(admin).patch(`/gallery/${seeded.id}`, {})).status).toBe(400);
    expect((await as(admin).patch(`/gallery/${seeded.id}`, { image_asset_id: uuid() })).status).toBe(400);
    expect((await as(admin).patch(`/gallery/${uuid()}`, { title: 'Hantu' })).status).toBe(404);
    expect((await pool.query<{ display_prompt: string }>('SELECT display_prompt FROM gallery_items WHERE id = $1', [seeded.id])).rows[0]?.display_prompt).toBe('Warna: biru langit | Catatan: sederhana');

    await pool.query('UPDATE gallery_items SET title = $2, display_prompt = $3, sort_order = 0, is_featured = false WHERE id = $1', [seeded.id, seeded.title, original]);
    expectNoSecretsInAudit(await auditFor(seeded.id));
  });

  it('deletes an item and removes it from the public gallery', async () => {
    const admin = await loginSeedAdmin();
    const res = await as(admin).upload('/gallery', await png(), { title: `Hapus ${suffix()}`, template_slug: 'poster-promo-produk' });
    const id = res.body.data.id as string;
    expect(await publicIds()).toContain(id);
    expect((await as(admin).del(`/gallery/${id}`)).status).toBe(200);
    expect(await publicIds()).not.toContain(id);
    expect((await as(admin).del(`/gallery/${id}`)).status).toBe(404);
    expect((await auditFor(id)).map((a) => a.action)).toEqual(['gallery.create', 'gallery.delete']);
  });
});
