/** Small formatting helpers for the creator pages (pure, unit tested). */
import { fileUrl } from '../../api/client';
import type { Generation } from '../../api/types';

/** "10 menit lalu", "Kemarin", "3 hari lalu" ... relative to `now`. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  if (seconds < 45) return 'Baru saja';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Kemarin';
  if (days < 7) return `${days} hari lalu`;
  if (days < 30) return `${Math.round(days / 7)} minggu lalu`;
  return then.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** `4:5` becomes 0.8; anything unparsable becomes 4:5. */
export function aspectRatioValue(ratio: string | null | undefined): number {
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec((ratio ?? '').trim());
  if (!match) return 4 / 5;
  const w = Number(match[1]);
  const h = Number(match[2]);
  return w > 0 && h > 0 ? w / h : 4 / 5;
}

/** Best human title for a finished generation: its title/product slot, else the template name. */
export function generationTitle(g: Pick<Generation, 'slot_values' | 'template'>): string {
  const values = g.slot_values ?? {};
  const candidate = values.title || values.product || values.model || values.message;
  return (candidate && candidate.trim()) || g.template?.name || 'Hasil Desain';
}

export function dimensionsLabel(g: Pick<Generation, 'width' | 'height'>): string | null {
  return g.width && g.height ? `${g.width}x${g.height}` : null;
}

/** "4,2 dtk" from milliseconds. */
export function durationLabel(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || ms < 0) return null;
  return `${(ms / 1000).toFixed(1).replace('.', ',')} dtk`;
}

/** File name for a downloaded result. */
export function resultFileName(title: string, suffix = 'hd'): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'desain'}-${suffix}.png`;
}

/** `src` for an `<img>` from a signed URL in a DTO (undefined when there is none). */
export function imageSrc(url: string | null | undefined): string | undefined {
  return fileUrl(url) ?? undefined;
}

/** A queued/running generation older than this is treated as stuck: polling stops and it may be deleted. */
export const STALE_ACTIVE_MS = 10 * 60_000;

export function isStaleActive(g: Pick<Generation, 'status' | 'created_at'>, now: Date = new Date()): boolean {
  if (g.status !== 'queued' && g.status !== 'running') return false;
  const created = new Date(g.created_at).getTime();
  return !Number.isNaN(created) && now.getTime() - created > STALE_ACTIVE_MS;
}
