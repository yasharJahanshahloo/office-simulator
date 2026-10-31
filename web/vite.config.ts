import { defineConfig } from 'vite';

// Presence server (server/) for the dev proxy; override with API_TARGET=http://host:port.
const apiTarget = process.env.API_TARGET ?? 'http://localhost:8090';

export default defineConfig({
  // three.js alone is ~600 kB minified; that's expected for this app.
  build: { chunkSizeWarningLimit: 1000 },
  server: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
});
