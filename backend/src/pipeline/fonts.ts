import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Bundled OFL-licensed Inter (see assets/fonts/OFL-Inter.txt). Resolves from both src/ and dist/. */
export const FONTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');

export interface FontFace {
  weight: number;
  /** Pango family+style name for this file. */
  face: string;
  file: string;
}

export const FONT_FACES: readonly FontFace[] = [
  { weight: 400, face: 'Inter', file: path.join(FONTS_DIR, 'Inter-Regular.ttf') },
  { weight: 500, face: 'Inter Medium', file: path.join(FONTS_DIR, 'Inter-Medium.ttf') },
  { weight: 600, face: 'Inter SemiBold', file: path.join(FONTS_DIR, 'Inter-SemiBold.ttf') },
  { weight: 700, face: 'Inter Bold', file: path.join(FONTS_DIR, 'Inter-Bold.ttf') },
  { weight: 800, face: 'Inter ExtraBold', file: path.join(FONTS_DIR, 'Inter-ExtraBold.ttf') },
];

/** Nearest bundled weight; zone `font_family` values other than Inter are not available and fall back to it. */
export function faceForWeight(weight: number): FontFace {
  let best = FONT_FACES[0] as FontFace;
  for (const f of FONT_FACES) if (Math.abs(f.weight - weight) < Math.abs(best.weight - weight)) best = f;
  return best;
}

let configured = false;

/**
 * Points fontconfig at the bundled fonts by generating a small fonts.conf and setting FONTCONFIG_FILE.
 * It must run before sharp renders its first text (this module is imported by the compositor, long
 * before that). On Linux/Docker this is what makes `Inter` resolvable without system fonts; on
 * Windows libvips does not read it, so every text render ALSO passes the font file explicitly
 * (sharp's `fontfile` option), which works the same on every platform.
 */
export function configureFontconfig(): string | null {
  if (configured) return process.env.FONTCONFIG_FILE ?? null;
  configured = true;
  if (process.env.FONTCONFIG_FILE) return process.env.FONTCONFIG_FILE;
  try {
    const dir = path.join(os.tmpdir(), 'sukamenak-studio-fontconfig');
    mkdirSync(path.join(dir, 'cache'), { recursive: true });
    const conf = path.join(dir, 'fonts.conf');
    const xml = [
      '<?xml version="1.0"?>',
      '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">',
      '<fontconfig>',
      '  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>',
      `  <dir>${FONTS_DIR}</dir>`,
      `  <cachedir>${path.join(dir, 'cache')}</cachedir>`,
      '</fontconfig>',
      '',
    ].join('\n');
    writeFileSync(conf, xml, 'utf8');
    process.env.FONTCONFIG_FILE = conf;
    process.env.FONTCONFIG_PATH = dir;
    return conf;
  } catch {
    return null;
  }
}

configureFontconfig();
