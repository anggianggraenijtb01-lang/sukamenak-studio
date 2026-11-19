#!/usr/bin/env node
/**
 * Stand-in for video/render.mjs in tests: writes a tiny file with an MP4 signature and reports
 * progress, so the endpoint, job state machine, asset storage and Range serving are all exercised
 * without launching Chrome. The real renderer is covered by the video/ package's own typecheck and
 * by a manual render.
 *
 * Usage: node fakeRender.mjs --props <props.json> --out <out.mp4>
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argOf = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const out = argOf('out');
if (!out) {
  process.stderr.write('missing --out\n');
  process.exit(2);
}

await mkdir(path.dirname(out), { recursive: true });
for (const p of [5, 45, 90, 100]) process.stdout.write(`PROGRESS ${p}\n`);

// 64 bytes: enough for Range tests (a partial body must differ from the whole one).
const body = Buffer.alloc(64, 0);
body.write('ftypisom', 4, 'ascii');
await writeFile(out, body);
