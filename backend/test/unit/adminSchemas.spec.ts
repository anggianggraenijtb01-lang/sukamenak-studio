import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { apiKeyEnvName, createModelSchemas } from '../../src/modules/admin/models/schemas.js';
import { createZoneSchemas, updateTemplateSchemas } from '../../src/modules/admin/templates/schemas.js';
import { normaliseBlockedTerms } from '../../src/modules/admin/settings/service.js';
import { SETTING_SCHEMAS, updateSettingsSchemas, updatePolicySchemas } from '../../src/modules/admin/settings/schemas.js';
import { CORE_PROMPT_KEY, createCorePromptSchemas, testRenderSchemas } from '../../src/modules/admin/corePrompts/schemas.js';
import { validateCoreBody, HIDDEN_MARKER } from '../../src/modules/admin/corePrompts/service.js';
import { dateOnly, escapeLike, Where } from '../../src/modules/admin/common.js';
import { SEED_CORE_PROMPTS } from '../../src/seed/data/corePrompts.js';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');
const sql = (name: string) => readFileSync(path.join(migrations, name), 'utf8');

describe('Zod schemas mirror the database CHECK constraints', () => {
  it('api_key_env regex is the one in the model_configs migration', () => {
    const migration = sql('1794000000004_models_settings.sql');
    const pattern = /api_key_env\s+~\s+'([^']+)'/.exec(migration)?.[1];
    expect(pattern).toBeTruthy();
    const db = new RegExp(pattern as string);
    for (const value of ['GEMINI_API_KEY', 'A', 'FAL_KEY', 'sk-123', 'gemini_key', '1KEY', 'KEY WITH SPACE', 'KEY-DASH', '', 'KEY\n', 'a'.repeat(5)]) {
      expect(apiKeyEnvName.safeParse(value).success, value).toBe(db.test(value) && value.length <= 80 && value !== 'KEY\n');
    }
  });

  it('core prompt key regex is the one in the core_prompts migration', () => {
    const pattern = /key ~ '([^']+)'/.exec(sql('1794000000003_catalog.sql'))?.[1] as string;
    const db = new RegExp(pattern);
    for (const value of ['product.poster', 'a.b.c', 'product', 'Product.poster', 'product.', '.x', 'x.1y', 'x.y_z']) {
      expect(CORE_PROMPT_KEY.test(value), value).toBe(db.test(value));
    }
  });

  it('text zone bounds match CHECK (x + w <= 1.0001 AND y + h <= 1.0001)', () => {
    const ok = createZoneSchemas.body.safeParse({ slot_key: 'title', x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
    expect(ok.success).toBe(true);
    expect(createZoneSchemas.body.safeParse({ slot_key: 'title', x: 0.5, y: 0.5, w: 0.6, h: 0.1 }).success).toBe(false);
    expect(createZoneSchemas.body.safeParse({ slot_key: 'title', x: 0.5, y: 0.5, w: 0.1, h: 0.6 }).success).toBe(false);
    expect(createZoneSchemas.body.safeParse({ slot_key: 'title', x: 0, y: 0, w: 0, h: 0.1 }).success).toBe(false);
  });

  it('create model requires the right fields per provider', () => {
    const base = { name: 'Model X', capability: 't2i', model_id: 'm' };
    expect(createModelSchemas.body.safeParse({ ...base, provider: 'mock' }).success).toBe(true);
    expect(createModelSchemas.body.safeParse({ ...base, provider: 'gemini', api_key_env: 'GEMINI_API_KEY' }).success).toBe(true);
    expect(createModelSchemas.body.safeParse({ ...base, provider: 'gemini' }).success).toBe(false);
    expect(createModelSchemas.body.safeParse({ ...base, provider: 'openai_compat', api_key_env: 'OPENAI_API_KEY' }).success).toBe(false);
    expect(createModelSchemas.body.safeParse({ ...base, provider: 'openai_compat', api_key_env: 'OPENAI_API_KEY', base_url: 'https://api.openai.com/v1' }).success).toBe(true);
  });
});

