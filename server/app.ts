import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import downloadsRouter from './routes/downloads.js';
import dmitRouter from './routes/dmit.js';
import { getServerVersion } from './app-version.js';
import { buildXuiPath, getXuiTarget } from './xui.js';
import { buildSubscriptionPayload } from './subscription-builder.js';
import { renderSubscription, SubconverterError, type SubFormat } from './subconverter-client.js';
import { buildPublicSubscriptionSourceUrl } from './subscription-source-url.js';
import { buildSubscriptionUserinfoHeader } from './subscription-userinfo.js';
import { fetchClientStatsBySubId } from './xui-admin.js';
import { buildSubscriptionProfileTitleHeader } from './subscription-profile.js';
import { ClashInlineRenderError, renderClashInlineSubscription } from './clash-inline.js';
import { renderSingboxInlineSubscription, SingboxInlineRenderError } from './singbox-inline.js';
import { requestXuiTransport, stripHopByHopHeaders, XuiTransportError } from './xui-transport.js';

const XUI_NOT_CONFIGURED_ERROR =
  '3X-UI admin capability is not configured. Set VITE_3XUI_SERVER and VITE_3XUI_BASE_PATH in .env.';

function toBoundedPositiveInt(
  rawValue: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function parseCorsOrigins(rawValue: string | undefined): string[] {
  if (!rawValue) return [];
  const origins = rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(origins));
}

