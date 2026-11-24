import { parseArgs } from 'node:util';
import { closePool, query } from '../db/pool.js';
import { withTx } from '../db/tx.js';
import { isKeyConfigured, MODEL_COLUMNS, type ModelRow } from '../modules/admin/models/dto.js';

/**
 * Turns on every seeded model whose API key variable is already set in the environment, and makes a real
 * model the default of its capability instead of the mock one.
 *
 * Why this exists: seeding installs the mock provider as the default of every capability (it needs no key),
 * and `listActiveModels` sorts `is_default DESC, priority ASC`, so an activated real model could never win
 * over the mock default. Without this step a deployment with a working Cloudflare/FAL/Gemini key still
 * renders the mock placeholder image, which reads as "the model is bad" rather than "the model is unused".
 *
 *   npm run models:activate            # activate keyed models, real default where possible
 *   npm run models:activate -- --dry   # print what would change, write nothing
 */

interface Plan {
  activate: ModelRow[];
  defaults: { capability: string; from: string; to: string }[];
  mockPriority: string[];
}

export function planActivation(models: ModelRow[], mockPriority = 900): Plan {
  const plan: Plan = { activate: [], defaults: [], mockPriority: [] };
  for (const m of models) {
    if (m.provider !== 'mock' && !m.is_active && isKeyConfigured(m)) plan.activate.push(m);
    if (m.provider === 'mock' && m.priority < mockPriority) plan.mockPriority.push(m.id);
  }

  const capabilities = [...new Set(models.map((m) => m.capability))];
  for (const capability of capabilities) {
    const rows = models.filter((m) => m.capability === capability);
    const current = rows.find((m) => m.is_default);
    const usable = rows
      .map((m) => (plan.activate.some((a) => a.id === m.id) ? { ...m, is_active: true } : m))
      .filter((m) => m.provider !== 'mock' && m.is_active && isKeyConfigured(m))
      .sort((a, b) => a.priority - b.priority || Number(a.cost_per_call_usd) - Number(b.cost_per_call_usd) || a.name.localeCompare(b.name));
    const best = usable[0];
    if (!best) continue;
    if (current?.provider === 'mock' || !current) {
      plan.defaults.push({ capability, from: current?.name ?? '(none)', to: best.name });
    }
  }
  return plan;
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { dry: { type: 'boolean', default: false } } });
  const models = await query<ModelRow>(
    `SELECT ${MODEL_COLUMNS} FROM model_configs WHERE deleted_at IS NULL ORDER BY capability, priority`,
  );
  const plan = planActivation(models);

  if (values.dry) {
    for (const m of plan.activate) process.stdout.write(`would activate  ${m.capability.padEnd(6)} ${m.name}\n`);
    for (const d of plan.defaults) process.stdout.write(`would default   ${d.capability.padEnd(6)} ${d.from} -> ${d.to}\n`);
    printSkipped(models);
    return;
  }

  await withTx(async (client) => {
    // Mock rows lose their leading position so an active real model of the same capability sorts first.
    await client.query("UPDATE model_configs SET priority = 900 WHERE provider = 'mock' AND priority < 900 AND deleted_at IS NULL");
    for (const m of plan.activate) {
      await client.query('UPDATE model_configs SET is_active = true WHERE id = $1', [m.id]);
    }
    for (const d of plan.defaults) {
      // `NOT is_default OR is_active` and the one-default-per-capability index are both checked per row,
      // so the old default has to step down before the new one steps up.
      await client.query('UPDATE model_configs SET is_default = false WHERE capability = $1 AND is_default AND deleted_at IS NULL', [
        d.capability,
      ]);
      await client.query(
        `UPDATE model_configs SET is_default = true
          WHERE capability = $1 AND name = $2 AND is_active AND deleted_at IS NULL`,
        [d.capability, d.to],
      );
    }
  });

  for (const m of plan.activate) process.stdout.write(`activated   ${m.capability.padEnd(6)} ${m.name}\n`);
  for (const d of plan.defaults) process.stdout.write(`default     ${d.capability.padEnd(6)} ${d.from} -> ${d.to}\n`);
  if (plan.activate.length === 0 && plan.defaults.length === 0) process.stdout.write('Nothing to change.\n');
  printSkipped(models);
}

function printSkipped(models: ModelRow[]): void {
  const noKey = models.filter((m) => m.provider !== 'mock' && !isKeyConfigured(m));
  if (noKey.length === 0) return;
  const names = [...new Set(noKey.map((m) => m.api_key_env ?? '(none)'))];
  process.stdout.write(`\nStill inactive: ${noKey.length} model(s) whose key variable is unset: ${names.join(', ')}\n`);
}

main()
  .catch((err: unknown) => {
    process.stderr.write(`models:activate failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(() => closePool());
