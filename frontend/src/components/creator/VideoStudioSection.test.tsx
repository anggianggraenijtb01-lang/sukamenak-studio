import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { Generation, VideoJob } from '../../api/types';
import { ok, pageMeta, renderWithProviders, stubApi } from '../../test/adminHarness';
import { VideoStudioSection } from './VideoStudioSection';

const POSTER_ID = '11111111-1111-4111-8111-111111111111';
const JOB_ID = '33333333-3333-4333-8333-333333333333';

const poster = (over: Partial<Generation> = {}): Generation => ({
  id: POSTER_ID,
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
  id: JOB_ID,
  generation_id: POSTER_ID,
  status: 'done',
  composition: 'story-promo',
  duration_seconds: 6,
  width: 1080,
  height: 1920,
  fps: 30,
  progress: 100,
  video_url: 'http://localhost/api/v1/files/videos/2026-11/a.mp4?token=t',
  thumbnail_url: null,
  bytes: 2055767,
  render_ms: 93_000,
  error_code: null,
  created_at: '2026-11-19T07:00:00.000Z',
  finished_at: '2026-11-19T07:02:00.000Z',
  ...over,
});

/** jsdom has no media element implementation; only the warnings would differ. */
beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('VideoStudioSection editing', () => {
  it('re-renders an existing video with the new duration instead of creating a second job', async () => {
    const api = stubApi({
      'GET /generations': () => ok([poster()], pageMeta(1)),
      'GET /videos/quota': () => ok({ limit: 3, used: 1 }),
      'GET /videos': () => ok([job()], pageMeta(1)),
      [`PATCH /videos/${JOB_ID}`]: () => ({
        status: 202,
        body: { status: 'success', message: 'queued', data: { id: JOB_ID, status: 'queued', duration_seconds: 12 } },
      }),
      [`GET /videos/${JOB_ID}`]: () => ok(job({ status: 'rendering', progress: 10, duration_seconds: 12, video_url: null })),
    });

    renderWithProviders(<VideoStudioSection />);

    fireEvent.click(await screen.findByRole('button', { name: /ubah video/i }));

    const slider = (await screen.findByLabelText('Durasi')) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '12' } });
    expect(screen.getByText('12 detik')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /render ulang/i }));

    await waitFor(() => expect(api.count('PATCH', `/videos/${JOB_ID}`)).toBe(1));
    const sent = api.calls.find((c) => c.method === 'PATCH')?.body as { duration_seconds: number };
    expect(sent.duration_seconds).toBe(12);

    // No second job: editing must not go through the create endpoint.
    expect(api.count('POST', `/generations/${POSTER_ID}/video`)).toBe(0);
    // The dialog closes and the re-render is followed in the preview column.
    await waitFor(() => expect(screen.queryByLabelText('Durasi')).toBeNull());
    expect(await screen.findByText(/video sedang dibuat ulang/i)).toBeTruthy();
  });

  it('refuses to edit a video that is still rendering', async () => {
    stubApi({
      'GET /generations': () => ok([poster()], pageMeta(1)),
      'GET /videos/quota': () => ok({ limit: 3, used: 1 }),
      'GET /videos': () => ok([job({ status: 'rendering', progress: 40, video_url: null })], pageMeta(1)),
    });

    renderWithProviders(<VideoStudioSection />);
    const button = (await screen.findByRole('button', { name: /ubah video/i })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
