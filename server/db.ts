import Database from 'better-sqlite3';
import { scryptSync, randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const configuredDataDir = (process.env.DATA_DIR ?? '').trim();
const dataDir = path.resolve(configuredDataDir || './data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const dataDirectory = dataDir;
export const dbFilePath = path.join(dataDir, 'proxydog.db');
export const db = new Database(dbFilePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    sub_id TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    used_by INTEGER REFERENCES users(id),
    used_at INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL,
    used_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
    ON password_reset_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires
    ON password_reset_tokens(expires_at);

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// Seed admin account on first run
const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminPassword) {
  console.warn('[DB] WARNING: ADMIN_PASSWORD not set in .env — admin account not seeded');
} else {
  const existing = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!existing) {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(adminPassword, salt, 64).toString('hex');
    db.prepare('INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)').run(
      adminUsername,
      hash,
      salt,
      'admin',
    );
    console.log(`[DB] Admin account created: ${adminUsername}`);
  }
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  // timingSafeEqual requires same length
  if (derived.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ stored[i];
  return diff === 0;
}

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
