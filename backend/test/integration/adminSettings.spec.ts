import { afterAll, describe, expect, it } from 'vitest';
import { api, bearer, pool, registerUser } from '../helpers/api.js';
import { as, auditFor, expectNoSecretsInAudit, loginSeedAdmin, png, suffix, useSeededDatabase } from '../helpers/admin.js';
import { postGeneration } from '../helpers/pipeline.js';

useSeededDatabase();

// Snapshot of the seeded configuration, restored at the end so later files see what they expect.
let originalSettings: { key: string; value: unknown }[] = [];
let originalPolicy: { blocked_terms: string[]; moderation_level: string; disclaimers: unknown } | undefined;
let originalBrand: { name: string; palette: unknown; font_family: string | null; disclaimer: string | null } | undefined;

async function snapshot() {
  if (originalPolicy) return;
  originalSettings = (await pool.query<{ key: string; value: unknown }>('SELECT key, value FROM app_settings')).rows;
  originalPolicy = (await pool.query('SELECT blocked_terms, moderation_level, disclaimers FROM content_policies WHERE is_active')).rows[0];
  originalBrand = (await pool.query('SELECT name, palette, font_family, disclaimer FROM brand_identities WHERE is_default')).rows[0];
}

afterAll(async () => {
  if (!originalPolicy) return;
  for (const s of originalSettings) await pool.query('UPDATE app_settings SET value = $2::jsonb WHERE key = $1', [s.key, JSON.stringify(s.value)]);
  await pool.query('UPDATE content_policies SET blocked_terms = $1::text[], moderation_level = $2, disclaimers = $3::jsonb WHERE is_active', [
    originalPolicy.blocked_terms, originalPolicy.moderation_level, JSON.stringify(originalPolicy.disclaimers),
  ]);
  const b = originalBrand;
  if (b) await pool.query('UPDATE brand_identities SET name = $1, palette = $2::jsonb, font_family = $3, disclaimer = $4 WHERE is_default', [b.name, JSON.stringify(b.palette), b.font_family, b.disclaimer]);
});

describe('admin settings', () => {
  it('reads settings with the allowed values, and changes apply on the very next request', async () => {
    await snapshot();
    const admin = await loginSeedAdmin();
    const user = await registerUser();
    const before = await as(admin).get('/settings');
    expect(before.status).toBe(200);
    expect(before.body.data.settings).toMatchObject({ language: 'id', default_daily_limit: 10, watermark_enabled: false, max_references: 4 });
    expect(before.body.data.schema.language.values).toEqual(['id', 'en']);

    // The creator's own view reflects the new limit immediately (no stale cache).
    expect((await api().get('/api/v1/me').set(bearer(user.accessToken))).body.data.usage.daily_limit).toBe(10);
    const patched = await as(admin).patch('/settings', { default_daily_limit: 1, language: 'en', watermark_enabled: true });
    expect(patched.status).toBe(200);
    expect(patched.body.data.settings).toMatchObject({ default_daily_limit: 1, language: 'en', watermark_enabled: true });
    expect((await api().get('/api/v1/me').set(bearer(user.accessToken))).body.data.usage.daily_limit).toBe(1);
    expect((await as(admin).get('/settings')).body.data.settings.language).toBe('en');

    // And the limit is enforced for the next generation.
    const first = await postGeneration(user, { template_slug: 'poster-kegiatan-organisasi', slot_values: { title: 'Bazar', date_venue: 'Balai Desa' } });
    expect(first.status).toBe(202);
    await import('../../src/queue/index.js').then((q) => q.awaitQueueIdle());
    const second = await postGeneration(user, { template_slug: 'poster-kegiatan-organisasi', slot_values: { title: 'Bazar', date_venue: 'Balai Desa' } });
    expect(second.status).toBe(429);
    expect(second.body.error_code).toBe('DAILY_LIMIT_REACHED');
    await as(admin).patch('/settings', { default_daily_limit: 10, language: 'id', watermark_enabled: false });
    const third = await postGeneration(user, { template_slug: 'poster-kegiatan-organisasi', slot_values: { title: 'Bazar', date_venue: 'Balai Desa' } });
    expect(third.status).toBe(202);

    const audit = await auditFor(null, 'settings.update');
    expect(audit.length).toBeGreaterThanOrEqual(2);
    const changed = audit.map((a) => (a.diff.changed as Record<string, { from: unknown; to: unknown }>).default_daily_limit).find(Boolean);
    expect(changed).toEqual({ from: 10, to: 1 });
    expectNoSecretsInAudit(audit);
  });

  it('rejects unknown keys and values outside each key schema', async () => {
    await snapshot();
    const admin = await loginSeedAdmin();
    for (const [why, body] of Object.entries({
      'unknown key': { theme: 'dark' },
      'unknown mixed with known': { language: 'id', secret_flag: true },
      'language outside enum': { language: 'fr' },
      'limit wrong type': { default_daily_limit: '5' },
      'limit negative': { default_daily_limit: -1 },
      'limit not integer': { default_daily_limit: 2.5 },
      'limit too large': { default_daily_limit: 100000 },
      'watermark wrong type': { watermark_enabled: 'yes' },
      'max_references 0': { max_references: 0 },
      'max_references 13': { max_references: 13 },
      empty: {},
    })) {
      const res = await as(admin).patch('/settings', body);
      expect(res.status, why).toBe(400);
      expect(res.body.error_code, why).toBe('VALIDATION_ERROR');
    }
    expect((await as(admin).get('/settings')).body.data.settings.language).toBe('id');
  });
});

