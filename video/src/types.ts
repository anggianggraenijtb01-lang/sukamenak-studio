/**
 * Props contract between the backend and the renderer.
 *
 * Mirror of `backend/src/video/props.ts` (`VideoRenderProps`). Keep both in sync: the backend validates
 * what it enqueues, this file only renders it. Nothing here may ever carry a core prompt, a final prompt
 * or any ciphertext — the backend builds these fields from slot values, text zones and the brand palette.
 */
export interface VideoTextZone {
  /** Slot key: identifies the zone and is the React key, never drawn. */
  key: string;
  /**
   * The zone's text, kept for diagnostics and so the backend contract matches the poster.
   * The renderer does NOT draw it: the poster already carries it (composited in the pipeline), so the
   * reel reveals that text instead of drawing a second copy on top.
   */
  text: string;
  /** Fractions of the canvas, straight from `text_zones`. */
  x: number;
  y: number;
  w: number;
  h: number;
  align: 'left' | 'center' | 'right';
  weight: number;
  /** Font size as a fraction of the canvas height (`font_size_ratio`). */
  sizeRatio: number;
  color: string;
  maxLines: number;
  /** Stagger, in frames, before this zone animates in. */
  delay: number;
}

export interface VideoRenderProps {
  /** The finished poster as a data URI: `publicDir` is frozen at bundle time, so files cannot be added per job. */
  posterDataUri: string;
  durationSeconds: number;
  /** Brand palette, most important first. Used for the badge and the outro. */
  palette: string[];
  zones: VideoTextZone[];
  watermark: boolean;
  brandName: string;
}
