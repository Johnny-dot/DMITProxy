import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

// Walk up directory tree to find the folder containing .env.
// This allows worktrees (which do not have their own .env) to
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

function readGitShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig(({ mode }) => {
  const envDir = findEnvDir(__dirname);
  const env = loadEnv(mode, envDir, '');
  const localBackend = `http://localhost:${env.SERVER_PORT || '3001'}`;

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_COMMIT__: JSON.stringify(readGitShortSha()),
      __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Allow disabling HMR when editing through remote or constrained environments.
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
        '/sub': {
          target: localBackend,
          changeOrigin: true,
        },
      },
    },
    test: {
      exclude: ['**/node_modules/**', '**/dist/**', '**/.tmp/**', '**/.claude/**', '**/.codex/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'dist/',
          '**/*.config.*',
          '**/*.test.*',
          '**/*.spec.*',
          'scripts/',
        ],
      },
    },
  };
});
