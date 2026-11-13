import { createHash } from 'node:crypto';
import sharp, { type OverlayOptions, type Sharp } from 'sharp';
import { heuristicImprove } from '../engine/promptAnalysis.js';
import type { EmptyZone, GenerateImageInput, ProviderAdapter } from './types.js';

/**
 * Key-less provider for development and tests. It produces a real, deterministic image: a seeded
 * gradient with every reference image tiled into the largest area that is free of text zones, and
 * the text zones themselves painted as flat, empty colour fields (exactly what the core prompt asks
 * real models for). The whole pipeline therefore runs end to end with zero API keys.
 */

const hex = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const toHex = (r: number, g: number, b: number): string => `#${hex(r)}${hex(g)}${hex(b)}`;

async function describeImage(data: Buffer): Promise<{ hex: string; brightness: number }> {
  const stats = await sharp(data).removeAlpha().stats();
  const { r, g, b } = stats.dominant;
  const mean = stats.channels.reduce((sum, c) => sum + c.mean, 0) / Math.max(1, stats.channels.length);
  return { hex: toHex(r, g, b), brightness: mean / 255 };
}

function describeForRole(role: string, d: { hex: string; brightness: number }): string {
  switch (role) {
    case 'color':
      return `a palette dominated by ${d.hex}`;
    case 'lighting':
      return d.brightness > 0.6 ? 'bright even daylight' : d.brightness > 0.35 ? 'soft balanced lighting' : 'dim moody lighting';
    case 'background':
      return `a calm background in tones of ${d.hex}`;
    case 'style':
      return `a clean modern look with ${d.hex} accents`;
    case 'pose':
      return 'standing relaxed, facing the camera';
    case 'human_model':
      return 'an adult person with a friendly expression';
    case 'font':
      return 'a clean modern sans-serif character';
    default:
      return `the product from the reference, mainly ${d.hex}`;
  }
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const intersects = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Largest axis-aligned rectangle (canvas fractions) that avoids every zone, padded by `pad`. */
export function largestFreeRect(zones: EmptyZone[], pad = 0.015): Rect {
  const blocked: Rect[] = zones.map((z) => ({ x: z.x - pad, y: z.y - pad, w: z.w + 2 * pad, h: z.h + 2 * pad }));
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const xs = [...new Set([0, 1, ...blocked.flatMap((z) => [clamp(z.x), clamp(z.x + z.w)])])].sort((a, b) => a - b);
  const ys = [...new Set([0, 1, ...blocked.flatMap((z) => [clamp(z.y), clamp(z.y + z.h)])])].sort((a, b) => a - b);
  let best: Rect = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
  let bestArea = -1;
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      for (let k = 0; k < ys.length; k++) {
        for (let l = k + 1; l < ys.length; l++) {
          const r: Rect = { x: xs[i] as number, y: ys[k] as number, w: (xs[j] as number) - (xs[i] as number), h: (ys[l] as number) - (ys[k] as number) };
          const area = r.w * r.h;
          if (area <= bestArea || r.w < 0.05 || r.h < 0.05) continue;
          if (blocked.some((z) => intersects(r, z))) continue;
          best = r;
          bestArea = area;
        }
      }
    }
  }
  return best;
}

/** Rows x columns that give the largest square-ish cells for `n` tiles in a w x h area. */
function gridFor(n: number, w: number, h: number): { cols: number; rows: number } {
  let best = { cols: 1, rows: n };
  let bestSide = -1;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const side = Math.min(w / cols, h / rows);
    if (side > bestSide) {
      best = { cols, rows };
      bestSide = side;
    }
  }
  return best;
}

function seedColours(seed: Buffer): { from: string; to: string; flat: string; accent: string } {
  const hue = (seed[0] as number) / 255;
  const hsl = (h: number, s: number, l: number): string => {
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h * 12) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
  };
  return {
    from: hsl(hue, 0.55, 0.42),
    to: hsl((hue + 0.12) % 1, 0.6, 0.62),
    flat: hsl(hue, 0.45, 0.18),
    accent: hsl((hue + 0.5) % 1, 0.5, 0.7),
  };
}

async function generate(input: GenerateImageInput): Promise<Buffer> {
  const { width: W, height: H } = input;
  const digest = createHash('sha256');
  digest.update(input.prompt);
  for (const ref of input.references) digest.update(ref.data);
  const seed = digest.digest();
  const c = seedColours(seed);

  const zones = input.emptyZones ?? [];
  const px = (z: EmptyZone) => ({
    x: Math.round(z.x * W),
    y: Math.round(z.y * H),
    w: Math.max(1, Math.round(z.w * W)),
    h: Math.max(1, Math.round(z.h * H)),
  });

  const circle = (i: number): string => {
    const cx = Math.round(((seed[1 + i] as number) / 255) * W);
    const cy = Math.round(((seed[5 + i] as number) / 255) * H);
    const r = Math.round(W * (0.08 + ((seed[9 + i] as number) / 255) * 0.12));
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.accent}" fill-opacity="0.35"/>`;
  };
  const background = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.from}"/><stop offset="1" stop-color="${c.to}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>${circle(0)}${circle(1)}${circle(2)}</svg>`;

  const layers: OverlayOptions[] = [];

  // References first, inside the largest area that no text zone touches.
  if (input.references.length > 0) {
    const free = largestFreeRect(zones);
    const area = { x: free.x * W, y: free.y * H, w: free.w * W, h: free.h * H };
    const { cols, rows } = gridFor(input.references.length, area.w, area.h);
    const cellW = area.w / cols;
    const cellH = area.h / rows;
    const gap = Math.max(4, Math.round(W * 0.01));
    const border = 4;
    for (const [i, ref] of input.references.entries()) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const innerW = Math.max(8, Math.floor(cellW - 2 * gap - 2 * border));
      const innerH = Math.max(8, Math.floor(cellH - 2 * gap - 2 * border));
      const tile = await sharp(ref.data)
        .rotate()
        .resize(innerW, innerH, { fit: 'cover' })
        .flatten({ background: '#ffffff' })
        .extend({ top: border, bottom: border, left: border, right: border, background: '#ffffff' })
        .png()
        .toBuffer();
      layers.push({ input: tile, left: Math.round(area.x + col * cellW + gap), top: Math.round(area.y + row * cellH + gap) });
    }
  }

  // Text zones last: flat, empty and exactly uniform, whatever was drawn underneath.
  if (zones.length > 0) {
    const rects = zones
      .map(px)
      .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${c.flat}" shape-rendering="crispEdges"/>`)
      .join('');
    layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rects}</svg>`) });
  }

  return sharp(Buffer.from(background)).composite(layers).png({ compressionLevel: 6 }).toBuffer();
}

export const mockProvider: ProviderAdapter = {
  name: 'mock',

  async improveText(_config, { text }) {
    const { text: improved } = heuristicImprove(text);
    return { text: improved, source: 'heuristic', costUsd: 0 };
  },

  async analyzeReference(_config, { image, role }) {
    return { description: describeForRole(role, await describeImage(image.data)), costUsd: 0 };
  },

  async generateImage(_config, input) {
    const useRefs = input.mode === 'i2i' ? input.references : [];
    const image = await generate({ ...input, references: useRefs });
    return { image, mime: 'image/png', costUsd: 0, referencesUsed: useRefs.length };
  },
};
