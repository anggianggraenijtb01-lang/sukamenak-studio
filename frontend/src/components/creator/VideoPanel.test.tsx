import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { Generation, VideoJob } from '../../api/types';
import { fail, ok, renderWithProviders, stubApi } from '../../test/adminHarness';
import { VideoPanel, canMakeVideo } from './VideoPanel';

const poster = (over: Partial<Generation> = {}): Generation => ({
  id: '11111111-1111-4111-8111-111111111111',
  status: 'done',
  progress_step: 'done',
  template: { id: '22222222-2222-4222-8222-222222222222', slug: 'poster-promo-produk', name: 'Poster Promo Produk' },
  mode: 'i2i',
  subject: 'product',
  publication: 'poster',
  slot_values: { title: 'Keripik Tempe Renyah' },
  remarks: null,
  references: [],
  used_reference_image: true,
  reference_count_used: 1,
  composited_text: true,
  degraded: false,
  error_code: null,
  result_url: 'http://localhost/api/v1/files/results/2026-11/a.png?token=t',
  thumbnail_url: 'http://localhost/api/v1/files/thumbs/2026-11/a.jpg?token=t',
  width: 1080,
  height: 1350,
  duration_ms: 1200,
  archived: false,
  created_at: '2026-11-19T07:00:00.000Z',
  updated_at: '2026-11-19T07:00:01.000Z',
  ...over,
});

const job = (over: Partial<VideoJob> = {}): VideoJob => ({
  id: '33333333-3333-4333-8333-333333333333',
  generation_id: '11111111-1111-4111-8111-111111111111',
  status: 'rendering',
  composition: 'story-promo',
  duration_seconds: 15,
  width: 1080,
  height: 1920,
  fps: 30,
  progress: 42,
  video_url: null,
  thumbnail_url: null,
  bytes: null,
  render_ms: null,
  error_code: null,
  created_at: '2026-11-19T07:00:00.000Z',
  finished_at: null,
  ...over,
});

/** `HTMLMediaElement.play` is not implemented in jsdom and only warns. */
beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('canMakeVideo', () => {
  it('needs a finished poster with composited text and a result', () => {
    expect(canMakeVideo(poster())).toBe(true);
    expect(canMakeVideo(poster({ status: 'running' }))).toBe(false);
    expect(canMakeVideo(poster({ composited_text: false }))).toBe(false);
    expect(canMakeVideo(poster({ result_url: null }))).toBe(false);
  });
});

describe('VideoPanel', () => {
  it('explains why a poster without text cannot become a video, and offers no button', () => {
    stubApi({ 'GET /videos/quota': () => ok({ limit: 3, used: 0 }) });
    renderWithProviders(<VideoPanel generation={poster({ composited_text: false })} />);
    expect(screen.getByText(/hanya bisa dibuat dari desain yang sudah selesai dan memiliki teks/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /buat video/i })).toBeNull();
  });

  it('hides the start button when the daily quota is used up', async () => {
    stubApi({ 'GET /videos/quota': () => ok({ limit: 3, used: 3 }) });
    renderWithProviders(<VideoPanel generation={poster()} />);
    expect(await screen.findByText('Sisa 0 video hari ini')).toBeTruthy();
    expect(screen.getByText(/batas video harian sudah tercapai/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /buat video/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('starts a render with the chosen duration and then polls until it is done', async () => {
      let polls = 0;
    const api = stubApi({
      'GET /videos/quota': () => ok({ limit: 3, used: 1 }),
      'POST /generations/11111111-1111-4111-8111-111111111111/video': () => ({
        status: 202,
        body: { status: 'success', message: 'queued', data: { id: job().id, status: 'queued' } },
      }),
      // First poll: still rendering; second: done with a URL.
      'GET /videos/33333333-3333-4333-8333-333333333333': () =>
        ok(
          polls++ === 0
            ? job()
            : job({ status: 'done', progress: 100, video_url: 'http://localhost/api/v1/files/videos/2026-11/a.mp4?token=t', thumbnail_url: null, bytes: 2055767, render_ms: 93000 }),
        ),
    });

    renderWithProviders(<VideoPanel generation={poster()} />);
    fireEvent.click(await screen.findByRole('button', { name: /8 detik/i }));
    fireEvent.click(screen.getByRole('button', { name: /buat video/i }));

    await waitFor(() => expect(api.count('POST', '/generations/11111111-1111-4111-8111-111111111111/video')).toBe(1));
    expect((api.calls.find((c) => c.method === 'POST')?.body as { duration_seconds: number }).duration_seconds).toBe(8);

    // The panel polls every 2 s while rendering, so the second poll (not the first render) flips it to done.
    const video = (await screen.findByRole('button', { name: /unduh video/i }, { timeout: 8000 })) as HTMLElement;
    expect(video).toBeTruthy();
    expect(screen.getByText('2.0 MB')).toBeTruthy();
    const player = document.querySelector('video');
    expect(player?.getAttribute('src')).toContain('/api/v1/files/videos/2026-11/a.mp4');
    expect(polls).toBeGreaterThanOrEqual(2);
  });

  it('shows the fixed message for a failed render, never server text', async () => {
      stubApi({
      'GET /videos/quota': () => ok({ limit: 3, used: 0 }),
      'POST /generations/11111111-1111-4111-8111-111111111111/video': () => ({ status: 202, body: { status: 'success', message: 'queued', data: { id: job().id, status: 'queued' } } }),
      'GET /videos/33333333-3333-4333-8333-333333333333': () => ok(job({ status: 'failed', error_code: 'VIDEO_TIMEOUT' })),
    });

    renderWithProviders(<VideoPanel generation={poster()} />);
    fireEvent.click(await screen.findByRole('button', { name: /buat video/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Pembuatan video melebihi batas waktu');
    expect(screen.queryByText(/server text that must never be shown/i)).toBeNull();
  });

  it('reports a refused start with the mapped error, not the raw one', async () => {
      stubApi({
      'GET /videos/quota': () => ok({ limit: 3, used: 0 }),
      'POST /generations/11111111-1111-4111-8111-111111111111/video': () => fail(429, 'VIDEO_DAILY_LIMIT_REACHED'),
    });
    renderWithProviders(<VideoPanel generation={poster()} />);
    fireEvent.click(await screen.findByRole('button', { name: /buat video/i }));
    await waitFor(() => expect(screen.getAllByText(/batas pembuatan video hari ini/i).length).toBeGreaterThan(0));
    expect(screen.queryByText(/server text that must never be shown/i)).toBeNull();
  });
});
