import { describe, expect, it } from 'vitest';
import type { TemplateDetail, TemplateSlot } from '../../api/types';
import {
  allowedModes,
  buildGenerationRequest,
  buildSlotValues,
  defaultUploadRole,
  imageSlots,
  initialSlotValues,
  needsConsent,
  overlaySlots,
  parseMaxReferences,
  pickDefaultTemplate,
  pickMode,
  referenceBadge,
  stepOfProgress,
  stepperStates,
  submitBlock,
  validateSlotValues,
  validateSubmission,
  visibleSlots,
} from './studioLogic';

const slot = (over: Partial<TemplateSlot> & { key: string }): TemplateSlot => ({
  label: over.key,
  type: 'text',
  target: 'image',
  required: false,
  default_value: null,
  options: null,
  max_length: null,
  reference_role: null,
  ...over,
});

const template = (over: Partial<TemplateDetail> = {}): TemplateDetail => ({
  id: 't1',
  slug: 'poster-promo-produk',
  name: 'Poster',
  description: '',
  category: 'poster',
  mode: 'i2i',
  subject: 'product',
  aspect_ratio: '4:5',
  requires_consent: false,
  preview_url: null,
  text_zones: [],
  example_references: [],
  disclaimer: null,
  slots: [
    slot({ key: 'product', required: true, default_value: 'a snack', max_length: 20, reference_role: 'product' }),
    slot({
      key: 'lighting',
      type: 'select',
      default_value: 'soft',
      options: [
        { value: 'soft', label: 'Lembut' },
        { value: 'warm', label: 'Hangat' },
      ],
    }),
    slot({ key: 'remarks', type: 'textarea', default_value: 'clean' }),
    slot({ key: 'title', target: 'overlay', required: true, max_length: 10 }),
    slot({ key: 'cta', target: 'overlay' }),
  ],
  ...over,
});

describe('modes', () => {
  it('offers only what the template allows, image-to-image first', () => {
    expect(allowedModes({ mode: 'i2i' })).toEqual(['i2i']);
    expect(allowedModes({ mode: 't2i' })).toEqual(['t2i']);
    expect(allowedModes({ mode: 'both' })).toEqual(['i2i', 't2i']);
  });

  it('defaults to image-to-image and ignores a mode the template does not allow', () => {
    expect(pickMode({ mode: 'both' })).toBe('i2i');
    expect(pickMode({ mode: 'both' }, 't2i')).toBe('t2i');
    expect(pickMode({ mode: 'i2i' }, 't2i')).toBe('i2i');
    expect(pickMode({ mode: 't2i' }, 'i2i')).toBe('t2i');
  });

  it('picks the first product template that supports the wanted mode', () => {
    const list = [
      { mode: 't2i' as const, subject: 'product' as const },
      { mode: 'i2i' as const, subject: 'human_model' as const },
      { mode: 'both' as const, subject: 'product' as const },
    ];
    expect(pickDefaultTemplate(list, 'i2i')).toBe(list[2]);
    expect(pickDefaultTemplate(list, 't2i')).toBe(list[0]);
    expect(pickDefaultTemplate([], 'i2i')).toBeUndefined();
  });
});

