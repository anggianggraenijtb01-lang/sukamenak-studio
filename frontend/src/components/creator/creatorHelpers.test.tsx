import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GenerationErrorNotice, GenerationStepper, describeGenerationProblem } from './GenerationNotices';
import { MiniMarkdown, parseBlocks } from './MiniMarkdown';
import { aspectRatioValue, generationTitle, isStaleActive, relativeTime, resultFileName } from './format';
import { checkImageFile } from './useReferences';
import { estimateCompactness } from './promptAnalysis';
import { studioHandoff, readStudioHandoff } from './handoff';
import { defaultPromptTitle } from './SavedPrompts';
import { matchesFilter } from '../../pages/creator/Gallery';
import { validatePasswordChange } from '../../pages/creator/ProfilePage';
import { hexOf } from './SlotField';

describe('generation error states', () => {
  it.each([
    ['DAILY_LIMIT_REACHED', 'Batas harian tercapai'],
    ['CONSENT_REQUIRED', 'Persetujuan diperlukan'],
    ['CONTENT_POLICY_VIOLATION', 'Konten tidak diizinkan'],
    ['RATE_LIMIT_EXCEEDED', 'Terlalu banyak permintaan'],
    ['NO_MODEL_AVAILABLE', 'Layanan sedang tidak tersedia'],
  ])('%s has its own title', (code, title) => {
    expect(describeGenerationProblem(code).title).toBe(title);
  });

  it('falls back to a generic failure with the mapped reason for stored provider codes', () => {
    const p = describeGenerationProblem('PROVIDER_TIMEOUT');
    expect(p.title).toBe('Desain belum berhasil dibuat');
    expect(p.message).toMatch(/terlalu lama/);
  });

  it('renders an alert carrying the code and never raw server text', () => {
    render(<GenerationErrorNotice code="DAILY_LIMIT_REACHED" />);
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('data-error-code')).toBe('DAILY_LIMIT_REACHED');
    expect(alert.textContent).toMatch(/Batas harian tercapai/);
  });
});

describe('GenerationStepper', () => {
  const states = () => Array.from(document.querySelectorAll('[data-step-state]')).map((e) => e.getAttribute('data-step-state'));

  it('shows the polled progress_step on the four steps', () => {
    const { rerender } = render(<GenerationStepper generation={{ status: 'running', progress_step: 'compose' }} />);
    expect(states()).toEqual(['done', 'running', 'pending', 'pending']);
    rerender(<GenerationStepper generation={{ status: 'done', progress_step: 'done' }} />);
    expect(states()).toEqual(['done', 'done', 'done', 'done']);
    rerender(<GenerationStepper generation={{ status: 'failed', progress_step: 'generate' }} />);
    expect(states()).toEqual(['done', 'done', 'failed', 'pending']);
  });
});

describe('MiniMarkdown', () => {
  it('parses paragraphs and lists', () => {
    expect(parseBlocks('Intro\n\n1. satu\n2. dua\n\n- a\n- b')).toEqual([
      { type: 'p', text: 'Intro' },
      { type: 'ol', items: ['satu', 'dua'] },
      { type: 'ul', items: ['a', 'b'] },
    ]);
  });

  it('renders bold and never injects markup', () => {
    const { container } = render(<MiniMarkdown source={'Pilih **template** <img src=x onerror=alert(1)>'} />);
    expect(container.querySelector('strong')?.textContent).toBe('template');
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x');
  });
});

describe('format helpers', () => {
  const now = new Date('2026-11-14T12:00:00Z');

  it('formats relative time in Indonesian', () => {
    expect(relativeTime('2026-11-14T11:59:50Z', now)).toBe('Baru saja');
    expect(relativeTime('2026-11-14T11:50:00Z', now)).toBe('10 menit lalu');
    expect(relativeTime('2026-11-14T09:00:00Z', now)).toBe('3 jam lalu');
    expect(relativeTime('2026-11-13T11:00:00Z', now)).toBe('Kemarin');
    expect(relativeTime('2026-11-09T12:00:00Z', now)).toBe('5 hari lalu');
  });

  it('parses ratios with a safe fallback', () => {
    expect(aspectRatioValue('4:5')).toBeCloseTo(0.8);
    expect(aspectRatioValue('16:9')).toBeCloseTo(16 / 9);
    expect(aspectRatioValue('bad')).toBeCloseTo(0.8);
    expect(aspectRatioValue(null)).toBeCloseTo(0.8);
  });

  it('titles a generation from its title slot, else the template name', () => {
    expect(generationTitle({ slot_values: { title: 'Keripik' }, template: { id: '1', slug: 's', name: 'Poster' } })).toBe('Keripik');
    expect(generationTitle({ slot_values: {}, template: { id: '1', slug: 's', name: 'Poster' } })).toBe('Poster');
    expect(generationTitle({ slot_values: {}, template: null })).toBe('Hasil Desain');
  });

  it('builds a safe file name', () => {
    expect(resultFileName('Keripik Tempe: Gurih!')).toBe('keripik-tempe-gurih-hd.png');
    expect(resultFileName('???')).toBe('desain-hd.png');
  });

  it('treats an old queued/running generation as stuck, but not finished or fresh ones', () => {
    expect(isStaleActive({ status: 'running', created_at: '2026-11-14T11:00:00Z' }, now)).toBe(true);
    expect(isStaleActive({ status: 'running', created_at: '2026-11-14T11:58:00Z' }, now)).toBe(false);
    expect(isStaleActive({ status: 'done', created_at: '2026-11-01T11:00:00Z' }, now)).toBe(false);
  });
});

