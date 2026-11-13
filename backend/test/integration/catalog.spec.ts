import { describe, expect, it } from 'vitest';
import { decryptWithCoreKey, corePromptAad } from '../../src/lib/coreCipher.js';
import { SEED_CORE_PROMPTS } from '../../src/seed/data/corePrompts.js';
import { api, collectKeys, pool, useDatabase } from '../helpers/api.js';

useDatabase();

const PROMPT_LIKE_KEY = /prompt|cipher|core/i;

describe('GET /templates', () => {
  it('lists the 10 published templates, public (no auth)', async () => {
    const res = await api().get('/api/v1/templates');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(10);
    const names = res.body.data.map((t: { name: string }) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['Poster Promo Produk', 'Banner Pengumuman Layanan Publik', 'Ucapan Selamat / Greeting']),
    );
    expect(res.body.data[0]).toMatchObject({ slug: 'poster-promo-produk', category: 'poster', mode: 'i2i', subject: 'product', aspect_ratio: '4:5' });
    expect(res.body.data[0].preview_url).toMatch(/\/api\/v1\/files\/seed\/posters\//);
  });

  it('contains no key that looks like a prompt, cipher or core field', async () => {
    const res = await api().get('/api/v1/templates');
    const offending = [...collectKeys(res.body)].filter((k) => PROMPT_LIKE_KEY.test(k));
    expect(offending).toEqual([]);
  });

  it('filters by category, subject and mode', async () => {
    const poster = await api().get('/api/v1/templates?category=poster');
    expect(poster.body.data.map((t: { slug: string }) => t.slug).sort()).toEqual(['poster-kegiatan-organisasi', 'poster-promo-produk']);
    const human = await api().get('/api/v1/templates?subject=human_model');
    expect(human.body.data).toHaveLength(2);
    expect(human.body.data.every((t: { requires_consent: boolean }) => t.requires_consent)).toBe(true);
    const t2i = await api().get('/api/v1/templates?mode=t2i');
    // t2i includes templates that support both modes.
    const t2iSlugs = t2i.body.data.map((t: { slug: string }) => t.slug);
    expect(t2iSlugs).toContain('ucapan-selamat-greeting');
    expect(t2iSlugs).not.toContain('foto-produk-gaya-hidup');
    const search = await api().get('/api/v1/templates?search=story');
    expect(search.body.data.map((t: { slug: string }) => t.slug)).toEqual(['story-promo-9-16']);
    expect((await api().get('/api/v1/templates?category=bogus')).status).toBe(400);
  });

  it('hides draft, archived and soft-deleted templates', async () => {
    await pool.query("UPDATE templates SET status = 'draft' WHERE slug = 'story-promo-9-16'");
    try {
      const res = await api().get('/api/v1/templates');
      expect(res.body.data.map((t: { slug: string }) => t.slug)).not.toContain('story-promo-9-16');
      expect((await api().get('/api/v1/templates/story-promo-9-16')).status).toBe(404);
    } finally {
      await pool.query("UPDATE templates SET status = 'published' WHERE slug = 'story-promo-9-16'");
    }
  });
});