describe('admin brand identity', () => {
  it('reads and updates name, palette, font and disclaimer; validates values; replaces the logo', async () => {
    await snapshot();
    const admin = await loginSeedAdmin();
    const current = await as(admin).get('/brand-identity');
    expect(current.status).toBe(200);
    expect(current.body.data.palette).toHaveLength(5);

    const name = `Brand ${suffix()}`;
    const res = await as(admin).patch('/brand-identity', { name, palette: ['#112233', '#AABBCC'], font_family: 'Inter', disclaimer: 'Gambar dibuat dengan AI' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name, palette: ['#112233', '#AABBCC'], font_family: 'Inter', disclaimer: 'Gambar dibuat dengan AI' });
    expect((await as(admin).get('/brand-identity')).body.data.name).toBe(name);
    expect((await as(admin).patch('/brand-identity', { disclaimer: null })).body.data.disclaimer).toBeNull();

    for (const [why, body] of Object.entries({
      'colour name': { palette: ['red'] },
      'short hex': { palette: ['#fff'] },
      'too many colours': { palette: Array(13).fill('#112233') },
      'font injection': { font_family: 'Inter; drop' },
      'empty name': { name: '' },
      'unknown field': { logo_asset_id: 'x' },
      empty: {},
    })) {
      expect((await as(admin).patch('/brand-identity', body)).status, why).toBe(400);
    }

    const logo = await as(admin).upload('/brand-identity/logo', await png('#cc2200', 200, 200));
    expect(logo.status).toBe(200);
    expect(logo.body.data.logo_url).toContain('/files/');
    const second = await as(admin).upload('/brand-identity/logo', await png('#00cc22', 200, 200));
    expect(second.body.data.logo_url).not.toBe(logo.body.data.logo_url);
    expect((await as(admin).upload('/brand-identity/logo', Buffer.from('nope'))).status).toBe(400);
    expect((await as(admin).post('/brand-identity/logo')).status).toBe(400);
    expectNoSecretsInAudit(await auditFor(null, 'brand.update'));
  });
});

describe('admin content policy', () => {
  it('normalises and de-duplicates blocked terms, and a new term blocks the next generation at once', async () => {
    await snapshot();
    const admin = await loginSeedAdmin();
    const user = await registerUser();
    const word = `zzblock${suffix()}`;
    const body = { title: `Promo ${word}`, date_venue: 'Balai Desa' };
    const gen = { template_slug: 'poster-kegiatan-organisasi', slot_values: body };
    expect((await postGeneration(user, gen)).status).toBe(202);
    await import('../../src/queue/index.js').then((q) => q.awaitQueueIdle());

    const res = await as(admin).patch('/policy', { blocked_terms: [`  ${word.toUpperCase()}  `, word, `${word}   dua`, '', '   ', '!!!', 'Judi Online', 'judi   ONLINE'] });
    expect(res.status).toBe(200);
    expect(res.body.data.blocked_terms).toEqual([word, `${word} dua`, 'judi online']);

    const blocked = await postGeneration(user, gen);
    expect(blocked.status).toBe(422);
    expect(blocked.body.error_code).toBe('CONTENT_POLICY_VIOLATION');
    expect(blocked.text).not.toContain(word);
    await as(admin).patch('/policy', { blocked_terms: ['judi online'] });
    expect((await postGeneration(user, gen)).status).toBe(202);
    await import('../../src/queue/index.js').then((q) => q.awaitQueueIdle());

    const audit = await auditFor(null, 'policy.update');
    expect(audit.some((a) => a.diff.blocked_terms_added === 2 && a.diff.blocked_terms_total === 3)).toBe(true);
    expect(JSON.stringify(audit)).not.toContain(word);
  });

  it('the psa disclaimer is mandatory; other disclaimers can be removed; changes reach the public template at once', async () => {
    await snapshot();
    const admin = await loginSeedAdmin();
    for (const [why, body] of Object.entries({
      'psa null': { disclaimers: { psa: null } },
      'psa empty': { disclaimers: { psa: '   ' } },
      'unknown category': { disclaimers: { banner: 'x' } },
      'too long': { disclaimers: { poster: 'x'.repeat(501) } },
      'bad level': { moderation_level: 'paranoid' },
      'unknown field': { is_active: false },
      empty: {},
    })) {
      expect((await as(admin).patch('/policy', body)).status, why).toBe(400);
    }
    const psa = (await pool.query<{ slug: string }>("SELECT slug FROM templates WHERE category = 'psa' AND status = 'published' LIMIT 1")).rows[0] as { slug: string };
    const text = `Disclaimer baru ${suffix()}`;
    const res = await as(admin).patch('/policy', { moderation_level: 'strict', disclaimers: { psa: text, poster: 'Catatan poster', human_model: null } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ moderation_level: 'strict' });
    expect(res.body.data.disclaimers.psa).toBe(text);
    expect(res.body.data.disclaimers.human_model).toBeUndefined();
    expect((await api().get(`/api/v1/templates/${psa.slug}`)).body.data.disclaimer).toBe(text);
    expect((await as(admin).get('/policy')).body.data.moderation_level).toBe('strict');
    expectNoSecretsInAudit(await auditFor(null, 'policy.update'));
  });
});
