import 'dotenv/config';
import './logger.js';
import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import {
  buildXuiPath,
  getXuiPathCandidates,
  getXuiRequestFactory,
  getXuiTarget,
  resolveXuiRedirectPath,
} from './xui.js';

const app = express();
const PORT = parseInt(process.env.SERVER_PORT ?? '3001');
const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308]);
const MAX_REDIRECTS = 3;
const PROXY_DEBUG = (process.env.PROXY_DEBUG ?? 'false').toLowerCase() === 'true';

// Cookie parser (manual, no deps)
app.use((req, _res, next) => {
  const raw = req.headers.cookie ?? '';
  (req as any).cookies = Object.fromEntries(
    raw
      .split(';')
      .map((s) => s.trim().split('='))
      .filter((p) => p.length === 2)
      .map(([k, v]) => [k.trim(), v.trim()]),
  );
  next();
});

// ── Our own API routes ──────────────────────────────────────────────────────
app.use('/local', express.json());
app.use('/local/auth', authRouter);
app.use('/local/admin', adminRouter);

// ── Proxy /api/* → 3X-UI (used in both development and production) ──────────
const xuiTarget = getXuiTarget();

if (xuiTarget) {
  const requestFactory = getXuiRequestFactory(xuiTarget.protocol);

  app.use('/api', (req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('error', () => {
      if (!res.headersSent) res.status(400).json({ error: 'Invalid request body' });
    });
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const candidatePaths = getXuiPathCandidates(req.url).map((candidate) =>
        buildXuiPath(xuiTarget.basePath, candidate),
      );
      const method = req.method ?? 'GET';
      const receivedSetCookies: string[] = [];
      const reqHost = String(req.headers.host ?? '')
        .split(':')[0]
        .toLowerCase();
      const isLocalDevHost =
        reqHost === 'localhost' || reqHost === '127.0.0.1' || reqHost === '::1';
      const upstreamOrigin = `${xuiTarget.protocol}//${xuiTarget.hostHeader}`;
      const upstreamReferer = `${upstreamOrigin}${buildXuiPath(xuiTarget.basePath, '/panel/')}`;

      if (PROXY_DEBUG) {
        const hasCookie = Boolean((req.headers.cookie ?? '').trim());
        console.warn(`[ProxyDog] -> ${method} ${req.url} cookie=${hasCookie ? 'yes' : 'no'}`);
      }

      const baseHeaders: Record<string, string | string[]> = {
        ...(req.headers as Record<string, string | string[]>),
      };
      baseHeaders.host = xuiTarget.hostHeader;
      baseHeaders.origin = upstreamOrigin;
      baseHeaders.referer = upstreamReferer;
      if (!baseHeaders['x-requested-with']) {
        baseHeaders['x-requested-with'] = 'XMLHttpRequest';
      }
      delete baseHeaders['content-length'];
      delete baseHeaders['transfer-encoding'];
      delete baseHeaders['sec-fetch-site'];
      delete baseHeaders['sec-fetch-mode'];
      delete baseHeaders['sec-fetch-dest'];
      delete baseHeaders['sec-fetch-user'];
      delete baseHeaders['sec-ch-ua'];
      delete baseHeaders['sec-ch-ua-mobile'];
      delete baseHeaders['sec-ch-ua-platform'];
      if (body.length > 0) baseHeaders['content-length'] = String(body.length);

      const toCookieArray = (value: string | string[] | undefined) => {
        if (!value) return [] as string[];
        return Array.isArray(value) ? value : [value];
      };

      const rewriteCookieForClient = (cookie: string) => {
        let rewritten = cookie.replace(/;\s*Path=[^;]*/i, '; Path=/');
        if (isLocalDevHost) {
          // Local HTTP dev cannot use upstream domain-bound secure cookies.
          rewritten = rewritten.replace(/;\s*Domain=[^;]*/gi, '');
          rewritten = rewritten.replace(/;\s*Secure/gi, '');
          rewritten = rewritten.replace(/;\s*SameSite=None/gi, '; SameSite=Lax');
        }
        return rewritten;
      };

      const proxyAttempt = (
        targetPath: string,
        redirectsRemaining: number,
        candidateIndex: number,
      ) => {
        const requestOptions: any = {
          hostname: xuiTarget.hostname,
          port: xuiTarget.port,
          path: targetPath,
          method,
          headers: baseHeaders,
        };
        if (xuiTarget.protocol === 'https:') requestOptions.rejectUnauthorized = false;

        const proxyReq = requestFactory(requestOptions, (proxyRes) => {
          const statusCode = proxyRes.statusCode ?? 502;
          const location =
            typeof proxyRes.headers.location === 'string' ? proxyRes.headers.location : undefined;
          const contentType = String(proxyRes.headers['content-type'] ?? '');
          const setCookies = toCookieArray(
            proxyRes.headers['set-cookie'] as string | string[] | undefined,
          );
          if (setCookies.length > 0) receivedSetCookies.push(...setCookies);
          if (PROXY_DEBUG && req.url.startsWith('/login')) {
            console.warn(
              `[ProxyDog] <- ${method} ${req.url} status=${statusCode} set-cookie=${setCookies.length}`,
            );
          }

          if (REDIRECT_STATUS_CODES.has(statusCode) && location && redirectsRemaining > 0) {
            const redirectPath = resolveXuiRedirectPath(xuiTarget, location);
            if (redirectPath) {
              proxyRes.resume();
              const redirectedIndex = candidatePaths.indexOf(redirectPath);
              return proxyAttempt(
                redirectPath,
                redirectsRemaining - 1,
                redirectedIndex >= 0 ? redirectedIndex : candidateIndex,
              );
            }
          }

          if (statusCode === 404 && candidateIndex + 1 < candidatePaths.length) {
            if (PROXY_DEBUG) {
              console.warn(
                `[ProxyDog] 404 on ${targetPath}, retrying with ${candidatePaths[candidateIndex + 1]}`,
              );
            }
            proxyRes.resume();
            return proxyAttempt(
              candidatePaths[candidateIndex + 1],
              MAX_REDIRECTS,
              candidateIndex + 1,
            );
          }

          if (PROXY_DEBUG && statusCode >= 400) {
            console.warn(`[ProxyDog] ${method} ${req.url} => ${statusCode} via ${targetPath}`);
          }
          if (
            PROXY_DEBUG &&
            req.url.startsWith('/panel/api/') &&
            statusCode >= 200 &&
            statusCode < 400
          ) {
            if (!contentType.toLowerCase().includes('application/json')) {
              console.warn(
                `[ProxyDog] ${method} ${req.url} => ${statusCode} non-json content-type=${contentType}`,
              );
            } else {
              console.info(`[ProxyDog] ${method} ${req.url} => ${statusCode} json`);
            }
          }

          const headers = { ...proxyRes.headers };
          if (receivedSetCookies.length > 0) {
            headers['set-cookie'] = receivedSetCookies.map(rewriteCookieForClient);
          } else if (headers['set-cookie']) {
            headers['set-cookie'] = toCookieArray(
              headers['set-cookie'] as string | string[] | undefined,
            ).map(rewriteCookieForClient);
          }
          res.writeHead(statusCode, headers);
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err: Error) => {
          if (!res.headersSent) {
            res.status(502).json({ error: 'Upstream error', detail: err.message });
          }
        });

        if (body.length > 0) proxyReq.write(body);
        proxyReq.end();
      };

      proxyAttempt(candidatePaths[0], MAX_REDIRECTS, 0);
    });
  });
} else {
  console.warn('[ProxyDog] VITE_3XUI_SERVER is not set. /api proxy is disabled.');
}

// ── Serve React build in production ─────────────────────────────────────────
const distPath = path.resolve('./dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

createServer(app).listen(PORT, () => {
  console.log(`[ProxyDog] Server running on http://localhost:${PORT}`);
});
