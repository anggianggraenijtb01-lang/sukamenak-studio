import sharp, { type OverlayOptions, type Sharp } from 'sharp';
import { faceForWeight } from './fonts.js';

export interface ZoneSpec {
  slot_key: string;
  /** Fractions (0-1) of the output image. */
  x: number;
  y: number;
  w: number;
  h: number;
  align: 'left' | 'center' | 'right';
  font_family?: string;
  font_weight: number;
  /** Font size as a fraction of the image WIDTH. */
  font_size_ratio: number;
  /** `#rrggbb`, `#rgb`, `brand` (first palette colour) or `brand:N`. Anything else falls back to white. */
  color: string;
  max_lines: number;
}

export interface CompositeInput {
  base: Buffer;
  zones: ZoneSpec[];
  /** Slot key -> text to paste. Empty values leave the zone untouched. */
  values: Record<string, string | null | undefined>;
  palette?: string[];
  /** Target ratio "w:h"; the base is centre-cropped when it deviates by more than 1%. */
  aspectRatio?: string;
  /** Small corner mark (for example the brand name). Omit for none. */
  watermark?: string | null;
}

export interface CompositeResult {
  image: Buffer;
  width: number;
  height: number;
  /** Slot keys whose text was actually pasted. */
  placed: string[];
}

const MAX_PIXELS = 50_000_000;
const LINE_HEIGHT = 1.22;
const MIN_FONT_PX = 12;
const SHRINK_STEP = 0.92;
const MIN_SCALE = 0.45;

const markupEscape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠﻿]/g;
const cleanLine = (s: string): string => s.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(color: string): Rgb | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m?.[1]) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

const toHex = ({ r, g, b }: Rgb): string => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

function luminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrast = (a: Rgb, b: Rgb): number => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

function resolveColor(spec: string, palette: string[]): Rgb {
  const direct = parseHex(spec);
  if (direct) return direct;
  const m = /^brand(?::(\d+))?$/i.exec(spec.trim());
  if (m) {
    const picked = parseHex(palette[Number(m[1] ?? 0)] ?? '');
    if (picked) return picked;
  }
  return { r: 255, g: 255, b: 255 };
}

interface TextRender {
  buffer: Buffer;
  width: number;
  height: number;
}

