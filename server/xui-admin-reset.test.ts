import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

interface ReceivedRequest {
  method: string;
  url: string;
  body: string;
}

describe('resetInboundTrafficCounters', () => {
  const received: ReceivedRequest[] = [];
  const previousEnv = {
    server: process.env.VITE_3XUI_SERVER,
    basePath: process.env.VITE_3XUI_BASE_PATH,
    username: process.env.XUI_ADMIN_USERNAME,
    password: process.env.XUI_ADMIN_PASSWORD,
  };

  let failAggregateReset = false;
  let failClientReset = false;
  let resetInboundTrafficCounters:
    | (typeof import('./xui-admin.js'))['resetInboundTrafficCounters']
    | undefined;

  const inbound = {
    id: 7,
    remark: 'DMIT',
    protocol: 'vless',
    enable: true,
    port: 443,
    listen: '',
    settings: '{"clients":[]}',
    streamSettings: '{"network":"tcp"}',
    sniffing: '{"enabled":true}',
    up: 123,
    down: 456,
    total: 0,
    expiryTime: 0,
    trafficReset: 'never',
    lastTrafficResetTime: 111,
    clientStats: [],
  };

  function sendJson(res: ServerResponse, body: unknown, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const method = req.method ?? '';
      const url = req.url ?? '';
      received.push({ method, url, body });

      if (method === 'POST' && url === '/login') {
        res.setHeader('Set-Cookie', 'session=test-session; Path=/; HttpOnly');
        sendJson(res, { success: true, msg: '', obj: null });
        return;
      }
      if (method === 'GET' && url === '/panel/api/inbounds/list') {
        sendJson(res, { success: true, msg: '', obj: [inbound] });
        return;
      }
      if (method === 'POST' && url === '/panel/api/inbounds/update/7') {
        sendJson(res, {
          success: !failAggregateReset,
          msg: failAggregateReset ? 'aggregate reset refused' : '',
          obj: null,
        });
        return;
      }
      if (method === 'POST' && url === '/panel/api/inbounds/resetAllClientTraffics/7') {
        sendJson(res, {
          success: !failClientReset,
          msg: failClientReset ? 'client reset refused' : '',
          obj: null,
        });
        return;
      }

      sendJson(res, { success: false, msg: 'not found', obj: null }, 404);
    });
  });

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    process.env.VITE_3XUI_SERVER = `http://127.0.0.1:${address.port}`;
    delete process.env.VITE_3XUI_BASE_PATH;
    process.env.XUI_ADMIN_USERNAME = 'test-admin';
    process.env.XUI_ADMIN_PASSWORD = 'test-password';
    vi.resetModules();
    ({ resetInboundTrafficCounters } = await import('./xui-admin.js'));
  });

  beforeEach(() => {
    received.length = 0;
    failAggregateReset = false;
    failClientReset = false;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    for (const [key, value] of Object.entries(previousEnv)) {
      const envName =
        key === 'server'
          ? 'VITE_3XUI_SERVER'
          : key === 'basePath'
            ? 'VITE_3XUI_BASE_PATH'
            : key === 'username'
              ? 'XUI_ADMIN_USERNAME'
              : 'XUI_ADMIN_PASSWORD';
      if (value === undefined) delete process.env[envName];
      else process.env[envName] = value;
    }
  });

  it('resets the target inbound aggregate before resetting its clients', async () => {
    await resetInboundTrafficCounters!(7);

    const mutations = received.filter((request) => request.url !== '/login');
    expect(mutations.map((request) => `${request.method} ${request.url}`)).toEqual([
      'GET /panel/api/inbounds/list',
      'POST /panel/api/inbounds/update/7',
      'POST /panel/api/inbounds/resetAllClientTraffics/7',
    ]);

    const aggregatePayload = Object.fromEntries(new URLSearchParams(mutations[1].body));
    expect(aggregatePayload).toMatchObject({
      up: '0',
      down: '0',
      total: '0',
      remark: 'DMIT',
      enable: 'true',
      port: '443',
      protocol: 'vless',
      settings: '{"clients":[]}',
      streamSettings: '{"network":"tcp"}',
      sniffing: '{"enabled":true}',
    });
  });

  it('does not reset clients when the aggregate reset fails', async () => {
    failAggregateReset = true;

    await expect(resetInboundTrafficCounters!(7)).rejects.toThrow('aggregate reset refused');
    expect(received.some((request) => request.url.includes('resetAllClientTraffics'))).toBe(false);
  });

  it('reports failure when the client reset fails after the aggregate was cleared', async () => {
    failClientReset = true;

    await expect(resetInboundTrafficCounters!(7)).rejects.toThrow('client reset refused');
    expect(received.some((request) => request.url === '/panel/api/inbounds/update/7')).toBe(true);
    expect(
      received.some((request) => request.url === '/panel/api/inbounds/resetAllClientTraffics/7'),
    ).toBe(true);
  });
});
