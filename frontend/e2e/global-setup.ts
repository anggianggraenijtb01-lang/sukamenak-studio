import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { BACKEND_DIR, E2E_STORAGE_DIR, backendEnv } from './env';

/**
 * Rebuilds the end-to-end database before the suite: drop, create, migrate, seed. The API is started
 * afterwards by the `webServer` entries, so it will see the fresh data.
 */
export default function globalSetup(): void {
  rmSync(E2E_STORAGE_DIR, { recursive: true, force: true });
  mkdirSync(E2E_STORAGE_DIR, { recursive: true });

  execFileSync('npm', ['run', 'e2e:db'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, ...backendEnv() },
    stdio: 'inherit',
    shell: true,
  });
}
