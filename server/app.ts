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
import {
  buildXuiPath,
  getXuiPathCandidates,
  getXuiRequestFactory,
  shouldSkipXuiTlsVerification,
  getXuiTarget,
  resolveXuiRedirectPath,
} from './xui.js';
import { buildSubscriptionPayload } from './subscription-builder.js';
import { renderSubscription, SubconverterError, type SubFormat } from './subconverter-client.js';

const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308]);
const MAX_REDIRECTS = 3;
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

function toCookieArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
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
  app.set('trust proxy', 1);
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
  app.use('/local/downloads', downloadsRouter);
  app.use('/local/auth/login', authLimiter);
  app.use('/local/auth/register', authLimiter);
  app.use('/local/auth/password-reset', authLimiter);
  app.use('/local/auth/portal/market/refresh', refreshLimiter);
  app.use('/local/auth/portal/news/refresh', refreshLimiter);
  app.use('/local/auth/portal/node-quality/refresh', refreshLimiter);
  app.use('/local/auth', authRouter);
  app.use('/local/admin', adminLimiter, adminRouter);

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
  // 404 — `app.set('trust proxy', 1)` above means req.ip is the real client IP
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
      res.set('Content-Type', 'text/plain; charset=utf-8').send(base64Payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Prism] /sub/_raw build failed for ${subId}: ${message}`);
      res.status(502).send('Failed to build subscription.');
    }
  });

  // Loopback-only template endpoint. Subconverter fetches our minimal Clash
  // template from here (default: dmit-default.ini) instead of pulling a
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
    // Reject anything that isn't a plain ini filename to prevent path traversal.
    if (!/^[a-zA-Z0-9_-]+\.ini$/.test(name)) {
      res.status(400).send('Invalid template name');
      return;
    }
    const filePath = path.join(TEMPLATE_DIR, name);
    if (!fs.existsSync(filePath)) {
      res.status(404).send('Not found');
      return;
    }
    res.set('Content-Type', 'text/plain; charset=utf-8').sendFile(filePath);
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
      const port = process.env.SERVER_PORT ?? '3001';
      const rawSourceUrl = `http://127.0.0.1:${port}/sub/_raw/${encodeURIComponent(subId)}`;
      try {
        const result = await renderSubscription({ format, rawSourceUrl });
        res
          .set('Content-Type', result.contentType)
          .set('Content-Disposition', `attachment; filename="${result.filename}"`)
          .send(result.body);
      } catch (error) {
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
      res.set('Content-Type', 'text/plain; charset=utf-8').send(base64Payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Prism] Subscription build failed for ${subId}: ${message}`);
      res.status(502).send('Failed to build subscription.');
    }
  });

  // Proxy /api/* -> 3X-UI (used in both development and production)
  const xuiTarget = getXuiTarget();
  if (xuiTarget) {
    const requestFactory = getXuiRequestFactory(xuiTarget.protocol);
    const skipTlsVerification = shouldSkipXuiTlsVerification();
    if (xuiTarget.protocol === 'https:' && skipTlsVerification) {
      console.warn(
        '[Prism] WARNING: XUI_TLS_INSECURE_SKIP_VERIFY=true, TLS cert verification disabled.',
      );
    }

    app.use('/api', (req, res) => {
      const chunks: Buffer[] = [];
      let bodySize = 0;
      req.on('data', (chunk) => {
        const buffered = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bodySize += buffered.length;
        if (bodySize > MAX_PROXY_BODY_BYTES) {
          if (!res.headersSent) {
            res.status(413).json({
              error: `Request body too large (max ${Math.floor(MAX_PROXY_BODY_BYTES / (1024 * 1024))}MB)`,
            });
          }
          req.destroy();
          return;
        }
        chunks.push(buffered);
      });
      req.on('error', () => {
        if (!res.headersSent) res.status(400).json({ error: 'Invalid request body' });
      });
      req.on('end', () => {
        if (res.headersSent) return;

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
          console.warn(`[Prism] -> ${method} ${req.url} cookie=${hasCookie ? 'yes' : 'no'}`);
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
          if (xuiTarget.protocol === 'https:' && skipTlsVerification) {
            requestOptions.rejectUnauthorized = false;
          }

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
                `[Prism] <- ${method} ${req.url} status=${statusCode} set-cookie=${setCookies.length}`,
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
                  `[Prism] 404 on ${targetPath}, retrying with ${candidatePaths[candidateIndex + 1]}`,
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
              console.warn(`[Prism] ${method} ${req.url} => ${statusCode} via ${targetPath}`);
            }
            if (
              PROXY_DEBUG &&
              req.url.startsWith('/panel/api/') &&
              statusCode >= 200 &&
              statusCode < 400
            ) {
              if (!contentType.toLowerCase().includes('application/json')) {
                console.warn(
                  `[Prism] ${method} ${req.url} => ${statusCode} non-json content-type=${contentType}`,
                );
              } else {
                console.info(`[Prism] ${method} ${req.url} => ${statusCode} json`);
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
    console.warn('[Prism] VITE_3XUI_SERVER is not set. /api proxy is disabled.');
    app.use('/api', (_req, res) => {
      res.status(503).json({ error: XUI_NOT_CONFIGURED_ERROR });
    });
  }

  // Serve React build in production
  const distPath = path.resolve('./dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  return app;
}
