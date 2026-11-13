import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool } from '../db/pool.js';
import { runRetention } from './retention.js';

/** `npm run retention`: one retention pass (suitable for cron / a scheduled container task). */
const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  runRetention()
    .then((result) => {
      process.stdout.write(
        result
          ? `Retention complete: expired_references=${result.expiredReferences}, purged_generations=${result.purgedGenerations}, orphan_files=${result.orphanFiles}\n`
          : 'Retention skipped: another run holds the lock\n',
      );
    })
    .catch((err: unknown) => {
      process.stderr.write(`Retention failed: ${err instanceof Error ? err.name : 'error'}\n`);
      process.exitCode = 1;
    })
    .finally(() => closePool());
}
