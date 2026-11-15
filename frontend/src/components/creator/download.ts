import { fileUrl, saveBlob } from '../../api/client';

/**
 * Saves a result image. Signed URLs expire after about 15 minutes, so the URL is used right away and never stored.
 * Fetches the bytes and saves them as a file; when the browser blocks that (cross-origin storage without CORS)
 * the image opens in a new tab instead, from where it can be saved by hand.
 * Resolves true when a file was saved.
 */
export async function downloadImage(url: string, filename: string): Promise<boolean> {
  const href = fileUrl(url);
  try {
    const res = await fetch(href, { credentials: 'omit' });
    if (!res.ok) throw new Error(String(res.status));
    saveBlob(await res.blob(), filename);
    return true;
  } catch {
    window.open(href, '_blank', 'noopener,noreferrer');
    return false;
  }
}
