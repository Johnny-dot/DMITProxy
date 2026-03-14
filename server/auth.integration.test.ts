import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import type { Express } from 'express';
import BetterSqlite3 from 'better-sqlite3';
import type Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

interface MockProvisionedClient {
  inboundId: number;
  protocol: string;
  email: string;
  clientId: string;
  subId: string;
}

interface TestContext {
  app: Express;
  db: Database;
  hashToken: (token: string) => string;
  cleanup: () => void;
  mocks: {
    provisionClientForRegisteredUser?: ReturnType<typeof vi.fn>;
    cleanupProvisionedClient?: ReturnType<typeof vi.fn>;
  };
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
  mockClientStats?: {
    inboundId: number;
    inboundRemark: string;
    protocol: string;
    up: number;
    down: number;
    total: number;
    expiryTime: number;
    enable: boolean;
  };
  mockNodeQualityProfile?: {
    inboundId: number;
    probeMode?: 'server-egress' | 'proxy-outbound';
    probeTarget?: string;
    summary: string;
    fraudScore: number | null;
    netflixStatus: 'unknown' | 'supported' | 'limited' | 'blocked';
    chatgptStatus: 'unknown' | 'supported' | 'limited' | 'blocked';
    claudeStatus: 'unknown' | 'supported' | 'limited' | 'blocked';
    tiktokStatus: 'unknown' | 'supported' | 'limited' | 'blocked';
    instagramStatus: 'unknown' | 'supported' | 'limited' | 'blocked';
    spotifyStatus: 'unknown' | 'supported' | 'limited' | 'blocked';
    youtubeStatus: 'unknown' | 'supported' | 'limited' | 'blocked';
    disneyplusStatus: 'unknown' | 'supported' | 'limited' | 'blocked';
    primevideoStatus: 'unknown' | 'supported' | 'limited' | 'blocked';
    xStatus: 'unknown' | 'supported' | 'limited' | 'blocked';
    notes: string;
    updatedAt: number | null;
  };
  mockServerStatus?: {
    cpu: number;
    cpuCores: number;
    mem: { current: number; total: number };
    swap: { current: number; total: number };
    disk: { current: number; total: number };
    xray: { state: string; version: string };
    uptime: number;
    loads: number[];
    tcpCount: number;
    udpCount: number;
    netIO: { up: number; down: number };
    netTraffic: { sent: number; recv: number };
  };
  mockAutoProvision?: {
    implementation?: (username: string) => Promise<MockProvisionedClient | null>;
    cleanupImplementation?: (client: MockProvisionedClient) => Promise<void>;
  };
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

  vi.doUnmock('./xui-admin.js');
  vi.doUnmock('./node-quality-probe.js');
  const xuiMocks: TestContext['mocks'] = {};
  if (options?.mockClientStats || options?.mockServerStatus || options?.mockAutoProvision) {
    const mockClientStats = options.mockClientStats;
    const mockServerStatus = options.mockServerStatus;
    const provisionClientForRegisteredUser = options.mockAutoProvision
      ? vi.fn(options.mockAutoProvision.implementation)
      : undefined;
    const cleanupProvisionedClient = options.mockAutoProvision
      ? vi.fn(options.mockAutoProvision.cleanupImplementation ?? (async () => {}))
      : undefined;

    xuiMocks.provisionClientForRegisteredUser = provisionClientForRegisteredUser;
    xuiMocks.cleanupProvisionedClient = cleanupProvisionedClient;

    vi.doMock('./xui-admin.js', async () => {
      const actual = await vi.importActual<typeof import('./xui-admin.js')>('./xui-admin.js');
      return {
        ...actual,
        ...(provisionClientForRegisteredUser
          ? {
              provisionClientForRegisteredUser,
              autoProvisionClientForRegisteredUser: vi.fn(async (username: string) => {
                const provisionedClient = await provisionClientForRegisteredUser(username);
                return provisionedClient?.subId ?? null;
              }),
              cleanupProvisionedClient,
            }
          : {}),
        ...(mockClientStats
          ? {
              fetchClientStatsBySubId: vi.fn(async () => mockClientStats),
            }
          : {}),
        ...(mockServerStatus
          ? {
              fetchServerStatusForPortal: vi.fn(async () => mockServerStatus),
            }
          : {}),
      };
    });
  }
  if (options?.mockNodeQualityProfile) {
    const mockNodeQualityProfile = options.mockNodeQualityProfile;
    vi.doMock('./node-quality-probe.js', async () => {
      const actual =
        await vi.importActual<typeof import('./node-quality-probe.js')>('./node-quality-probe.js');
      return {
        ...actual,
        probeAndStoreNodeQualityProfile: vi.fn(async () => mockNodeQualityProfile),
      };
    });
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

    vi.doUnmock('./xui-admin.js');
    vi.doUnmock('./node-quality-probe.js');
  };