async function renderText(text: string, sizePx: number, weight: number, color: string, align: 'left' | 'center' | 'right', alpha?: number): Promise<TextRender> {
  const font = faceForWeight(weight);
  const attrs = `foreground="${color}"${alpha !== undefined ? ` alpha="${Math.round(alpha * 100)}%"` : ''}`;
  const { data, info } = await sharp({
    text: {
      text: `<span ${attrs}>${markupEscape(text)}</span>`,
      font: `${font.face} ${Math.max(1, Math.round(sizePx))}`,
      fontfile: font.file,
      align: align === 'center' ? 'centre' : align,
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}

const SIZE_PROBE = 100;

/** Greedy word wrap using widths measured once at SIZE_PROBE and scaled linearly to `sizePx`. */
function wrapWords(words: string[], widths: number[], spaceWidth: number, sizePx: number, maxWidth: number): { lines: string[]; overflowWord: boolean } {
  const scale = sizePx / SIZE_PROBE;
  const lines: string[] = [];
  let line: string[] = [];
  let lineWidth = 0;
  let overflowWord = false;
  words.forEach((word, i) => {
    const w = (widths[i] as number) * scale;
    if (w > maxWidth) overflowWord = true;
    const added = line.length === 0 ? w : lineWidth + spaceWidth * scale + w;
    if (line.length > 0 && added > maxWidth) {
      lines.push(line.join(' '));
      line = [word];
      lineWidth = w;
    } else {
      line.push(word);
      lineWidth = added;
    }
  });
  if (line.length > 0) lines.push(line.join(' '));
  return { lines, overflowWord };
}

function zoneBox(zone: ZoneSpec, imgW: number, imgH: number): { x: number; y: number; w: number; h: number } {
  const x = Math.round(zone.x * imgW);
  const y = Math.round(zone.y * imgH);
  return { x, y, w: Math.max(1, Math.min(imgW - x, Math.round(zone.w * imgW))), h: Math.max(1, Math.min(imgH - y, Math.round(zone.h * imgH))) };
}

interface PlacedText {
  layers: OverlayOptions[];
  rendered: boolean;
}

async function layoutZone(
  zone: ZoneSpec,
  value: string,
  imgW: number,
  imgH: number,
  color: Rgb,
  shadow: Rgb,
): Promise<PlacedText> {
  const { x: boxX, y: boxY, w: boxW, h: boxH } = zoneBox(zone, imgW, imgH);

  const baseSize = Math.max(MIN_FONT_PX, zone.font_size_ratio * imgW);
  const minSize = Math.max(MIN_FONT_PX, baseSize * MIN_SCALE);
  const offset = Math.max(1, Math.round(baseSize * 0.035));
  const availW = Math.max(1, boxW - offset);
  const availH = Math.max(1, boxH - offset);
  const maxLines = Math.max(1, zone.max_lines);

  const words = value.split(' ').filter(Boolean);
  if (words.length === 0) return { layers: [], rendered: false };

  // Probe widths once; sizes below are linear scalings of these.
  const probe = async (t: string) => (await renderText(t, SIZE_PROBE, zone.font_weight, '#000000', 'left')).width;
  const widths = await Promise.all(words.map(probe));
  const spaceWidth = Math.max(1, (await probe('n n')) - (await probe('nn')));

  const fitsAt = (size: number): string[] | null => {
    const { lines, overflowWord } = wrapWords(words, widths, spaceWidth, size, availW);
    if (overflowWord || lines.length > maxLines) return null;
    return lines.length * size * LINE_HEIGHT <= availH ? lines : null;
  };

  let size = baseSize;
  let lines: string[] | null = null;
  while (size >= minSize - 0.01) {
    lines = fitsAt(size);
    if (lines) break;
    size *= SHRINK_STEP;
  }
  if (!lines) {
    // Does not fit even at the smallest size: drop trailing words (then characters) and add an ellipsis.
    size = minSize;
    const heightOk = (n: number): boolean => n * size * LINE_HEIGHT <= availH;
    for (let n = words.length; n >= 1 && !lines; n--) {
      const candidate = words.slice(0, n);
      candidate[n - 1] = `${candidate[n - 1] as string}…`;
      const candidateWidths = [...widths.slice(0, n - 1), await probe(candidate[n - 1] as string)];
      const wrapped = wrapWords(candidate, candidateWidths, spaceWidth, size, availW);
      if (!wrapped.overflowWord && wrapped.lines.length <= maxLines && heightOk(wrapped.lines.length)) lines = wrapped.lines;
    }
    if (!lines) {
      let word = words[0] as string;
      while (word.length > 1) {
        word = word.slice(0, -1);
        if (((await probe(`${word}…`)) * size) / SIZE_PROBE <= availW) break;
      }
      lines = [`${word}…`];
    }
  }

  // Render for real and verify; shrink a little if the estimate was optimistic.
  let block: TextRender | null = null;
  const text = (): string => (lines as string[]).join('\n');
  for (let attempt = 0; attempt < 8; attempt++) {
    block = await renderText(text(), size, zone.font_weight, toHex(color), zone.align);
    if (block.width <= availW && block.height <= availH) break;
    if (size <= MIN_FONT_PX) break;
    size = Math.max(MIN_FONT_PX, size * SHRINK_STEP);
    const refit = fitsAt(size);
    if (refit) lines = refit;
  }
  if (!block) return { layers: [], rendered: false };

  // Never exceed the zone, whatever the font did.
  let renderedBlock = block;
  if (renderedBlock.width > availW || renderedBlock.height > availH) {
    const resized = await sharp(renderedBlock.buffer)
      .resize({ width: availW, height: availH, fit: 'inside' })
      .png()
      .toBuffer({ resolveWithObject: true });
    renderedBlock = { buffer: resized.data, width: resized.info.width, height: resized.info.height };
  }

  const left =
    zone.align === 'left' ? boxX : zone.align === 'right' ? boxX + availW - renderedBlock.width : boxX + Math.round((availW - renderedBlock.width) / 2);
  const top = boxY + Math.round((availH - renderedBlock.height) / 2);

  const shadowBlock = await renderText(text(), size, zone.font_weight, toHex(shadow), zone.align, 0.45);
  const shadowFits = shadowBlock.width === renderedBlock.width && shadowBlock.height === renderedBlock.height;
  const layers: OverlayOptions[] = [];
  if (shadowFits) layers.push({ input: shadowBlock.buffer, left: left + offset, top: top + offset });
  layers.push({ input: renderedBlock.buffer, left, top });
  return { layers, rendered: true };
}

/** Centre-crops to the requested ratio when the provider returned something noticeably different. */
async function normaliseBase(base: Buffer, aspectRatio?: string): Promise<{ buffer: Buffer; width: number; height: number }> {
  let pipeline = sharp(base, { limitInputPixels: MAX_PIXELS }).rotate().flatten({ background: '#ffffff' });
  const meta = await sharp(base, { limitInputPixels: MAX_PIXELS }).metadata();
  let width = meta.width ?? 0;
  let height = meta.height ?? 0;
  const m = aspectRatio ? /^(\d{1,2}):(\d{1,2})$/.exec(aspectRatio) : null;
  if (m && width > 0 && height > 0) {
    const target = Number(m[1]) / Number(m[2]);
    const actual = width / height;
    if (Math.abs(actual / target - 1) > 0.01) {
      const cropW = actual > target ? Math.round(height * target) : width;
      const cropH = actual > target ? height : Math.round(width / target);
      pipeline = sharp(await pipeline.png().toBuffer()).extract({
        left: Math.floor((width - cropW) / 2),
        top: Math.floor((height - cropH) / 2),
        width: cropW,
        height: cropH,
      });
      width = cropW;
      height = cropH;
    }
  }
  const out = await pipeline.png().toBuffer();
  return { buffer: out, width, height };
}

/** Average colour of a region. (sharp's `stats()` ignores `extract()`, so the region is read as raw pixels.) */
async function meanColor(image: Buffer, region: { left: number; top: number; width: number; height: number }): Promise<Rgb> {
  const { data, info } = await sharp(image).extract(region).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const stride = Math.max(1, Math.floor((info.width * info.height) / 4000));
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let p = 0; p < info.width * info.height; p += stride) {
    r += data[p * 3] as number;
    g += data[p * 3 + 1] as number;
    b += data[p * 3 + 2] as number;
    n++;
  }
  return n === 0 ? { r: 0, g: 0, b: 0 } : { r: r / n, g: g / n, b: b / n };
}

/**
 * Pastes the creator's slot text into the template's text zones (the model never writes text), plus an
 * optional watermark. Output is a metadata-free PNG. Text is rendered with sharp's Pango text input
 * using the bundled Inter font files, so it looks the same on every platform.
 */
export async function compositeText(input: CompositeInput): Promise<CompositeResult> {
  const { buffer, width, height } = await normaliseBase(input.base, input.aspectRatio);
  const palette = input.palette ?? [];
  const layers: OverlayOptions[] = [];
  const placed: string[] = [];

  for (const zone of [...input.zones].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const value = cleanLine(input.values[zone.slot_key] ?? '');
    if (!value) continue;

    const { x: boxX, y: boxY, w: boxW, h: boxH } = zoneBox(zone, width, height);
    // Legibility guard: the zone is meant to be a flat field, but if the configured colour would not
    // contrast with what is actually there, switch to white or near-black.
    const background = await meanColor(buffer, { left: boxX, top: boxY, width: boxW, height: boxH });
    let color = resolveColor(zone.color, palette);
    if (contrast(color, background) < 2.5) {
      const white: Rgb = { r: 255, g: 255, b: 255 };
      const dark: Rgb = { r: 17, g: 24, b: 39 };
      color = contrast(white, background) >= contrast(dark, background) ? white : dark;
    }
    const shadow: Rgb = luminance(color) > 0.4 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };

    const result = await layoutZone(zone, value, width, height, color, shadow);
    if (result.rendered) {
      layers.push(...result.layers);
      placed.push(zone.slot_key);
    }
  }

  if (input.watermark) {
    const size = Math.max(MIN_FONT_PX, Math.round(width * 0.022));
    const mark = await renderText(input.watermark, size, 600, '#ffffff', 'right', 0.75);
    const margin = Math.round(width * 0.02);
    if (mark.width + margin < width && mark.height + margin < height) {
      layers.push({ input: mark.buffer, left: width - mark.width - margin, top: height - mark.height - margin });
    }
  }

  const image = await sharp(buffer).composite(layers).png({ compressionLevel: 6 }).toBuffer();
  return { image, width, height, placed };
}
