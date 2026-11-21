import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from '../config/env.js';
import { closePool, pool } from '../db/pool.js';
import { migrate } from '../db/migrate.js';
import { runSeed, SEED_USERS } from '../seed/index.js';

/**
 * Phase H: prepares the throwaway database the Playwright suite runs against.
 *
 * It DROPS the target database, recreates it, applies every migration and seeds the reference data
 * (models, templates, core-prompt stand-ins, gallery, tutorials). The seed installs mock providers as
 * the defaults, so the suite generates real posters through the real pipeline without any API key.
 *
 * The name must end with `_e2e`. That guard is the whole point: a mistyped DATABASE_URL that pointed at
 * the developer database would otherwise drop it.
 *
 *   DATABASE_URL=postgres://.../sukamenak_e2e npm run e2e:db
 */

export const E2E_DB_SUFFIX = '_e2e';
export const E2E_ADMIN_PASSWORD = 'Admin-e2e-pass-1';
export const E2E_DEMO_PASSWORD = 'Demo-e2e-pass-1';

function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}

/**
 * The seed installs one mock model per capability, and the panel only offers "Jadikan Default" on a
 * second active model of the same capability. This adds that second mock model, which is what the admin
 * flow spec switches to.
 */
async function addAlternateModels(): Promise<void> {
  await pool.query(
    `INSERT INTO model_configs
       (name, provider, capability, model_id, base_url, api_key_env, is_default, is_active, priority, notes)
     SELECT name || ' (cadangan)', provider, capability, model_id || '-alt', base_url, api_key_env,
            false, true, priority + 10, 'End-to-end fixture: a second active model to switch the default to.'
     FROM model_configs
     WHERE is_default AND deleted_at IS NULL`,
  );
}

export async function prepareE2eDatabase(url: string): Promise<{ name: string }> {
  const name = databaseName(url);
  if (!name.endsWith(E2E_DB_SUFFIX)) {
    throw new Error(`Refusing to prepare "${name}": an end-to-end database name must end with "${E2E_DB_SUFFIX}"`);
  }

  const target = new URL(url);
  const admin = new URL(url);
  admin.pathname = '/postgres';

  const client = new pg.Client({ connectionString: admin.toString(), connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    // The API that the previous run left behind can hold a connection and block DROP DATABASE.
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [name],
    );
    await client.query(`DROP DATABASE IF EXISTS "${name.replace(/"/g, '""')}"`);
    await client.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
  } finally {
    await client.end();
  }

  await migrate('up', { databaseUrl: target.toString(), quiet: true });

  // runSeed writes through the shared pool, which reads DATABASE_URL at import time, so this process
  // must already be pointed at the end-to-end database.
  if (databaseName(env.DATABASE_URL) !== name) {
    throw new Error(
      `DATABASE_URL points at "${databaseName(env.DATABASE_URL)}" but the run targets "${name}". ` +
        'Start this command with DATABASE_URL set to the end-to-end database.',
    );
  }

  await runSeed({ adminPassword: E2E_ADMIN_PASSWORD, demoPassword: E2E_DEMO_PASSWORD, quiet: true });
  await addAlternateModels();

  return { name };
}

const isMain =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  prepareE2eDatabase(env.DATABASE_URL)
    .then(async ({ name }) => {
      process.stdout.write(`e2e database ready: ${name}\n`);
      process.stdout.write(`admin: ${SEED_USERS.admins[0].email}\n`);
      await closePool();
    })
    .catch(async (err: unknown) => {
      process.stderr.write(`${(err as Error).message}\n`);
      await closePool().catch(() => undefined);
      process.exit(1);
    });
}