  return {
    app: appModule.createApp(),
    db: dbModule.db as Database,
    hashToken: dbModule.hashToken,
    cleanup,
    mocks: xuiMocks,
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
    expect(meRes.body.displayName).toBe('alice');
    expect(meRes.body.avatarStyle).toBe('emerald');

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

  it('loads and updates the local user profile', async () => {
    const loginRes = await request(context.app).post('/local/auth/login').send({
      username: 'alice',
      password: 'secret456',
    });
    expect(loginRes.status).toBe(200);

    const rawSetCookie = loginRes.headers['set-cookie'];
    const setCookies =
      rawSetCookie === undefined ? [] : Array.isArray(rawSetCookie) ? rawSetCookie : [rawSetCookie];
    const sessionCookie = setCookies.find((entry) => entry.startsWith('pd_session='));
    expect(sessionCookie).toBeTruthy();

    const cookieHeader = sessionCookie!.split(';')[0];

    const profileRes = await request(context.app)
      .get('/local/auth/profile')
      .set('Cookie', cookieHeader);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body).toMatchObject({
      username: 'alice',
      displayName: '',
      resolvedDisplayName: 'alice',
      avatarStyle: 'emerald',
    });

    const updateRes = await request(context.app)
      .patch('/local/auth/profile')
      .set('Cookie', cookieHeader)
      .send({
        displayName: 'Alice Prism',
        avatarStyle: 'violet',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.profile).toMatchObject({
      username: 'alice',
      displayName: 'Alice Prism',
      resolvedDisplayName: 'Alice Prism',
      avatarStyle: 'violet',
    });

    const storedUser = context.db
      .prepare('SELECT display_name, avatar_style FROM users WHERE username = ?')
      .get('alice') as { display_name: string; avatar_style: string } | undefined;
    expect(storedUser).toEqual({
      display_name: 'Alice Prism',
      avatar_style: 'violet',
    });

    const meRes = await request(context.app).get('/local/auth/me').set('Cookie', cookieHeader);
    expect(meRes.status).toBe(200);
    expect(meRes.body).toMatchObject({
      username: 'alice',
      displayName: 'Alice Prism',
      avatarStyle: 'violet',
    });
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

  it('returns auth session hints without probing upstream', async () => {
    const anonymousRes = await request(context.app).get('/local/auth/admin-session-hint');
    expect(anonymousRes.status).toBe(200);
    expect(anonymousRes.body).toEqual({
      hasAdminCookie: false,
      hasUserSessionCookie: false,
    });

    const adminCookieRes = await request(context.app)
      .get('/local/auth/admin-session-hint')
      .set('Cookie', '3x-ui=test=session==');
    expect(adminCookieRes.status).toBe(200);
    expect(adminCookieRes.body).toEqual({
      hasAdminCookie: true,
      hasUserSessionCookie: false,
    });

    const userCookieRes = await request(context.app)
      .get('/local/auth/admin-session-hint')
      .set('Cookie', 'pd_session=test-session');
    expect(userCookieRes.status).toBe(200);
    expect(userCookieRes.body).toEqual({
      hasAdminCookie: false,
      hasUserSessionCookie: true,
    });
  });

  it('includes shared resources in portal context for local users', async () => {
    const now = Math.floor(Date.now() / 1000);
    const settings = [
      ['siteName', 'Prism'],
      ['publicUrl', 'https://portal.example.com'],
      ['supportTelegram', '@prism_support'],
      ['announcementText', 'Maintenance window tonight'],
      ['announcementActive', '1'],
      [
        'sharedResources',
        JSON.stringify([
          {
            id: 'apple-help',
            title: 'iPhone / iPad download help',
            kind: 'apple-id',
            access: 'credentials',
            summary: 'Sign in only inside App Store.',
            content: 'Apple ID: demo@icloud.com\nRule: sign out after install.',
            active: true,
          },
          {
            id: 'chatgpt-team',
            title: 'ChatGPT shared account',
            kind: 'chatgpt-account',
            access: 'credentials',
            summary: 'Use only for GPT access.',
            content: 'Account: demo@example.com\nPassword: ******',
            active: true,
          },
        ]),
      ],
      [
        'communityLinks',
        JSON.stringify([
          {
            id: 'telegram-main',
            title: 'Main Telegram group',
            platform: 'telegram',
            url: 'https://t.me/prism_group',
            summary: 'General chat for members.',
            rules: 'Be respectful and keep it on topic.',
            notes: 'Introduce yourself after joining.',
            qrContent: '',
            active: true,
          },
        ]),
      ],
    ] as const;

    const stmt = context.db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    for (const [key, value] of settings) {
      stmt.run(key, value, now);
    }

    context.db
      .prepare('UPDATE users SET display_name = ?, avatar_style = ? WHERE username = ?')
      .run('Alice Prism', 'violet', 'alice');

    const loginRes = await request(context.app).post('/local/auth/login').send({
      username: 'alice',
      password: 'secret456',
    });
    expect(loginRes.status).toBe(200);

    const rawSetCookie = loginRes.headers['set-cookie'];
    const setCookies =
      rawSetCookie === undefined ? [] : Array.isArray(rawSetCookie) ? rawSetCookie : [rawSetCookie];
    const sessionCookie = setCookies.find((entry) => entry.startsWith('pd_session='));
    expect(sessionCookie).toBeTruthy();

    const portalRes = await request(context.app)
      .get('/local/auth/portal/context')
      .set('Cookie', sessionCookie!.split(';')[0]);

    expect(portalRes.status).toBe(200);
    expect(portalRes.body.settings).toMatchObject({
      siteName: 'Prism',
      publicUrl: 'https://portal.example.com',
      supportTelegram: '@prism_support',
      announcementText: 'Maintenance window tonight',
      announcementActive: true,
      sharedResources: [
        expect.objectContaining({
          id: 'apple-help',
          title: 'iPhone / iPad download help',
          kind: 'apple-id',
          access: 'credentials',
        }),
        expect.objectContaining({
          id: 'chatgpt-team',
          title: 'ChatGPT shared account',
          kind: 'chatgpt-account',
          access: 'credentials',
        }),
      ],
      communityLinks: [
        expect.objectContaining({
          id: 'telegram-main',
          title: 'Main Telegram group',
          platform: 'telegram',
          url: 'https://t.me/prism_group',
          active: true,
        }),
      ],
    });
    expect(portalRes.body.user).toMatchObject({
      username: 'alice',
      displayName: 'Alice Prism',
      avatarStyle: 'violet',
    });
    expect(portalRes.body.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringMatching(/^admin-announcement(?::\d+)?$/),
          message: 'Maintenance window tonight',
        }),
      ]),
    );
  });

  it('returns announcement history newest first and keeps recurring notices on stable timestamps', async () => {
    const now = Math.floor(Date.now() / 1000);
    const stmt = context.db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    stmt.run('supportTelegram', '@prism_support', now - 300);
    stmt.run('announcementActive', '1', now + 60);
    stmt.run('announcementText', 'Newest notice', now + 60);
    stmt.run(
      'announcementHistory',
      JSON.stringify([
        {
          id: `admin-announcement:${(now - 120) * 1000}`,
          message: 'Older notice',
          createdAt: (now - 120) * 1000,
        },
        {
          id: `admin-announcement:${(now + 60) * 1000}`,
          message: 'Newest notice',
          createdAt: (now + 60) * 1000,
        },
      ]),
      now + 60,
    );
    context.db
      .prepare('UPDATE users SET created_at = ? WHERE username = ?')
      .run(now - 600, 'alice');

    const loginRes = await request(context.app).post('/local/auth/login').send({
      username: 'alice',
      password: 'secret456',
    });
    expect(loginRes.status).toBe(200);

    const rawSetCookie = loginRes.headers['set-cookie'];
    const setCookies =
      rawSetCookie === undefined ? [] : Array.isArray(rawSetCookie) ? rawSetCookie : [rawSetCookie];
    const sessionCookie = setCookies.find((entry) => entry.startsWith('pd_session='));
    expect(sessionCookie).toBeTruthy();

    const portalRes = await request(context.app)
      .get('/local/auth/portal/context')
      .set('Cookie', sessionCookie!.split(';')[0]);

    expect(portalRes.status).toBe(200);

    const notifications = portalRes.body.notifications as Array<{
      id: string;
      message: string;
      createdAt: number;
    }>;
    const announcementMessages = notifications
      .filter((item) => item.id.startsWith('admin-announcement:'))
      .map((item) => item.message);

    expect(notifications[0]).toMatchObject({
      id: `admin-announcement:${(now + 60) * 1000}`,
      message: 'Newest notice',
      createdAt: (now + 60) * 1000,
    });
    expect(announcementMessages).toEqual(['Newest notice', 'Older notice']);
    expect(notifications.find((item) => item.id === 'subscription-pending')?.createdAt).toBe(
      (now - 600) * 1000,
    );
    expect(notifications.find((item) => item.id === 'support-contact')?.createdAt).toBe(
      (now - 300) * 1000,
    );
  });

  it('maps legacy shared Apple ID settings into shared resources when no new list is stored', async () => {
    const now = Math.floor(Date.now() / 1000);
    const stmt = context.db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    stmt.run('sharedAppleIdTitle', 'Legacy Apple help', now);
    stmt.run('sharedAppleIdContent', 'Apple ID: legacy@example.com', now);
    stmt.run('sharedAppleIdActive', '1', now);
    context.db.prepare("DELETE FROM app_settings WHERE key = 'sharedResources'").run();

    const loginRes = await request(context.app).post('/local/auth/login').send({
      username: 'alice',
      password: 'secret456',
    });
    expect(loginRes.status).toBe(200);

    const rawSetCookie = loginRes.headers['set-cookie'];
    const setCookies =
      rawSetCookie === undefined ? [] : Array.isArray(rawSetCookie) ? rawSetCookie : [rawSetCookie];
    const sessionCookie = setCookies.find((entry) => entry.startsWith('pd_session='));
    expect(sessionCookie).toBeTruthy();

    const portalRes = await request(context.app)
      .get('/local/auth/portal/context')
      .set('Cookie', sessionCookie!.split(';')[0]);

    expect(portalRes.status).toBe(200);
    expect(portalRes.body.settings.sharedResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'apple-id',
          access: 'credentials',
          title: 'Legacy Apple help',
          content: 'Apple ID: legacy@example.com',
          active: true,
        }),
      ]),
    );
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

