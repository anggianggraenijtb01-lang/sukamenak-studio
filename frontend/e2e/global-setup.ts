import { mkdirSync, rmSync } from 'node:fs';
import { E2E_STORAGE_DIR } from './env';

/**
 * Empties the folder the run stores posters in. The database is NOT rebuilt here: Playwright starts the
 * `webServer` entries before this runs, so `playwright.config.ts` rebuilds it in the API's start command.
 */
export default function globalSetup(): void {
  rmSync(E2E_STORAGE_DIR, { recursive: true, force: true });
  mkdirSync(E2E_STORAGE_DIR, { recursive: true });
}
