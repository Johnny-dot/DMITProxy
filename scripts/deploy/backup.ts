import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { createDatabaseBackup } from '../../server/database-backup.js';

const appDir = path.resolve(process.argv[2] || '.');
const envFile = path.join(appDir, '.env');
const env = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
const directory = path.resolve(appDir, env.DATA_DIR || './data');
const file = path.join(directory, 'prism.db');
if (!fs.existsSync(file)) {
  console.log('[deploy] no existing database to back up');
} else {
  const database = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const result = await createDatabaseBackup(database, directory);
    console.log(`[deploy] database backup verified: ${path.basename(result.file)}`);
  } finally {
    database.close();
  }
}