describe.sequential('Register Provisioning Integration', () => {
  it('claims an invite atomically when concurrent registrations race on the same code', async () => {
    const provisionSpy = vi.fn(async (username: string) => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return {
        inboundId: 1,
        protocol: 'vless',
        email: `${username}@example.test`,
        clientId: `client-${username}`,
        subId: `sub-${username}`,
      };
    });

    const context = await createTestContext({
      mockAutoProvision: {
        implementation: provisionSpy,
      },
    });

    try {
      context.db.prepare('INSERT INTO invite_codes (code) VALUES (?)').run('invite-race');

      const [first, second] = await Promise.all([
        request(context.app).post('/local/auth/register').send({
          username: 'race-alice',
          password: 'secret123',
          inviteCode: 'invite-race',
        }),
        request(context.app).post('/local/auth/register').send({
          username: 'race-bob',
          password: 'secret123',
          inviteCode: 'invite-race',
        }),
      ]);

      expect([first.status, second.status].sort((a, b) => a - b)).toEqual([200, 400]);
      expect(
        [first.body.error, second.body.error].filter((value): value is string => Boolean(value)),
      ).toContain('Invalid or expired invite code');
      expect(context.mocks.provisionClientForRegisteredUser).toHaveBeenCalledTimes(1);

      const users = context.db
        .prepare('SELECT username, sub_id FROM users ORDER BY id')
        .all() as Array<{ username: string; sub_id: string | null }>;
      expect(users).toHaveLength(1);
      expect(users[0].sub_id).toMatch(/^sub-/);

      const invite = context.db
        .prepare('SELECT used_by, used_at FROM invite_codes WHERE code = ?')
        .get('invite-race') as { used_by: number | null; used_at: number | null } | undefined;
      expect(invite?.used_by).toBeTypeOf('number');
      expect(invite?.used_at).toBeTypeOf('number');
    } finally {
      context.cleanup();
    }
  });

  it('rolls back the claimed invite and local user when upstream provisioning fails', async () => {
    const provisionSpy = vi.fn(async () => {
      const actual = await vi.importActual<typeof import('./xui-admin.js')>('./xui-admin.js');
      await new Promise((resolve) => setTimeout(resolve, 25));
      throw new actual.XuiAdminError('Upstream provisioning failed');
    });

    const context = await createTestContext({
      mockAutoProvision: {
        implementation: provisionSpy,
      },
    });

    try {
      context.db.prepare('INSERT INTO invite_codes (code) VALUES (?)').run('invite-upstream-fail');

      const registerRes = await request(context.app).post('/local/auth/register').send({
        username: 'upstream-fail-user',
        password: 'secret123',
        inviteCode: 'invite-upstream-fail',
      });

      expect(registerRes.status).toBe(502);
      expect(registerRes.body.error).toBe('Upstream provisioning failed');
      expect(context.mocks.provisionClientForRegisteredUser).toHaveBeenCalledTimes(1);

      const userCount = context.db
        .prepare('SELECT COUNT(*) as count FROM users WHERE username = ?')
        .get('upstream-fail-user') as { count: number };
      expect(userCount.count).toBe(0);

      const invite = context.db
        .prepare('SELECT used_by, used_at FROM invite_codes WHERE code = ?')
        .get('invite-upstream-fail') as
        | { used_by: number | null; used_at: number | null }
        | undefined;
      expect(invite).toEqual({
        used_by: null,
        used_at: null,
      });
    } finally {
      context.cleanup();
    }
  });
});