describe('GET /templates/:slug', () => {
  it('returns slots, text zones and example references, with zero prompt fields', async () => {
    const res = await api().get('/api/v1/templates/poster-promo-produk');
    expect(res.status).toBe(200);
    const t = res.body.data;
    expect(t.slug).toBe('poster-promo-produk');
    expect(t.slots.map((s: { key: string }) => s.key)).toEqual([
      'product', 'color', 'background', 'lighting', 'style', 'composition', 'remarks', 'title', 'subtitle', 'cta',
    ]);
    const product = t.slots[0];
    expect(product).toMatchObject({ key: 'product', required: true, target: 'image', reference_role: 'product' });
    expect(t.slots.find((s: { key: string }) => s.key === 'title')).toMatchObject({ target: 'overlay', required: true });
    expect(t.slots.find((s: { key: string }) => s.key === 'lighting').options.length).toBeGreaterThan(2);

    expect(t.text_zones.map((z: { slot_key: string }) => z.slot_key).sort()).toEqual(['cta', 'subtitle', 'title']);
    const title = t.text_zones.find((z: { slot_key: string }) => z.slot_key === 'title');
    expect(title).toMatchObject({ x: 0.08, y: 0.06, w: 0.84, h: 0.18, align: 'center', max_lines: 2 });
    expect(typeof title.font_size_ratio).toBe('number');

    expect(t.example_references).toHaveLength(1);
    expect(t.example_references[0]).toMatchObject({ role: 'product' });
    expect(t.example_references[0].url).toMatch(/^http/);

    const offending = [...collectKeys(res.body)].filter((k) => PROMPT_LIKE_KEY.test(k));
    expect(offending).toEqual([]);
  });

  it.each([
    'poster-promo-produk', 'poster-kegiatan-organisasi', 'banner-pengumuman-layanan-publik', 'konten-feed-produk-4-5',
    'story-promo-9-16', 'foto-produk-latar-putih', 'foto-produk-gaya-hidup', 'model-manusia-studio', 'model-manusia-outdoor',
    'ucapan-selamat-greeting',
  ])('never leaks the core prompt text or wiring for %s', async (slug) => {
    const res = await api().get(`/api/v1/templates/${slug}`);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('[___]');
    // Compact JSON never contains "{{"; a leaked named placeholder would.
    expect(body).not.toContain('{{');
    expect(body).not.toMatch(/blank_index|source_hint|core_prompt_key|body_/);
    // None of the (decrypted) core prompt sentences may appear anywhere in the response.
    const { rows } = await pool.query('SELECT key, version, body_ciphertext, body_iv, body_auth_tag FROM core_prompts WHERE is_active');
    expect(rows.length).toBe(5);
    for (const row of rows) {
      const plain = decryptWithCoreKey(
        { ciphertext: row.body_ciphertext, iv: row.body_iv, authTag: row.body_auth_tag },
        corePromptAad(row.key, row.version),
      );
      for (const line of plain.split('\n')) {
        expect(body.includes(line.slice(0, 40)), `${row.key}: "${line.slice(0, 40)}"`).toBe(false);
      }
    }
  });

  it('attaches the mandatory disclaimer to the PSA template only', async () => {
    const psa = await api().get('/api/v1/templates/banner-pengumuman-layanan-publik');
    expect(psa.body.data.disclaimer).toMatch(/AI/);
    const poster = await api().get('/api/v1/templates/poster-promo-produk');
    expect(poster.body.data.disclaimer).toBeNull();
  });

  it('marks human-model templates as requiring consent and has no text zones for them', async () => {
    const res = await api().get('/api/v1/templates/model-manusia-studio');
    expect(res.body.data.requires_consent).toBe(true);
    expect(res.body.data.text_zones).toEqual([]);
  });

  it('answers 404 NOT_FOUND for an unknown slug and 400 for a malformed one', async () => {
    const missing = await api().get('/api/v1/templates/does-not-exist');
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ status: 'error', error_code: 'NOT_FOUND' });
    expect((await api().get('/api/v1/templates/Bad_Slug!')).status).toBe(400);
  });
});

describe('seeded core prompts (storage)', () => {
  it('are encrypted at rest, decrypt back to the source and match slot counts', async () => {
    const { rows } = await pool.query(
      'SELECT key, version, blank_count, is_active, body_ciphertext, body_iv, body_auth_tag FROM core_prompts ORDER BY key',
    );
    expect(rows.map((r) => r.key)).toEqual(SEED_CORE_PROMPTS.map((c) => c.key).sort());
    for (const row of rows) {
      const source = SEED_CORE_PROMPTS.find((c) => c.key === row.key);
      expect(row.is_active).toBe(true);
      expect((row.body_ciphertext as Buffer).toString('utf8')).not.toContain('Create a');
      expect(row.body_iv).toHaveLength(12);
      expect(row.body_auth_tag).toHaveLength(16);
      const plain = decryptWithCoreKey(
        { ciphertext: row.body_ciphertext, iv: row.body_iv, authTag: row.body_auth_tag },
        corePromptAad(row.key, row.version),
      );
      expect(plain).toBe(source?.body);
      expect(plain.split('[___]').length - 1).toBe(row.blank_count);

      const templates = await pool.query(
        `SELECT t.slug, count(s.id) FILTER (WHERE s.blank_index IS NOT NULL)::int AS blanks
           FROM templates t JOIN template_slots s ON s.template_id = t.id
          WHERE t.core_prompt_key = $1 GROUP BY t.slug`,
        [row.key],
      );
      expect(templates.rowCount).toBeGreaterThan(0);
      for (const t of templates.rows) expect(t.blanks, `${t.slug} vs ${row.key}`).toBe(row.blank_count);
    }
  });

  it('allows only one active version per key and one default model per capability', async () => {
    await expect(
      pool.query(
        `INSERT INTO core_prompts (key, version, subject, publication, body_ciphertext, body_iv, body_auth_tag, blank_count, is_active)
         VALUES ('product.poster', 2, 'product', 'poster', '\\x00', '\\x00', '\\x00', 0, true)`,
      ),
    ).rejects.toThrow(/core_prompts_one_active_per_key/);
    await expect(
      pool.query(
        `INSERT INTO model_configs (name, provider, capability, model_id, is_default, is_active) VALUES ('Second default', 'mock', 'text', 'x', true, true)`,
      ),
    ).rejects.toThrow(/model_configs_one_default_per_capability/);
    await expect(
      pool.query(`INSERT INTO model_configs (name, provider, capability, model_id, is_default, is_active) VALUES ('Inactive default', 'mock', 'i2i', 'x', true, false)`),
    ).rejects.toThrow();
    await expect(
      pool.query(`INSERT INTO model_configs (name, provider, capability, model_id, api_key_env) VALUES ('Raw key', 'gemini', 'vision', 'x', 'sk-live-abc123')`),
    ).rejects.toThrow();
  });
});

