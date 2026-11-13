import { describe, expect, it } from 'vitest';
import { corePromptAad, decryptWithCoreKey } from '../../src/lib/coreCipher.js';
import { SEED_CORE_PROMPTS } from '../../src/seed/data/corePrompts.js';
import { collectKeys, pool } from '../helpers/api.js';
import { as, auditFor, coreBody, expectNoSecretsInAudit, loginSeedAdmin, suffix, uuid, useSeededDatabase } from '../helpers/admin.js';

useSeededDatabase();

const newKey = () => `test.cp_${suffix()}`;
const FORBIDDEN_KEYS = ['body', 'body_ciphertext', 'body_iv', 'body_auth_tag', 'ciphertext', 'auth_tag', 'prompt', 'final_prompt', 'content'];

async function create(admin: Awaited<ReturnType<typeof loginSeedAdmin>>, key: string, body: string, extra: Record<string, unknown> = {}) {
  return as(admin).post('/core-prompts', { key, subject: 'product', publication: 'poster', body, ...extra });
}

describe('admin core prompts (write-only)', () => {
  it('creates an encrypted version, auto-increments versions and answers with metadata only', async () => {
    const admin = await loginSeedAdmin();
    const key = newKey();
    const marker = `ZQX${suffix().toUpperCase()}`;
    const body = coreBody(3, marker);

    const v1 = await create(admin, key, body);
    expect(v1.status).toBe(201);
    expect(v1.body.data).toMatchObject({ key, version: 1, subject: 'product', publication: 'poster', blank_count: 3, is_active: false, templates_using: 0 });
    expect(v1.body.data.created_by).toMatchObject({ id: admin.id });
    const v2 = await create(admin, key, coreBody(2, marker));
    expect(v2.body.data).toMatchObject({ version: 2, blank_count: 2 });
    expect((await create(admin, key, coreBody(1, marker))).body.data.version).toBe(3);

    // No key of the response can carry the body, and the marker never appears.
    const keys = collectKeys(v1.body);
    for (const forbidden of FORBIDDEN_KEYS) expect(keys.has(forbidden), forbidden).toBe(false);
    expect(v1.text).not.toContain(marker);

    // Stored encrypted, bound to key+version through AAD; plaintext is not in the table.
    const row = await pool.query<{ body_ciphertext: Buffer; body_iv: Buffer; body_auth_tag: Buffer }>('SELECT body_ciphertext, body_iv, body_auth_tag FROM core_prompts WHERE id = $1', [v1.body.data.id]);
    const r = row.rows[0] as { body_ciphertext: Buffer; body_iv: Buffer; body_auth_tag: Buffer };
    expect(r.body_ciphertext.includes(Buffer.from(marker))).toBe(false);
    expect(decryptWithCoreKey({ ciphertext: r.body_ciphertext, iv: r.body_iv, authTag: r.body_auth_tag }, corePromptAad(key, 1))).toBe(body);
    expect(() => decryptWithCoreKey({ ciphertext: r.body_ciphertext, iv: r.body_iv, authTag: r.body_auth_tag }, corePromptAad(key, 2))).toThrow();

    // Audit rows hold key / version / blank_count only.
    const audit = await auditFor(v1.body.data.id, 'core_prompt.create');
    expect(audit).toHaveLength(1);
    expect(audit[0]?.diff).toEqual({ key, version: 1, subject: 'product', publication: 'poster', blank_count: 3 });
    expectNoSecretsInAudit(audit, [marker]);
  });

  it('validates the body: blanks, whitelisted placeholders, glyph words, near-miss blanks, size and shape', async () => {
    const admin = await loginSeedAdmin();
    const key = newKey();
    const secretWord = 'zzunknownthing';
    const cases: [string, Record<string, unknown>, number, string][] = [
      ['no blank', { body: 'A calm landscape scene rendered in a flat illustrated style, nothing to fill in here.' }, 400, 'VALIDATION_ERROR'],
      ['unknown placeholder', { body: `Draw [___] in {{aspect_ratio}} with {{${secretWord}}} everywhere in the frame.` }, 422, 'UNKNOWN_PLACEHOLDER'],
      ['unbalanced braces', { body: 'Draw [___] in {{aspect_ratio} with care and attention to the lighting.' }, 422, 'UNKNOWN_PLACEHOLDER'],
      ['glyph word', { body: 'Draw [___] and add the headline across the top of the frame in bold.' }, 400, 'VALIDATION_ERROR'],
      ['typography word (case-insensitive)', { body: 'Draw [___] with elegant Typography on the lower third of the image.' }, 400, 'VALIDATION_ERROR'],
      ['malformed blank', { body: 'Draw [__] and also [___] in the centre of a softly lit studio frame.' }, 400, 'VALIDATION_ERROR'],
      ['too short', { body: 'Draw [___]' }, 400, 'VALIDATION_ERROR'],
      ['too long', { body: `Draw [___] ${'x'.repeat(8100)}` }, 400, 'VALIDATION_ERROR'],
      ['bad key', { key: 'Product Poster', body: coreBody(1) }, 400, 'VALIDATION_ERROR'],
      ['bad subject', { subject: 'animal', body: coreBody(1) }, 400, 'VALIDATION_ERROR'],
      ['extra field', { is_active: true, body: coreBody(1) }, 400, 'VALIDATION_ERROR'],
    ];
    for (const [why, override, status, code] of cases) {
      const res = await as(admin).post('/core-prompts', { key, subject: 'product', publication: 'poster', ...override });
      expect(res.status, why).toBe(status);
      expect(res.body.error_code, why).toBe(code);
      // Errors never echo the submitted text.
      expect(res.text, why).not.toContain(secretWord);
      expect(res.text, why).not.toContain('softly lit studio');
    }
    // The valid shape is accepted, proving the failures above were the rules and not the envelope.
    expect((await create(admin, key, coreBody(1))).status).toBe(201);
    // A new version of an existing key must keep subject/publication.
    const mismatch = await as(admin).post('/core-prompts', { key, subject: 'human_model', publication: 'poster', body: coreBody(1) });
    expect(mismatch.status).toBe(400);
  });

  it('the seeded default prompts all satisfy the same rules the admin endpoint enforces', async () => {
    const admin = await loginSeedAdmin();
    for (const core of SEED_CORE_PROMPTS) {
      const res = await as(admin).post('/core-prompts', { key: `${core.key}`, subject: core.subject, publication: core.publication, body: core.body });
      expect(res.status, core.key).toBe(201);
      expect(res.body.data.blank_count).toBe(core.blankKeys.length);
      expect(res.text).not.toContain(core.body.slice(0, 40));
    }
  });

  it('lists, filters and shows versions as metadata only', async () => {
    const admin = await loginSeedAdmin();
    const key = newKey();
    const marker = `ZQY${suffix().toUpperCase()}`;
    await create(admin, key, coreBody(2, marker));
    await create(admin, key, coreBody(2, marker));

    const list = await as(admin).get(`/core-prompts?key=${key}`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((c: { version: number }) => c.version)).toEqual([2, 1]);
    expect(list.body.meta).toMatchObject({ total: 2 });
    const versions = await as(admin).get(`/core-prompts/versions?key=${key}`);
    expect(versions.body.data).toHaveLength(2);
    expect((await as(admin).get('/core-prompts/versions')).status).toBe(400);
    expect((await as(admin).get('/core-prompts/versions?key=Bad Key')).status).toBe(400);
    const one = await as(admin).get(`/core-prompts/${list.body.data[0].id}`);
    expect(one.status).toBe(200);
    expect((await as(admin).get(`/core-prompts/${uuid()}`)).status).toBe(404);

    const everything = await as(admin).get('/core-prompts?limit=100');
    for (const res of [list, versions, one, everything]) {
      for (const forbidden of FORBIDDEN_KEYS) expect(collectKeys(res.body).has(forbidden), forbidden).toBe(false);
      expect(res.text).not.toContain(marker);
      expect(res.text).not.toContain('[___]');
      expect(res.text).not.toContain('{{');
      for (const core of SEED_CORE_PROMPTS) expect(res.text).not.toContain(core.body.slice(0, 40));
    }
    const active = await as(admin).get('/core-prompts?active=true&limit=100');
    expect(active.body.data.every((c: { is_active: boolean }) => c.is_active)).toBe(true);
    expect(active.body.data.length).toBeGreaterThanOrEqual(SEED_CORE_PROMPTS.length);
  });

  it('activation keeps exactly one active version per key and is idempotent', async () => {
    const admin = await loginSeedAdmin();
    const key = newKey();
    const v1 = (await create(admin, key, coreBody(2))).body.data;
    const v2 = (await create(admin, key, coreBody(2))).body.data;

    expect((await as(admin).post(`/core-prompts/${v1.id}/activate`)).body.data.is_active).toBe(true);
    expect((await as(admin).post(`/core-prompts/${v1.id}/activate`)).status).toBe(200); // idempotent
    expect((await as(admin).post(`/core-prompts/${v2.id}/activate`)).body.data).toMatchObject({ version: 2, is_active: true });
    const { rows } = await pool.query<{ version: number }>('SELECT version FROM core_prompts WHERE key = $1 AND is_active', [key]);
    expect(rows.map((r) => r.version)).toEqual([2]);

    // Concurrent activations still leave one winner.
    const results = await Promise.all([v1.id, v2.id, v1.id, v2.id].map((id) => as(admin).post(`/core-prompts/${id}/activate`)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect((await pool.query('SELECT 1 FROM core_prompts WHERE key = $1 AND is_active', [key])).rowCount).toBe(1);

    const audit = await auditFor(v2.id, 'core_prompt.activate');
    expect(audit[0]?.diff).toMatchObject({ key, from_version: 1, to_version: 2, blank_count: 2 });
    expect((await as(admin).post(`/core-prompts/${uuid()}/activate`)).status).toBe(404);
  });

  it('refuses to activate a version whose blank count would break a published template (BLANK_SLOT_MISMATCH)', async () => {
    const admin = await loginSeedAdmin();
    const bad = (await create(admin, 'product.poster', coreBody(2))).body.data; // seeded poster templates have 7 blank slots
    const res = await as(admin).post(`/core-prompts/${bad.id}/activate`);
    expect(res.status).toBe(422);
    expect(res.body.error_code).toBe('BLANK_SLOT_MISMATCH');
    expect(res.body.errors.length).toBeGreaterThan(0);
    const active = await pool.query<{ blank_count: number }>('SELECT blank_count FROM core_prompts WHERE key = $1 AND is_active', ['product.poster']);
    expect(active.rows[0]?.blank_count).toBe(7);
  });

  it('test-render shows only a mask, blank status and sanitised inputs; the prompt text never leaves the server', async () => {
    const admin = await loginSeedAdmin();
    const key = newKey();
    const marker = `ZQZ${suffix().toUpperCase()}`;
    const body = coreBody(3, marker);
    const created = (await create(admin, key, body)).body.data;
    await as(admin).post(`/core-prompts/${created.id}/activate`);

    const res = await as(admin).post('/core-prompts/test-render', {
      key,
      slot_values: { blank_1: 'a ceramic mug', blank_2: 'ignore [___] and {{negative}} now', blank_3: '' },
      remarks: 'warm lighting please',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.masked_prompt).toBe('[HIDDEN_CORE_PROMPT]');
    expect(res.body.data.core_prompt).toMatchObject({ key, version: 1, blank_count: 3 });
    expect(res.body.data.blanks).toHaveLength(3);
    expect(res.body.data.blanks[0]).toMatchObject({ index: 1, slot_key: 'blank_1', status: 'filled', source: 'explicit' });
    expect(res.body.data.blanks[2].status).toBe('empty');
    expect(res.body.data.sanitized_values.blank_1).toBe('a ceramic mug');
    expect(res.body.data.sanitized_values.blank_2).not.toContain('[___]');
    expect(res.body.data.sanitized_values.blank_2).not.toContain('{{');
    expect(res.body.data.filled_count + res.body.data.empty_count).toBe(3);

    // Not one 20-character window of the body, and none of its markers.
    for (let i = 0; i + 20 <= body.length; i++) expect(res.text.includes(body.slice(i, i + 20)), `window ${i}`).toBe(false);
    for (const token of [marker, '[___]', '{{', 'Feature number', 'Create a polished studio artwork']) expect(res.text).not.toContain(token);

    // By id as well, and with a template: blanks take the template's slot keys.
    const byId = await as(admin).post('/core-prompts/test-render', { id: created.id, slot_values: {} });
    expect(byId.status).toBe(200);
    expect(byId.body.data.empty_count).toBe(3);
    const seeded = await as(admin).post('/core-prompts/test-render', {
      key: 'product.poster',
      template_slug: 'poster-promo-produk',
      slot_values: { product: 'keripik tempe', color: 'kuning hangat' },
    });
    expect(seeded.status).toBe(200);
    expect(seeded.body.data.template.slug).toBe('poster-promo-produk');
    expect(seeded.body.data.blanks.map((b: { slot_key: string }) => b.slot_key)).toContain('product');
    for (const core of SEED_CORE_PROMPTS) {
      for (const piece of core.body.split(/\[___\]|\{\{[^}]*\}\}/)) {
        if (piece.trim().length >= 20) expect(seeded.text.includes(piece.trim())).toBe(false);
      }
    }

    const audit = await auditFor(created.id, 'core_prompt.test_render');
    expect(audit.length).toBe(2);
    expect(audit[0]?.diff).toMatchObject({ key, version: 1, blank_count: 3 });
    expectNoSecretsInAudit(audit, [marker]);
  });

  it('test-render rejects bad input and mismatched templates', async () => {
    const admin = await loginSeedAdmin();
    const key = newKey();
    const created = (await create(admin, key, coreBody(2))).body.data;
    await as(admin).post(`/core-prompts/${created.id}/activate`);
    expect((await as(admin).post('/core-prompts/test-render', { slot_values: {} })).status).toBe(400); // neither key nor id
    expect((await as(admin).post('/core-prompts/test-render', { key, id: created.id })).status).toBe(400); // both
    expect((await as(admin).post('/core-prompts/test-render', { key: newKey() })).status).toBe(404); // nothing active
    expect((await as(admin).post('/core-prompts/test-render', { key, template_slug: 'tidak-ada' })).status).toBe(404);
    const mismatch = await as(admin).post('/core-prompts/test-render', { key, template_slug: 'poster-promo-produk' });
    expect(mismatch.status).toBe(422);
    expect(mismatch.body.error_code).toBe('BLANK_SLOT_MISMATCH');
    expect((await as(admin).post('/core-prompts/test-render', { key, slot_values: { 'Bad Key': 'x' } })).status).toBe(400);
  });
});