describe.sequential('Refresh Limiter Configuration', () => {
  it('does not emit the express-rate-limit IPv6 fallback warning during app creation', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const context = await createTestContext();

    try {
      const loggedErrors = errorSpy.mock.calls
        .flat()
        .map((entry) => String(entry))
        .join('\n');
      expect(loggedErrors).not.toContain('ERR_ERL_KEY_GEN_IPV6');
    } finally {
      errorSpy.mockRestore();
      context.cleanup();
    }
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

describe.sequential('Portal Stats Integration', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext({
      mockClientStats: {
        inboundId: 11,
        inboundRemark: 'US-West-Reality',
        protocol: 'vless',
        up: 1024,
        down: 2048,
        total: 0,
        expiryTime: 0,
        enable: true,
      },
      mockServerStatus: {
        cpu: 12.5,
        cpuCores: 4,
        mem: { current: 536_870_912, total: 2_147_483_648 },
        swap: { current: 0, total: 0 },
        disk: { current: 4_294_967_296, total: 21_474_836_480 },
        xray: { state: 'running', version: '1.8.9' },
        uptime: 123_456,
        loads: [0.22, 0.18, 0.11],
        tcpCount: 42,
        udpCount: 12,
        netIO: { up: 2048, down: 4096 },
        netTraffic: { sent: 8192, recv: 16384 },
      },
    });
  });

  afterAll(() => {
    context.cleanup();
  });

  it('returns node quality metadata alongside portal stats', async () => {
    context.db.prepare('INSERT INTO invite_codes (code) VALUES (?)').run('invite-bob');

    const registerRes = await request(context.app).post('/local/auth/register').send({
      username: 'bob',
      password: 'secret123',
      inviteCode: 'invite-bob',
    });
    expect(registerRes.status).toBe(200);
    context.db.prepare('UPDATE users SET sub_id = ? WHERE username = ?').run('mock-sub-id', 'bob');

    context.db
      .prepare('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, unixepoch())')
      .run(
        'nodeQualityProfiles',
        JSON.stringify({
          '11': {
            summary: 'Residential quality looks stable.',
            fraudScore: 18,
            netflixStatus: 'supported',
            chatgptStatus: 'supported',
            claudeStatus: 'limited',
            tiktokStatus: 'supported',
            instagramStatus: 'supported',
            spotifyStatus: 'supported',
            youtubeStatus: 'supported',
            disneyplusStatus: 'limited',
            primevideoStatus: 'supported',
            xStatus: 'limited',
            notes: 'Claude may ask for extra verification on first login.',
            updatedAt: Date.now(),
          },
        }),
      );

    const loginRes = await request(context.app).post('/local/auth/login').send({
      username: 'bob',
      password: 'secret123',
    });
    expect(loginRes.status).toBe(200);

    const rawSetCookie = loginRes.headers['set-cookie'];
    const setCookies =
      rawSetCookie === undefined ? [] : Array.isArray(rawSetCookie) ? rawSetCookie : [rawSetCookie];
    const sessionCookie = setCookies.find((entry) => entry.startsWith('pd_session='));
    expect(sessionCookie).toBeTruthy();

    const statsRes = await request(context.app)
      .get('/local/auth/portal/stats')
      .set('Cookie', sessionCookie!.split(';')[0]);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.stats).toMatchObject({
      inboundId: 11,
      inboundRemark: 'US-West-Reality',
      protocol: 'vless',
    });
    expect(statsRes.body.nodeQuality).toMatchObject({
      inboundId: 11,
      fraudScore: 18,
      netflixStatus: 'supported',
      chatgptStatus: 'supported',
      claudeStatus: 'limited',
      tiktokStatus: 'supported',
      instagramStatus: 'supported',
      spotifyStatus: 'supported',
      youtubeStatus: 'supported',
      disneyplusStatus: 'limited',
      primevideoStatus: 'supported',
      xStatus: 'limited',
    });
    expect(statsRes.body.serverStatus).toMatchObject({
      cpu: 12.5,
      cpuCores: 4,
      xray: {
        state: 'running',
        version: '1.8.9',
      },
      netIO: {
        up: 2048,
        down: 4096,
      },
    });
  });

  it('refreshes node quality via the user portal route', async () => {
    const refreshContext = await createTestContext({
      mockClientStats: {
        inboundId: 22,
        inboundRemark: 'US-East-Reality',
        protocol: 'vless',
        up: 4096,
        down: 8192,
        total: 0,
        expiryTime: 0,
        enable: true,
      },
      mockNodeQualityProfile: {
        inboundId: 22,
        summary: 'US / New York / 64.1.1.1 · Risk 16',
        fraudScore: 16,
        netflixStatus: 'supported',
        chatgptStatus: 'limited',
        claudeStatus: 'supported',
        tiktokStatus: 'supported',
        instagramStatus: 'supported',
        spotifyStatus: 'limited',
        youtubeStatus: 'supported',
        disneyplusStatus: 'supported',
        primevideoStatus: 'limited',
        xStatus: 'supported',
        notes: 'Automated reachability probe from the server egress.',
        updatedAt: Date.now(),
      },
    });

    try {
      refreshContext.db.prepare('INSERT INTO invite_codes (code) VALUES (?)').run('invite-carol');
      await request(refreshContext.app).post('/local/auth/register').send({
        username: 'carol',
        password: 'secret123',
        inviteCode: 'invite-carol',
      });
      refreshContext.db
        .prepare('UPDATE users SET sub_id = ? WHERE username = ?')
        .run('refresh-sub-id', 'carol');

      const loginRes = await request(refreshContext.app).post('/local/auth/login').send({
        username: 'carol',
        password: 'secret123',
      });
      expect(loginRes.status).toBe(200);

      const rawSetCookie = loginRes.headers['set-cookie'];
      const setCookies =
        rawSetCookie === undefined
          ? []
          : Array.isArray(rawSetCookie)
            ? rawSetCookie
            : [rawSetCookie];
      const sessionCookie = setCookies.find((entry) => entry.startsWith('pd_session='));
      expect(sessionCookie).toBeTruthy();

      const refreshRes = await request(refreshContext.app)
        .post('/local/auth/portal/node-quality/refresh')
        .set('Cookie', sessionCookie!.split(';')[0]);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.stats).toMatchObject({
        inboundId: 22,
        inboundRemark: 'US-East-Reality',
      });
      expect(refreshRes.body.nodeQuality).toMatchObject({
        inboundId: 22,
        fraudScore: 16,
        netflixStatus: 'supported',
        chatgptStatus: 'limited',
        claudeStatus: 'supported',
        tiktokStatus: 'supported',
        instagramStatus: 'supported',
        spotifyStatus: 'limited',
        youtubeStatus: 'supported',
        disneyplusStatus: 'supported',
        primevideoStatus: 'limited',
        xStatus: 'supported',
      });
    } finally {
      refreshContext.cleanup();
    }
  });
});
