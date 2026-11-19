import { describe, expect, it } from 'vitest';
import { buildVideoJobProps, toRenderProps, type ZoneRow } from '../../src/video/props.js';
import { parseRange } from '../../src/modules/files/routes.js';
import { extensionForMime, mimeForKey, newStorageKey } from '../../src/storage/keys.js';

const zone = (over: Partial<ZoneRow> = {}): ZoneRow => ({
  slot_key: 'title',
  x: 0.08,
  y: 0.1,
  w: 0.84,
  h: 0.14,
  align: 'center',
  font_weight: 800,
  font_size_ratio: 0.05,
  color: '#FFFFFF',
  max_lines: 2,
  ...over,
});

const base = {
  posterKey: 'results/2026-11/abc.png',
  palette: ['#1800ad', '#ffcc00', 'not-a-colour'],
  durationSeconds: 15,
  watermark: false,
  brandName: 'Desa Sukamenak',
};

describe('video props', () => {
  it('keeps only zones that carry text, in template order, and staggers them', () => {
    const props = buildVideoJobProps({
      ...base,
      zones: [zone({ slot_key: 'title' }), zone({ slot_key: 'cta' }), zone({ slot_key: 'subtitle' })],
      values: { title: 'Keripik Tempe', subtitle: '   ', cta: 'Pesan sekarang' },
    });
    expect(props.zones.map((z) => z.key)).toEqual(['title', 'cta']);
    expect(props.zones.map((z) => z.delay)).toEqual([0, 10]);
    expect(props.zones[0]?.text).toBe('Keripik Tempe');
  });

  it('clamps geometry and filters unsafe values instead of trusting the row', () => {
    const props = buildVideoJobProps({
      ...base,
      zones: [
        zone({ x: -1, y: 4, w: 2, h: Number.NaN, font_weight: 5000, font_size_ratio: 9, max_lines: 99, color: 'red' }),
      ],
      values: { title: 'Judul' },
    });
    const z = props.zones[0]!;
    expect(z.x).toBe(0);
    expect(z.y).toBe(1);
    expect(z.w).toBe(1);
    expect(z.h).toBe(0);
    expect(z.weight).toBe(900);
    expect(z.sizeRatio).toBe(0.2);
    expect(z.maxLines).toBe(6);
    expect(z.color).toBe('#FFFFFF');
    expect(props.palette).toEqual(['#1800ad', '#ffcc00']);
  });

  it('never carries a prompt-shaped field', () => {
    const props = buildVideoJobProps({ ...base, zones: [zone()], values: { title: 'Judul' } });
    expect(Object.keys(props).sort()).toEqual(['brand_name', 'duration_seconds', 'palette', 'poster_key', 'watermark', 'zones']);
    expect(JSON.stringify(props)).not.toMatch(/prompt|cipher|auth_tag|final_/i);
  });

  it('inlines the poster as a data URI for the renderer', () => {
    const props = buildVideoJobProps({ ...base, zones: [zone()], values: { title: 'Judul' } });
    const rendered = toRenderProps(props, Buffer.from('png-bytes'), 'image/png');
    expect(rendered.posterDataUri).toBe(`data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}`);
    expect(rendered.durationSeconds).toBe(15);
    expect(rendered.zones).toHaveLength(1);
    expect(rendered.brandName).toBe('Desa Sukamenak');
  });
});

describe('mp4 storage keys', () => {
  it('maps the video mime both ways', () => {
    expect(extensionForMime('video/mp4')).toBe('mp4');
    expect(mimeForKey('videos/2026-11/x.mp4')).toBe('video/mp4');
    expect(mimeForKey('videos/2026-11/x.unknown')).toBe('application/octet-stream');
  });

  it('generates a key the files route accepts', () => {
    const key = newStorageKey('videos', 'video/mp4', new Date('2026-11-19T00:00:00Z'));
    expect(key).toMatch(/^videos\/2026-11\/[0-9a-f-]{36}\.mp4$/);
  });
});

describe('Range parsing', () => {
  it('reads the common forms', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
  });

  it('clamps an end past the file and refuses what it cannot serve', () => {
    expect(parseRange('bytes=900-9999', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=1000-', 1000)).toBeNull();
    expect(parseRange('bytes=9-2', 1000)).toBeNull();
    expect(parseRange('bytes=-0', 1000)).toBeNull();
    expect(parseRange('bytes=abc', 1000)).toBeNull();
    expect(parseRange('bytes=0-1,4-5', 1000)).toBeNull();
    expect(parseRange(undefined, 1000)).toBeNull();
    expect(parseRange('bytes=0-1', 0)).toBeNull();
  });
});
