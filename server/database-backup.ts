import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/** Produces a checked, standalone snapshot without relying on a successful WAL checkpoint. */
export async function createDatabaseBackup(database: Database.Database, directory: string) {
  const backupDir = path.resolve(directory, 'backups');
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const name = `prism-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.db`;
  const file = path.join(backupDir, name);
  const partial = `${file}.partial`;
  fs.writeFileSync(partial, '', { flag: 'wx', mode: 0o600 });
  try {
    const deadline = Date.now() + 30_000;
    await database.backup(partial, {
      progress() {
        if (Date.now() > deadline) throw new Error('Database backup timed out');
        return 100;
      },
    });
    const snapshot = new Database(partial, { readonly: true, fileMustExist: true });
    try {
      if (snapshot.pragma('quick_check', { simple: true }) !== 'ok')
        throw new Error('Database backup integrity check failed');
    } finally {
      snapshot.close();
    }
    fs.chmodSync(partial, 0o600);
    fs.renameSync(partial, file);
    return { file, integrity: 'ok' as const, bytes: fs.statSync(file).size };
  } catch (error) {
    fs.rmSync(partial, { force: true });
    throw error;
  }
}
