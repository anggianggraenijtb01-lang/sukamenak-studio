import 'dotenv/config';
import { defineConfig } from 'vitest/config';
import { testEnv } from './test/helpers/testEnv.js';

// Unit tests only: no database, no global setup.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.spec.ts'],
    env: testEnv,
    testTimeout: 20_000,
  },
});
