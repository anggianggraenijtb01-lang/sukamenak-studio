import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runner, type RunnerOption } from 'node-pg-migrate';
import { env } from '../config/env.js';

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');

/** Applies (`up`) or reverts (`down`, `count` steps, default 1) migrations against `databaseUrl`. */
export async function migrate(
  direction: 'up' | 'down',
  opts: { databaseUrl?: string; count?: number; quiet?: boolean } = {},
): Promise<string[]> {
  const options: RunnerOption = {
    databaseUrl: opts.databaseUrl ?? env.DATABASE_URL,
    dir: MIGRATIONS_DIR,
    direction,
    migrationsTable: 'pgmigrations',
    count: direction === 'down' ? (opts.count ?? 1) : (opts.count ?? Infinity),
    checkOrder: true,
    log: opts.quiet ? () => undefined : (msg: string) => process.stdout.write(`${msg}\n`),
  };
  const ran = await runner(options);
  return ran.map((m) => m.name);
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const direction = process.argv[2];
  if (direction !== 'up' && direction !== 'down') {
    process.stderr.write('Usage: tsx src/db/migrate.ts <up|down> [count]\n');
    process.exit(1);
  }
  const count = process.argv[3] ? Number(process.argv[3]) : undefined;
  migrate(direction, { count })
    .then((names) => {
      process.stdout.write(`${direction}: ${names.length} migration(s) applied\n`);
    })
    .catch((err: unknown) => {
      process.stderr.write(`Migration failed: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    });
}
