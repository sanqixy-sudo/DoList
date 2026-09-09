import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        input: { index: path.resolve('src/main/index.ts'), 'backup-worker': path.resolve('src/main/backup/worker.ts') },
        external: ['sql.js'],
      },
    },
  },
  preload: {
    build: {
      outDir: 'dist/preload',
    },
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: 'dist/renderer',
      minify: 'esbuild',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/renderer'),
      },
    },
  },
});
