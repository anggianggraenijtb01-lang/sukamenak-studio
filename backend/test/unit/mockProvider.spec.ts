import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { largestFreeRect, mockProvider } from '../../src/providers/mock.js';
import type { GenerateImageInput, ModelConfigRecord } from '../../src/providers/types.js';

const config = { id: 'x', provider: 'mock' } as unknown as ModelConfigRecord;
const solid = (color: string) => sharp({ create: { width: 160, height: 120, channels: 3, background: color } }).png().toBuffer();

const ZONES = [
  { x: 0.08, y: 0.06, w: 0.84, h: 0.18 },
  { x: 0.1, y: 0.86, w: 0.8, h: 0.08 },
];

const baseInput = (over: Partial<GenerateImageInput> = {}): GenerateImageInput => ({
  prompt: 'a prompt',
  mode: 'i2i',
  references: [],
  aspectRatio: '4:5',
  width: 400,
  height: 500,
  emptyZones: ZONES,
  ...over,
});

async function pixels(buf: Buffer) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const near = (data: Buffer, i: number, rgb: [number, number, number], tol = 6) =>
  Math.abs((data[i] as number) - rgb[0]) <= tol && Math.abs((data[i + 1] as number) - rgb[1]) <= tol && Math.abs((data[i + 2] as number) - rgb[2]) <= tol;

function countColour(data: Buffer, rgb: [number, number, number]): number {
  let n = 0;
  for (let i = 0; i < data.length; i += 3) if (near(data, i, rgb)) n++;
  return n;
}

describe('mock provider: generateImage', () => {
  it('returns a real PNG of the requested size', async () => {
    const out = await mockProvider.generateImage!(config, baseInput());
    expect(out.mime).toBe('image/png');
    const meta = await sharp(out.image).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['png', 400, 500]);
    expect(out.costUsd).toBe(0);
  });

  it('composites ALL reference images it receives and reports how many', async () => {
    const colours: [string, [number, number, number]][] = [
      ['#ff0000', [255, 0, 0]],
      ['#00ff00', [0, 255, 0]],
      ['#0000ff', [0, 0, 255]],
    ];
    const refs = await Promise.all(colours.map(async ([c]) => ({ data: await solid(c), mime: 'image/png' })));
    const out = await mockProvider.generateImage!(config, baseInput({ references: refs }));
    expect(out.referencesUsed).toBe(3);
    const { data } = await pixels(out.image);
    for (const [, rgb] of colours) expect(countColour(data, rgb), `colour ${rgb.join(',')}`).toBeGreaterThan(1500);

    const one = await mockProvider.generateImage!(config, baseInput({ references: refs.slice(0, 1) }));
    expect(one.referencesUsed).toBe(1);
    const onePx = await pixels(one.image);
    expect(countColour(onePx.data, [255, 0, 0])).toBeGreaterThan(1500);
    expect(countColour(onePx.data, [0, 255, 0])).toBe(0);
  });

  it('keeps every empty zone a perfectly flat colour field, with references or without', async () => {
    const refs = [{ data: await solid('#ff00ff'), mime: 'image/png' }, { data: await solid('#00ffff'), mime: 'image/png' }];
    for (const references of [refs, []]) {
      const out = await mockProvider.generateImage!(config, baseInput({ references }));
      const { data, width } = await pixels(out.image);
      for (const z of ZONES) {
        const x0 = Math.round(z.x * 400);
        const y0 = Math.round(z.y * 500);
        const first = [data[(y0 * width + x0) * 3], data[(y0 * width + x0) * 3 + 1], data[(y0 * width + x0) * 3 + 2]];
        for (let y = y0; y < y0 + Math.round(z.h * 500); y++) {
          for (let x = x0; x < x0 + Math.round(z.w * 400); x++) {
            const i = (y * width + x) * 3;
            expect([data[i], data[i + 1], data[i + 2]]).toEqual(first);
          }
        }
      }
    }
  });

  it('is deterministic for identical input and varies with the prompt', async () => {
    const refs = [{ data: await solid('#ff0000'), mime: 'image/png' }];
    const a = await mockProvider.generateImage!(config, baseInput({ references: refs }));
    const b = await mockProvider.generateImage!(config, baseInput({ references: refs }));
    expect(Buffer.compare(a.image, b.image)).toBe(0);
    const c = await mockProvider.generateImage!(config, baseInput({ references: refs, prompt: 'another prompt' }));
    expect(Buffer.compare(a.image, c.image)).not.toBe(0);
  });

  it('ignores references in t2i mode and reports zero used', async () => {
    const refs = [{ data: await solid('#ff0000'), mime: 'image/png' }];
    const out = await mockProvider.generateImage!(config, baseInput({ mode: 't2i', references: refs }));
    expect(out.referencesUsed).toBe(0);
    expect(countColour((await pixels(out.image)).data, [255, 0, 0])).toBe(0);
  });

  it('finds the largest rectangle that avoids all zones', () => {
    const free = largestFreeRect(ZONES);
    for (const z of ZONES) {
      const overlaps = free.x < z.x + z.w && z.x < free.x + free.w && free.y < z.y + z.h && z.y < free.y + free.h;
      expect(overlaps).toBe(false);
    }
    expect(free.w * free.h).toBeGreaterThan(0.5);
  });
});

describe('mock provider: analyzeReference', () => {
  it('describes the requested aspect from the image, deterministically and without glyph words', async () => {
    const image = { data: await solid('#cc2200'), mime: 'image/png' };
    const color = await mockProvider.analyzeReference!(config, { image, role: 'color', instruction: 'x' });
    // sharp reports a quantised dominant colour, so compare loosely with the source colour #cc2200.
    const hex = /#([0-9a-f]{6})/i.exec(color.description)?.[1] ?? '';
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
    expect(Math.abs(r - 0xcc)).toBeLessThan(16);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(24);
    const again = await mockProvider.analyzeReference!(config, { image, role: 'color', instruction: 'x' });
    expect(again.description).toBe(color.description);
    for (const role of ['product', 'lighting', 'background', 'style', 'pose', 'human_model', 'font']) {
      const r = await mockProvider.analyzeReference!(config, { image, role, instruction: 'x' });
      expect(r.description.length).toBeGreaterThan(5);
      expect(r.description).not.toMatch(/\b(text|font|typography|headline)\b/i);
    }
  });
});
