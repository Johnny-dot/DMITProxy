import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import type { Express } from 'express';
import BetterSqlite3 from 'better-sqlite3';
import type Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

interface TestContext {
  app: Express;
  db: Database;
  hashToken: (token: string) => string;
  cleanup: () => void;
}

const TEST_ENV_KEYS = [
  'DATA_DIR',
  'XUI_AUTO_CREATE_ON_REGISTER',
  'VITE_3XUI_SERVER',
  'XUI_ADMIN_USERNAME',
  'XUI_ADMIN_PASSWORD',
  'COOKIE_SECURE',
  'AUTH_RATE_LIMIT_WINDOW_MS',
  'AUTH_RATE_LIMIT_MAX',
] as const;

async function createTestContext(options?: {
  authRateLimitMax?: number;
  preloadLegacyAdmin?: boolean;
}): Promise<TestContext> {
  const previousEnv = new Map<string, string | undefined>();
  for (const key of TEST_ENV_KEYS) {
    previousEnv.set(key, process.env[key]);
  }

  const testDataDir = path.resolve(
    '.tmp',
    `vitest-auth-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  process.env.DATA_DIR = testDataDir;
  process.env.XUI_AUTO_CREATE_ON_REGISTER = 'false';
  process.env.VITE_3XUI_SERVER = '';
  process.env.XUI_ADMIN_USERNAME = '';
  process.env.XUI_ADMIN_PASSWORD = '';
  process.env.COOKIE_SECURE = 'false';
  process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';
  process.env.AUTH_RATE_LIMIT_MAX = String(options?.authRateLimitMax ?? 20);

  if (options?.preloadLegacyAdmin) {
    fs.mkdirSync(testDataDir, { recursive: true });
    const seedDb = new BetterSqlite3(path.join(testDataDir, 'prism.db'));
    seedDb.pragma('journal_mode = WAL');
    seedDb.pragma('foreign_keys = ON');
    seedDb.exec(`
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
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);

    const admin = seedDb
      .prepare('INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)')
      .run('legacy-admin', 'hash', 'salt', 'admin');
    seedDb
      .prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)')
      .run(admin.lastInsertRowid, 'legacy-session', Math.floor(Date.now() / 1000) + 3600);
    seedDb
      .prepare(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      )
      .run(admin.lastInsertRowid, 'legacy-reset', Math.floor(Date.now() / 1000) + 3600);
    seedDb
      .prepare('INSERT INTO invite_codes (code, used_by, used_at) VALUES (?, ?, unixepoch())')
      .run('legacy-invite', admin.lastInsertRowid);
    seedDb.close();
  }

  vi.resetModules();

  const dbModule = await import('./db.js');
  const appModule = await import('./app.js');

  const cleanup = () => {
    try {
      dbModule.db.close();
    } catch {
      // ignore close errors in cleanup
    }

    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }

    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  return {
    app: appModule.createApp(),
    db: dbModule.db as Database,
    hashToken: dbModule.hashToken,
    cleanup,
  };
}

