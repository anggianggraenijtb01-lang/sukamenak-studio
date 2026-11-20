import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Port of the Express backend in development (backend/.env PORT, default 3000).
// Override with VITE_DEV_API_TARGET when the backend runs elsewhere.
const DEV_API_TARGET = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    open: false,
    // Same-origin in dev: the httpOnly refresh cookie (Path=/api/v1/auth, SameSite=Lax) is set for
    // http://localhost:5173 and therefore sent back on /api/v1/auth/refresh without any CORS setup.
    proxy: {
      '/api': {
        target: DEV_API_TARGET,
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
    // Node 23+ installs its own experimental `localStorage` on the global object, and without
    // --localstorage-file it is undefined: jsdom's Storage then loses the shadowing race and
    // `localStorage` is undefined inside tests. Disabling Node's webstorage lets jsdom's own
    // implementation win. Accepted (as a no-op) by Node 22 and 24, which have no such global.
    // Top-level since Vitest 4 (the old `poolOptions.forks.execArgv` shape was removed).
    execArgv: ['--no-experimental-webstorage'],
  },
});
