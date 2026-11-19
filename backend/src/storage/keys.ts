import { randomUUID } from 'node:crypto';

const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

/** Storage keys are relative, slash-separated, and never contain `.`/`..` segments or odd characters. */
export function isValidStorageKey(key: string): boolean {
  return key.length > 0 && key.length <= 300 && KEY_RE.test(key) && !key.split('/').some((s) => s === '.' || s === '..');
}

export function assertStorageKey(key: string): void {
  if (!isValidStorageKey(key)) throw new Error('Invalid storage key');
}

const EXT_BY_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4' };
const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
};

export const extensionForMime = (mime: string): string => EXT_BY_MIME[mime] ?? 'bin';

export function mimeForKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

/** Unguessable key: `<prefix>/<yyyy-mm>/<uuid>.<ext>`. */
export function newStorageKey(prefix: string, mime: string, now: Date = new Date()): string {
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${prefix}/${month}/${randomUUID()}.${extensionForMime(mime)}`;
}
