import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import request from 'supertest';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import type Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

interface TestContext {
  app: Express;
  db: Database;
  adminCookie: string;
  cleanup: () => Promise<void>;
}

const TEST_ENV_KEYS = [
  'COOKIE_SECURE',
  'DATA_DIR',
  'VITE_3XUI_BASE_PATH',
  'VITE_3XUI_SERVER',
  'XUI_AUTO_CREATE_ON_REGISTER',
  'XUI_ADMIN_PASSWORD',
  'XUI_ADMIN_USERNAME',
] as const;

async function createTestContext(): Promise<TestContext> {
  const previousEnv = new Map<string, string | undefined>();
  for (const key of TEST_ENV_KEYS) {
    previousEnv.set(key, process.env[key]);
  }

  const upstreamServer = http.createServer((req, res) => {
    if (req.url?.startsWith('/panel/api/server/status')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false }));
  });

  await new Promise<void>((resolve) => upstreamServer.listen(0, '127.0.0.1', () => resolve()));
  const upstreamPort = (upstreamServer.address() as AddressInfo).port;
  const testDataDir = path.resolve(
    '.tmp',
    `vitest-admin-crud-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  process.env.COOKIE_SECURE = 'false';
  process.env.DATA_DIR = testDataDir;
  process.env.VITE_3XUI_SERVER = `http://127.0.0.1:${upstreamPort}`;
  process.env.VITE_3XUI_BASE_PATH = '';
  process.env.XUI_AUTO_CREATE_ON_REGISTER = 'false';
  process.env.XUI_ADMIN_USERNAME = 'admin';
  process.env.XUI_ADMIN_PASSWORD = 'secret';

  vi.resetModules();

  const dbModule = await import('./db.js');
  const appModule = await import('./app.js');

  const cleanup = async () => {
    try {
      dbModule.db.close();
    } catch {
      // ignore cleanup errors
    }

    await new Promise<void>((resolve, reject) => {
      upstreamServer.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

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
    adminCookie: '3x-ui=test-session',
    cleanup,
  };
}

async function registerTestUser(context: TestContext, username: string, inviteCode: string) {
  context.db.prepare('INSERT INTO invite_codes (code) VALUES (?)').run(inviteCode);
  const res = await request(context.app)
    .post('/local/auth/register')
    .send({ username, password: 'secret123', inviteCode });
  expect(res.status).toBe(200);
  const row = context.db.prepare('SELECT id FROM users WHERE username = ?').get(username) as
    | { id: number }
    | undefined;
  expect(row).toBeTruthy();
  return row!.id;
}

describe.sequential('Admin CRUD Integration', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
  });

  afterAll(async () => {
    await context.cleanup();
  });

  describe('invite codes', () => {
    it('creates and lists invite codes, deletes by id', async () => {
      const createRes = await request(context.app)
        .post('/local/admin/invite')
        .set('Cookie', context.adminCookie)
        .send({ count: 2 });
      expect(createRes.status).toBe(200);
      expect(createRes.body.codes).toHaveLength(2);

      const listRes = await request(context.app)
        .get('/local/admin/invite')
        .set('Cookie', context.adminCookie);
      expect(listRes.status).toBe(200);
      const codes = listRes.body as Array<{ id: number; code: string }>;
      const target = codes.find((c) => c.code === createRes.body.codes[0]);
      expect(target).toBeTruthy();

      const deleteRes = await request(context.app)
        .delete(`/local/admin/invite/${target!.id}`)
        .set('Cookie', context.adminCookie);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body).toEqual({ ok: true });

      const remaining = context.db
        .prepare('SELECT id FROM invite_codes WHERE id = ?')
        .get(target!.id);
      expect(remaining).toBeUndefined();
    });

    it('rejects non-numeric invite id with 400', async () => {
      const res = await request(context.app)
        .delete('/local/admin/invite/not-a-number')
        .set('Cookie', context.adminCookie);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid invite id/i);
    });

    it('preserves invite codes already used by a registered user', async () => {
      context.db.prepare('INSERT INTO invite_codes (code) VALUES (?)').run('invite-used-1');
      const reg = await request(context.app).post('/local/auth/register').send({
        username: 'used-by-tester',
        password: 'secret123',
        inviteCode: 'invite-used-1',
      });
      expect(reg.status).toBe(200);

      const codeRow = context.db
        .prepare('SELECT id FROM invite_codes WHERE code = ?')
        .get('invite-used-1') as { id: number };

      const deleteRes = await request(context.app)
        .delete(`/local/admin/invite/${codeRow.id}`)
        .set('Cookie', context.adminCookie);
      expect(deleteRes.status).toBe(200);

      const stillThere = context.db
        .prepare('SELECT id FROM invite_codes WHERE id = ?')
        .get(codeRow.id);
      expect(stillThere).toBeTruthy();
    });
  });

  describe('users', () => {
    it('lists, patches sub_id, and deletes a user', async () => {
      const userId = await registerTestUser(context, 'crud-user', 'invite-crud-1');

      const listRes = await request(context.app)
        .get('/local/admin/users')
        .set('Cookie', context.adminCookie);
      expect(listRes.status).toBe(200);
      const users = listRes.body as Array<{ id: number; username: string }>;
      expect(users.find((u) => u.id === userId)).toBeTruthy();

      const patchRes = await request(context.app)
        .patch(`/local/admin/users/${userId}`)
        .set('Cookie', context.adminCookie)
        .send({ subId: 'sub-xyz-001' });
      expect(patchRes.status).toBe(200);

      const stored = context.db.prepare('SELECT sub_id FROM users WHERE id = ?').get(userId) as {
        sub_id: string;
      };
      expect(stored.sub_id).toBe('sub-xyz-001');

      const deleteRes = await request(context.app)
        .delete(`/local/admin/users/${userId}`)
        .set('Cookie', context.adminCookie);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body).toMatchObject({ ok: true, username: 'crud-user' });

      const removed = context.db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
      expect(removed).toBeUndefined();
    });

    it('rejects non-numeric user id with 400', async () => {
      for (const verb of ['delete', 'patch'] as const) {
        const res = await (request(context.app) as unknown as Record<string, Function>)
          [verb](`/local/admin/users/abc`)
          .set('Cookie', context.adminCookie)
          .send({ subId: 'x' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/invalid user id/i);
      }
    });

    it('returns 404 when deleting a non-existent user id', async () => {
      const res = await request(context.app)
        .delete('/local/admin/users/9999999')
        .set('Cookie', context.adminCookie);
      expect(res.status).toBe(404);
    });
  });

  describe('password reset', () => {
    it('issues a one-shot reset token for a user and persists its hash', async () => {
      const userId = await registerTestUser(context, 'reset-target', 'invite-reset-1');

      const res = await request(context.app)
        .post(`/local/admin/users/${userId}/password-reset`)
        .set('Cookie', context.adminCookie)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.token).toMatch(/^[a-f0-9]{64}$/);
      expect(res.body.username).toBe('reset-target');
      expect(res.body.ttlSeconds).toBeGreaterThan(0);

      const storedTokenCount = context.db
        .prepare(
          'SELECT COUNT(*) AS c FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL',
        )
        .get(userId) as { c: number };
      expect(storedTokenCount.c).toBe(1);
    });

    it('rejects non-numeric user id with 400', async () => {
      const res = await request(context.app)
        .post('/local/admin/users/abc/password-reset')
        .set('Cookie', context.adminCookie)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid user id/i);
    });
  });

  describe('rate limiter', () => {
    it('throttles excessive admin requests with 429', async () => {
      // adminLimiter is 240/min; flood with 260 requests to trigger the limit.
      let lastStatus = 200;
      for (let i = 0; i < 260; i++) {
        const res = await request(context.app)
          .get('/local/admin/invite')
          .set('Cookie', context.adminCookie);
        lastStatus = res.status;
        if (lastStatus === 429) break;
      }
      expect(lastStatus).toBe(429);
    });
  });
});
