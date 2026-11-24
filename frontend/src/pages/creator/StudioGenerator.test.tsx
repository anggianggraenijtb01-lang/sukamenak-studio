import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { AuthProvider } from '../../auth/AuthProvider';
import { StudioGenerator } from './StudioGenerator';

const user = { id: 'u1', email: 'u@x.id', name: 'Siti', role: 'creator', last_login_at: null, created_at: '2026-01-01T00:00:00Z' };
const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ok = (data: unknown) => res(200, { status: 'success', message: 'ok', data });
const ok200Page = (items: unknown[]) => res(200, { status: 'success', message: 'ok', data: items, meta: { page: 1, limit: 20, total: items.length, total_pages: 1 } });

const slot = (key: string, over: Record<string, unknown> = {}) => ({
  key,
  label: key,
  type: 'text',
  target: 'image',
  required: false,
  default_value: null,
  options: null,
  max_length: null,
  reference_role: null,
  ...over,
});

const productList = {
  id: 't1', slug: 'poster-promo-produk', name: 'Poster Promo Produk', description: 'Poster', category: 'poster', mode: 'both',
  subject: 'product', aspect_ratio: '4:5', requires_consent: false, preview_url: null,
};
const humanList = {
  id: 't2', slug: 'model-manusia-studio', name: 'Model Manusia Studio', description: 'Potret', category: 'human_model', mode: 'i2i',
  subject: 'human_model', aspect_ratio: '4:5', requires_consent: true, preview_url: null,
};
const details: Record<string, unknown> = {
  'poster-promo-produk': {
    ...productList,
    slots: [slot('product', { label: 'Produk', required: true }), slot('remarks', { type: 'textarea' }), slot('title', { label: 'Judul', target: 'overlay', required: true })],
    text_zones: [], example_references: [], disclaimer: null,
  },
  'model-manusia-studio': {
    ...humanList,
    slots: [slot('model', { label: 'Model', required: true, reference_role: 'human_model' })],
    text_zones: [], example_references: [], disclaimer: 'Gambar ini dihasilkan AI dan bukan foto asli.',
  },
};

const finishedPoster = (id: string, title: string, over: Record<string, unknown> = {}) => ({
  id, status: 'done', progress_step: 'done', template: { id: 't1', slug: 'poster-promo-produk', name: 'Poster Promo Produk' }, mode: 'i2i', subject: 'product',
  publication: 'poster', slot_values: { title }, remarks: null, references: [], used_reference_image: true, reference_count_used: 1, composited_text: true,
  degraded: false, error_code: null, result_url: `http://localhost/api/v1/files/results/${id}.png?token=t`, thumbnail_url: `http://localhost/api/v1/files/thumbs/${id}.jpg?token=t`,
  width: 1080, height: 1350, duration_ms: 1000, archived: false, created_at: '2026-11-20T00:00:00Z', updated_at: '2026-11-20T00:00:00Z', ...over,
});

const videoJob = (over: Record<string, unknown> = {}) => ({
  id: 'v-new', generation_id: 'g-keripik', status: 'rendering', composition: 'story-promo', duration_seconds: 15, width: 1080, height: 1920, fps: 30, progress: 40,
  video_url: null, thumbnail_url: null, bytes: null, render_ms: null, error_code: null, created_at: '2026-11-20T00:00:00Z', finished_at: null, ...over,
});

interface Backend {
  remaining: number;
  generationBodies: unknown[];
  generationAnswer: () => Response;
  videoBodies: Array<{ path: string; body: unknown }>;
  videoPolls: number;
  deletedVideos: string[];
}

