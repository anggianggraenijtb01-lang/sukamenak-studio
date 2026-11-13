import { describe, expect, it } from 'vitest';
import { api, collectKeys, pool, registerUser } from '../helpers/api.js';
import { as, auditFor, coreBody, expectNoSecretsInAudit, loginSeedAdmin, png, suffix, uuid, useSeededDatabase } from '../helpers/admin.js';
import { download, postGeneration, settle } from '../helpers/pipeline.js';

useSeededDatabase();

type Admin = Awaited<ReturnType<typeof loginSeedAdmin>>;

interface Authored {
  id: string;
  slug: string;
  key: string;
  marker: string;
  coreId: string;
}

/** A draft template with a 2-blank core prompt (active), two blank slots, one overlay slot and its zone. */
async function author(admin: Admin, opts: { activateCore?: boolean; category?: string; withZone?: boolean } = {}): Promise<Authored> {
  const sfx = suffix();
  const key = `test.tpl_${sfx}`;
  const marker = `ZQT${sfx.toUpperCase()}`;
  const core = await as(admin).post('/core-prompts', { key, subject: 'product', publication: opts.category === 'psa' ? 'psa' : 'poster', body: coreBody(2, marker) });
  expect(core.status).toBe(201);
  if (opts.activateCore !== false) expect((await as(admin).post(`/core-prompts/${core.body.data.id}/activate`)).status).toBe(200);
  const slug = `tpl-${sfx}`;
  const t = await as(admin).post('/templates', { slug, name: `Template ${sfx}`, category: opts.category ?? 'poster', mode: 'both', subject: 'product', core_prompt_key: key });
  expect(t.status).toBe(201);
  const id = t.body.data.id as string;
  expect((await as(admin).post(`/templates/${id}/slots`, { key: 'product', label: 'Produk', blank_index: 1, required: false, vision_role: 'product', source_hint: 'the product from the reference' })).status).toBe(201);
  expect((await as(admin).post(`/templates/${id}/slots`, { key: 'color', label: 'Warna', type: 'color', blank_index: 2 })).status).toBe(201);
  expect((await as(admin).post(`/templates/${id}/slots`, { key: 'title', label: 'Judul', max_length: 40 })).status).toBe(201);
  if (opts.withZone !== false) {
    expect((await as(admin).post(`/templates/${id}/text-zones`, { slot_key: 'title', x: 0.05, y: 0.05, w: 0.9, h: 0.2 })).status).toBe(201);
  }
  return { id, slug, key, marker, coreId: core.body.data.id };
}

