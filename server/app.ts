import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
  app.use('/local/auth', authRouter);
  app.use('/local/admin', adminRouter);

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
