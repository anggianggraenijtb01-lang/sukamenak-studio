#!/usr/bin/env node
/**
 * Manual end-to-end check of the video feature against a running API (dev or staging).
 *
 *   BASE=http://127.0.0.1:3000/api/v1 node scripts/e2e-video.mjs
 *   BASE=http://127.0.0.1:3000/api/v1 REF=path/to/poster.jpg OUT_DIR=/tmp node scripts/e2e-video.mjs
 *
 * Registers a throwaway user, generates a poster, renders it with the REAL Remotion renderer, downloads
 * the mp4 (full body + Range) and checks the response shapes. Takes ~2 minutes and leaves one
 * `video-e2e-*@test.local` account (and its poster) behind by design: this is a probe, not a test.
 *
 * Not part of the suite: it needs a live API, a browser and real minutes.
 */
const BASE = process.env.BASE ?? 'http://127.0.0.1:3000/api/v1';
const REF = process.env.REF ?? 'frontend/public/posters/poster-keripik.jpg';
const OUT_DIR = process.env.OUT_DIR ?? '.';
const email = `video-e2e-${Date.now()}@test.local`;
const password = 'E2e-video-pass-1';

const log = (label, extra) => console.log(extra === undefined ? label : `${label}: ${JSON.stringify(extra)}`);
const fail = (msg) => {
  console.error(`FAIL ${msg}`);
  process.exit(1);
};

const req = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { res, data };
};

const { readFile, writeFile, mkdir } = await import('node:fs/promises');

const reg = await req('POST', '/auth/register', { body: { email, password, name: 'E2E Video' } });
if (reg.res.status !== 201) fail(`register ${reg.res.status} ${JSON.stringify(reg.data)}`);
const token = reg.data.data.access_token;

const form = new FormData();
form.append('role', 'product');
form.append('file', new Blob([await readFile(REF)], { type: 'image/jpeg' }), 'poster.jpg');
const upRes = await fetch(`${BASE}/references`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
const up = await upRes.json();
if (upRes.status !== 201) fail(`upload ${upRes.status} ${JSON.stringify(up).slice(0, 300)}`);

const gen = await req('POST', '/generations', {
  token,
  body: {
    template_slug: 'poster-promo-produk',
    slot_values: { title: 'Keripik Tempe Renyah', product: 'keripik tempe', cta: 'Pesan Sekarang', color: 'warm orange' },
    reference_ids: [up.data.id],
    consent_confirmed: false,
  },
});
if (gen.res.status !== 202) fail(`generation ${gen.res.status} ${JSON.stringify(gen.data).slice(0, 300)}`);
const genId = gen.data.data.id;
log('generation', genId);

let poster;
for (let i = 0; i < 90; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  poster = (await req('GET', `/generations/${genId}`, { token })).data.data;
  if (poster?.status === 'done' || poster?.status === 'failed') break;
}
if (poster?.status !== 'done') fail(`generation ${poster?.status} ${poster?.error_code}`);

const started = Date.now();
const created = await req('POST', `/generations/${genId}/video`, { token, body: { duration_seconds: 8 } });
if (created.res.status !== 202) fail(`video ${created.res.status} ${JSON.stringify(created.data)}`);
const videoId = created.data.data.id;
log('video queued', videoId);

let job;
for (let i = 0; i < 150; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  job = (await req('GET', `/videos/${videoId}`, { token })).data.data;
  if (job?.status === 'done' || job?.status === 'failed') break;
}
if (job?.status !== 'done') fail(`video ${job?.status} ${job?.error_code}`);
log('video done', { seconds: Math.round((Date.now() - started) / 1000), bytes: job.bytes, render_ms: job.render_ms });

const raw = JSON.stringify(job);
for (const banned of ['poster_key', 'zones', 'brand_name', 'prompt', 'cipher']) {
  if (raw.toLowerCase().includes(banned)) fail(`DTO leaked ${banned}`);
}

const full = await fetch(job.video_url);
if (full.status !== 200) fail(`download ${full.status}`);
const buf = Buffer.from(await full.arrayBuffer());
if (buf.length !== job.bytes) fail(`size ${buf.length} != ${job.bytes}`);

const ranged = await fetch(job.video_url, { headers: { Range: 'bytes=0-1023' } });
const head = Buffer.from(await ranged.arrayBuffer());
if (ranged.status !== 206) fail(`range ${ranged.status}`);
if (!head.equals(buf.subarray(0, 1024))) fail('range bytes differ from the file head');
log('download', { status: full.status, bytes: buf.length, type: full.headers.get('content-type') });
log('range', { status: ranged.status, contentRange: ranged.headers.get('content-range') });

await mkdir(OUT_DIR, { recursive: true });
const outFile = `${OUT_DIR}/e2e-${videoId}.mp4`;
await writeFile(outFile, buf);
log('saved', outFile);
log('quota', (await req('GET', '/videos/quota', { token })).data.data);

console.log('E2E OK');
