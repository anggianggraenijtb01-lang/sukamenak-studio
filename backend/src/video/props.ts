/**
 * Mirror of `video/src/types.ts` (`VideoTextZone` / `VideoRenderProps`). The two packages are installed
 * and built separately (backend has no Remotion dependency), so the contract is duplicated on purpose:
 * this side validates what it enqueues, the renderer only renders it. Change both together.
 */
export interface VideoTextZone {
  key: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  align: 'left' | 'center' | 'right';
  weight: number;
  sizeRatio: number;
  color: string;
  maxLines: number;
  delay: number;
}

export interface VideoRenderProps {
  posterDataUri: string;
  durationSeconds: number;
  palette: string[];
  zones: VideoTextZone[];
  watermark: boolean;
  brandName: string;
}

/**
 * Props stored on `video_jobs.props`. The poster is referenced by storage key, not embedded: a job row
 * must stay small, and the key is read once at render time (see toRenderProps).
 *
 * Nothing here may carry a core prompt, a final prompt, a ciphertext or a model id. Every field is
 * derived from slot values, `text_zones` and the brand identity, exactly like the poster compositor.
 */
export interface VideoJobProps {
  poster_key: string;
  zones: VideoTextZone[];
  palette: string[];
  duration_seconds: number;
  watermark: boolean;
  brand_name: string;
}

export interface ZoneRow {
  slot_key: string;
  x: string | number;
  y: string | number;
  w: string | number;
  h: string | number;
  align: string;
  font_weight: number;
  font_size_ratio: string | number;
  color: string;
  max_lines: number;
}

export interface BuildVideoJobPropsInput {
  posterKey: string;
  zones: ZoneRow[];
  /** Slot values, already validated by the generation. Unknown keys are ignored. */
  values: Record<string, string>;
  palette: string[];
  durationSeconds: number;
  watermark: boolean;
  brandName: string;
}

/** Frames a zone waits before it animates in, so text does not all appear at once. */
export const ZONE_STAGGER_FRAMES = 10;
/** A zone whose text is empty is dropped rather than rendered as an empty box. */
export const zoneText = (values: Record<string, string>, slotKey: string): string => (values[slotKey] ?? '').trim();

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

const toZone = (row: ZoneRow, text: string, index: number): VideoTextZone => ({
  key: row.slot_key,
  text,
  x: clamp01(Number(row.x)),
  y: clamp01(Number(row.y)),
  w: clamp01(Number(row.w)),
  h: clamp01(Number(row.h)),
  align: row.align === 'left' || row.align === 'right' ? row.align : 'center',
  weight: Math.min(900, Math.max(100, Math.round(Number(row.font_weight) || 700))),
  sizeRatio: Math.min(0.2, Math.max(0.01, Number(row.font_size_ratio) || 0.04)),
  color: /^#[0-9a-fA-F]{6}$/.test(row.color) ? row.color : '#FFFFFF',
  maxLines: Math.min(6, Math.max(1, Math.round(Number(row.max_lines) || 2))),
  delay: index * ZONE_STAGGER_FRAMES,
});

/**
 * Builds the stored props. Pure: no database, no storage, no clock. Text zones without text are
 * skipped, and the stagger is applied in zone order so the first zone always leads.
 */
export function buildVideoJobProps(input: BuildVideoJobPropsInput): VideoJobProps {
  const zones: VideoTextZone[] = [];
  for (const row of input.zones) {
    const text = zoneText(input.values, row.slot_key);
    if (!text) continue;
    zones.push(toZone(row, text, zones.length));
  }
  return {
    poster_key: input.posterKey,
    zones,
    palette: input.palette.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, 6),
    duration_seconds: input.durationSeconds,
    watermark: input.watermark,
    brand_name: input.brandName.slice(0, 80),
  };
}

/** Resolved props for the renderer: the stored props plus the poster as a data URI. */
export function toRenderProps(props: VideoJobProps, poster: Buffer, posterMime: string): VideoRenderProps {
  return {
    posterDataUri: `data:${posterMime};base64,${poster.toString('base64')}`,
    durationSeconds: props.duration_seconds,
    palette: props.palette,
    zones: props.zones,
    watermark: props.watermark,
    brandName: props.brand_name,
  };
}
