// apps/web/vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        viewer: resolve(__dirname, 'viewer.html'),
        admin: resolve(__dirname, 'admin.html'),
        securitydomain: resolve(__dirname, 'securitydomain.html'),
      },
    },
  },
});
