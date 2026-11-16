import { getStorage } from './index.js';

/**
 * Time-limited URL for a stored asset: an HMAC-signed `/files/:key?token=` URL for the local
 * driver, a presigned URL for s3. Returns null when there is no (valid) key. Never unsigned.
 */
export function assetUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  try {
    return getStorage().url(storageKey);
  } catch {
    return null;
  }
}
