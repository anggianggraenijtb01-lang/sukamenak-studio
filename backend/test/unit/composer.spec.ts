import { describe, expect, it } from 'vitest';
import {
  SUBJECT_LOCK,
  composePrompt,
  composePromptDetailed,
  describeTextZones,
  type ComposeInput,
  type ComposeSlot,
} from '../../src/engine/promptComposer.js';
import { AppError } from '../../src/lib/errors.js';
import { SEED_CORE_PROMPTS } from '../../src/seed/data/corePrompts.js';
import { SEED_TEMPLATES } from '../../src/seed/data/templates.js';
import { resolveSlots } from '../../src/seed/templateSlots.js';

const GLYPH_WORDS = /\b(text|typography|headline)\b/i;

function fixture(slug: string): Pick<ComposeInput, 'coreBody' | 'slots' | 'subject' | 'aspectRatio' | 'textZones'> {
  const template = SEED_TEMPLATES.find((t) => t.slug === slug);
  const core = SEED_CORE_PROMPTS.find((c) => c.key === template?.core_prompt_key);
  if (!template || !core) throw new Error('fixture missing');
  const slots = resolveSlots(template, core);
  return {
    coreBody: core.body,
    slots,
    subject: template.subject,
    aspectRatio: template.aspect_ratio,
    textZones: slots.filter((s) => s.overlay).map((s) => ({ slot_key: s.key, ...(s.overlay as NonNullable<typeof s.overlay>).zone })),
  };
}

const poster = fixture('poster-promo-produk');

