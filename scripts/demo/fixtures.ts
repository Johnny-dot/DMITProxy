import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { XuiInbound } from '../../server/xui-admin.js';

export const DEMO_PASSWORD = 'prism-demo-2026';
export const DEMO_INVITE = 'PRISM-DEMO';
export const GIB = 1024 ** 3;
export const DEMO_USERS = [
  { username: 'demo', displayName: 'Alex Chen', subId: 'demo-alex', avatar: 'cobalt' },
  { username: 'morgan', displayName: 'Morgan Lee', subId: 'demo-morgan', avatar: 'emerald' },
  { username: 'sam', displayName: 'Sam Taylor', subId: 'demo-sam', avatar: 'violet' },
];

export function createDemoInbounds(now = Date.now()): XuiInbound[] {
  const profiles = [
    { name: 'Tokyo · Reality', host: 'tokyo.example.invalid', used: 38.6, port: 443 },
    { name: 'Singapore · Reality', host: 'singapore.example.invalid', used: 24.8, port: 8443 },
    { name: 'Frankfurt · Reality', host: 'frankfurt.example.invalid', used: 12.4, port: 2083 },
  ];
  return profiles.map((profile, index) => {
    const user = DEMO_USERS[index];
    const client = {
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      email: user.username,
      subId: user.subId,
      enable: true,
      expiryTime: now + 90 * 86400000,
      totalGB: 200 * GIB,
      flow: 'xtls-rprx-vision',
    };
    return {
      id: index + 1,
      remark: profile.name,
      protocol: 'vless',
      port: profile.port,
      listen: profile.host,
      enable: true,
      up: profile.used * GIB * 0.16,
      down: profile.used * GIB * 0.84,
      total: 400 * GIB,
      expiryTime: 0,
      settings: JSON.stringify({ clients: [client], decryption: 'none' }),
      streamSettings: JSON.stringify({
        network: 'tcp',
        security: 'reality',
        realitySettings: {
          serverNames: ['example.invalid'],
          shortIds: ['0123456789abcdef'],
          settings: {
            publicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            fingerprint: 'chrome',
          },
        },
      }),
      clientStats: [
        {
          email: user.username,
          enable: true,
          up: Math.round(profile.used * GIB * 0.16),
          down: Math.round(profile.used * GIB * 0.84),
          total: client.totalGB,
          expiryTime: client.expiryTime,
        },
      ],
    };
  });
}

export async function startDemoUpstream(inbounds = createDemoInbounds()) {
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const reply = (obj: unknown, status = 200, success = true, msg = '') => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success, obj, msg }));
      };
      if (url.pathname === '/login') {
        const body = new URLSearchParams(raw);
        if (body.get('username') !== 'admin' || body.get('password') !== DEMO_PASSWORD) {
          reply(null, 401, false, 'Invalid demo credentials');
          return;
        }
        res.setHeader('Set-Cookie', '3x-ui=prism-demo-session; Path=/; HttpOnly; SameSite=Lax');
        reply(null);
        return;
      }
      if (!req.headers.cookie?.includes('3x-ui=prism-demo-session')) {
        reply(null, 401, false, 'Demo authentication required');
        return;
      }
      if (url.pathname === '/logout') {
        res.setHeader('Set-Cookie', '3x-ui=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
        reply(null);
        return;
      }
      if (url.pathname === '/panel/api/server/status') {
        reply({
          cpu: 12.4,
          cpuCores: 4,
          mem: { current: 1.6 * GIB, total: 8 * GIB },
          swap: { current: 0, total: 2 * GIB },
          disk: { current: 18.2 * GIB, total: 80 * GIB },
          xray: { state: 'running', version: 'demo' },
          uptime: 86400 * 12 + 3600 * 4,
          loads: [0.28, 0.35, 0.31],
          tcpCount: 46,
          udpCount: 12,
          netIO: { up: 153600, down: 1258291 },
          netTraffic: { sent: 24.8 * GIB, recv: 112.6 * GIB },
        });
        return;
      }
      if (url.pathname === '/panel/api/inbounds/list') {
        reply(inbounds);
        return;
      }
      if (url.pathname.endsWith('/onlines')) {
        reply(['demo', 'morgan']);
        return;
      }
      if (url.pathname.endsWith('/lastOnline')) {
        reply(Object.fromEntries(DEMO_USERS.map((u) => [u.username, Date.now()])));
        return;
      }
      if (url.pathname.includes('/clientIps/')) {
        reply(JSON.stringify(['192.0.2.10']));
        return;
      }
      reply(null, 403, false, 'This upstream operation is disabled in the local demo');
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
