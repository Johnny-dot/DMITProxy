import { Router, Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { dataDirectory, db, dbFilePath, generateToken, hashToken } from '../db.js';
import {
  buildXuiPath,
  getXuiPathCandidates,
  getXuiRequestFactory,
  getXuiTarget,
  resolveXuiRedirectPath,
  shouldSkipXuiTlsVerification,
} from '../xui.js';

const router = Router();
const xuiTarget = getXuiTarget();
const skipTlsVerification = shouldSkipXuiTlsVerification();
const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308]);
const MAX_REDIRECTS = 3;
const XUI_NOT_CONFIGURED_ERROR =
  '3X-UI admin capability is not configured. Set VITE_3XUI_SERVER and VITE_3XUI_BASE_PATH in .env.';
const configuredResetTtlSeconds = Number.parseInt(process.env.PASSWORD_RESET_TTL_SECONDS ?? '', 10);
const DEFAULT_RESET_TTL_SECONDS =
  Number.isFinite(configuredResetTtlSeconds) && configuredResetTtlSeconds > 0
    ? Math.max(5 * 60, Math.min(24 * 60 * 60, configuredResetTtlSeconds))
    : 30 * 60;

if (xuiTarget?.protocol === 'https:' && skipTlsVerification) {
  console.warn(
    '[Prism] WARNING: XUI_TLS_INSECURE_SKIP_VERIFY=true, admin upstream TLS verification disabled.',
  );
}

interface AppSettings {
  siteName: string;
  publicUrl: string;
  supportTelegram: string;
  announcementText: string;
  announcementActive: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  siteName: 'Prism Admin',
  publicUrl: '',
  supportTelegram: '',
  announcementText: '',
  announcementActive: false,
};

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof AppSettings>;

function parseBoolean(value: string): boolean {
  return value === '1' || value.toLowerCase() === 'true';
}

function sanitizeSettingsInput(input: unknown): Partial<AppSettings> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const payload = input as Record<string, unknown>;
  const normalized: Partial<AppSettings> = {};

  for (const key of SETTINGS_KEYS) {
    if (!(key in payload)) continue;
    if (key === 'announcementActive') {
      normalized.announcementActive = Boolean(payload.announcementActive);
      continue;
    }
    const raw = payload[key];
    normalized[key] = typeof raw === 'string' ? raw.trim() : '';
  }

  return normalized;
}

function getSettings(): AppSettings {
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as Array<{
    key: string;
    value: string;
  }>;
  const result: AppSettings = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    if (!SETTINGS_KEYS.includes(row.key as keyof AppSettings)) continue;
    if (row.key === 'announcementActive') {
      result.announcementActive = parseBoolean(row.value);
    } else {
      result[row.key as Exclude<keyof AppSettings, 'announcementActive'>] = row.value;
    }
  }

  return result;
}

function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const entries = Object.entries(partial) as Array<
    [keyof AppSettings, AppSettings[keyof AppSettings]]
  >;
  if (entries.length === 0) return getSettings();

  const stmt = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, unixepoch())
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  const tx = db.transaction(() => {
    for (const [key, value] of entries) {
      const stored = key === 'announcementActive' ? (value ? '1' : '0') : String(value);
      stmt.run(key, stored);
    }
  });

  tx();
  return getSettings();
}