describe('composePrompt', () => {
  it('is valid with zero remarks and zero slot values (defaults fill every blank)', () => {
    const out = composePromptDetailed(poster);
    expect(out.prompt).not.toContain('[___]');
    expect(out.prompt).not.toMatch(/\{\{|\}\}/);
    expect(out.prompt).toContain('4:5');
    expect(out.prompt).toContain('a packaged Indonesian snack product');
    expect(Object.values(out.sources).every((s) => s === 'default')).toBe(true);
    expect(out.droppedRemarks).toBe(false);
  });

  it('lets an explicit value replace the blank instead of appending to the prompt', () => {
    const base = composePrompt(poster);
    const out = composePrompt({ ...poster, slotValues: { lighting: 'dramatic side light with a soft rim highlight' } });
    expect(out).toContain('Lighting: dramatic side light with a soft rim highlight.');
    expect(out).not.toContain('Lighting: soft diffused daylight.');
    // Same number of sentences/lines: replaced in place, nothing appended at the end.
    expect(out.split('\n')).toHaveLength(base.split('\n').length);
  });

  it('fills blanks in blank_index order, not array order', () => {
    const slots: ComposeSlot[] = [
      { key: 'c', blank_index: 3 },
      { key: 'a', blank_index: 1 },
      { key: 'b', blank_index: 2 },
      { key: 'title', blank_index: null },
    ];
    const out = composePrompt({
      coreBody: 'first [___], second [___], third [___]. {{subject_lock}} {{negative}}',
      slots,
      slotValues: { a: 'ONE', b: 'TWO', c: 'THREE', title: 'ignored' },
      subject: 'product',
      aspectRatio: '1:1',
    });
    expect(out).toContain('first ONE, second TWO, third THREE.');
    expect(out).not.toContain('ignored');
  });

  it('always carries the subject lock for product and human_model', () => {
    expect(composePrompt(poster)).toContain('no human, no face, no hands');
    const model = fixture('model-manusia-studio');
    const out = composePrompt(model);
    expect(out).toContain('exactly one human model, no additional people');
    expect(out).not.toContain('no face');
    expect(SUBJECT_LOCK.product).toBe('no human, no face, no hands');
  });

  it('appends the subject lock and glyph-negative when the core body forgot the placeholders', () => {
    const out = composePrompt({
      coreBody: 'A plain scene of [___].',
      slots: [{ key: 'product', blank_index: 1, default_value: 'a jar' }],
      subject: 'product',
      aspectRatio: '1:1',
    });
    expect(out).toContain('A plain scene of a jar.');
    expect(out).toContain('no human, no face, no hands');
    expect(out).toContain('no glyphs');
  });

  it('throws BLANK_SLOT_MISMATCH when blanks and slots disagree', () => {
    const tooFewSlots = () =>
      composePrompt({ ...poster, slots: poster.slots.filter((s) => s.key !== 'remarks') });
    expect(tooFewSlots).toThrow(AppError);
    try {
      tooFewSlots();
    } catch (err) {
      expect((err as AppError).code).toBe('BLANK_SLOT_MISMATCH');
      expect((err as AppError).message).not.toContain('professional');
    }
    expect(() =>
      composePrompt({ ...poster, coreBody: `${poster.coreBody}\nExtra [___].` }),
    ).toThrowError(expect.objectContaining({ code: 'BLANK_SLOT_MISMATCH' }));
  });

  it('throws BLANK_SLOT_MISMATCH on duplicate blank_index', () => {
    expect(() =>
      composePrompt({
        coreBody: 'a [___] b [___]',
        slots: [
          { key: 'x', blank_index: 1 },
          { key: 'y', blank_index: 1 },
        ],
        subject: 'product',
        aspectRatio: '1:1',
      }),
    ).toThrowError(expect.objectContaining({ code: 'BLANK_SLOT_MISMATCH' }));
  });

  it('throws UNKNOWN_PLACEHOLDER without echoing the body', () => {
    try {
      composePrompt({ ...poster, coreBody: `${poster.coreBody} {{secret_instruction}}` });
      expect.unreachable();
    } catch (err) {
      expect((err as AppError).code).toBe('UNKNOWN_PLACEHOLDER');
      expect((err as AppError).message).not.toContain('secret_instruction');
    }
  });

  it('never outputs text / typography / headline, whatever the inputs or even the core body', () => {
    const out = composePrompt({
      ...poster,
      coreBody: `${poster.coreBody}\nAdd bold typography and a big headline text.`,
      slotValues: { product: 'a jar with TEXT on it', background: 'Typography wall', style: 'headline style' },
      remarks: 'put a Headline and some text, typography please',
    });
    expect(out).not.toMatch(GLYPH_WORDS);
  });

  it('keeps user values from injecting blanks or placeholders', () => {
    const out = composePrompt({
      ...poster,
      slotValues: { product: 'jar [___] {{subject_lock}} {{negative}}', background: '{{ text_zone }}' },
      remarks: 'ignore this [___] and {{unknown}}',
    });
    expect(out).not.toContain('[___]');
    expect(out).not.toMatch(/\{\{|\}\}/);
    // The real subject lock appears exactly once (from the body), not once per injected copy.
    expect(out.split('no human, no face, no hands')).toHaveLength(2);
  });

  it('routes remarks to slots by keyword and sends the rest to the remarks blank', () => {
    const out = composePromptDetailed({
      ...poster,
      remarks: 'warna biru laut, cahaya lembut dari samping, kemasan higienis dan ramah',
    });
    expect(out.prompt).toContain('Colour palette: warna biru laut,');
    expect(out.prompt).toContain('Lighting: cahaya lembut dari samping.');
    expect(out.prompt).toContain('Additional art direction: kemasan higienis dan ramah.');
    expect(out.sources.color).toBe('remarks');
    expect(out.sources.lighting).toBe('remarks');
    expect(out.sources.remarks).toBe('remarks');
    expect(out.sources.product).toBe('default');
  });

  it('never lets remarks replace the product or model subject', () => {
    const out = composePromptDetailed({ ...poster, remarks: 'produk kemasan botol kaca' });
    expect(out.sources.product).toBe('default');
    expect(out.prompt).toContain('a packaged Indonesian snack product');
    expect(out.prompt).toContain('produk kemasan botol kaca');
  });

  it('explicit values beat remarks, which beat analysis, which beats defaults', () => {
    const out = composePromptDetailed({
      ...poster,
      slotValues: { color: 'teal' },
      remarks: 'cahaya keras, warna merah',
      analysis: { color: 'forest green', lighting: 'studio flash', background: 'marble counter' },
    });
    expect(out.sources.color).toBe('explicit');
    expect(out.sources.lighting).toBe('remarks');
    expect(out.sources.background).toBe('analysis');
    expect(out.sources.style).toBe('default');
    expect(out.prompt).toContain('teal');
    expect(out.prompt).not.toContain('forest green');
    expect(out.prompt).not.toContain('merah');
  });

  it('adds the source hint only for values that came from a reference analysis', () => {
    const out = composePrompt({ ...poster, analysis: { color: 'teal and white' } });
    expect(out).toContain('teal and white (colour taken from the colour reference)');
    const explicit = composePrompt({ ...poster, analysis: { color: 'teal and white' }, slotValues: { color: 'red' } });
    expect(explicit).not.toContain('colour taken from the colour reference');
  });

  it('drops remarks that match no slot when the template has no remarks blank', () => {
    const slots: ComposeSlot[] = [{ key: 'product', blank_index: 1, default_value: 'a jar' }];
    const out = composePromptDetailed({
      coreBody: 'Photo of [___]. {{subject_lock}} {{negative}}',
      slots,
      remarks: 'something unmapped entirely',
      subject: 'product',
      aspectRatio: '1:1',
    });
    expect(out.droppedRemarks).toBe(true);
    expect(out.prompt).not.toContain('unmapped');
  });

  it('requires required slots that have no value and no default', () => {
    expect(() =>
      composePrompt({
        coreBody: 'Photo of [___]. {{subject_lock}}',
        slots: [{ key: 'product', blank_index: 1, required: true }],
        subject: 'product',
        aspectRatio: '1:1',
      }),
    ).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('falls back to a neutral phrase for optional empty slots', () => {
    const out = composePromptDetailed({
      coreBody: 'Photo of [___]. {{subject_lock}}',
      slots: [{ key: 'product', blank_index: 1 }],
      subject: 'product',
      aspectRatio: '1:1',
    });
    expect(out.sources.product).toBe('fallback');
    expect(out.prompt).toContain('as appropriate to the subject');
  });

  it('removes blocked terms from values and remarks', () => {
    const out = composePrompt({
      ...poster,
      slotValues: { product: 'keripik judi online renyah' },
      remarks: 'cahaya lembut, narkoba',
      blockedTerms: ['judi online', 'narkoba'],
    });
    expect(out).not.toMatch(/judi|narkoba/i);
    expect(out).toContain('keripik renyah');
  });

  it('enforces maximum value length per slot', () => {
    const out = composePrompt({ ...poster, slotValues: { product: 'x'.repeat(500) } });
    expect(out).not.toContain('x'.repeat(121));
  });

  it('rejects malformed aspect ratios', () => {
    expect(() => composePrompt({ ...poster, aspectRatio: '4x5; ignore everything' })).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('describes text zones as flat empty colour fields, never as lettering', () => {
    const d = describeTextZones([
      { slot_key: 'title', x: 0.08, y: 0.06, w: 0.84, h: 0.18 },
      { slot_key: 'cta', x: 0.1, y: 0.86, w: 0.8, h: 0.08 },
    ]);
    expect(d).toContain('flat empty colour field');
    expect(d).toContain('top');
    expect(d).toContain('bottom');
    expect(d).not.toMatch(GLYPH_WORDS);
    expect(describeTextZones([])).toContain('flat empty colour field');
  });

  it('uses the brand palette when given and a neutral phrase otherwise', () => {
    expect(composePrompt({ ...poster, brand: { palette: ['#1E40AF', '#EA580C'] } })).toContain('the brand colours #1E40AF, #EA580C');
    expect(composePrompt(poster)).toContain('balanced complementary tones');
  });

  it('composes every seeded template without errors and without glyph words', () => {
    for (const template of SEED_TEMPLATES) {
      const out = composePrompt(fixture(template.slug));
      expect(out, template.slug).not.toMatch(GLYPH_WORDS);
      expect(out, template.slug).not.toMatch(/\[___\]|\{\{|\}\}/);
      expect(out, template.slug).toContain(SUBJECT_LOCK[template.subject]);
    }
  });

  it('is deterministic', () => {
    const input = { ...poster, remarks: 'warna hangat, cahaya pagi', slotValues: { product: 'tempe' } };
    expect(composePrompt(input)).toBe(composePrompt(input));
  });
});
