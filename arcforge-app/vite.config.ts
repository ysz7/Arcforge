import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.join(__dirname, 'app/renderer'),
  plugins: [react()],
  resolve: {
    alias: {
      '@shared/types': path.resolve(__dirname, 'app/shared/types'),
    },
  },
  build: {
    outDir: path.join(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  base: './',
});