describe('settings, policy and template schemas', () => {
  it('every setting has its own schema and unknown keys are rejected', () => {
    expect(Object.keys(SETTING_SCHEMAS).sort()).toEqual(['default_daily_limit', 'language', 'max_references', 'watermark_enabled']);
    expect(updateSettingsSchemas.body.safeParse({ language: 'en' }).success).toBe(true);
    expect(updateSettingsSchemas.body.safeParse({ language: 'en', extra: 1 }).success).toBe(false);
    expect(updateSettingsSchemas.body.safeParse({}).success).toBe(false);
    expect(updateSettingsSchemas.body.safeParse({ max_references: 13 }).success).toBe(false);
  });

  it('policy disclaimers only accept known publication categories', () => {
    expect(updatePolicySchemas.body.safeParse({ disclaimers: { psa: 'x', poster: null } }).success).toBe(true);
    expect(updatePolicySchemas.body.safeParse({ disclaimers: { banner: 'x' } }).success).toBe(false);
    expect(updatePolicySchemas.body.safeParse({ blocked_terms: ['a'], moderation_level: 'strict' }).success).toBe(true);
  });

  it('template update needs at least one field and a valid slug', () => {
    expect(updateTemplateSchemas.body.safeParse({}).success).toBe(false);
    expect(updateTemplateSchemas.body.safeParse({ slug: 'Bad Slug' }).success).toBe(false);
    expect(updateTemplateSchemas.body.safeParse({ name: 'Nama' }).success).toBe(true);
  });

  it('normaliseBlockedTerms lowercases, collapses spaces, drops empties and duplicates', () => {
    expect(normaliseBlockedTerms(['  Judi   ONLINE ', 'judi online', 'JUDI-ONLINE', '', '   ', '!!!', 'Narkoba', 'narkoba'])).toEqual(['judi online', 'narkoba']);
    expect(normaliseBlockedTerms([])).toEqual([]);
  });
});

describe('core prompt body validation', () => {
  const GOOD = 'Create a polished artwork in {{aspect_ratio}} showing [___] on a calm surface.';
  it('accepts a well-formed body and counts its blanks', () => {
    expect(validateCoreBody(GOOD)).toBe(1);
    for (const core of SEED_CORE_PROMPTS) expect(validateCoreBody(core.body), core.key).toBe(core.blankKeys.length);
  });

  it('rejects each rule with the documented error code and never quotes the body', () => {
    const attempts: [string, string, string][] = [
      ['no blank', 'Create a polished artwork in {{aspect_ratio}} on a calm surface.', 'VALIDATION_ERROR'],
      ['unknown placeholder', `${GOOD} {{leak_me_please}}`, 'UNKNOWN_PLACEHOLDER'],
      ['malformed blank', `${GOOD} and [____] also`, 'VALIDATION_ERROR'],
      ['glyph word', `${GOOD} with a headline`, 'VALIDATION_ERROR'],
    ];
    for (const [why, body, code] of attempts) {
      let error: { code?: string; message?: string; errors?: unknown } | undefined;
      try {
        validateCoreBody(body);
      } catch (e) {
        error = e as typeof error;
      }
      expect(error?.code, why).toBe(code);
      expect(JSON.stringify(error), why).not.toContain('leak_me_please');
      expect(JSON.stringify(error), why).not.toContain('polished artwork');
    }
    expect(HIDDEN_MARKER).toBe('[HIDDEN_CORE_PROMPT]');
  });

  it('create and test-render schemas keep the body write-only and the selector exclusive', () => {
    expect(createCorePromptSchemas.body.safeParse({ key: 'a.b', subject: 'product', publication: 'poster', body: GOOD }).success).toBe(true);
    expect(createCorePromptSchemas.body.safeParse({ key: 'a.b', subject: 'product', publication: 'poster', body: GOOD, is_active: true }).success).toBe(false);
    expect(testRenderSchemas.body.safeParse({ key: 'a.b' }).success).toBe(true);
    expect(testRenderSchemas.body.safeParse({ key: 'a.b', id: '0e5c0f2e-1111-4111-8111-111111111111' }).success).toBe(false);
    expect(testRenderSchemas.body.safeParse({}).success).toBe(false);
  });
});

describe('admin helpers', () => {
  it('dateOnly accepts real calendar dates only', () => {
    expect(dateOnly.safeParse('2026-02-28').success).toBe(true);
    expect(dateOnly.safeParse('2026-02-30').success).toBe(false);
    expect(dateOnly.safeParse('28-02-2026').success).toBe(false);
    expect(dateOnly.safeParse('2026-13-01').success).toBe(false);
  });

  it('escapeLike neutralises LIKE wildcards', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('Where builds numbered placeholders', () => {
    const w = new Where('a = 1').add((p) => `b = ${p}`, 'x');
    const tz = w.param('UTC');
    w.add((p) => `c > ${p}::date AND d = ${tz}`, '2026-01-01').raw('e IS NULL');
    expect(w.sql).toBe('WHERE a = 1 AND b = $1 AND c > $3::date AND d = $2 AND e IS NULL');
    expect(w.params).toEqual(['x', 'UTC', '2026-01-01']);
    expect(w.next()).toBe('$4');
    expect(new Where().sql).toBe('');
  });
});
