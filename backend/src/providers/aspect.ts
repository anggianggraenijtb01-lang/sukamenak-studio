export function parseAspect(aspect: string): { w: number; h: number } {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(aspect);
  const w = Number(m?.[1] ?? 1);
  const h = Number(m?.[2] ?? 1);
  return w > 0 && h > 0 ? { w, h } : { w: 1, h: 1 };
}

const roundTo = (n: number, step: number): number => Math.max(step, Math.round(n / step) * step);

/** Pixel size for an aspect ratio with the longest side near `longSide` (multiples of 8). */
export function aspectSize(aspect: string, longSide = 1024): { width: number; height: number } {
  const { w, h } = parseAspect(aspect);
  if (w >= h) return { width: roundTo(longSide, 8), height: roundTo((longSide * h) / w, 8) };
  return { width: roundTo((longSide * w) / h, 8), height: roundTo(longSide, 8) };
}

/** The supported ratio (as "w:h") closest to `aspect` on a log scale. */
export function nearestAspect(aspect: string, supported: readonly string[]): string {
  const target = Math.log(ratioOf(aspect));
  let best = supported[0] ?? '1:1';
  let bestDelta = Infinity;
  for (const candidate of supported) {
    const delta = Math.abs(Math.log(ratioOf(candidate)) - target);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  return best;
}

export function ratioOf(aspect: string): number {
  const { w, h } = parseAspect(aspect);
  return w / h;
}

/** The supported `WxH` size closest in ratio to `aspect`. */
export function nearestSize(aspect: string, supported: readonly string[]): string {
  const target = Math.log(ratioOf(aspect));
  let best = supported[0] ?? '1024x1024';
  let bestDelta = Infinity;
  for (const s of supported) {
    const [w, h] = s.split('x').map(Number);
    if (!w || !h) continue;
    const delta = Math.abs(Math.log(w / h) - target);
    if (delta < bestDelta) {
      best = s;
      bestDelta = delta;
    }
  }
  return best;
}
