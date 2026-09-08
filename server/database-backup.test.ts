import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { createDatabaseBackup } from './database-backup.js';

it('includes committed WAL rows even while another reader holds an older snapshot', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-backup-test-'));
  const file = path.join(directory, 'source.db');
  const source = new Database(file);
  source.pragma('journal_mode=WAL');
  source.exec('CREATE TABLE records(id INTEGER PRIMARY KEY, value TEXT)');
  source.pragma('wal_checkpoint(TRUNCATE)');
  const reader = new Database(file, { readonly: true });
  try {
    reader.exec('BEGIN');
    reader.prepare('SELECT COUNT(*) FROM records').get();
    source.prepare('INSERT INTO records(value) VALUES (?)').run('committed after reader began');
    const result = await createDatabaseBackup(source, directory);
    const snapshot = new Database(result.file, { readonly: true });
    try {
      expect(snapshot.prepare('SELECT value FROM records').get()).toEqual({
        value: 'committed after reader began',
      });
      expect(result.integrity).toBe('ok');
      expect(
        fs.readdirSync(path.join(directory, 'backups')).filter((f) => f.endsWith('.partial')),
      ).toEqual([]);
      if (process.platform !== 'win32') expect(fs.statSync(result.file).mode & 0o777).toBe(0o600);
    } finally {
      snapshot.close();
    }
  } finally {
    reader.exec('ROLLBACK');
    reader.close();
    source.close();
    const resolved = fs.realpathSync(directory);
    if (
      path.dirname(resolved) === fs.realpathSync(os.tmpdir()) &&
      path.basename(resolved).startsWith('prism-backup-test-')
    )
      fs.rmSync(resolved, { recursive: true });
  }
});