async function setSubscriptionUserinfoHeader(res: express.Response, subId: string) {
  try {
    const usage = await fetchClientStatsBySubId(subId);
    const userinfo = buildSubscriptionUserinfoHeader(usage);
    if (userinfo) res.set('subscription-userinfo', userinfo);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[Prism] subscription-userinfo unavailable: ${message}`);
  }
}

function setSubscriptionProfileHeaders(res: express.Response, subId: string) {
  res.set('profile-title', buildSubscriptionProfileTitleHeader('Prism'));
  res.set(
    'profile-web-page-url',
    buildPublicSubscriptionSourceUrl(subId) ?? `/sub/${encodeURIComponent(subId)}`,
  );
}

function buildLoopbackRawSubscriptionSourceUrl(subId: string): string {
  const port = process.env.SERVER_PORT ?? '3001';
  return `http://127.0.0.1:${port}/sub/_raw/${encodeURIComponent(subId)}`;
}

export function createApp() {
  const app = express();
  const PROXY_DEBUG = (process.env.PROXY_DEBUG ?? 'false').toLowerCase() === 'true';
  const configuredProxyMaxBodyMb = Number.parseInt(process.env.PROXY_MAX_BODY_MB ?? '', 10);
  const MAX_PROXY_BODY_BYTES =
    Number.isFinite(configuredProxyMaxBodyMb) && configuredProxyMaxBodyMb > 0
      ? configuredProxyMaxBodyMb * 1024 * 1024
      : 2 * 1024 * 1024;
  const localJsonLimitMb = toBoundedPositiveInt(process.env.LOCAL_JSON_LIMIT_MB, 1, 1, 20);
  const authRateLimitWindowMs = toBoundedPositiveInt(
    process.env.AUTH_RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000,
    10 * 1000,
    24 * 60 * 60 * 1000,
  );
  const authRateLimitMax = toBoundedPositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 20, 1, 10_000);

  app.disable('x-powered-by');
  const trustedProxy = (process.env.TRUST_PROXY ?? 'loopback').trim();
  app.set(
    'trust proxy',
    trustedProxy === 'false'
      ? false
      : trustedProxy
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
  );
  app.use(compression());
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
  if (corsOrigins.length > 0) {
    const allowedOrigins = new Set(corsOrigins);
    app.use(
      cors({
        origin(origin, callback) {
          if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
      }),
    );
  }

  const authLimiter = rateLimit({
    windowMs: authRateLimitWindowMs,
    max: authRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth attempts. Please retry later.' },
  });

  // Limit expensive refresh endpoints: 10 per user per minute
  const refreshLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const cookie = req.headers.cookie ?? '';
      const match = cookie.match(/pd_session=([^;]+)/);
      return match ? match[1] : ipKeyGenerator(req.ip ?? 'unknown');
    },
    message: { error: 'Too many refresh requests. Please wait a moment.' },
  });

  // Admin endpoints: caps abuse without disrupting normal dashboard polling.
  // Each admin verify hits the upstream 3X-UI panel (cached for 10s),
  // so this also protects the upstream from credential-spray attempts.
  const adminLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 240,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many admin requests. Please wait a moment.' },
  });

  // Cookie parser (manual, no deps)
  app.use((req, _res, next) => {
    const raw = req.headers.cookie ?? '';
    const cookies: Record<string, string> = {};
    for (const segment of raw.split(';')) {
      const trimmed = segment.trim();
      if (!trimmed) continue;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) continue;

      const name = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (!name) continue;

      cookies[name] = value;
    }

    (req as any).cookies = cookies;
    next();
  });

  app.use('/local', express.json({ limit: `${localJsonLimitMb}mb` }));
  app.use('/local/auth', (req, res, next) => {
    delete req.headers['if-none-match'];
    delete req.headers['if-modified-since'];
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    next();
  });
  app.use('/local/downloads', downloadsRouter);
  app.use('/local/auth/login', authLimiter);
  app.use('/local/auth/register', authLimiter);
  app.use('/local/auth/password-reset', authLimiter);
  app.use('/api', (req, res, next) => {
    try {
      const pathname = decodeURIComponent(req.path).replace(/\/+$/, '').toLowerCase();
      if (/(^|\/)login$/.test(pathname)) return authLimiter(req, res, next);
    } catch {
      return res.status(400).json({ error: 'Invalid request path' });
    }
    next();
  });
  app.use('/local/auth/portal/node-quality/refresh', refreshLimiter);
  app.use('/local/auth', authRouter);
  app.use('/local/admin', adminLimiter, adminRouter);
  app.use(
    '/local/dmit',
    cors({ origin: ['https://www.dmit.io'], methods: ['POST'], credentials: false }),
    dmitRouter,
  );

  // Public version probe: returns the git commit this process was LAUNCHED from (frozen at
  // startup). The deploy script asserts this equals the just-pulled HEAD so a stale/orphan
  // process holding the port can no longer make a deploy silently "succeed" against old code.
  app.get('/local/version', (_req, res) => {
    res.json(getServerVersion());
  });

  // Subscription format conversion: fetch from upstream, convert to Clash YAML etc.
  const subLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many subscription requests. Please wait a moment.',
  });

  // Loopback-only raw payload endpoint. Subconverter (running on 127.0.0.1:25500)
  // calls this to fetch the source v2ray-format subscription. Public callers get
  // 404 — req.ip only honors headers from the configured trusted proxies
  // via X-Forwarded-For when behind nginx, so non-loopback addresses won't match.
  // Skips subLimiter so localhost calls don't compete with public traffic for the
  // shared bucket.
  app.get('/sub/_raw/:subId', async (req, res) => {
    const remoteIp = req.ip ?? '';
    const isLoopback =
      remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';
    if (!isLoopback) {
      res.status(404).send('Not found');
      return;
    }
    const { subId } = req.params;
    if (!subId) {
      res.status(400).send('Missing subscription ID.');
      return;
    }
    try {
      const payload = await buildSubscriptionPayload(subId);
      const base64Payload = Buffer.from(payload).toString('base64');
      await setSubscriptionUserinfoHeader(res, subId);
      setSubscriptionProfileHeaders(res, subId);
      res.set('Content-Type', 'text/plain; charset=utf-8').send(base64Payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Prism] /sub/_raw build failed for ${subId}: ${message}`);
      res.status(502).send('Failed to build subscription.');
    }
  });

  // Loopback-only template endpoint. Subconverter fetches our minimal Clash
  // template from here (default: dmit-default.toml) instead of pulling a
  // community template (e.g. ACL4SSR_Online_Full) — that one assumes nodes
  // carry region tags in their names and would route most traffic to empty
  // regional sub-groups when our nodes (named after 3X-UI client emails)
  // don't match its filters. Templates live under server/templates/.
  const TEMPLATE_DIR = path.resolve('./server/templates');
  app.get('/sub/_template/:name', (req, res) => {
    const remoteIp = req.ip ?? '';
    const isLoopback =
      remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';
    if (!isLoopback) {
      res.status(404).send('Not found');
      return;
    }
    const { name } = req.params;
    // Reject anything that isn't a plain ini/toml filename to prevent path traversal.
    if (!/^[a-zA-Z0-9_-]+\.(ini|toml)$/.test(name)) {
      res.status(400).send('Invalid template name');
      return;
    }
    const filePath = path.join(TEMPLATE_DIR, name);
    if (!fs.existsSync(filePath)) {
      res.status(404).send('Not found');
      return;
    }
    // Read + send explicitly as text/plain. Otherwise res.sendFile() may pick
    // up application/toml from the .toml extension via mime sniffing, which
    // some subconverter builds reject when fetching an external config URL.
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.set('Content-Type', 'text/plain; charset=utf-8').send(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Prism] /sub/_template/${name} read failed: ${message}`);
      res.status(500).send('Failed to read template');
    }
  });

  const FORMAT_FLAG_MAP: Record<string, SubFormat> = {
    clash: 'clash',
    'sing-box': 'singbox',
    surge: 'surge',
  };

  app.get('/sub/:subId', subLimiter, async (req, res) => {
    const { subId } = req.params;
    const flag = String(req.query.flag ?? '').toLowerCase();

    if (!subId) {
      res.status(400).send('Missing subscription ID.');
      return;
    }

    const format = FORMAT_FLAG_MAP[flag];
    if (format) {
      try {
        await setSubscriptionUserinfoHeader(res, subId);
        setSubscriptionProfileHeaders(res, subId);

        if (format === 'clash') {
          const payload = await buildSubscriptionPayload(subId);
          const body = renderClashInlineSubscription(payload);
          res
            .set('Content-Type', 'text/yaml; charset=utf-8')
            .set('Content-Disposition', 'attachment; filename="clash-config.yaml"')
            .send(body);
          return;
        }

        if (format === 'singbox') {
          const payload = await buildSubscriptionPayload(subId);
          const body = renderSingboxInlineSubscription(payload);
          res
            .set('Content-Type', 'application/json; charset=utf-8')
            .set('Content-Disposition', 'attachment; filename="sing-box-config.json"')
            .send(body);
          return;
        }

        const rawSourceUrl = buildLoopbackRawSubscriptionSourceUrl(subId);
        const result = await renderSubscription({ format, rawSourceUrl });
        res
          .set('Content-Type', result.contentType)
          .set('Content-Disposition', `attachment; filename="${result.filename}"`)
          .send(result.body);
      } catch (error) {
        if (error instanceof ClashInlineRenderError) {
          console.error(`[Prism] inline Clash render failed for ${subId}: ${error.message}`);
          res.status(502).send('Subscription conversion failed.');
          return;
        }
        if (error instanceof SingboxInlineRenderError) {
          console.error(`[Prism] inline sing-box render failed for ${subId}: ${error.message}`);
          res.status(502).send('Subscription conversion failed.');
          return;
        }
        if (error instanceof SubconverterError) {
          console.error(`[Prism] subconverter ${format} failed for ${subId}: ${error.message}`);
          res.status(502).send('Subscription conversion failed.');
          return;
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Prism] /sub/${subId}?flag=${flag} unexpected error: ${message}`);
        res.status(502).send('Failed to build subscription.');
      }
      return;
    }

    // Fallback for v2ray / universal clients: base64-encoded protocol links.
    try {
      const payload = await buildSubscriptionPayload(subId);
      const base64Payload = Buffer.from(payload).toString('base64');
      await setSubscriptionUserinfoHeader(res, subId);
      setSubscriptionProfileHeaders(res, subId);
      res.set('Content-Type', 'text/plain; charset=utf-8').send(base64Payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Prism] Subscription build failed for ${subId}: ${message}`);
      res.status(502).send('Failed to build subscription.');
    }
  });

  // Browser credentials are forwarded as supplied; service credentials are never injected here.
  const xuiTarget = getXuiTarget();
  if (xuiTarget) {
    app.use('/api', (req, res) => {
      const chunks: Buffer[] = [];
      let bodySize = 0;
      const controller = new AbortController();
      const disconnect = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.once('close', disconnect);
      req.once('aborted', () => controller.abort());
      req.on('data', (chunk) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bodySize += buffer.length;
        if (bodySize > MAX_PROXY_BODY_BYTES) {
          if (!res.headersSent) res.status(413).json({ error: 'Request body too large' });
          req.destroy();
          return;
        }
        chunks.push(buffer);
      });
      req.on('error', () => {
        if (!res.headersSent && !res.destroyed)
          res.status(400).json({ error: 'Invalid request body' });
      });
      req.on('end', async () => {
        if (res.headersSent || res.destroyed) return;
        try {
          const origin = `${xuiTarget.protocol}//${xuiTarget.hostHeader}`;
          const headers: Record<string, string | string[]> = {
            ...(req.headers as Record<string, string | string[]>),
            host: xuiTarget.hostHeader,
            origin,
            referer: `${origin}${buildXuiPath(xuiTarget.basePath, '/panel/')}`,
            'x-requested-with': 'XMLHttpRequest',
          };
          for (const key of [
            'sec-fetch-site',
            'sec-fetch-mode',
            'sec-fetch-dest',
            'sec-fetch-user',
            'sec-ch-ua',
            'sec-ch-ua-mobile',
            'sec-ch-ua-platform',
          ])
            delete headers[key];
          const response = await requestXuiTransport({
            target: xuiTarget,
            path: req.url,
            method: req.method,
            headers,
            body: Buffer.concat(chunks),
            signal: controller.signal,
          });
          if (res.destroyed) return;
          const resultHeaders = stripHopByHopHeaders(response.headers);
          const hostname = req.hostname.toLowerCase();
          const local =
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '[::1]' ||
            hostname === '::1';
          if (response.cookies.length)
            resultHeaders['set-cookie'] = response.cookies.map((cookie) => {
              let value = cookie.replace(/;\s*Path=[^;]*/i, '; Path=/');
              if (local)
                value = value
                  .replace(/;\s*Domain=[^;]*/gi, '')
                  .replace(/;\s*Secure/gi, '')
                  .replace(/;\s*SameSite=None/gi, '; SameSite=Lax');
              return value;
            });
          if (PROXY_DEBUG)
            console.info(`[Prism] 3X-UI proxy ${req.method} status=${response.status}`);
          res.writeHead(response.status, resultHeaders);
          res.end(response.body);
        } catch (error) {
          if (!res.headersSent && !res.destroyed)
            res
              .status(error instanceof XuiTransportError && error.code === 'timeout' ? 504 : 502)
              .json({
                error: 'Upstream request failed',
                detail: error instanceof Error ? error.message : 'Unknown error',
              });
        } finally {
          res.off('close', disconnect);
        }
      });
    });
  } else {
    console.warn('[Prism] VITE_3XUI_SERVER is not set. /api proxy is disabled.');
    app.use('/api', (_req, res) => res.status(503).json({ error: XUI_NOT_CONFIGURED_ERROR }));
  }

  // Serve React build in production
  const distPath = path.resolve('./dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  return app;
}