describe('slots', () => {
  it('hides the remarks slot (the free remarks field feeds it) and splits image/overlay', () => {
    const t = template();
    expect(visibleSlots(t).map((s) => s.key)).toEqual(['product', 'lighting', 'title', 'cta']);
    expect(imageSlots(t).map((s) => s.key)).toEqual(['product', 'lighting']);
    expect(overlaySlots(t).map((s) => s.key)).toEqual(['title', 'cta']);
  });

  it('starts selects on their default and everything else empty', () => {
    expect(initialSlotValues(template())).toEqual({ product: '', lighting: 'soft', title: '', cta: '' });
  });

  it('requires a slot only when it is required and has no default (same rule as the server)', () => {
    const errors = validateSlotValues(template(), { product: '', lighting: 'soft', title: '', cta: '' });
    expect(errors).toEqual({ 'slot_values.title': 'Wajib diisi' });
  });

  it('flags values that are too long or not among the options', () => {
    const errors = validateSlotValues(template(), { product: 'x'.repeat(21), lighting: 'nope', title: 'ok', cta: '' });
    expect(errors['slot_values.product']).toBe('Maksimal 20 karakter');
    expect(errors['slot_values.lighting']).toBe('Pilihan tidak valid');
    expect(errors['slot_values.title']).toBeUndefined();
  });

  it('sends only the template keys, trimmed, without empty values', () => {
    const values = buildSlotValues(template(), { product: '  keripik ', lighting: 'soft', title: 'Hai', cta: '   ', unknown: 'x', remarks: 'y' });
    expect(values).toEqual({ product: 'keripik', lighting: 'soft', title: 'Hai' });
  });

  it('starts the upload box on the role of the main reference slot', () => {
    expect(defaultUploadRole(template())).toBe('product');
    expect(defaultUploadRole(template({ slots: [slot({ key: 'model', required: true, reference_role: 'human_model' })], subject: 'human_model' }))).toBe('human_model');
    expect(defaultUploadRole(template({ slots: [], subject: 'human_model' }))).toBe('human_model');
    expect(defaultUploadRole(null)).toBe('product');
  });
});

describe('consent', () => {
  it('is needed for human-model templates and for any human_model reference', () => {
    expect(needsConsent({ subject: 'product', requires_consent: false }, [{ role: 'product' }])).toBe(false);
    expect(needsConsent({ subject: 'human_model', requires_consent: true }, [])).toBe(true);
    expect(needsConsent({ subject: 'product', requires_consent: false }, [{ role: 'human_model' }])).toBe(true);
    expect(needsConsent(null, [])).toBe(false);
  });
});

describe('buildGenerationRequest', () => {
  const base = { template: template(), values: { product: ' keripik ', lighting: 'warm', title: 'Hai', cta: '' }, remarks: '  cahaya pagi  ', consent: false };

  it('builds an i2i body with trimmed values, remarks and unique reference ids', () => {
    const body = buildGenerationRequest({
      ...base,
      mode: 'i2i',
      refs: [
        { id: 'r1', role: 'product' },
        { id: 'r1', role: 'product' },
        { id: 'r2', role: 'style' },
      ],
    });
    expect(body).toEqual({
      template_slug: 'poster-promo-produk',
      mode: 'i2i',
      slot_values: { product: 'keripik', lighting: 'warm', title: 'Hai' },
      remarks: 'cahaya pagi',
      reference_ids: ['r1', 'r2'],
    });
    expect('consent_confirmed' in body).toBe(false);
  });

  it('never sends references in t2i mode and omits empty remarks', () => {
    const body = buildGenerationRequest({ ...base, mode: 't2i', remarks: '   ', refs: [{ id: 'r1', role: 'product' }] });
    expect(body.reference_ids).toBeUndefined();
    expect(body.remarks).toBeUndefined();
    expect(body.mode).toBe('t2i');
  });

  it('sends the consent flag when the template shows people, or a human_model reference is used', () => {
    const human = template({ subject: 'human_model', requires_consent: true });
    expect(buildGenerationRequest({ ...base, template: human, mode: 'i2i', refs: [{ id: 'r1', role: 'product' }], consent: true }).consent_confirmed).toBe(true);
    expect(buildGenerationRequest({ ...base, mode: 'i2i', refs: [{ id: 'r9', role: 'human_model' }], consent: true }).consent_confirmed).toBe(true);
  });

  it('caps remarks at 1000 characters', () => {
    const body = buildGenerationRequest({ ...base, mode: 't2i', remarks: 'a'.repeat(1500), refs: [] });
    expect(body.remarks).toHaveLength(1000);
  });
});

