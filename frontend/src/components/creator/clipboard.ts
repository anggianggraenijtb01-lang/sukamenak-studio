import { useCallback, useEffect, useRef, useState } from 'react';

/** Writes `text` to the clipboard. Resolves false when the browser refuses (or has no clipboard API). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * `copy(key, text)` remembers which key was copied for two seconds (for a "Tersalin!" label) and
 * `failedKey` says which one the browser refused, so the UI can tell the user to copy by hand.
 */
export function useCopy(resetMs = 2000) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    async (key: string, text: string) => {
      const ok = await copyText(text);
      setCopiedKey(ok ? key : null);
      setFailedKey(ok ? null : key);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setCopiedKey(null);
        setFailedKey(null);
      }, resetMs);
      return ok;
    },
    [resetMs],
  );

  return { copiedKey, failedKey, copy };
}
