import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..');

function readGitShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

// Captured once at module load so we report the commit the server was launched
// from, even if the working tree later moves ahead.
const serverCommit = readGitShortSha();
const serverStartedAt = new Date().toISOString();

export function getServerVersion(): { commit: string; startedAt: string } {
  return { commit: serverCommit, startedAt: serverStartedAt };
}
