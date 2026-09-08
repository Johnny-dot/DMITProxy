import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {
  createDemoInbounds,
  DEMO_INVITE,
  DEMO_PASSWORD,
  DEMO_USERS,
  startDemoUpstream,
} from './fixtures.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Dedicated local harness: no dotenv, production database, or production listeners. */
export async function startDemo(port = 4173) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('The demo cannot run in production mode.');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-demo-'));
  const inbounds = createDemoInbounds();
  const upstream = await startDemoUpstream(inbounds);
  const cleanups: Array<() => Promise<void>> = [upstream.close];
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    for (const cleanup of [...cleanups].reverse()) await cleanup();
  };
  try {
    Object.assign(process.env, {
      DATA_DIR: dataDir,
      LOG_TO_FILE: 'false',
      COOKIE_SECURE: 'false',
      VITE_3XUI_SERVER: upstream.url,
      VITE_3XUI_BASE_PATH: '',
      XUI_ADMIN_USERNAME: 'admin',
      XUI_ADMIN_PASSWORD: DEMO_PASSWORD,
      XUI_AUTO_CREATE_ON_REGISTER: 'false',
      EXTRA_SUBSCRIPTION_LINKS: '',
      XUI_TLS_INSECURE_SKIP_VERIFY: 'false',
      PUBLIC_NODE_HOST: '',
      VITE_PUBLIC_NODE_HOST: '',
      DMIT_SERVICE_ID: '1',
      DMIT_SYNC_TOKEN: '',
      CORS_ORIGINS: '',
      AUTH_RATE_LIMIT_MAX: '200',
    });
    const { createApp } = await import('../../server/app.js');
    const { db, hashPassword } = await import('../../server/db.js');
    cleanups.push(async () => {
      db.close();
    });
    const { setBillingDay } = await import('../../server/xui-billing.js');
    const { upsertDmitTraffic } = await import('../../server/dmit-traffic-store.js');
    const { saveNodeQualityProfile } = await import('../../server/node-quality.js');
    const now = Date.now();
    for (const user of DEMO_USERS) {
      const { hash, salt } = hashPassword(DEMO_PASSWORD);
      db.prepare(
        'INSERT INTO users(username,password_hash,salt,sub_id,display_name,avatar_style) VALUES(?,?,?,?,?,?)',
      ).run(user.username, hash, salt, user.subId, user.displayName, user.avatar);
    }
    db.prepare('INSERT INTO invite_codes(code) VALUES(?)').run(DEMO_INVITE);
    const setting = db.prepare('INSERT OR REPLACE INTO app_settings(key,value) VALUES(?,?)');
    setting.run('siteName', 'Prism Demo');
    setting.run(
      'announcementText',
      '欢迎体验 Prism。这是独立的本地演示，节点、流量与账号均为示例数据。',
    );
    setting.run('announcementActive', 'true');
    setting.run(
      'communityLinks',
      JSON.stringify([
        {
          id: 'demo-community',
          platform: 'custom',
          title: 'Prism on GitHub',
          summary: '使用指南、问题反馈与项目更新。',
          url: 'https://github.com/Johnny-dot/DMITProxy',
          qrContent: '',
          rules: '',
          notes: '',
          active: true,
        },
      ]),
    );
    setting.run(
      'sharedResources',
      JSON.stringify([
        {
          id: 'demo-guide',
          kind: 'other',
          title: '快速开始',
          summary: '从选择设备到导入订阅，三步完成。',
          content: '1. 选择当前设备\n2. 安装推荐客户端\n3. 导入订阅并选择节点',
          access: 'instructions',
          active: true,
        },
      ]),
    );
    for (const inbound of inbounds) {
      setBillingDay(inbound.id, 3);
      saveNodeQualityProfile({
        inboundId: inbound.id,
        probeMode: 'proxy-outbound',
        probeTarget: 'demo.example.invalid',
        summary: '演示数据 · 未执行网络探测',
        fraudScore: null,
        netflixStatus: 'supported',
        chatgptStatus: 'supported',
        claudeStatus: 'supported',
        tiktokStatus: 'limited',
        instagramStatus: 'supported',
        spotifyStatus: 'supported',
        youtubeStatus: 'supported',
        disneyplusStatus: 'unknown',
        primevideoStatus: 'unknown',
        xStatus: 'supported',
        notes: 'Sample data only. No real proxy connection or service test was performed.',
        egress: {
          ip: `192.0.2.${inbound.id}`,
          country: ['Japan', 'Singapore', 'Germany'][inbound.id - 1],
          countryCode: ['JP', 'SG', 'DE'][inbound.id - 1],
          regionName: '',
          city: '',
          isp: 'Demo network',
          asn: 'AS64496',
          proxy: null,
          hosting: true,
          mobile: false,
        },
        serviceDetails: {},
        updatedAt: now,
      });
    }
    upsertDmitTraffic({
      serviceId: 1,
      bwusageMb: 156 * 1024,
      bwlimitMb: 1200 * 1024,
      xuiUsedMb: Math.round(75.8 * 1024),
      nextResetAt: now + 15 * 86400000,
      nextResetDay: 3,
      source: 'manual',
      now,
    });

    const api = express();
    api.use((req, res, next) => {
      if (
        /\/node-quality.*\/refresh/.test(req.url) ||
        req.url.startsWith('/local/downloads/') ||
        req.url.startsWith('/local/dmit/') ||
        (req.path.startsWith('/sub/') && req.query.flag === 'surge')
      ) {
        res
          .status(409)
          .json({ error: '演示模式使用模拟数据。外部探测、镜像下载和流量同步已禁用。' });
        return;
      }
      next();
    });
    api.use(createApp());
    const apiServer = createServer(api);
    cleanups.push(
      () =>
        new Promise<void>((resolve) => {
          apiServer.closeAllConnections();
          apiServer.close(() => resolve());
        }),
    );
    await new Promise<void>((resolve, reject) => {
      apiServer.once('error', reject);
      apiServer.listen(0, '127.0.0.1', resolve);
    });
    const apiUrl = `http://127.0.0.1:${(apiServer.address() as AddressInfo).port}`;
    process.env.SERVER_PORT = String((apiServer.address() as AddressInfo).port);
    const vite = await createViteServer({
      root,
      configFile: false,
      envDir: false,
      plugins: [react(), tailwindcss()],
      resolve: { alias: { '@': root } },
      define: {
        __APP_COMMIT__: JSON.stringify('local-demo'),
        __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
        'import.meta.env.VITE_3XUI_SERVER': JSON.stringify(upstream.url),
        'import.meta.env.VITE_API_BASE': JSON.stringify('/api'),
        'import.meta.env.VITE_DEMO_MODE': 'true',
      },
      server: {
        host: '127.0.0.1',
        port,
        strictPort: true,
        proxy: { '/local': apiUrl, '/api': apiUrl, '/sub': apiUrl },
      },
    } as Parameters<typeof createViteServer>[0]);
    cleanups.push(() => vite.close());
    let frontendPort = port;
    if (port === 0) {
      // Vite 6 treats port 0 as its default port. Ask the OS for a free port
      // and keep strictPort enabled so a race fails without disturbing another app.
      const portProbe = createServer();
      await new Promise<void>((resolve, reject) => {
        portProbe.once('error', reject);
        portProbe.listen(0, '127.0.0.1', resolve);
      });
      frontendPort = (portProbe.address() as AddressInfo).port;
      await new Promise<void>((resolve) => portProbe.close(() => resolve()));
    }
    await vite.listen(frontendPort);
    const actualPort = (vite.httpServer!.address() as AddressInfo).port;
    const url = `http://127.0.0.1:${actualPort}`;
    setting.run('publicUrl', url);
    return { url, dataDir, db, close };
  } catch (error) {
    await close();
    throw error;
  }
}
