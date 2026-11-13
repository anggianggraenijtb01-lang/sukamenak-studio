import { describe, expect, it } from 'vitest';
import { containsForbiddenWords } from '../../src/engine/policy.js';
import { countBlanks, findUnknownPlaceholders } from '../../src/engine/placeholders.js';
import { SEED_CORE_PROMPTS } from '../../src/seed/data/corePrompts.js';
import { SEED_MODELS } from '../../src/seed/data/models.js';
import { SEED_TEMPLATES } from '../../src/seed/data/templates.js';
import { SEED_BREAKDOWNS, SEED_TUTORIALS } from '../../src/seed/data/tutorials.js';
import { resolveSlots } from '../../src/seed/templateSlots.js';

describe('seed data invariants', () => {
  it('has the five required core prompts', () => {
    expect(SEED_CORE_PROMPTS.map((c) => c.key).sort()).toEqual(
      ['human_model.portrait', 'product.poster', 'product.product_shot', 'product.psa', 'product.social_post'],
    );
  });

  it.each(SEED_CORE_PROMPTS.map((c) => [c.key, c] as const))('core prompt %s is well-formed', (_key, core) => {
    expect(findUnknownPlaceholders(core.body)).toEqual([]);
    expect(countBlanks(core.body)).toBe(core.blankKeys.length);
    expect(containsForbiddenWords(core.body)).toBe(false);
    expect(core.body).toContain('{{subject_lock}}');
    expect(core.body).toContain('{{negative}}');
    expect(core.body).toContain('{{aspect_ratio}}');
  });

  it('defines the 10 PRD templates with unique slugs', () => {
    expect(SEED_TEMPLATES).toHaveLength(10);
    expect(new Set(SEED_TEMPLATES.map((t) => t.slug)).size).toBe(10);
    expect(SEED_TEMPLATES.find((t) => t.category === 'psa')?.name).toBe('Banner Pengumuman Layanan Publik');
  });

  it.each(SEED_TEMPLATES.map((t) => [t.slug, t] as const))('template %s matches its core prompt', (_slug, template) => {
    const core = SEED_CORE_PROMPTS.find((c) => c.key === template.core_prompt_key);
    expect(core, 'core prompt exists').toBeDefined();
    const slots = resolveSlots(template, core as NonNullable<typeof core>);
    const blank = slots.filter((s) => s.blank_index !== null);
    expect(blank).toHaveLength(countBlanks((core as NonNullable<typeof core>).body));
    expect(new Set(blank.map((s) => s.blank_index)).size).toBe(blank.length);
    // Text slots (no blank) must each have a zone; every zone must sit inside the image.
    for (const s of slots.filter((x) => x.blank_index === null)) {
      expect(s.overlay, `${s.key} has a zone`).toBeDefined();
      const z = s.overlay?.zone as NonNullable<typeof s.overlay>['zone'];
      expect(z.x + z.w).toBeLessThanOrEqual(1);
      expect(z.y + z.h).toBeLessThanOrEqual(1);
    }
    // Subject matches the core prompt's subject; psa/human templates use the right core prompts.
    expect(core?.subject).toBe(template.subject);
    // Slot defaults never contain glyph words (they end up in the prompt).
    for (const s of blank) expect(containsForbiddenWords(s.default_value ?? ''), `${s.key} default`).toBe(false);
  });

  it('seeds tutorials with do / dont / what_to_do sections and six visual breakdowns', () => {
    expect(SEED_TUTORIALS).toHaveLength(6);
    for (const t of SEED_TUTORIALS) {
      const kinds = new Set(t.sections.map((s) => s.kind));
      expect(kinds, t.slug).toContain('what_to_do');
      expect(kinds, t.slug).toContain('do');
      expect(kinds, t.slug).toContain('dont');
    }
    expect(SEED_BREAKDOWNS.map((b) => b.aspect).sort()).toEqual(['angle', 'color', 'composition', 'gradient', 'lighting', 'style']);
  });

  it('keeps API key NAMES (not keys) on model candidates, all inactive', () => {
    const candidates = SEED_MODELS.filter((m) => m.provider !== 'mock');
    expect(candidates.length).toBeGreaterThanOrEqual(12);
    for (const m of candidates) {
      expect(m.is_active).toBe(false);
      expect(m.is_default).toBe(false);
      expect(m.api_key_env).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
    const mocks = SEED_MODELS.filter((m) => m.provider === 'mock');
    expect(mocks.map((m) => m.capability).sort()).toEqual(['i2i', 't2i', 'text', 'vision']);
    expect(mocks.every((m) => m.is_active && m.is_default)).toBe(true);
  });
});
