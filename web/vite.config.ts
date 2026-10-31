import { fileURLToPath } from 'node:url';
import { type Connect, type Plugin, defineConfig } from 'vite';

// Presence server (server/) for the dev proxy; override with API_TARGET=http://host:port.
const apiTarget = process.env.API_TARGET ?? 'http://localhost:8090';

const page = (name: string) => fileURLToPath(new URL(name, import.meta.url));

/** `/avatar` → the avatar creator page, like the server's `GET /avatar` → dist/avatar.html. */
const rewriteAvatar: Connect.NextHandleFunction = (req, _res, next) => {
  if (req.url && /^\/avatar\/?(\?|#|$)/.test(req.url)) req.url = req.url.replace(/^\/avatar\/?/, '/avatar.html');
  next();
};
const avatarRoute: Plugin = {
  name: 'avatar-route',
  configureServer: (server) => void server.middlewares.use(rewriteAvatar),
  configurePreviewServer: (server) => void server.middlewares.use(rewriteAvatar),
};

export default defineConfig({
  plugins: [avatarRoute],
  build: {
    // three.js alone is ~600 kB minified; that's expected for this app.
    chunkSizeWarningLimit: 1000,
    // two pages: the office (index.html) and the avatar creator (avatar.html, served at /avatar)
    rolldownOptions: { input: { main: page('index.html'), avatar: page('avatar.html') } },
  },
  server: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
});
