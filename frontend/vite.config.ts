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
  },
});