function stubBackend(over: Partial<Backend> = {}) {
  const state: Backend = {
    remaining: 5,
    generationBodies: [],
    generationAnswer: () => res(202, { status: 'success', message: 'ok', data: { id: 'g1', status: 'queued' } }),
    videoBodies: [],
    videoPolls: 0,
    deletedVideos: [],
    ...over,
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.replace(/^.*\/api\/v1/, '').split('?')[0];
    const method = (init?.method ?? 'GET').toUpperCase();
    // ---- video mode ----
    if (path === '/generations' && method === 'GET') {
      // The poster without composited text must not be offered as a source.
      const items = [finishedPoster('g-keripik', 'Keripik Tempe'), finishedPoster('g-polos', 'Tanpa Teks', { composited_text: false })];
      return ok200Page(items);
    }
    if (/^\/generations\/[^/]+\/video$/.test(path) && method === 'POST') {
      state.videoBodies.push({ path, body: JSON.parse(String(init?.body ?? '{}')) });
      return res(202, { status: 'success', message: 'queued', data: { id: 'v-new', status: 'queued' } });
    }
    if (path === '/videos/quota') return ok({ limit: 3, used: 1 });
    if (path === '/videos' && method === 'GET') {
      const items = [videoJob({ id: 'v-old', status: 'done', progress: 100, video_url: 'http://localhost/api/v1/files/videos/old.mp4?token=t' })].filter(
        (v) => !state.deletedVideos.includes(v.id),
      );
      return ok200Page(items);
    }
    if (path.startsWith('/videos/') && method === 'DELETE') {
      state.deletedVideos.push(path.slice('/videos/'.length));
      return ok({ id: path.slice('/videos/'.length) });
    }
    if (path === '/videos/v-new') {
      state.videoPolls += 1;
      return ok(state.videoPolls === 1 ? videoJob() : videoJob({ status: 'done', progress: 100, video_url: 'http://localhost/api/v1/files/videos/new.mp4?token=t' }));
    }
    // ---- image mode ----
    if (path === '/auth/refresh') return ok({ user, access_token: 'tok', token_type: 'Bearer', expires_in: 3600 });
    if (path === '/me') return ok({ user, usage: { date: '2026-11-14', daily_limit: 10, used_today: 10 - state.remaining, in_flight: 0, remaining_today: state.remaining } });
    if (path === '/templates') return ok([productList, humanList]);
    if (path.startsWith('/templates/')) return ok(details[decodeURIComponent(path.slice('/templates/'.length))]);
    if (path === '/prompts/analyze') return ok({ score: 70, word_count: 5, char_count: 30, breakdown: {}, filler_words: [], repeated_terms: [], covered_aspects: [], missing_aspects: [], suggestions: [] });
    if (path === '/generations' && init?.method === 'POST') {
      state.generationBodies.push(JSON.parse(String(init.body)));
      return state.generationAnswer();
    }
    if (path.startsWith('/generations/')) return ok({ id: 'g1', status: 'running', progress_step: 'compose', template: null, mode: 't2i', subject: 'product', publication: 'poster', slot_values: {}, remarks: null, references: [], used_reference_image: false, reference_count_used: 0, composited_text: false, degraded: false, error_code: null, result_url: null, thumbnail_url: null, width: null, height: null, duration_ms: null, archived: false, created_at: '2026-11-14T00:00:00Z', updated_at: '2026-11-14T00:00:00Z' });
    return res(404, { status: 'error', message: 'x', error_code: 'NOT_FOUND' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return state;
}

function renderStudio(initial: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initial]}>
          <StudioGenerator />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  apiClient.clearSession();
  vi.unstubAllGlobals();
});

const submitButton = () => screen.getByRole('button', { name: /Buat Poster Instan|Sedang Memproses/ }) as HTMLButtonElement;
const modeSelect = () => screen.getByRole('combobox', { name: 'Metode Pembuatan' }) as HTMLSelectElement;
const optionLabels = () => Array.from(modeSelect().options).map((o) => o.textContent);
const chooseMode = (value: 't2i' | 'i2i' | 'video') => fireEvent.change(modeSelect(), { target: { value } });

