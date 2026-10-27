/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE_PATH permite publicar em subdiretório (ex.: GitHub Pages em /parfumania/).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 700,
    },
    test: {
      environment: 'node',
    },
  };
});