describe('upload checks', () => {
  it('accepts jpeg/png/webp up to 8 MB only', () => {
    expect(checkImageFile({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(checkImageFile({ type: 'image/gif', size: 1000 })).toMatch(/JPG, PNG/);
    expect(checkImageFile({ type: 'image/png', size: 9 * 1024 * 1024 })).toMatch(/8 MB/);
    expect(checkImageFile({ type: 'image/png', size: 0 })).toMatch(/kosong/);
  });
});

describe('prompt compactness estimate', () => {
  it('is empty without text and flags filler words', () => {
    expect(estimateCompactness('   ').source).toBe('none');
    const view = estimateCompactness('tolong buatkan foto yang sangat bagus');
    expect(view.source).toBe('estimate');
    expect(view.fillerWords).toEqual(expect.arrayContaining(['tolong', 'sangat', 'bagus']));
    expect(view.suggestions.some((s) => /pengisi/.test(s))).toBe(true);
  });

  it('scores a concrete prompt higher than a padded one', () => {
    const tight = estimateCompactness('Foto kemasan keripik tempe di meja kayu, cahaya studio hangat, latar netral, komposisi di tengah');
    const padded = estimateCompactness('tolong dong sangat bagus banget keren sih ya');
    expect(tight.score).toBeGreaterThan(padded.score);
  });
});

describe('Advisor to Studio hand-off', () => {
  it('travels as router state and tolerates anything else', () => {
    expect(readStudioHandoff(studioHandoff('  cahaya pagi '))).toEqual({ prompt: 'cahaya pagi' });
    expect(readStudioHandoff(null)).toBeNull();
    expect(readStudioHandoff({ prompt: 5 })).toBeNull();
    expect(readStudioHandoff({ prompt: '  ' })).toBeNull();
  });

  it('gives saved prompts a short default title', () => {
    expect(defaultPromptTitle('Foto kemasan keripik tempe di atas meja kayu dengan cahaya hangat')).toBe('Foto kemasan keripik tempe di atas');
    expect(defaultPromptTitle('   ')).toBe('Prompt saya');
  });
});

describe('page rules', () => {
  it('filters the gallery by category chip and search', () => {
    const fields = { category: 'poster', text: ['Poster Promo Produk', 'ruang judul'] };
    expect(matchesFilter(fields, 'all', '')).toBe(true);
    expect(matchesFilter(fields, 'poster', 'JUDUL')).toBe(true);
    expect(matchesFilter(fields, 'psa', '')).toBe(false);
    expect(matchesFilter(fields, 'all', 'kopi')).toBe(false);
  });

  it('validates a password change', () => {
    expect(validatePasswordChange('', '', '')).toMatchObject({ current_password: 'Wajib diisi', new_password: 'Wajib diisi' });
    expect(validatePasswordChange('old-pass-1', 'short', 'short').new_password).toMatch(/Minimal 8/);
    expect(validatePasswordChange('old-pass-1', 'old-pass-1', 'old-pass-1').new_password).toMatch(/berbeda/);
    expect(validatePasswordChange('old-pass-1', 'new-pass-22', 'other').confirm_password).toMatch(/tidak sama/);
    expect(validatePasswordChange('old-pass-1', 'new-pass-22', 'new-pass-22')).toEqual({});
  });

  it('reads the first hex colour for the colour picker', () => {
    expect(hexOf('warm orange (#EA580C) with cream')).toBe('#ea580c');
    expect(hexOf('#abc')).toBe('#aabbcc');
    expect(hexOf('biru')).toBeNull();
  });
});
