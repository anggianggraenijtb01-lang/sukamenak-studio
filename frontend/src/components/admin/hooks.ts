import { useEffect, useState } from 'react';

/** Value that follows `value` after it has been stable for `delayMs` (search boxes must not hit the API per keystroke). */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/** `'true' | 'false' | ''` (select value) to the boolean the API expects. */
export function triState(value: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}
