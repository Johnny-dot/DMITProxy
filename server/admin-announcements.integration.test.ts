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
    `vitest-admin-announcements-${Date.now()}-${Math.random().toString(16).slice(2)}`,
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

describe.sequential('Admin Announcements Integration', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
  });

  afterAll(async () => {
    await context.cleanup();
  });

  it('publishes announcements and removes deleted items from user portal notifications', async () => {
    const firstRes = await request(context.app)
      .post('/local/admin/announcements')
      .set('Cookie', context.adminCookie)
      .send({ message: 'First maintenance notice' });
    expect(firstRes.status).toBe(200);
    expect(firstRes.body.announcements).toEqual([
      expect.objectContaining({
        message: 'First maintenance notice',
        isActive: true,
      }),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 5));

    const secondRes = await request(context.app)
      .post('/local/admin/announcements')
      .set('Cookie', context.adminCookie)
      .send({ message: 'Second maintenance notice' });
    expect(secondRes.status).toBe(200);

    const secondAnnouncement = (
      secondRes.body.announcements as Array<{
        id: string;
        message: string;
        isActive: boolean;
      }>
    ).find((item) => item.message === 'Second maintenance notice');
    expect(secondAnnouncement).toBeTruthy();
    expect(secondAnnouncement?.isActive).toBe(true);

    context.db.prepare('INSERT INTO invite_codes (code) VALUES (?)').run('invite-delta');
    const registerRes = await request(context.app).post('/local/auth/register').send({
      username: 'delta',
      password: 'secret123',
      inviteCode: 'invite-delta',
    });
    expect(registerRes.status).toBe(200);

    const loginRes = await request(context.app).post('/local/auth/login').send({
      username: 'delta',
      password: 'secret123',
    });
    expect(loginRes.status).toBe(200);

    const userCookie = String(loginRes.headers['set-cookie']?.[0] ?? '').split(';')[0];
    expect(userCookie).toContain('pd_session=');

    const portalBeforeDelete = await request(context.app)
      .get('/local/auth/portal/context')
      .set('Cookie', userCookie);
    expect(portalBeforeDelete.status).toBe(200);
    expect(
      (portalBeforeDelete.body.notifications as Array<{ id: string; message: string }>)
        .filter((item) => item.id.startsWith('admin-announcement:'))
        .map((item) => item.message),
    ).toEqual(['Second maintenance notice', 'First maintenance notice']);

    const deleteRes = await request(context.app)
      .delete(`/local/admin/announcements/${encodeURIComponent(secondAnnouncement!.id)}`)
      .set('Cookie', context.adminCookie);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.announcements).toEqual([
      expect.objectContaining({
        message: 'First maintenance notice',
        isActive: true,
      }),
    ]);

    const portalAfterDelete = await request(context.app)
      .get('/local/auth/portal/context')
      .set('Cookie', userCookie);
    expect(portalAfterDelete.status).toBe(200);
    expect(
      (portalAfterDelete.body.notifications as Array<{ id: string; message: string }>)
        .filter((item) => item.id.startsWith('admin-announcement:'))
        .map((item) => item.message),
    ).toEqual(['First maintenance notice']);
  });
});
