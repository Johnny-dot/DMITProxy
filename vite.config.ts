import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

// Walk up directory tree to find the folder containing .env.
// This allows worktrees (which don't have their own .env) to
// inherit the .env from the main repository root.
function findEnvDir(start: string): string {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, '.env'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export default defineConfig(({ mode }) => {
  const envDir = findEnvDir(__dirname);
  const env = loadEnv(mode, envDir, '');
  const localBackend = `http://localhost:${env.SERVER_PORT || '3001'}`;
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: localBackend,
          changeOrigin: true,
        },
        '/local': {
          target: localBackend,
          changeOrigin: true,
        },
      },
    },
  };
});
