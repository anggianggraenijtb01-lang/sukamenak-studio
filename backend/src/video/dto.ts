import { assetUrl } from '../storage/urls.js';

export interface VideoJobRow {
  id: string;
  generation_id: string;
  status: string;
  composition: string;
  duration_seconds: number;
  width: number;
  height: number;
  fps: number;
  progress: number;
  render_ms: number | null;
  error_code: string | null;
  created_at: Date;
  finished_at: Date | null;
  storage_key: string | null;
  mime: string | null;
  bytes: number | null;
  thumbnail_key: string | null;
}

/** Columns the serializer reads. `props` is never selected: it holds internal layout data only. */
export const VIDEO_JOB_SELECT = `
  SELECT v.id, v.generation_id, v.status, v.composition, v.duration_seconds, v.width, v.height, v.fps,
         v.progress, v.render_ms, v.error_code, v.created_at, v.finished_at,
         a.storage_key, a.mime, a.bytes, t.storage_key AS thumbnail_key
    FROM video_jobs v
    LEFT JOIN assets a ON a.id = v.result_asset_id AND a.deleted_at IS NULL
    LEFT JOIN generations g ON g.id = v.generation_id
    LEFT JOIN assets t ON t.id = g.thumbnail_asset_id AND t.deleted_at IS NULL`;

/** Explicit allowlist: status, progress and signed URLs only. */
export const toVideoJobDTO = (v: VideoJobRow) => {
  const done = v.status === 'done';
  return {
    id: v.id,
    generation_id: v.generation_id,
    status: v.status,
    composition: v.composition,
    duration_seconds: v.duration_seconds,
    width: v.width,
    height: v.height,
    fps: v.fps,
    progress: v.progress,
    video_url: done ? assetUrl(v.storage_key) : null,
    thumbnail_url: done ? assetUrl(v.thumbnail_key) : null,
    bytes: done ? v.bytes : null,
    render_ms: v.render_ms,
    error_code: v.status === 'failed' ? v.error_code : null,
    created_at: v.created_at,
    finished_at: v.finished_at,
  };
};
