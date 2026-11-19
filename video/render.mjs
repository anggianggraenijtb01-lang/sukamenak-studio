#!/usr/bin/env node
/**
 * Renders one StoryPromo reel for the backend.
 *
 *   node render.mjs --props /path/props.json --out /path/out.mp4
 *
 * The backend spawns this with VIDEO_RENDER_COMMAND (default: this file) and passes the props the API
 * already validated. Exit code 0 means the mp4 exists; any other code is a render failure, and stderr
 * is forwarded to the worker log (never to a user-facing response).
 *
 * Rendering runs in a child process on purpose: a Chrome crash or an OOM kill takes down this process,
 * not the worker that also writes job state to PostgreSQL.
 */
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(HERE, 'src', 'index.ts');
const COMPOSITION = process.env.VIDEO_COMPOSITION_ID ?? 'StoryPromo';

const argOf = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const propsPath = argOf('props');
const outPath = argOf('out');
if (!propsPath || !outPath) {
  process.stderr.write('Usage: node render.mjs --props <props.json> --out <out.mp4>\n');
  process.exit(2);
}

const progress = (percent) => {
  // The worker parses this line to update video_jobs.progress, so keep the format stable.
  process.stdout.write(`PROGRESS ${Math.max(0, Math.min(100, Math.round(percent)))}\n`);
};

const main = async () => {
  const inputProps = JSON.parse(await readFile(propsPath, 'utf8'));
  await mkdir(path.dirname(outPath), { recursive: true });

  progress(2);
  const serveUrl = await bundle({ entryPoint: ENTRY });

  progress(8);
  const composition = await selectComposition({ serveUrl, id: COMPOSITION, inputProps });

  await renderMedia({
    serveUrl,
    composition,
    codec: 'h264',
    outputLocation: outPath,
    inputProps,
    imageFormat: 'jpeg',
    jpegQuality: 90,
    crf: 23,
    overwrite: true,
    onProgress: ({ progress: p }) => progress(10 + p * 88),
  });

  progress(100);
  // bundle() writes to a temp dir; remove it so repeated renders do not fill the volume.
  if (typeof serveUrl === 'string' && serveUrl.includes('remotion-bundle')) {
    await rm(serveUrl, { recursive: true, force: true }).catch(() => undefined);
  }
};

main().catch((err) => {
  process.stderr.write(`render failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
