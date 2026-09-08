import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

describe('service session and snapshot recovery', () => {
  let api: typeof import('./xui-admin.js');
  let logins = 0,
    lists = 0,
    writes = 0,
    used = 10;
  let cookie = '',
    mode = 'ok';
  let held: { response: ServerResponse; body: string } | null = null;
  const send = (res: ServerResponse, value: unknown, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(value));
  };
  const data = () => [
    {
      id: 1,
      enable: true,
      protocol: 'vless',
      port: 443,
      settings: JSON.stringify({
        clients: [{ id: 'synthetic-client', email: 'alice', subId: 'synthetic-sub', enable: true }],
      }),
      clientStats: [{ email: 'alice', enable: true, up: 0, down: used, total: 0, expiryTime: 0 }],
    },
  ];
  const server = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      if (req.url === '/login' && req.method === 'POST') {
        cookie = `session=${++logins}`;
        res.setHeader('Set-Cookie', cookie + '; Path=/');
        send(res, { success: true, obj: null });
        return;
      }
      if (req.url === '/login') {
        res.setHeader('Content-Type', 'text/html');
        res.end('<html>Sign in</html>');
        return;
      }
      if (!cookie || req.headers.cookie !== cookie) {
        if (mode === 'redirect-expired') {
          res.writeHead(302, { Location: '/login' });
          res.end();
        } else send(res, { success: false }, 401);
        return;
      }
      if (req.url === '/panel/api/inbounds/list') {
        lists++;
        if (mode === 'hang') return;
        const body = JSON.stringify({ success: true, obj: data() });
        if (mode === 'hold-first' && lists === 1) {
          held = { response: res, body };
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(body);
        return;
      }
      if (req.url?.startsWith('/panel/api/inbounds/updateClientTraffic/')) {
        writes++;
        if (mode === 'reject-write') {
          cookie = 'revoked';
          send(res, { success: false }, 401);
        } else {
          used = 500;
          send(res, { success: true });
        }
        return;
      }
      send(res, { success: true, obj: {} });
    });
  });
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    vi.stubEnv('VITE_3XUI_SERVER', `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    vi.stubEnv('VITE_3XUI_BASE_PATH', '');
    vi.stubEnv('XUI_ADMIN_USERNAME', 'fixture-admin');
    vi.stubEnv('XUI_ADMIN_PASSWORD', 'fixture-password');
    vi.stubEnv('XUI_REQUEST_TIMEOUT_MS', '1000');
  });
  beforeEach(async () => {
    vi.resetModules();
    api = await import('./xui-admin.js');
    logins = 0;
    lists = 0;
    writes = 0;
    used = 10;
    cookie = '';
    mode = 'ok';
    held = null;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.unstubAllEnvs();
  });
  it('coalesces concurrent logins and snapshots', async () => {
    const values = await Promise.all(
      Array.from({ length: 5 }, () => api.fetchClientStatsBySubId('synthetic-sub')),
    );
    expect(values.every((v) => v?.down === 10)).toBe(true);
    expect(logins).toBe(1);
    expect(lists).toBe(1);
  });
  it.each(['ok', 'redirect-expired'])(
    'refreshes an expired service session (%s)',
    async (nextMode) => {
      await api.fetchXuiInbounds();
      cookie = 'revoked';
      mode = nextMode;
      expect(await api.fetchXuiInbounds()).toHaveLength(1);
      expect(logins).toBe(2);
    },
  );
  it('releases a failed shared request and recovers on the next request', async () => {
    mode = 'hang';
    await expect(api.fetchClientStatsBySubId('synthetic-sub')).rejects.toThrow('timed out');
    mode = 'ok';
    expect((await api.fetchClientStatsBySubId('synthetic-sub'))?.down).toBe(10);
    expect(lists).toBe(2);
  });
  it('does not let an old in-flight snapshot overwrite a newer post-write snapshot', async () => {
    mode = 'hold-first';
    const older = api.fetchClientStatsBySubId('synthetic-sub');
    for (let i = 0; i < 100 && !held; i++) await new Promise((resolve) => setTimeout(resolve, 5));
    expect(held).not.toBeNull();
    await api.updateClientTrafficByEmail({ email: 'alice', upload: 0, download: 500 });
    expect((await api.fetchClientStatsBySubId('synthetic-sub'))?.down).toBe(500);
    held!.response.end(held!.body);
    expect((await older)?.down).toBe(10);
    expect((await api.fetchClientStatsBySubId('synthetic-sub'))?.down).toBe(500);
    expect(lists).toBe(2);
  });
  it('never automatically replays a write after authentication rejection', async () => {
    await api.fetchXuiInbounds();
    mode = 'reject-write';
    await expect(
      api.updateClientTrafficByEmail({ email: 'alice', upload: 0, download: 1 }),
    ).rejects.toThrow('session expired');
    expect(writes).toBe(1);
    expect(logins).toBe(1);
    mode = 'ok';
    await api.fetchXuiInbounds();
    expect(logins).toBe(2);
  });
});
