import { mkdirSync, rmSync } from 'node:fs';
import pg from 'pg';
import { TEST_STORAGE_DIR, testDatabaseUrl, testEnv } from './testEnv.js';

function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}

/** Creates the test database when the postgres volume predates the init script. */
async function ensureDatabase(url: string): Promise<void> {
  const probe = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  try {
    await probe.connect();
    await probe.end();
    return;
  } catch (err) {
    await probe.end().catch(() => undefined);
    if ((err as { code?: string }).code !== '3D000') throw err;
  }
  const admin = new URL(url);
  const name = databaseName(url);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
  } finally {
    await client.end();
  }
}

export default async function setup(): Promise<() => Promise<void>> {
  Object.assign(process.env, testEnv);
  rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
  mkdirSync(TEST_STORAGE_DIR, { recursive: true });
  const name = databaseName(testDatabaseUrl);
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to run tests: database "${name}" does not end with "_test"`);
  }

  try {
    await ensureDatabase(testDatabaseUrl);
  } catch (err) {
    throw new Error(
      `Cannot reach the test database (${(err as Error).message}). Start it with "docker compose up -d" ` +
        'and check DATABASE_URL_TEST. Use "npm run test:unit" to run tests that need no database.',
    );
  }

  const { migrate } = await import('../../src/db/migrate.js');
  await migrate('up', { databaseUrl: testDatabaseUrl, quiet: true });

  const { pool, closePool } = await import('../../src/db/pool.js');
  const { rows } = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'pgmigrations'`,
  );
  if (rows.length > 0) {
    const list = rows.map((r) => `"${r.tablename}"`).join(', ');
    await pool.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }

  const { runSeed } = await import('../../src/seed/index.js');
  await runSeed({ quiet: true, copyAssets: false });
  await closePool();

  return async () => {
    rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
  };
}
