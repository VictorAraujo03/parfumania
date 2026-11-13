/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

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
      // As Edge Functions importam pacotes com 'npm:'; nos testes, usamos substitutos.
      alias: {
        'npm:@supabase/server@1.9.2': fileURLToPath(new URL('./supabase/functions/_test/stubs.ts', import.meta.url)),
        'npm:web-push-neo@0.1.2': fileURLToPath(new URL('./supabase/functions/_test/stubs.ts', import.meta.url)),
      },
    },
  };
});
