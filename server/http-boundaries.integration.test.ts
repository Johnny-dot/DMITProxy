import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer, get } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-http-test-'));
let app: express.Express;
let database: typeof import('./db.js');
let mode = 'ok',
  lastCookie = '';
let onHeld: ((closed: Promise<void>) => void) | undefined;
const upstream = createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    lastCookie = req.headers.cookie ?? '';
    if (mode === 'hang') {
      const closed = new Promise<void>((resolve) => req.socket.once('close', () => resolve()));
      onHeld?.(closed);
      return;
    }
    const ok = lastCookie.includes('3x-ui=fixture');
    res.writeHead(ok ? 200 : 401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: ok, obj: {} }));
  });
});
beforeAll(async () => {
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  vi.stubEnv('DATA_DIR', directory);
  vi.stubEnv('TRUST_PROXY', 'loopback');
  vi.stubEnv('VITE_3XUI_SERVER', `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`);
  vi.stubEnv('VITE_3XUI_BASE_PATH', '');
  vi.stubEnv('XUI_ADMIN_USERNAME', 'service');
  vi.stubEnv('XUI_ADMIN_PASSWORD', 'secret-fixture');
  vi.stubEnv('AUTH_RATE_LIMIT_MAX', '2');
  vi.stubEnv('XUI_REQUEST_TIMEOUT_MS', '100');
  vi.resetModules();
  database = await import('./db.js');
  const { createApp } = await import('./app.js');
  app = express();
  // Model an untrusted TCP peer without depending on the host's LAN interfaces.
  app.use((req, _res, next) => {
    Object.defineProperty(req.socket, 'remoteAddress', {
      value: '198.51.100.20',
      configurable: true,
    });
    next();
  });
  app.use(createApp());
});
beforeEach(() => {
  mode = 'ok';
  onHeld = undefined;
});
afterAll(async () => {
  upstream.closeAllConnections();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
  database.db.close();
  vi.unstubAllEnvs();
  const resolved = fs.realpathSync(directory);
  if (
    path.dirname(resolved) === fs.realpathSync(os.tmpdir()) &&
    path.basename(resolved).startsWith('prism-http-test-')
  )
    fs.rmSync(resolved, { recursive: true });
});
it('ignores forged loopback identity and rotating forwarded IPs from an untrusted peer', async () => {
  expect(
    (await request(app).get('/sub/_template/dmit-default.toml').set('X-Forwarded-For', '127.0.0.1'))
      .status,
  ).toBe(404);
  const statuses = [];
  for (let i = 1; i <= 3; i++)
    statuses.push(
      (
        await request(app)
          .post('/local/auth/login')
          .set('X-Forwarded-For', `203.0.113.${i}`)
          .send({ username: 'missing', password: 'invalid' })
      ).status,
    );
  expect(statuses).toEqual([401, 401, 429]);
});
it('never injects service credentials into the browser proxy', async () => {
  expect((await request(app).get('/api/panel/api/server/status')).status).toBe(401);
  expect(lastCookie).toBe('');
});
it('returns bounded availability errors and can verify the same admin again after recovery', async () => {
  mode = 'hang';
  expect((await request(app).get('/api/panel/api/server/status')).status).toBe(504);
  expect(
    (await request(app).get('/local/admin/users').set('Cookie', '3x-ui=fixture; probe=recovery'))
      .status,
  ).toBe(503);
  mode = 'ok';
  expect(
    (await request(app).get('/local/admin/users').set('Cookie', '3x-ui=fixture; probe=recovery'))
      .status,
  ).toBe(200);
});
it('aborts the upstream exchange when the browser disconnects', async () => {
  mode = 'hang';
  vi.stubEnv('XUI_REQUEST_TIMEOUT_MS', '5000');
  const local = createServer(app);
  await new Promise<void>((resolve) => local.listen(0, '127.0.0.1', resolve));
  const reached = new Promise<{ closed: Promise<void> }>((resolve) => {
    onHeld = (closed) => resolve({ closed });
  });
  const client = get(
    `http://127.0.0.1:${(local.address() as AddressInfo).port}/api/panel/api/server/status`,
  );
  client.on('error', () => {});
  try {
    const { closed } = await reached;
    client.destroy();
    const result = await Promise.race([
      closed.then(() => 'closed'),
      new Promise((resolve) => setTimeout(() => resolve('pending'), 1000)),
    ]);
    expect(result).toBe('closed');
  } finally {
    client.destroy();
    local.closeAllConnections();
    await new Promise<void>((resolve) => local.close(() => resolve()));
    vi.stubEnv('XUI_REQUEST_TIMEOUT_MS', '100');
  }
});
it('returns success only after an authenticated WAL backup is complete', async () => {
  const reader = new Database(path.join(directory, 'prism.db'), { readonly: true });
  reader.exec('BEGIN');
  reader.prepare('SELECT COUNT(*) FROM invite_codes').get();
  database.db.prepare('INSERT INTO invite_codes(code) VALUES(?)').run('backup-regression');
  try {
    const response = await request(app)
      .post('/local/admin/maintenance/backup')
      .set('Cookie', '3x-ui=fixture; probe=backup');
    expect(response.status).toBe(200);
    expect(response.body.integrity).toBe('ok');
    const snapshot = new Database(response.body.file, { readonly: true });
    try {
      expect(snapshot.prepare('SELECT code FROM invite_codes').get()).toEqual({
        code: 'backup-regression',
      });
    } finally {
      snapshot.close();
    }
  } finally {
    reader.exec('ROLLBACK');
    reader.close();
  }
});