describe('StudioGenerator', () => {
  it('builds the form from the template and only offers the modes it allows', async () => {
    stubBackend();
    renderStudio('/creator/studio?template=poster-promo-produk');
    expect(await screen.findByLabelText(/Produk/)).toBeTruthy();
    expect(optionLabels()).toEqual(['Teks ke Gambar', 'Foto ke Gambar', 'Video (Reel)']);
    expect(modeSelect().value).toBe('i2i');
    expect(modeSelect().getAttribute('aria-describedby')).toBe('studio-mode-help');
    // The remarks slot is fed by the free remarks field, not shown twice.
    expect(screen.getAllByLabelText(/Deskripsi Visual/)).toHaveLength(1);
    expect(screen.queryByLabelText('remarks')).toBeNull();
  });

  it('keeps the button disabled for a human-model template until the unchecked consent box is ticked', async () => {
    stubBackend();
    renderStudio('/creator/studio?template=model-manusia-studio');
    const consent = (await screen.findByRole('checkbox', { name: /Persetujuan foto orang/ })) as HTMLInputElement;
    expect(consent.checked).toBe(false);
    await waitFor(() => expect(submitButton().disabled).toBe(true));
    expect(screen.getByText(/Centang pernyataan persetujuan/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Kebijakan Privasi/ }).getAttribute('href')).toBe('/privasi');
    fireEvent.click(consent);
    await waitFor(() => expect(submitButton().disabled).toBe(false));
  });

  it('does not show the consent box for an ordinary product template', async () => {
    stubBackend();
    renderStudio('/creator/studio?template=poster-promo-produk');
    await screen.findByLabelText(/Produk/);
    expect(screen.queryByRole('checkbox', { name: /Persetujuan foto orang/ })).toBeNull();
  });

  it('blocks the button and explains it when the daily limit is used up', async () => {
    stubBackend({ remaining: 0 });
    renderStudio('/creator/studio?template=poster-promo-produk');
    await screen.findByLabelText(/Produk/);
    await waitFor(() => expect(submitButton().disabled).toBe(true));
    expect(screen.getByText('Batas harian tercapai. Hubungi admin.')).toBeTruthy();
  });

  it('sends a t2i request without references and starts polling', async () => {
    const backend = stubBackend();
    renderStudio('/creator/studio?template=poster-promo-produk&mode=t2i');
    fireEvent.change(await screen.findByLabelText(/Produk/), { target: { value: ' keripik ' } });
    fireEvent.change(screen.getByLabelText(/Judul/), { target: { value: 'Keripik Enak' } });
    chooseMode('t2i');
    fireEvent.click(submitButton());
    await waitFor(() => expect(backend.generationBodies).toHaveLength(1));
    expect(backend.generationBodies[0]).toEqual({
      template_slug: 'poster-promo-produk',
      mode: 't2i',
      slot_values: { product: 'keripik', title: 'Keripik Enak' },
    });
    await waitFor(() => expect(document.querySelector('[data-step-state="running"]')).toBeTruthy());
  });

  it('opens in the mode a deep link asks for, when the template allows it', async () => {
    stubBackend();
    renderStudio('/creator/studio?template=poster-promo-produk&mode=t2i');
    await screen.findByLabelText(/Produk/);
    await waitFor(() => expect(modeSelect().value).toBe('t2i'));
  });

  it('falls back to a mode the template allows and never offers it a wrong image mode', async () => {
    stubBackend();
    renderStudio('/creator/studio?template=model-manusia-studio&mode=t2i');
    await screen.findByRole('checkbox', { name: /Persetujuan foto orang/ });
    await waitFor(() => expect(modeSelect().value).toBe('i2i'));
    // Video is offered regardless: it works on finished posters, not on this template.
    expect(optionLabels()).toEqual(['Foto ke Gambar', 'Video (Reel)']);
    expect(screen.getByText(/hanya mendukung metode Foto ke Gambar/)).toBeTruthy();
  });

  it('shows a clear state for DAILY_LIMIT_REACHED answered by the server and keeps the form filled', async () => {
    stubBackend({
      generationAnswer: () => res(429, { status: 'error', message: 'x', error_code: 'DAILY_LIMIT_REACHED' }),
    });
    renderStudio('/creator/studio?template=poster-promo-produk');
    const product = (await screen.findByLabelText(/Produk/)) as HTMLInputElement;
    fireEvent.change(product, { target: { value: 'keripik' } });
    fireEvent.change(screen.getByLabelText(/Judul/), { target: { value: 'Hai' } });
    chooseMode('t2i');
    fireEvent.click(submitButton());
    const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
    expect(alert.getAttribute('data-error-code')).toBe('DAILY_LIMIT_REACHED');
    expect(product.value).toBe('keripik');
  });

  it('shows field errors from the server next to the input', async () => {
    stubBackend({
      generationAnswer: () =>
        res(400, { status: 'error', message: 'x', error_code: 'VALIDATION_ERROR', errors: [{ field: 'slot_values.title', message: 'Terlalu panjang dari server' }] }),
    });
    renderStudio('/creator/studio?template=poster-promo-produk');
    fireEvent.change(await screen.findByLabelText(/Produk/), { target: { value: 'keripik' } });
    fireEvent.change(screen.getByLabelText(/Judul/), { target: { value: 'Hai' } });
    chooseMode('t2i');
    fireEvent.click(submitButton());
    expect(await screen.findByText('Terlalu panjang dari server')).toBeTruthy();
  });

  it('asks for a photo before sending an image-to-image request', async () => {
    const backend = stubBackend();
    renderStudio('/creator/studio?template=poster-promo-produk');
    fireEvent.change(await screen.findByLabelText(/Produk/), { target: { value: 'keripik' } });
    fireEvent.change(screen.getByLabelText(/Judul/), { target: { value: 'Hai' } });
    fireEvent.click(submitButton());
    expect(await screen.findByText(/Unggah minimal 1 foto referensi/)).toBeTruthy();
    expect(backend.generationBodies).toHaveLength(0);
  });

  describe('video mode', () => {
    beforeEach(() => {
      vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    });
    afterEach(() => vi.restoreAllMocks());

    it('swaps the slot form for the video section and only offers finished posters with text', async () => {
      stubBackend();
      renderStudio('/creator/studio?template=poster-promo-produk');
      await screen.findByLabelText(/Produk/);
      chooseMode('video');

      expect(await screen.findByText(/Reel dirender dari poster yang sudah selesai/)).toBeTruthy();
      expect(screen.queryByLabelText(/Produk/)).toBeNull();
      expect(screen.queryByRole('button', { name: /Buat Poster Instan/ })).toBeNull();
      expect(screen.getByText(/dirender ulang dengan potongan baru/)).toBeTruthy();

      const keripik = (await screen.findByRole('radio', { name: 'Keripik Tempe' })) as HTMLInputElement;
      await waitFor(() => expect(keripik.checked).toBe(true));
      expect(screen.queryByRole('radio', { name: 'Tanpa Teks' })).toBeNull();
      expect(await screen.findByText('Kuota video: 2 / 3 hari ini')).toBeTruthy();
      expect((screen.getByLabelText('Durasi video') as HTMLInputElement).value).toBe('15');
    });

    it('renders a reel with the chosen duration through the video API and never creates a generation', async () => {
      const backend = stubBackend();
      renderStudio('/creator/studio?template=poster-promo-produk&mode=video');
      await screen.findByRole('radio', { name: 'Keripik Tempe' });
      fireEvent.change(screen.getByLabelText('Durasi video'), { target: { value: '6' } });
      const start = screen.getByRole('button', { name: /Buat Video Reel/ }) as HTMLButtonElement;
      await waitFor(() => expect(start.disabled).toBe(false));
      fireEvent.click(start);

      await waitFor(() => expect(backend.videoBodies).toHaveLength(1));
      expect(backend.videoBodies[0]).toEqual({ path: '/generations/g-keripik/video', body: { duration_seconds: 6 } });
      expect(backend.generationBodies).toHaveLength(0);

      // First poll answers "rendering", the next one (2 s later) "done" with a playable file.
      await waitFor(() => expect(document.querySelector('video')?.getAttribute('src')).toContain('/files/videos/new.mp4'), { timeout: 8000 });
      expect(backend.videoPolls).toBeGreaterThanOrEqual(2);
    });

    it('lists recent videos with download and delete actions', async () => {
      const backend = stubBackend();
      renderStudio('/creator/studio?template=poster-promo-produk&mode=video');
      const remove = await screen.findByRole('button', { name: 'Hapus video Keripik Tempe' });
      expect((screen.getByRole('button', { name: 'Unduh video Keripik Tempe' }) as HTMLButtonElement).disabled).toBe(false);

      fireEvent.click(remove);
      fireEvent.click(await screen.findByRole('button', { name: 'Ya, Hapus' }));
      await waitFor(() => expect(backend.deletedVideos).toEqual(['v-old']));
      expect(await screen.findByText(/Belum ada video/)).toBeTruthy();
    });
  });
});