describe.sequential('Local Auth Integration', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
  });

  afterAll(() => {
    context.cleanup();
  });

  it('register/login/me/logout flow stores hashed session token', async () => {
    context.db.prepare('INSERT INTO invite_codes (code) VALUES (?)').run('invite-alice');

    const registerRes = await request(context.app).post('/local/auth/register').send({
      username: 'alice',
      password: 'secret123',
      inviteCode: 'invite-alice',
    });
    expect(registerRes.status).toBe(200);

    const loginRes = await request(context.app).post('/local/auth/login').send({
      username: 'alice',
      password: 'secret123',
    });
    expect(loginRes.status).toBe(200);

    const rawSetCookie = loginRes.headers['set-cookie'];
    const setCookies =
      rawSetCookie === undefined ? [] : Array.isArray(rawSetCookie) ? rawSetCookie : [rawSetCookie];
    const sessionCookie = setCookies.find((entry) => entry.startsWith('pd_session='));
    expect(sessionCookie).toBeTruthy();

    const rawToken = sessionCookie!.split(';')[0].split('=')[1];
    const storedSession = context.db
      .prepare('SELECT token FROM sessions ORDER BY id DESC LIMIT 1')
      .get() as { token: string } | undefined;

    expect(storedSession).toBeTruthy();
    expect(storedSession!.token).toBe(context.hashToken(rawToken));
    expect(storedSession!.token).not.toBe(rawToken);

    const cookieHeader = sessionCookie!.split(';')[0];
    const meRes = await request(context.app).get('/local/auth/me').set('Cookie', cookieHeader);
    expect(meRes.status).toBe(200);
    expect(meRes.body.username).toBe('alice');

    const logoutRes = await request(context.app)
      .post('/local/auth/logout')
      .set('Cookie', cookieHeader);
    expect(logoutRes.status).toBe(200);

    const meAfterLogout = await request(context.app)
      .get('/local/auth/me')
      .set('Cookie', cookieHeader);
    expect(meAfterLogout.status).toBe(401);
  });

  it('password reset verify/confirm updates password and invalidates sessions', async () => {
    const loginRes = await request(context.app).post('/local/auth/login').send({
      username: 'alice',
      password: 'secret123',
    });
    expect(loginRes.status).toBe(200);

    const user = context.db.prepare('SELECT id FROM users WHERE username = ?').get('alice') as
      | { id: number }
      | undefined;
    expect(user).toBeTruthy();

    const resetToken = 'reset-token-alice';
    const expiresAt = Math.floor(Date.now() / 1000) + 600;
    context.db
      .prepare(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      )
      .run(user!.id, context.hashToken(resetToken), expiresAt);

    const verifyRes = await request(context.app)
      .get('/local/auth/password-reset/verify')
      .query({ token: resetToken });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.ok).toBe(true);
    expect(verifyRes.body.username).toBe('alice');

    const confirmRes = await request(context.app).post('/local/auth/password-reset/confirm').send({
      token: resetToken,
      password: 'secret456',
    });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.ok).toBe(true);

    const userSessions = context.db
      .prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?')
      .get(user!.id) as { count: number };
    expect(userSessions.count).toBe(0);

    const usedToken = context.db
      .prepare('SELECT used_at FROM password_reset_tokens WHERE token_hash = ?')
      .get(context.hashToken(resetToken)) as { used_at: number | null } | undefined;
    expect(usedToken?.used_at).toBeTypeOf('number');

    const oldPasswordLogin = await request(context.app).post('/local/auth/login').send({
      username: 'alice',
      password: 'secret123',
    });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await request(context.app).post('/local/auth/login').send({
      username: 'alice',
      password: 'secret456',
    });
    expect(newPasswordLogin.status).toBe(200);
  });

  it('returns JSON 503 for /api routes when 3X-UI is not configured', async () => {
    const loginRes = await request(context.app)
      .post('/api/login')
      .type('form')
      .send({ username: 'admin', password: 'secret' });
    expect(loginRes.status).toBe(503);
    expect(loginRes.body.error).toContain('3X-UI admin capability is not configured');

    const statusRes = await request(context.app).get('/api/panel/api/server/status');
    expect(statusRes.status).toBe(503);
    expect(statusRes.body.error).toContain('3X-UI admin capability is not configured');
  });

  it('returns an admin session hint without probing upstream', async () => {
    const anonymousRes = await request(context.app).get('/local/auth/admin-session-hint');
    expect(anonymousRes.status).toBe(200);
    expect(anonymousRes.body).toEqual({ hasAdminCookie: false });

    const adminCookieRes = await request(context.app)
      .get('/local/auth/admin-session-hint')
      .set('Cookie', '3x-ui=test=session==');
    expect(adminCookieRes.status).toBe(200);
    expect(adminCookieRes.body).toEqual({ hasAdminCookie: true });
  });
});

describe.sequential('Auth Rate Limit Integration', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext({ authRateLimitMax: 2 });
  });

  afterAll(() => {
    context.cleanup();
  });

  it('returns HTTP 429 after configured login attempts', async () => {
    const first = await request(context.app).post('/local/auth/login').send({
      username: 'unknown-user',
      password: 'bad-password',
    });
    expect(first.status).not.toBe(429);

    const second = await request(context.app).post('/local/auth/login').send({
      username: 'unknown-user',
      password: 'bad-password',
    });
    expect(second.status).not.toBe(429);

    const third = await request(context.app).post('/local/auth/login').send({
      username: 'unknown-user',
      password: 'bad-password',
    });
    expect(third.status).toBe(429);
    expect(third.body.error).toContain('Too many auth attempts');
  });
});

describe.sequential('Legacy Local Admin Cleanup', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext({ preloadLegacyAdmin: true });
  });

  afterAll(() => {
    context.cleanup();
  });

  it('removes legacy local admin rows and their dependent records on startup', () => {
    const userCount = context.db
      .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
      .get() as { count: number };
    expect(userCount.count).toBe(0);

    const sessionCount = context.db
      .prepare("SELECT COUNT(*) as count FROM sessions WHERE token = 'legacy-session'")
      .get() as { count: number };
    expect(sessionCount.count).toBe(0);

    const resetCount = context.db
      .prepare(
        "SELECT COUNT(*) as count FROM password_reset_tokens WHERE token_hash = 'legacy-reset'",
      )
      .get() as { count: number };
    expect(resetCount.count).toBe(0);

    const inviteCount = context.db
      .prepare("SELECT COUNT(*) as count FROM invite_codes WHERE code = 'legacy-invite'")
      .get() as { count: number };
    expect(inviteCount.count).toBe(0);
  });
});
