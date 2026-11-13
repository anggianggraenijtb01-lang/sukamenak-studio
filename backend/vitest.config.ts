import 'dotenv/config';
import { defineConfig } from 'vitest/config';
import { testEnv } from './test/helpers/testEnv.js';

// Full suite: unit + integration + security. Integration tests need PostgreSQL (see docker-compose.yml);
// global setup migrates and truncates DATABASE_URL_TEST, then seeds it.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    globalSetup: ['./test/helpers/globalSetup.ts'],
    env: testEnv,
    // Integration files share one database, so files run one after another.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 90_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Process entry points and CLIs only wire things together; everything they call is measured.
      exclude: ['src/server.ts', 'src/worker.ts', 'src/retention/cli.ts', 'src/seed/createAdmin.ts', 'src/db/migrate.ts', 'src/types/**'],
      reporter: ['text-summary', 'text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 70 },
    },
  },
});