describe('validateSubmission', () => {
  const t = template();
  const ok = { product: 'x', lighting: 'soft', title: 'Hai', cta: '' };

  it('asks for a photo in i2i mode but not in t2i mode', () => {
    expect(validateSubmission({ template: t, mode: 'i2i', values: ok, refs: [], maxReferences: 4 }).reference_ids).toMatch(/minimal 1 foto/);
    expect(validateSubmission({ template: t, mode: 't2i', values: ok, refs: [], maxReferences: 4 })).toEqual({});
  });

  it('rejects more references than allowed', () => {
    const refs = [1, 2, 3].map((n) => ({ id: `r${n}`, role: 'product' as const }));
    expect(validateSubmission({ template: t, mode: 'i2i', values: ok, refs, maxReferences: 2 }).reference_ids).toMatch(/Maksimal 2/);
  });
});

describe('submitBlock', () => {
  const free = { template: {}, remainingToday: 5, consentNeeded: false, consentGiven: false, uploading: false, generating: false };

  it('lets a ready form through', () => {
    expect(submitBlock(free)).toBeNull();
    expect(submitBlock({ ...free, remainingToday: null })).toBeNull();
  });

  it('blocks on the daily limit, missing consent, uploads and a running generation (in that priority)', () => {
    expect(submitBlock({ ...free, template: null })).toBe('no_template');
    expect(submitBlock({ ...free, remainingToday: 0 })).toBe('daily_limit');
    expect(submitBlock({ ...free, consentNeeded: true })).toBe('consent');
    expect(submitBlock({ ...free, consentNeeded: true, consentGiven: true })).toBeNull();
    expect(submitBlock({ ...free, uploading: true })).toBe('uploading');
    expect(submitBlock({ ...free, generating: true, remainingToday: 0 })).toBe('generating');
    expect(submitBlock({ ...free, remainingToday: 0, consentNeeded: true })).toBe('daily_limit');
  });
});

describe('stepper mapping', () => {
  it('maps the real progress_step onto the four steps', () => {
    expect(stepOfProgress('analysis')).toBe(1);
    expect(stepOfProgress('compose')).toBe(2);
    expect(stepOfProgress('generate')).toBe(3);
    expect(stepOfProgress('composite')).toBe(3);
    expect(stepOfProgress('done')).toBe(4);
    expect(stepOfProgress(null)).toBe(1);
  });

  it('marks earlier steps done and the current one running', () => {
    expect(stepperStates(null)).toEqual(['pending', 'pending', 'pending', 'pending']);
    expect(stepperStates({ status: 'queued', progress_step: null })).toEqual(['running', 'pending', 'pending', 'pending']);
    expect(stepperStates({ status: 'running', progress_step: 'compose' })).toEqual(['done', 'running', 'pending', 'pending']);
    expect(stepperStates({ status: 'running', progress_step: 'composite' })).toEqual(['done', 'done', 'running', 'pending']);
  });

  it('finishes all four on done and shows where a failure stopped', () => {
    expect(stepperStates({ status: 'done', progress_step: 'done' })).toEqual(['done', 'done', 'done', 'done']);
    expect(stepperStates({ status: 'failed', progress_step: 'generate' })).toEqual(['done', 'done', 'failed', 'pending']);
  });
});

describe('honest reference badge', () => {
  it('says whether the reference was really used', () => {
    expect(referenceBadge({ used_reference_image: true, reference_count_used: 2 })).toBe('Referensi: Dipakai langsung (2)');
    expect(referenceBadge({ used_reference_image: false, reference_count_used: 0 })).toBe('Teks saja');
  });
});

describe('parseMaxReferences', () => {
  it('reads the limit out of the server explanation', () => {
    expect(parseMaxReferences('Maksimal 6 gambar referensi per pembuatan')).toBe(6);
    expect(parseMaxReferences('Batas 50 referensi tersimpan tercapai')).toBeNull();
    expect(parseMaxReferences(undefined)).toBeNull();
    expect(parseMaxReferences('Maksimal 99 gambar')).toBeNull();
  });
});
