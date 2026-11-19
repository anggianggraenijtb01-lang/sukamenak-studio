import { defineConfig, devices } from '@playwright/test';
import { API_ORIGIN, API_URL, BACKEND_DIR, FRONTEND_DIR, WEB_URL, backendEnv } from './env';

/**
 * Phase H (docs/IMPLEMENTATION_PLAN.md): the main flows against the real stack.
 *
 * The API and Vite are started by Playwright itself, on a database that globalSetup rebuilds, so a run
 * reflects the current code. `reuseExistingServer` is off on purpose: silently attaching to a developer
 * API that points at the developer database would test the wrong data.
 *
 *   npx playwright test -c e2e/playwright.config.ts
 */
/**
 * `E2E_CHANNEL=chrome` (or `msedge`) runs against an already installed browser instead of the downloaded
 * one. Useful on a machine where the Playwright CDN is unreachable; CI installs its own Chromium.
 */
const CHANNEL = process.env.E2E_CHANNEL;

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  // A poster generation is a few seconds with the mock providers, but a cold Vite build is slow.
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'report' }]] : [['list']],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...(CHANNEL ? { channel: CHANNEL } : {}) },
    },
  ],
  globalSetup: './global-setup.ts',
  webServer: [
    {
      command: 'npx tsx src/server.ts',
      cwd: BACKEND_DIR,
      url: `${API_URL}/health`,
      env: { ...(process.env as Record<string, string>), ...backendEnv() },
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // --host 127.0.0.1: Vite otherwise binds only [::1], and anything polling 127.0.0.1 never sees it.
      command: 'npx vite --host 127.0.0.1 --port 5173 --strictPort',
      cwd: FRONTEND_DIR,
      url: WEB_URL,
      env: { ...(process.env as Record<string, string>), VITE_DEV_API_TARGET: API_ORIGIN },
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
