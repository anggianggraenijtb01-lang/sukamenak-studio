#!/usr/bin/env node
// Post-deploy verification (PRD section 9, the VibeContent lesson: "ACTIVE" is not the same as "the new release
// is running"). Exits non-zero unless the URL serves the commit that was just deployed.
//
//   node deploy/verify-deploy.mjs --url https://staging.sukamenak.org --commit <sha> [--timeout 180]
//   node deploy/verify-deploy.mjs --bundle frontend/dist   # only the bundle check, against a local build
//
// No dependencies: Node 22's fetch only, so it runs on a CI runner or on the server as is.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/**
 * Must never reach a browser. Mirrors backend/test/helpers/leak.ts and the stand-in marker in
 * backend/src/engine/placeholderCorePrompt.ts: the old hard-coded AES key, a core prompt stand-in, the old
 * mock core prompt that once shipped in the frontend, and server-only column names.
 */
export const FORBIDDEN_IN_BUNDLE = [
  'SUKAMENAK-STUDIO-AES256-GCM-KEY',
  'PLACEHOLDER-CORE-PROMPT',
  'You are Sukamenak Studio Visual Engine',
  'body_ciphertext',
  'final_prompt',
];

/**
 * Must be present: API paths the client calls (frontend/src/api). They survive minification as string literals
 * and only change when the API contract does, unlike UI copy. Missing means this is not the app's bundle
 * (an error page, a stale or broken build).
 */
export const REQUIRED_IN_BUNDLE = ['/generations', '/auth/refresh'];

/** Script URLs referenced by the served index.html (Vite emits /assets/index-<hash>.js). */
export function scriptSources(indexHtml) {
  return [...indexHtml.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);
}

/**
 * Checks the JavaScript bundle that is actually being served. `bundle` is the concatenated text of every
 * script referenced by index.html. Throws with a short reason when the bundle is not acceptable.
 */
export function checkBundle(bundle) {
  const leaked = FORBIDDEN_IN_BUNDLE.filter((marker) => bundle.includes(marker));
  if (leaked.length > 0) throw new Error(`bundle contains forbidden text: ${leaked.join(', ')}`);
  const missing = REQUIRED_IN_BUNDLE.filter((marker) => !bundle.includes(marker));
  if (missing.length > 0) throw new Error(`bundle is missing expected text: ${missing.join(', ')}`);
}

async function verifyLocalBuild(distDir) {
  const assets = path.join(distDir, 'assets');
  const files = (await readdir(assets)).filter((f) => f.endsWith('.js'));
  if (files.length === 0) throw new Error(`no .js files in ${assets}`);
  const bundle = (await Promise.all(files.map((f) => readFile(path.join(assets, f), 'utf8')))).join('\n');
  checkBundle(bundle);
  console.log(`ok    bundle check (${files.length} file(s) in ${assets})`);
}

async function verifyDeploy(base, commit, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function get(urlPath, as = 'text') {
    const res = await fetch(`${base}${urlPath}`, { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`${urlPath} answered ${res.status}`);
    return as === 'json' ? res.json() : res.text();
  }

  /** Retries `check` until it passes or the deadline is reached; containers may still be starting. */
  async function eventually(name, check) {
    let last;
    for (;;) {
      try {
        await check();
        console.log(`ok    ${name}`);
        return true;
      } catch (err) {
        last = err;
      }
      if (Date.now() > deadline) {
        console.error(`FAIL  ${name}: ${last?.message ?? last}`);
        return false;
      }
      await sleep(5000);
    }
  }

  const results = [];
  results.push(
    await eventually('API health', async () => {
      const body = await get('/api/v1/health', 'json');
      if (body?.data?.status !== 'ok') throw new Error('status is not ok');
    }),
  );
  results.push(
    await eventually(`API runs commit ${commit.slice(0, 12)}`, async () => {
      const body = await get('/api/v1/meta/version', 'json');
      if (body?.data?.commit !== commit) throw new Error(`API reports commit ${body?.data?.commit ?? 'null'}`);
    }),
  );
  results.push(
    await eventually(`web serves commit ${commit.slice(0, 12)}`, async () => {
      const body = await get('/version.json', 'json');
      if (body?.commit !== commit) throw new Error(`version.json reports commit ${body?.commit ?? 'null'}`);
    }),
  );
  results.push(
    await eventually('served bundle', async () => {
      const sources = scriptSources(await get('/'));
      if (sources.length === 0) throw new Error('index.html references no script');
      const bundle = (await Promise.all(sources.map((src) => get(src.startsWith('http') ? new URL(src).pathname : src)))).join('\n');
      checkBundle(bundle);
    }),
  );
  return results.every(Boolean);
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' },
      commit: { type: 'string' },
      timeout: { type: 'string', default: '180' },
      bundle: { type: 'string' },
    },
  });
  try {
    if (values.bundle) {
      await verifyLocalBuild(values.bundle);
    } else if (!values.url || !values.commit) {
      console.error('Usage: node deploy/verify-deploy.mjs --url <https://host> --commit <sha> [--timeout seconds]');
      console.error('       node deploy/verify-deploy.mjs --bundle <frontend dist folder>');
      process.exitCode = 2;
    } else {
      const base = values.url.replace(/\/+$/, '');
      if (await verifyDeploy(base, values.commit, Number(values.timeout))) {
        console.log(`\nDeploy verified: ${base} runs ${values.commit}`);
      } else {
        console.error(`\nDeploy NOT verified: ${base}`);
        process.exitCode = 1;
      }
    }
  } catch (err) {
    console.error(`FAIL  ${err?.message ?? err}`);
    process.exitCode = 1;
  }
}