// Verify admin by checking if requester has a valid 3X-UI session cookie
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!xuiTarget) return res.status(503).json({ error: XUI_NOT_CONFIGURED_ERROR });
  const cookie = req.headers.cookie ?? '';
  if (!cookie) return res.status(401).json({ error: 'Unauthorized' });

  const ok = await new Promise<boolean>((resolve) => {
    const requestFactory = getXuiRequestFactory(xuiTarget.protocol);
    const candidates = getXuiPathCandidates('/panel/api/server/status').map((candidate) =>
      buildXuiPath(xuiTarget.basePath, candidate),
    );
    const upstreamOrigin = `${xuiTarget.protocol}//${xuiTarget.hostHeader}`;
    const upstreamReferer = `${upstreamOrigin}${buildXuiPath(xuiTarget.basePath, '/panel/')}`;

    const checkAttempt = (
      targetPath: string,
      redirectsRemaining: number,
      candidateIndex: number,
    ) => {
      const opts: any = {
        hostname: xuiTarget.hostname,
        port: xuiTarget.port,
        path: targetPath,
        method: 'GET',
        headers: {
          Cookie: cookie,
          Host: xuiTarget.hostHeader,
          Origin: upstreamOrigin,
          Referer: upstreamReferer,
          'X-Requested-With': 'XMLHttpRequest',
        },
      };
      if (xuiTarget.protocol === 'https:' && skipTlsVerification) {
        opts.rejectUnauthorized = false;
      }

      const r = requestFactory(opts, (proxyRes) => {
        const statusCode = proxyRes.statusCode ?? 0;
        const location =
          typeof proxyRes.headers.location === 'string' ? proxyRes.headers.location : undefined;
        if (REDIRECT_STATUS_CODES.has(statusCode) && location && redirectsRemaining > 0) {
          const redirectPath = resolveXuiRedirectPath(xuiTarget, location);
          if (redirectPath) {
            proxyRes.resume();
            const redirectedIndex = candidates.indexOf(redirectPath);
            return checkAttempt(
              redirectPath,
              redirectsRemaining - 1,
              redirectedIndex >= 0 ? redirectedIndex : candidateIndex,
            );
          }
        }

        if (statusCode === 404 && candidateIndex + 1 < candidates.length) {
          proxyRes.resume();
          return checkAttempt(candidates[candidateIndex + 1], MAX_REDIRECTS, candidateIndex + 1);
        }

        let data = '';
        proxyRes.on('data', (c) => (data += c));
        proxyRes.on('end', () => {
          if (statusCode < 200 || statusCode >= 300) return resolve(false);
          try {
            resolve(JSON.parse(data).success === true);
          } catch {
            resolve(false);
          }
        });
      });
      r.on('error', () => {
        resolve(false);
      });
      r.end();
    };

    checkAttempt(candidates[0], MAX_REDIRECTS, 0);
  });

  if (!ok) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// GET /local/admin/invite — list all invite codes
router.get('/invite', requireAdmin, (_req, res) => {
  const codes = db
    .prepare(
      `
    SELECT i.id, i.code, i.used_at, i.expires_at, i.created_at,
           u.username as used_by_username
    FROM invite_codes i
    LEFT JOIN users u ON u.id = i.used_by
    ORDER BY i.created_at DESC
  `,
    )
    .all();
  res.json(codes);
});

// POST /local/admin/invite — create invite codes
router.post('/invite', requireAdmin, (req, res) => {
  const count = Math.min(parseInt(req.body?.count ?? '1'), 20);
  const expiresAt = req.body?.expiresAt
    ? Math.floor(new Date(req.body.expiresAt).getTime() / 1000)
    : null;

  const created: string[] = [];
  const stmt = db.prepare('INSERT INTO invite_codes (code, expires_at) VALUES (?, ?)');

  for (let i = 0; i < count; i++) {
    const code = generateToken().slice(0, 16);
    stmt.run(code, expiresAt);
    created.push(code);
  }

  res.json({ codes: created });
});

// DELETE /local/admin/invite/:id — delete unused invite code
router.delete('/invite/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM invite_codes WHERE id = ? AND used_by IS NULL').run(req.params.id);
  res.json({ ok: true });
});

// GET /local/admin/users — list all non-admin users
router.get('/users', requireAdmin, (_req, res) => {
  const users = db
    .prepare(
      `
    SELECT id, username, sub_id, role, created_at FROM users WHERE role = 'user' ORDER BY created_at DESC
  `,
    )
    .all();
  res.json(users);
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  const user = db
    .prepare('SELECT id, username, sub_id FROM users WHERE id = ? AND role = ?')
    .get(req.params.id, 'user') as
    | { id: number; username: string; sub_id: string | null }
    | undefined;

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM invite_codes WHERE used_by = ?').run(user.id);
    db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(user.id, 'user');
  });

  tx();

  return res.json({
    ok: true,
    username: user.username,
    subId: user.sub_id,
  });
});

