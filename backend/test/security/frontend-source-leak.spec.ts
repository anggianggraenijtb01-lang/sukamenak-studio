import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AES_KEY_MARKER, BUNDLE_WINDOW, FRONTEND_MOCK_PROMPT_LINES, findWindow, seededCoreBodies, windowsOf } from '../helpers/leak.js';

/**
 * Scans the frontend SOURCE for core prompt text and the old AES key. Disabled by default because the frontend still
 * ships a leaked mock core prompt and key (Phase D removes them). Enable with CHECK_FRONTEND_SOURCE=1; then it must pass.
 * Offenders are reported as file + kind only, never with the matched text.
 */
const ENABLED = process.env.CHECK_FRONTEND_SOURCE === '1';
const FRONTEND_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../frontend/src');
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.html']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(name))) out.push(full);
  }
  return out;
}

describe.skipIf(!ENABLED)('frontend source contains no core prompt or encryption key (CHECK_FRONTEND_SOURCE=1)', () => {
  it('frontend/src is clean', () => {
    expect(existsSync(FRONTEND_SRC), `${FRONTEND_SRC} must exist`).toBe(true);
    const windows = windowsOf(seededCoreBodies(), BUNDLE_WINDOW);
    const offenders: string[] = [];
    for (const file of walk(FRONTEND_SRC)) {
      const code = readFileSync(file, 'utf8');
      const rel = path.relative(FRONTEND_SRC, file).replace(/\\/g, '/');
      if (code.includes(AES_KEY_MARKER)) offenders.push(`${rel}: AES key`);
      for (const line of FRONTEND_MOCK_PROMPT_LINES) if (code.includes(line)) offenders.push(`${rel}: leaked mock core prompt line`);
      if (findWindow(code, windows, BUNDLE_WINDOW)) offenders.push(`${rel}: contains a ${BUNDLE_WINDOW}+ character run of a seeded core prompt`);
    }
    expect([...new Set(offenders)].sort()).toEqual([]);
  });
});