describe('admin templates', () => {
  it('creates, lists, reads, updates and validates templates; slugs are unique', async () => {
    const admin = await loginSeedAdmin();
    const sfx = suffix();
    const base = { slug: `crud-${sfx}`, name: `Crud ${sfx}`, category: 'poster', mode: 'i2i', subject: 'product', core_prompt_key: 'product.poster' };
    const created = await as(admin).post('/templates', base);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ slug: base.slug, status: 'draft', aspect_ratio: '4:5', slot_count: 0 });
    expect(created.body.data.readiness.publishable).toBe(false);
    expect(created.body.data.readiness.issues[0].code).toBe('BLANK_SLOT_MISMATCH');

    const dup = await as(admin).post('/templates', base);
    expect(dup.status).toBe(400);
    expect(dup.body.errors[0].field).toBe('slug');

    for (const [why, bad] of Object.entries({
      'bad slug': { ...base, slug: 'Bad Slug!' },
      'bad category': { ...base, slug: `x-${sfx}`, category: 'banner' },
      'bad aspect': { ...base, slug: `y-${sfx}`, aspect_ratio: 'wide' },
      'bad core key': { ...base, slug: `z-${sfx}`, core_prompt_key: 'NoDots' },
      'unknown field': { ...base, slug: `w-${sfx}`, status: 'published' },
    })) {
      const res = await as(admin).post('/templates', bad);
      expect(res.status, why).toBe(400);
    }

    const list = await as(admin).get(`/templates?search=crud-${sfx}`);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta).toMatchObject({ total: 1, page: 1 });
    expect((await as(admin).get('/templates?status=published&limit=100')).body.data.length).toBeGreaterThanOrEqual(10);
    expect((await as(admin).get('/templates?status=nope')).status).toBe(400);

    const patched = await as(admin).patch(`/templates/${created.body.data.id}`, { name: 'Renamed', description: 'Deskripsi', sort_order: 5 });
    expect(patched.body.data).toMatchObject({ name: 'Renamed', description: 'Deskripsi', sort_order: 5 });
    expect((await as(admin).patch(`/templates/${created.body.data.id}`, {})).status).toBe(400);
    expect((await as(admin).patch(`/templates/${uuid()}`, { name: 'Ghost' })).status).toBe(404);
    expect((await as(admin).get(`/templates/${uuid()}`)).status).toBe(404);

    const audit = await auditFor(created.body.data.id);
    expect(audit.map((a) => a.action)).toEqual(['template.create', 'template.update']);
    expectNoSecretsInAudit(audit);
  });

  it('slots: CRUD with validation and uniqueness; select slots need options', async () => {
    const admin = await loginSeedAdmin();
    const t = await author(admin, { withZone: false });
    const slots = (await as(admin).get(`/templates/${t.id}`)).body.data.slots as { id: string; key: string; blank_index: number | null; source_hint: string | null }[];
    expect(slots.map((s) => s.key).sort()).toEqual(['color', 'product', 'title']);
    expect(slots.find((s) => s.key === 'product')).toMatchObject({ blank_index: 1, source_hint: 'the product from the reference' });

    const bad: [string, Record<string, unknown>][] = [
      ['select without options', { key: 'style', label: 'Gaya', type: 'select' }],
      ['bad key', { key: 'Bad-Key', label: 'x' }],
      ['bad type', { key: 'other', label: 'x', type: 'checkbox' }],
      ['blank_index 0', { key: 'other', label: 'x', blank_index: 0 }],
      ['bad option shape', { key: 'other', label: 'x', type: 'select', options: ['a'] }],
      ['unknown vision role', { key: 'other', label: 'x', vision_role: 'smell' }],
    ];
    for (const [why, body] of bad) expect((await as(admin).post(`/templates/${t.id}/slots`, body)).status, why).toBe(400);

    const dupKey = await as(admin).post(`/templates/${t.id}/slots`, { key: 'product', label: 'Lagi' });
    expect(dupKey.status).toBe(400);
    expect(dupKey.body.errors[0].field).toBe('key');
    const dupBlank = await as(admin).post(`/templates/${t.id}/slots`, { key: 'other', label: 'Lagi', blank_index: 1 });
    expect(dupBlank.status).toBe(400);
    expect(dupBlank.body.errors[0].field).toBe('blank_index');

    const select = await as(admin).post(`/templates/${t.id}/slots`, {
      key: 'style', label: 'Gaya', type: 'select', options: [{ value: 'flat', label: 'Flat' }, { value: 'photo', label: 'Foto' }],
    });
    expect(select.status).toBe(201);
    expect(select.body.data.options).toHaveLength(2);
    const upd = await as(admin).patch(`/templates/${t.id}/slots/${select.body.data.id}`, { label: 'Gaya visual', required: true });
    expect(upd.body.data).toMatchObject({ label: 'Gaya visual', required: true });
    expect((await as(admin).patch(`/templates/${t.id}/slots/${select.body.data.id}`, { options: null })).status).toBe(400);
    expect((await as(admin).patch(`/templates/${t.id}/slots/${uuid()}`, { label: 'Ghost' })).status).toBe(404);
    expect((await as(admin).patch(`/templates/${uuid()}/slots/${select.body.data.id}`, { label: 'Ghost' })).status).toBe(404);
    expect((await as(admin).del(`/templates/${t.id}/slots/${select.body.data.id}`)).status).toBe(200);
    expect((await as(admin).del(`/templates/${t.id}/slots/${select.body.data.id}`)).status).toBe(404);
    expectNoSecretsInAudit(await auditFor(select.body.data.id));
  });

  it('text zones: CRUD, canvas bounds, one per slot, existing slots only, safe font and colour values', async () => {
    const admin = await loginSeedAdmin();
    const t = await author(admin, { withZone: false });
    const zone = { slot_key: 'title', x: 0.1, y: 0.1, w: 0.8, h: 0.2 };
    const bad: [string, Record<string, unknown>][] = [
      ['x + w > 1', { ...zone, x: 0.5, w: 0.8 }],
      ['y + h > 1', { ...zone, y: 0.9, h: 0.5 }],
      ['zero width', { ...zone, w: 0 }],
      ['font injection', { ...zone, font_family: 'Inter"><script>' }],
      ['colour injection', { ...zone, color: 'red; fill: url(x)' }],
      ['bad align', { ...zone, align: 'justify' }],
      ['unknown slot', { ...zone, slot_key: 'nope' }],
    ];
    for (const [why, body] of bad) expect((await as(admin).post(`/templates/${t.id}/text-zones`, body)).status, why).toBe(400);

    const ok = await as(admin).post(`/templates/${t.id}/text-zones`, { ...zone, color: 'brand:1', font_weight: 800, max_lines: 3 });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ slot_key: 'title', x: 0.1, w: 0.8, color: 'brand:1', max_lines: 3 });
    const again = await as(admin).post(`/templates/${t.id}/text-zones`, zone);
    expect(again.status).toBe(400);

    const upd = await as(admin).patch(`/templates/${t.id}/text-zones/${ok.body.data.id}`, { align: 'left', font_size_ratio: 0.08 });
    expect(upd.body.data).toMatchObject({ align: 'left', font_size_ratio: 0.08 });
    // The partial update is checked against the stored values too.
    expect((await as(admin).patch(`/templates/${t.id}/text-zones/${ok.body.data.id}`, { w: 0.95 })).status).toBe(400);
    expect((await as(admin).patch(`/templates/${t.id}/text-zones/${ok.body.data.id}`, { slot_key: 'nope' })).status).toBe(400);
    expect((await as(admin).del(`/templates/${t.id}/text-zones/${ok.body.data.id}`)).status).toBe(200);
    expect((await as(admin).del(`/templates/${t.id}/text-zones/${ok.body.data.id}`)).status).toBe(404);
  });

  it('publish enforces an active core prompt, matching blank count, valid zones and a psa disclaimer', async () => {
    const admin = await loginSeedAdmin();

    // No active core prompt for the key.
    const noCore = await author(admin, { activateCore: false });
    const r1 = await as(admin).post(`/templates/${noCore.id}/publish`);
    expect(r1.status).toBe(422);
    expect(r1.body.error_code).toBe('CORE_PROMPT_REQUIRED');

    // Blank count differs from the number of blank slots.
    const mismatch = await author(admin);
    const extra = await as(admin).post(`/templates/${mismatch.id}/slots`, { key: 'extra', label: 'Extra', blank_index: 3 });
    const r2 = await as(admin).post(`/templates/${mismatch.id}/publish`);
    expect(r2.status).toBe(422);
    expect(r2.body.error_code).toBe('BLANK_SLOT_MISMATCH');
    expect((await pool.query('SELECT status FROM templates WHERE id = $1', [mismatch.id])).rows[0]?.status).toBe('draft');
    await as(admin).del(`/templates/${mismatch.id}/slots/${extra.body.data.id}`);
    expect((await as(admin).post(`/templates/${mismatch.id}/publish`)).status).toBe(200);

    // psa needs the policy disclaimer.
    const psa = await author(admin, { category: 'psa' });
    const saved = (await pool.query<{ disclaimers: Record<string, string> }>('SELECT disclaimers FROM content_policies WHERE is_active')).rows[0]?.disclaimers as Record<string, string>;
    try {
      const without = { ...saved };
      delete without.psa;
      await pool.query('UPDATE content_policies SET disclaimers = $1::jsonb WHERE is_active', [JSON.stringify(without)]);
      const r3 = await as(admin).post(`/templates/${psa.id}/publish`);
      expect(r3.status).toBe(422);
      expect(r3.body.error_code).toBe('CONTENT_POLICY_VIOLATION');
    } finally {
      await pool.query('UPDATE content_policies SET disclaimers = $1::jsonb WHERE is_active', [JSON.stringify(saved)]);
    }
    const r4 = await as(admin).post(`/templates/${psa.id}/publish`);
    expect(r4.status).toBe(200);
    expect(r4.body.data.status).toBe('published');
    expect((await api().get(`/api/v1/templates/${psa.slug}`)).body.data.disclaimer).toBe(saved.psa);

    expect((await as(admin).post(`/templates/${uuid()}/publish`)).status).toBe(404);
  });

  it('a published template is live without a deploy, never exposes core prompt text, and can be unpublished and archived', async () => {
    const admin = await loginSeedAdmin();
    const t = await author(admin);
    const pub = await as(admin).post(`/templates/${t.id}/publish`);
    expect(pub.status).toBe(200);
    expect(pub.body.data.readiness.publishable).toBe(true);

    // Admin DTO may show wiring (blank_index, source_hint) but never the core prompt text.
    expect(pub.text).not.toContain(t.marker);
    expect(pub.text).not.toContain('[___]');
    expect(pub.text).not.toContain('Feature number');
    for (const k of ['body', 'body_ciphertext', 'prompt', 'final_prompt']) expect(collectKeys(pub.body).has(k)).toBe(false);
    expect(pub.body.data.slots.find((s: { key: string }) => s.key === 'product')).toMatchObject({ blank_index: 1, source_hint: 'the product from the reference' });

    // Public side: listed, without internal wiring.
    const publicDetail = await api().get(`/api/v1/templates/${t.slug}`);
    expect(publicDetail.status).toBe(200);
    expect(publicDetail.text).not.toContain(t.key);
    expect(collectKeys(publicDetail.body).has('blank_index')).toBe(false);
    expect(collectKeys(publicDetail.body).has('source_hint')).toBe(false);

    // End to end: a creator generates from the admin-authored template and gets an image.
    const user = await registerUser();
    const gen = await postGeneration(user, { template_slug: t.slug, mode: 't2i', slot_values: { product: 'sepatu lari', color: 'biru', title: 'Diskon' } });
    expect(gen.status).toBe(202);
    const state = await settle(user, gen.body.data.id);
    expect(state).toMatchObject({ status: 'done', composited_text: true });
    expect((await download(state.result_url)).status).toBe(200);

    expect((await as(admin).patch(`/templates/${t.id}`, { name: 'Edited Live' })).body.data.name).toBe('Edited Live');
    expect((await api().get(`/api/v1/templates/${t.slug}`)).body.data.name).toBe('Edited Live');

    const unpub = await as(admin).post(`/templates/${t.id}/unpublish`);
    expect(unpub.body.data.status).toBe('draft');
    expect((await api().get(`/api/v1/templates/${t.slug}`)).status).toBe(404);
    expect((await as(admin).post(`/templates/${t.id}/publish`)).status).toBe(200);
    expect((await as(admin).post(`/templates/${t.id}/archive`)).body.data.status).toBe('archived');
    expect((await api().get(`/api/v1/templates/${t.slug}`)).status).toBe(404);

    const audit = await auditFor(t.id);
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['template.create', 'template.publish', 'template.update', 'template.unpublish', 'template.archive']));
    expectNoSecretsInAudit(audit, [t.marker]);
  });

  it('edits to a published template are re-validated and rolled back when they would break it', async () => {
    const admin = await loginSeedAdmin();
    const t = await author(admin);
    expect((await as(admin).post(`/templates/${t.id}/publish`)).status).toBe(200);
    const detail = (await as(admin).get(`/templates/${t.id}`)).body.data;
    const blankSlot = detail.slots.find((s: { key: string }) => s.key === 'color');
    const titleSlot = detail.slots.find((s: { key: string }) => s.key === 'title');

    const delSlot = await as(admin).del(`/templates/${t.id}/slots/${blankSlot.id}`);
    expect(delSlot.status).toBe(422);
    expect(delSlot.body.error_code).toBe('BLANK_SLOT_MISMATCH');
    expect((await pool.query('SELECT 1 FROM template_slots WHERE id = $1', [blankSlot.id])).rowCount).toBe(1);

    const unblank = await as(admin).patch(`/templates/${t.id}/slots/${blankSlot.id}`, { blank_index: null });
    expect(unblank.status).toBe(422);
    const newKey = await as(admin).patch(`/templates/${t.id}`, { core_prompt_key: `test.missing_${suffix()}` });
    expect(newKey.status).toBe(422);
    expect(newKey.body.error_code).toBe('CORE_PROMPT_REQUIRED');
    expect((await pool.query('SELECT core_prompt_key FROM templates WHERE id = $1', [t.id])).rows[0]?.core_prompt_key).toBe(t.key);

    // Safe edits go through and are visible at once; deleting a slot with a zone removes the zone too.
    expect((await as(admin).patch(`/templates/${t.id}/slots/${blankSlot.id}`, { label: 'Warna utama' })).status).toBe(200);
    expect((await as(admin).del(`/templates/${t.id}/slots/${titleSlot.id}`)).status).toBe(200);
    expect((await pool.query('SELECT 1 FROM text_zones WHERE template_id = $1', [t.id])).rowCount).toBe(0);
    expect((await api().get(`/api/v1/templates/${t.slug}`)).body.data.slots.map((s: { key: string }) => s.key)).not.toContain('title');

    // A published template cannot be deleted; an unpublished one can, and frees its slug.
    expect((await as(admin).del(`/templates/${t.id}`)).status).toBe(400);
    await as(admin).post(`/templates/${t.id}/unpublish`);
    expect((await as(admin).del(`/templates/${t.id}`)).status).toBe(200);
    expect((await as(admin).get(`/templates/${t.id}`)).status).toBe(404);
    expect((await as(admin).post('/templates', { slug: t.slug, name: 'Reused slug', category: 'poster', mode: 'both', subject: 'product', core_prompt_key: t.key })).status).toBe(201);
  });

  it('uploads a preview image with the shared image validation and replaces the previous one', async () => {
    const admin = await loginSeedAdmin();
    const t = await author(admin);
    const first = await as(admin).upload(`/templates/${t.id}/preview`, await png('#aa3355'));
    expect(first.status).toBe(200);
    expect(first.body.data.preview_url).toContain('/files/');
    const file = await download(first.body.data.preview_url);
    expect(file.status).toBe(200);
    expect(file.type).toContain('image/png');
    const second = await as(admin).upload(`/templates/${t.id}/preview`, await png('#33aa55'));
    expect(second.body.data.preview_url).not.toBe(first.body.data.preview_url);

    expect((await as(admin).upload(`/templates/${t.id}/preview`, Buffer.from('not an image at all'))).status).toBe(400);
    expect((await as(admin).post(`/templates/${t.id}/preview`)).status).toBe(400); // no file
    expect((await as(admin).upload(`/templates/${uuid()}/preview`, await png())).status).toBe(404);
    expect((await auditFor(t.id, 'template.preview_upload')).length).toBe(2);
  });
});
