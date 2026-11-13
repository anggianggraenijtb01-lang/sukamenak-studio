import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { compositeText, type ZoneSpec } from '../../src/pipeline/compositor.js';
import { FONT_FACES, faceForWeight } from '../../src/pipeline/fonts.js';

const W = 800;
const H = 1000;

const zone = (over: Partial<ZoneSpec> = {}): ZoneSpec => ({
  slot_key: 'title',
  x: 0.1,
  y: 0.08,
  w: 0.8,
  h: 0.2,
  align: 'center',
  font_weight: 800,
  font_size_ratio: 0.07,
  color: '#FFFFFF',
  max_lines: 2,
  ...over,
});

const flatBase = (color = '#1e3a8a', width = W, height = H): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();

async function raw(buf: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Counts pixels that differ between two same-size images, inside and outside the given pixel rectangle. */
async function diff(a: Buffer, b: Buffer, rect: { x: number; y: number; w: number; h: number }) {
  const ra = await raw(a);
  const rb = await raw(b);
  expect([ra.width, ra.height]).toEqual([rb.width, rb.height]);
  let inside = 0;
  let outside = 0;
  for (let y = 0; y < ra.height; y++) {
    for (let x = 0; x < ra.width; x++) {
      const i = (y * ra.width + x) * 3;
      const changed = ra.data[i] !== rb.data[i] || ra.data[i + 1] !== rb.data[i + 1] || ra.data[i + 2] !== rb.data[i + 2];
      if (!changed) continue;
      const inZone = x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      if (inZone) inside++;
      else outside++;
    }
  }
  return { inside, outside };
}

const rectOf = (z: ZoneSpec) => ({ x: Math.round(z.x * W), y: Math.round(z.y * H), w: Math.round(z.w * W), h: Math.round(z.h * H) });

describe('bundled fonts', () => {
  it('ships Inter in five weights and maps weights to the nearest face', () => {
    expect(FONT_FACES.map((f) => f.weight)).toEqual([400, 500, 600, 700, 800]);
    expect(faceForWeight(900).weight).toBe(800);
    expect(faceForWeight(100).weight).toBe(400);
    expect(faceForWeight(660).weight).toBe(700);
  });
});

describe('compositeText', () => {
  it('draws text inside the zone and leaves every pixel outside the zone unchanged', async () => {
    const base = await flatBase();
    const z = zone();
    const out = await compositeText({ base, zones: [z], values: { title: 'Promo Hemat 50%' }, aspectRatio: '4:5' });
    expect(out.placed).toEqual(['title']);
    expect([out.width, out.height]).toEqual([W, H]);

    const { inside, outside } = await diff(base, out.image, rectOf(z));
    expect(inside).toBeGreaterThan(1500); // glyphs are really there
    expect(outside).toBe(0);
  });

  it('renders visible light pixels (white text) on a dark field and keeps the output a metadata-free PNG', async () => {
    const out = await compositeText({ base: await flatBase('#0f172a'), zones: [zone()], values: { title: 'Halo Desa' } });
    const meta = await sharp(out.image).metadata();
    expect(meta.format).toBe('png');
    expect(meta.exif).toBeUndefined();
    const { data, width } = await raw(out.image);
    const r = rectOf(zone());
    let light = 0;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if ((data[(y * width + x) * 3] as number) > 200) light++;
    expect(light).toBeGreaterThan(500);
  });

  it('uses the bundled Inter files: different weights give different glyph shapes', async () => {
    const base = await flatBase();
    const regular = await compositeText({ base, zones: [zone({ font_weight: 400 })], values: { title: 'Keripik Tempe' } });
    const bold = await compositeText({ base, zones: [zone({ font_weight: 800 })], values: { title: 'Keripik Tempe' } });
    expect(Buffer.compare(regular.image, bold.image)).not.toBe(0);
    const a = await diff(base, regular.image, rectOf(zone()));
    const b = await diff(base, bold.image, rectOf(zone()));
    expect(b.inside).toBeGreaterThan(a.inside);
  });

  it('is deterministic', async () => {
    const base = await flatBase();
    const args = { base, zones: [zone()], values: { title: 'Sama Persis' } };
    const a = await compositeText(args);
    const b = await compositeText(args);
    expect(Buffer.compare(a.image, b.image)).toBe(0);
  });

  it('does nothing for empty or missing values', async () => {
    const base = await flatBase();
    const out = await compositeText({ base, zones: [zone()], values: { title: '   ', other: 'ignored' } });
    expect(out.placed).toEqual([]);
    const { inside, outside } = await diff(base, out.image, rectOf(zone()));
    expect(inside + outside).toBe(0);
  });

  it('wraps to max_lines, shrinks long text to fit and never leaves the zone', async () => {
    const base = await flatBase();
    const z = zone({ h: 0.12, max_lines: 2, font_size_ratio: 0.08 });
    const long = 'Diskon besar besaran untuk seluruh produk keripik tempe renyah gurih khas desa Sukamenak minggu ini';
    const out = await compositeText({ base, zones: [z], values: { title: long } });
    expect(out.placed).toEqual(['title']);
    const { inside, outside } = await diff(base, out.image, rectOf(z));
    expect(inside).toBeGreaterThan(500);
    expect(outside).toBe(0);
  });

  it('truncates with an ellipsis when even the smallest size cannot fit, still inside the zone', async () => {
    const base = await flatBase();
    const z = zone({ h: 0.04, w: 0.3, max_lines: 1, font_size_ratio: 0.05 });
    const out = await compositeText({
      base,
      zones: [z],
      values: { title: 'Kalimat yang sangat panjang sekali dan tidak mungkin muat dalam satu baris kecil ini' },
    });
    expect(out.placed).toEqual(['title']);
    const { inside, outside } = await diff(base, out.image, rectOf(z));
    expect(inside).toBeGreaterThan(50);
    expect(outside).toBe(0);
  });

  it('handles one unbreakable long word and markup characters in user text', async () => {
    const base = await flatBase();
    const z = zone({ w: 0.4, max_lines: 1 });
    const out = await compositeText({
      base,
      zones: [z],
      values: { title: 'Supercalifragilisticexpialidocious_tanpa_spasi <b>&</b> "kutip"' },
    });
    expect(out.placed).toEqual(['title']);
    const { outside } = await diff(base, out.image, rectOf(z));
    expect(outside).toBe(0);
  });

  it('supports left/right alignment and several zones independently', async () => {
    const base = await flatBase();
    const zones = [
      zone({ slot_key: 'a', align: 'left', y: 0.05, h: 0.1 }),
      zone({ slot_key: 'b', align: 'right', y: 0.4, h: 0.1 }),
      zone({ slot_key: 'c', align: 'center', y: 0.8, h: 0.1 }),
    ];
    const out = await compositeText({ base, zones, values: { a: 'Kiri', b: 'Kanan', c: 'Tengah' } });
    expect(out.placed.sort()).toEqual(['a', 'b', 'c']);
    // Text pixels of the left-aligned zone sit in its left half, the right-aligned one in its right half.
    const { data, width } = await raw(out.image);
    const bright = (x0: number, x1: number, y0: number, y1: number) => {
      let n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if ((data[(y * width + x) * 3] as number) > 200) n++;
      return n;
    };
    const mid = Math.round(0.5 * W);
    expect(bright(80, mid, 50, 150)).toBeGreaterThan(bright(mid, 720, 50, 150));
    expect(bright(mid, 720, 400, 500)).toBeGreaterThan(bright(80, mid, 400, 500));
  });

  it('switches to a readable colour when the zone colour would not contrast', async () => {
    const out = await compositeText({
      base: await flatBase('#ffffff'),
      zones: [zone({ color: '#FFFFFF' })],
      values: { title: 'Terbaca' },
    });
    const { data, width } = await raw(out.image);
    const r = rectOf(zone());
    let dark = 0;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if ((data[(y * width + x) * 3] as number) < 100) dark++;
    expect(dark).toBeGreaterThan(300);
  });

  it('judges legibility from the zone itself, not from the whole image', async () => {
    // A white poster with a dark navy field in the zone: white text is right and must be kept.
    const dark = await sharp({ create: { width: 300, height: 120, channels: 3, background: '#0f172a' } }).png().toBuffer();
    const base = await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
      .composite([{ input: dark, left: Math.round(0.1 * W), top: Math.round(0.08 * H) }])
      .png()
      .toBuffer();
    const z = zone({ w: 300 / W, h: 120 / H });
    const out = await compositeText({ base, zones: [z], values: { title: 'Putih di atas gelap' } });
    const { data, width } = await raw(out.image);
    const r = rectOf(z);
    let white = 0;
    let black = 0;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const v = data[(y * width + x) * 3] as number;
      if (v > 220) white++;
      if (v < 8) black++;
    }
    expect(white).toBeGreaterThan(200);
    expect(black).toBe(0);
  });

  it('resolves brand palette colours', async () => {
    const base = await flatBase('#0f172a');
    const out = await compositeText({ base, zones: [zone({ color: 'brand:1' })], values: { title: 'Warna Brand' }, palette: ['#ffffff', '#ff0000'] });
    const { data, width } = await raw(out.image);
    const r = rectOf(zone());
    let red = 0;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const i = (y * width + x) * 3;
      if ((data[i] as number) > 200 && (data[i + 1] as number) < 60) red++;
    }
    expect(red).toBeGreaterThan(300);
  });

  it('adds a watermark only when asked, in the bottom-right corner', async () => {
    const base = await flatBase();
    const plain = await compositeText({ base, zones: [], values: {} });
    expect(Buffer.compare(plain.image, base)).toBe(0);
    const marked = await compositeText({ base, zones: [], values: {}, watermark: 'Sukamenak Studio' });
    const { inside, outside } = await diff(base, marked.image, { x: W * 0.55, y: H * 0.9, w: W * 0.45, h: H * 0.1 });
    expect(inside).toBeGreaterThan(100);
    expect(outside).toBe(0);
  });

  it('centre-crops a base whose ratio differs from the template ratio', async () => {
    const out = await compositeText({ base: await flatBase('#222222', 1000, 1000), zones: [], values: {}, aspectRatio: '4:5' });
    expect([out.width, out.height]).toEqual([800, 1000]);
    const same = await compositeText({ base: await flatBase('#222222', 800, 1000), zones: [], values: {}, aspectRatio: '4:5' });
    expect([same.width, same.height]).toEqual([800, 1000]);
  });
});
