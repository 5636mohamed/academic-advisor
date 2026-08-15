import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxies /api to the Express demo server (packages/api/src/server.ts,
// default port 3001) so the real React app can be developed against real
// (if in-memory) data without a separate CORS setup.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
