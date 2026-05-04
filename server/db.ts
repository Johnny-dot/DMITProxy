import Database from 'better-sqlite3';
import { scryptSync, randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const configuredDataDir = (process.env.DATA_DIR ?? '').trim();
const dataDir = path.resolve(configuredDataDir || './data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const dataDirectory = dataDir;
export const dbFilePath = path.join(dataDir, 'prism.db');
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
  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash
    ON password_reset_tokens(token_hash);

  CREATE INDEX IF NOT EXISTS idx_users_username
    ON users(username);
  CREATE INDEX IF NOT EXISTS idx_sessions_token
    ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id
    ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
    ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_invite_codes_code
    ON invite_codes(code);
  CREATE INDEX IF NOT EXISTS idx_users_sub_id
    ON users(sub_id);

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS xui_inbound_billing (
    inbound_id INTEGER PRIMARY KEY,
    billing_day INTEGER NOT NULL CHECK (billing_day BETWEEN 1 AND 31),
    last_reset_date TEXT
  );
`);

function ensureUserProfileColumns() {
  const columns = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has('display_name')) {
    db.exec(`ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''`);
  }

  if (!columnNames.has('avatar_style')) {
    db.exec(`ALTER TABLE users ADD COLUMN avatar_style TEXT NOT NULL DEFAULT 'emerald'`);
  }
}

ensureUserProfileColumns();

const cleanupLegacyAdminUsers = db.transaction(() => {
  const legacyAdmins = db
    .prepare('SELECT id FROM users WHERE role = ? ORDER BY id')
    .all('admin') as Array<{ id: number }>;
  if (legacyAdmins.length === 0) return 0;

  const deleteInviteCodes = db.prepare('DELETE FROM invite_codes WHERE used_by = ?');
  const deleteAdminUser = db.prepare('DELETE FROM users WHERE id = ? AND role = ?');

  for (const admin of legacyAdmins) {
    deleteInviteCodes.run(admin.id);
    deleteAdminUser.run(admin.id, 'admin');
  }

  return legacyAdmins.length;
});

const removedLegacyAdminCount = cleanupLegacyAdminUsers();
if (removedLegacyAdminCount > 0) {
  console.warn(
    `[DB] Removed ${removedLegacyAdminCount} legacy local admin account(s); admin auth now relies on 3X-UI.`,
  );
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
