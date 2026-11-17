import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { closePool, query, queryOne } from '../db/pool.js';
import { isKeyConfigured, MODEL_COLUMNS, type ModelRow } from '../modules/admin/models/dto.js';
import { testModel } from '../modules/admin/models/service.js';
import { initProviders } from '../providers/index.js';

/**
 * Phase E (docs/IMPLEMENTATION_PLAN.md): one tiny real call per model whose API key variable is set, through
 * the same code path as the admin "Test" button. Results are written to model_configs.last_test_* and the
 * audit log, attributed to an admin account. Prints only names, capabilities, latency and error codes: never
 * a key, a provider response body or a prompt.
 *
 *   npm run models:smoke                          # every keyed, non-mock model
 *   npm run models:smoke -- --capability i2i      # one capability
 *   npm run models:smoke -- --as admin@example.com
 */

export interface SmokeCandidate {
  id: string;
  name: string;
  provider: string;
  capability: string;
  keyConfigured: boolean;
}

export interface SmokeSelection {
  run: SmokeCandidate[];
  skipped: { candidate: SmokeCandidate; reason: 'mock' | 'no_key' | 'capability' }[];
}

/** Decides which models get a real call. Mock rows are skipped unless asked for; unkeyed rows are never called. */
export function selectSmokeTargets(
  models: SmokeCandidate[],
  opts: { capability?: string; includeMock?: boolean } = {},
): SmokeSelection {
  const selection: SmokeSelection = { run: [], skipped: [] };
  for (const m of models) {
    if (opts.capability && m.capability !== opts.capability) selection.skipped.push({ candidate: m, reason: 'capability' });
    else if (m.provider === 'mock' && !opts.includeMock) selection.skipped.push({ candidate: m, reason: 'mock' });
    else if (!m.keyConfigured) selection.skipped.push({ candidate: m, reason: 'no_key' });
    else selection.run.push(m);
  }
  return selection;
}

async function resolveActor(email: string | undefined): Promise<string> {
  const row = email
    ? await queryOne<{ id: string }>(
        `SELECT id FROM users WHERE email = $1 AND role = 'admin' AND is_active AND deleted_at IS NULL`,
        [email.toLowerCase()],
      )
    : await queryOne<{ id: string }>(
        `SELECT id FROM users WHERE role = 'admin' AND is_active AND deleted_at IS NULL ORDER BY created_at LIMIT 1`,
      );
  if (!row) throw new Error(email ? `No active admin with email ${email}` : 'No active admin account (run npm run seed first)');
  return row.id;
}

const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      capability: { type: 'string' },
      as: { type: 'string' },
      'include-mock': { type: 'boolean', default: false },
    },
  });
  initProviders();
  const actorId = await resolveActor(values.as);

  const rows = await query<ModelRow>(`SELECT ${MODEL_COLUMNS} FROM model_configs WHERE deleted_at IS NULL ORDER BY capability, priority, name`);
  const candidates: SmokeCandidate[] = rows.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    capability: m.capability,
    keyConfigured: isKeyConfigured(m),
  }));
  const { run, skipped } = selectSmokeTargets(candidates, { capability: values.capability, includeMock: values['include-mock'] });

  const noKey = skipped.filter((s) => s.reason === 'no_key');
  if (noKey.length > 0) {
    process.stdout.write(`Skipped (API key variable not set): ${noKey.map((s) => s.candidate.name).join(', ')}\n\n`);
  }
  if (run.length === 0) {
    process.stdout.write('Nothing to test: set at least one provider key in .env (see .env.example).\n');
    return 1;
  }

  process.stdout.write(`${pad('MODEL', 34)} ${pad('CAP', 7)} ${pad('RESULT', 7)} ${pad('LATENCY', 9)} ERROR\n`);
  let failures = 0;
  for (const m of run) {
    const r = await testModel({ actorId, ip: null }, m.id);
    if (!r.ok) failures += 1;
    process.stdout.write(
      `${pad(m.name, 34)} ${pad(m.capability, 7)} ${pad(r.ok ? 'ok' : 'FAIL', 7)} ${pad(`${r.latency_ms} ms`, 9)} ${r.error_code ?? ''}\n`,
    );
  }
  process.stdout.write(`\n${run.length - failures}/${run.length} passed. Results saved to model_configs.last_test_*.\n`);
  return failures === 0 ? 0 : 1;
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err: unknown) => {
      process.stderr.write(`Model smoke test failed: ${err instanceof Error ? err.message : 'error'}\n`);
      process.exitCode = 1;
    })
    .finally(() => closePool());
}
