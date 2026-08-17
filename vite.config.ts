import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { createExpressApp } from './server/app.js';
import { initSocketIO } from './server/socket.js';

function backendApiPlugin(): Plugin {
  return {
    name: 'backend-api-plugin',
    configureServer(server) {
      const app = createExpressApp();
      server.middlewares.use(app);
      if (server.httpServer) {
        initSocketIO(server.httpServer);
      }
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [vue(), tailwindcss(), backendApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