describe('GET /gallery', () => {
  it('lists non-hidden items, featured first, with display_prompt as the only prompt-like field', async () => {
    const res = await api().get('/api/v1/gallery');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(6);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 12, total: 6, total_pages: 1 });
    const flags = res.body.data.map((i: { is_featured: boolean }) => i.is_featured);
    expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)));
    expect(flags[0]).toBe(true);

    const promptLike = [...collectKeys(res.body)].filter((k) => PROMPT_LIKE_KEY.test(k));
    expect(promptLike).toEqual(['display_prompt']);

    const item = res.body.data.find((i: { title: string }) => i.title === 'Keripik Tempe Renyah');
    expect(item.display_prompt).toContain('keripik tempe renyah dalam kemasan standing pouch');
    expect(item.display_prompt).toContain('Catatan: suasana hangat');
    expect(item.display_prompt).not.toMatch(/\[___\]|\{\{|Create a professional/);
    expect(item.template).toMatchObject({ slug: 'poster-promo-produk', category: 'poster' });
    expect(item.image_url).toMatch(/^http/);
  });

  it('excludes hidden items and supports filters and pagination', async () => {
    await pool.query("UPDATE gallery_items SET is_hidden = true WHERE title = 'Kue Lebaran'");
    try {
      const res = await api().get('/api/v1/gallery');
      expect(res.body.data.map((i: { title: string }) => i.title)).not.toContain('Kue Lebaran');
      expect(res.body.meta.total).toBe(5);
    } finally {
      await pool.query("UPDATE gallery_items SET is_hidden = false WHERE title = 'Kue Lebaran'");
    }
    const featured = await api().get('/api/v1/gallery?featured=true');
    expect(featured.body.data.every((i: { is_featured: boolean }) => i.is_featured)).toBe(true);
    const byTemplate = await api().get('/api/v1/gallery?template=poster-kegiatan-organisasi');
    expect(byTemplate.body.data).toHaveLength(2);
    const page = await api().get('/api/v1/gallery?limit=4&page=2');
    expect(page.body.data).toHaveLength(2);
    expect(page.body.meta).toMatchObject({ page: 2, limit: 4, total: 6, total_pages: 2 });
    expect((await api().get('/api/v1/gallery?limit=500')).status).toBe(400);
  });

  it('is read-only: no write verbs exist', async () => {
    expect((await api().post('/api/v1/gallery').send({})).status).toBe(404);
    expect((await api().delete('/api/v1/gallery/anything')).status).toBe(404);
  });
});

describe('GET /tutorials', () => {
  it('lists the six published tutorials and filters by level', async () => {
    const res = await api().get('/api/v1/tutorials');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(6);
    expect(res.body.data[0]).toEqual({
      id: expect.any(String),
      slug: 'mulai-membuat-konten-pertama',
      title: expect.any(String),
      summary: expect.any(String),
      level: 'pemula',
    });
    const menengah = await api().get('/api/v1/tutorials?level=menengah');
    expect(menengah.body.data.map((t: { level: string }) => t.level)).toEqual(['menengah', 'menengah']);
  });

  it('returns sections (do / dont / what_to_do) and visual breakdowns on detail', async () => {
    const res = await api().get('/api/v1/tutorials/elemen-visual-dasar');
    expect(res.status).toBe(200);
    const kinds = new Set(res.body.data.sections.map((s: { kind: string }) => s.kind));
    expect(kinds).toEqual(new Set(['what_to_do', 'do', 'dont', 'tip']));
    expect(res.body.data.visual_breakdowns.map((b: { aspect: string }) => b.aspect)).toEqual([
      'style', 'color', 'gradient', 'angle', 'lighting', 'composition',
    ]);
    expect(res.body.data.visual_breakdowns[0].prompt_fragment).toEqual(expect.any(String));
    const plain = await api().get('/api/v1/tutorials/mulai-membuat-konten-pertama');
    expect(plain.body.data.visual_breakdowns).toEqual([]);
  });

  it('404s on unknown slugs and hides unpublished tutorials', async () => {
    expect((await api().get('/api/v1/tutorials/tidak-ada')).status).toBe(404);
    await pool.query("UPDATE tutorials SET status = 'draft' WHERE slug = 'foto-produk-dengan-hp'");
    try {
      expect((await api().get('/api/v1/tutorials/foto-produk-dengan-hp')).status).toBe(404);
    } finally {
      await pool.query("UPDATE tutorials SET status = 'published' WHERE slug = 'foto-produk-dengan-hp'");
    }
  });
});
