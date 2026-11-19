import type { ComponentType, FC } from 'react';
import { Composition } from 'remotion';
import { StoryPromo } from './StoryPromo';
import type { VideoRenderProps } from './types';

/**
 * Default props exist only so Remotion Studio can open the composition without a job.
 * A real render always passes `--props` (see render.mjs), which replaces them entirely.
 */
const defaultProps: VideoRenderProps = {
  posterDataUri: '',
  durationSeconds: 15,
  palette: ['#1800ad', '#ffffff'],
  zones: [
    { key: 'title', text: 'Judul Poster', x: 0.08, y: 0.1, w: 0.84, h: 0.14, align: 'center', weight: 800, sizeRatio: 0.05, color: '#FFFFFF', maxLines: 2, delay: 0 },
    { key: 'subtitle', text: 'Keterangan singkat', x: 0.1, y: 0.84, w: 0.8, h: 0.06, align: 'center', weight: 700, sizeRatio: 0.03, color: '#FFFFFF', maxLines: 1, delay: 24 },
  ],
  watermark: false,
  brandName: 'Sukamenak Studio',
};

// Remotion types `component` for `Record<string, unknown>` props unless a zod schema is supplied.
// The backend validates the payload before enqueueing (backend/src/video/props.ts), so no runtime
// schema is duplicated here.
const TypedComponent = StoryPromo as unknown as ComponentType<Record<string, unknown>>;

export const RemotionRoot: FC = () => (
  <Composition
    id="StoryPromo"
    component={TypedComponent}
    durationInFrames={450}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={defaultProps as unknown as Record<string, unknown>}
    // The real duration comes from the job props; this calculation keeps Studio in sync.
    calculateMetadata={({ props }) => {
      const seconds = typeof props.durationSeconds === 'number' ? props.durationSeconds : 15;
      return { durationInFrames: Math.round(Math.max(3, Math.min(30, seconds)) * 30) };
    }}
  />
);