router.get('/system', requireAdmin, (_req, res) => {
  const autoProvisionEnabled =
    (process.env.XUI_AUTO_CREATE_ON_REGISTER ?? 'false').toLowerCase() === 'true';
  const xuiUsername = process.env.XUI_ADMIN_USERNAME ?? '';
  const xuiPassword = process.env.XUI_ADMIN_PASSWORD ?? '';

  res.json({
    xuiAutoProvisionEnabled: autoProvisionEnabled,
    xuiAutoProvisionCredentialsConfigured: Boolean(xuiUsername && xuiPassword),
  });
});

router.get('/profile', requireAdmin, (_req, res) => {
  const username = process.env.XUI_ADMIN_USERNAME ?? '';

  res.json({
    username,
    role: 'admin',
    sessionMode: 'xui-cookie',
    xuiServer: process.env.VITE_3XUI_SERVER ?? '',
    xuiBasePath: process.env.VITE_3XUI_BASE_PATH ?? '',
  });
});

// PATCH /local/admin/users/:id — assign subId to a user
router.patch('/users/:id', requireAdmin, (req, res) => {
  const { subId } = req.body ?? {};
  db.prepare('UPDATE users SET sub_id = ? WHERE id = ? AND role = ?').run(
    subId ?? null,
    req.params.id,
    'user',
  );
  res.json({ ok: true });
});

router.post('/users/:id/password-reset', requireAdmin, (req, res) => {
  const user = db
    .prepare('SELECT id, username FROM users WHERE id = ? AND role = ?')
    .get(req.params.id, 'user') as { id: number; username: string } | undefined;
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const requestedTtlMinutes = Number(req.body?.ttlMinutes);
  const ttlSeconds = Number.isFinite(requestedTtlMinutes)
    ? Math.max(5 * 60, Math.min(24 * 60 * 60, Math.floor(requestedTtlMinutes * 60)))
    : DEFAULT_RESET_TTL_SECONDS;
  const token = generateToken();
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

  const tx = db.transaction(() => {
    db.prepare(
      'DELETE FROM password_reset_tokens WHERE expires_at <= unixepoch() OR used_at IS NOT NULL',
    ).run();
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL').run(
      user.id,
    );
    db.prepare(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    ).run(user.id, hashToken(token), expiresAt);
  });
  tx();

  res.json({
    ok: true,
    token,
    username: user.username,
    expiresAt,
    ttlSeconds,
  });
});

// GET /local/admin/settings - read panel settings
router.get('/settings', requireAdmin, (_req, res) => {
  res.json(getSettings());
});

// PUT /local/admin/settings - update panel settings
router.put('/settings', requireAdmin, (req, res) => {
  const updated = updateSettings(sanitizeSettingsInput(req.body));
  res.json({ ok: true, settings: updated });
});

// POST /local/admin/security/clear-sessions - clear all user portal sessions
router.post('/security/clear-sessions', requireAdmin, (_req, res) => {
  const result = db.prepare('DELETE FROM sessions').run() as { changes: number };
  res.json({ ok: true, cleared: result.changes ?? 0 });
});

// POST /local/admin/maintenance/backup - create a SQLite backup file
router.post('/maintenance/backup', requireAdmin, (_req, res) => {
  try {
    const backupDir = path.join(dataDirectory, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    db.pragma('wal_checkpoint(TRUNCATE)');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(backupDir, `prism-${stamp}.db`);
    fs.copyFileSync(dbFilePath, filePath);

    res.json({ ok: true, file: filePath });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Backup failed: ${detail}` });
  }
});

// POST /local/admin/maintenance/clear-traffic - placeholder action
router.post('/maintenance/clear-traffic', requireAdmin, (_req, res) => {
  res.status(501).json({ error: '3X-UI traffic reset is not exposed by this panel API path yet' });
});

export default router;
