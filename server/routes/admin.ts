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
import { type NodeQualityProfile, getNodeQualityProfiles } from '../node-quality.js';
import { probeAndStoreNodeQualityProfile } from '../node-quality-probe.js';
import {
  type SharedResource,
  buildLegacyAppleSharedResource,
  parseStoredSharedResources,
  sanitizeSharedResourcesInput,
} from '../shared-resources.js';
import {
  type CommunityLink,
  parseStoredCommunityLinks,
  sanitizeCommunityLinksInput,
} from '../community-links.js';
import {
  ANNOUNCEMENT_CURRENT_CREATED_AT_KEY,
  ANNOUNCEMENT_HISTORY_KEY,
  appendAnnouncementHistoryEntry,
  buildAnnouncementNotificationId,
  ensureAnnouncementHistoryEntry,
  type AnnouncementHistoryEntry,
  parseAnnouncementHistory,
  removeAnnouncementHistoryEntry,
} from '../announcement-history.js';
import { clearBillingDay, listBillingConfigs, setBillingDay } from '../xui-billing.js';

const router = Router();
const xuiTarget = getXuiTarget();
const skipTlsVerification = shouldSkipXuiTlsVerification();
const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308]);
const MAX_REDIRECTS = 3;
const ADMIN_VERIFY_CACHE_TTL_MS = 10_000; // cache positive results for 10 seconds
const adminVerifyCache = new Map<string, { ok: boolean; expiresAt: number }>();
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
  sharedResources: SharedResource[];
  communityLinks: CommunityLink[];
}

interface StoredAppSettingRow {
  value: string;
  updated_at: number;
}

interface AnnouncementState {
  announcementText: string;
  announcementActive: boolean;
  announcementCreatedAt: number | null;
  announcementId: string | null;
  history: AnnouncementHistoryEntry[];
}

interface AdminAnnouncement {
  id: string;
  message: string;
  createdAt: number;
  isActive: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  siteName: 'Prism Admin',
  publicUrl: '',
  supportTelegram: '',
  announcementText: '',
  announcementActive: false,
  sharedResources: [],
  communityLinks: [],
};

const SETTINGS_KEYS: Array<keyof AppSettings> = [
  'siteName',
  'publicUrl',
  'supportTelegram',
  'announcementText',
  'announcementActive',
  'sharedResources',
  'communityLinks',
];

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
    if (key === 'sharedResources') {
      normalized.sharedResources = sanitizeSharedResourcesInput(payload.sharedResources);
      continue;
    }
    if (key === 'communityLinks') {
      normalized.communityLinks = sanitizeCommunityLinksInput(payload.communityLinks);
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
  const legacySharedAppleIdTitle =
    rows.find((row) => row.key === 'sharedAppleIdTitle')?.value ?? '';
  const legacySharedAppleIdContent =
    rows.find((row) => row.key === 'sharedAppleIdContent')?.value ?? '';
  const legacySharedAppleIdActiveRaw =
    rows.find((row) => row.key === 'sharedAppleIdActive')?.value ?? '0';
  const hasStoredSharedResources = rows.some((row) => row.key === 'sharedResources');

  for (const row of rows) {
    if (!SETTINGS_KEYS.includes(row.key as keyof AppSettings)) continue;
    if (row.key === 'announcementActive') {
      result.announcementActive = parseBoolean(row.value);
    } else if (row.key === 'sharedResources') {
      result.sharedResources = parseStoredSharedResources(row.value);
    } else if (row.key === 'communityLinks') {
      result.communityLinks = parseStoredCommunityLinks(row.value);
    } else {
      result[
        row.key as Exclude<
          keyof AppSettings,
          'announcementActive' | 'sharedResources' | 'communityLinks'
        >
      ] = row.value as never;
    }
  }

  if (!hasStoredSharedResources) {
    result.sharedResources = buildLegacyAppleSharedResource(
      legacySharedAppleIdTitle,
      legacySharedAppleIdContent,
      parseBoolean(legacySharedAppleIdActiveRaw),
    );
  }

  return result;
}

interface AnnouncementUpdate {
  nextText: string | undefined;
  nextCreatedAt: number | null;
  nextHistory: AnnouncementHistoryEntry[] | null;
}

function computeAnnouncementUpdate(
  partial: Partial<AppSettings>,
  currentText: string,
  currentCreatedAt: number,
  currentHistoryRaw: string | undefined,
  nowMs: number,
): AnnouncementUpdate {
  const nextText =
    partial.announcementText !== undefined ? String(partial.announcementText).trim() : undefined;

  const nextCreatedAt =
    nextText === undefined
      ? null
      : !nextText
        ? null
        : nextText === currentText
          ? currentCreatedAt
          : nowMs;

  const nextHistory =
    nextText !== undefined
      ? (() => {
          const existingHistory = parseAnnouncementHistory(currentHistoryRaw);
          const seededHistory = currentText
            ? ensureAnnouncementHistoryEntry(existingHistory, currentText, currentCreatedAt)
            : existingHistory;
          if (!nextText || nextText === currentText) return seededHistory;
          return appendAnnouncementHistoryEntry(seededHistory, nextText, nowMs);
        })()
      : null;

  return { nextText, nextCreatedAt, nextHistory };
}

function readCurrentAnnouncementState(updatedAtSeconds: number): {
  currentText: string;
  currentCreatedAt: number;
  currentHistoryRaw: string | undefined;
} {
  const announcementRow = db
    .prepare('SELECT value, updated_at FROM app_settings WHERE key = ?')
    .get('announcementText') as { value: string; updated_at: number } | undefined;
  const createdAtRow = db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(ANNOUNCEMENT_CURRENT_CREATED_AT_KEY) as { value: string } | undefined;
  const historyRow = db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(ANNOUNCEMENT_HISTORY_KEY) as { value: string } | undefined;

  const currentText = announcementRow?.value?.trim() ?? '';
  const parsed = Number.parseInt(createdAtRow?.value ?? '', 10);
  const currentCreatedAt =
    Number.isFinite(parsed) && parsed > 0
      ? parsed
      : (announcementRow?.updated_at ?? updatedAtSeconds) * 1000;

  return { currentText, currentCreatedAt, currentHistoryRaw: historyRow?.value };
}

function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const entries = Object.entries(partial) as Array<
    [keyof AppSettings, AppSettings[keyof AppSettings]]
  >;
  if (entries.length === 0) return getSettings();

  const updatedAtMs = Date.now();
  const updatedAtSeconds = Math.floor(updatedAtMs / 1000);

  const { currentText, currentCreatedAt, currentHistoryRaw } =
    readCurrentAnnouncementState(updatedAtSeconds);
  const { nextText, nextCreatedAt, nextHistory } = computeAnnouncementUpdate(
    partial,
    currentText,
    currentCreatedAt,
    currentHistoryRaw,
    updatedAtMs,
  );

  const stmt = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  const tx = db.transaction(() => {
    for (const [key, value] of entries) {
      const storedUpdatedAtSeconds =
        key === 'announcementText' && nextText !== undefined && nextCreatedAt
          ? Math.floor(nextCreatedAt / 1000)
          : updatedAtSeconds;
      const stored =
        key === 'announcementActive'
          ? value
            ? '1'
            : '0'
          : key === 'sharedResources' || key === 'communityLinks'
            ? JSON.stringify(value)
            : String(value);
      stmt.run(key, stored, storedUpdatedAtSeconds);
    }

    if (nextHistory !== null) {
      stmt.run(ANNOUNCEMENT_HISTORY_KEY, JSON.stringify(nextHistory), updatedAtSeconds);
      stmt.run(
        ANNOUNCEMENT_CURRENT_CREATED_AT_KEY,
        nextCreatedAt ? String(nextCreatedAt) : '',
        updatedAtSeconds,
      );
    }
  });

  tx();
  return getSettings();
}

const upsertAppSettingStmt = db.prepare(`
  INSERT INTO app_settings (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

function writeAppSetting(key: string, value: string, updatedAtSeconds: number) {
  upsertAppSettingStmt.run(key, value, updatedAtSeconds);
}

function readAnnouncementState(): AnnouncementState {
  const rows = db
    .prepare(
      `
      SELECT key, value, updated_at
      FROM app_settings
      WHERE key IN ('announcementText', 'announcementActive', ?, ?)
    `,
    )
    .all(ANNOUNCEMENT_HISTORY_KEY, ANNOUNCEMENT_CURRENT_CREATED_AT_KEY) as Array<{
    key: string;
    value: string;
    updated_at: number;
  }>;

  const announcementTextRow = rows.find((row) => row.key === 'announcementText') as
    | StoredAppSettingRow
    | undefined;
  const announcementActiveRow = rows.find((row) => row.key === 'announcementActive') as
    | StoredAppSettingRow
    | undefined;
  const announcementHistoryRow = rows.find((row) => row.key === ANNOUNCEMENT_HISTORY_KEY) as
    | StoredAppSettingRow
    | undefined;
  const announcementCurrentCreatedAtRow = rows.find(
    (row) => row.key === ANNOUNCEMENT_CURRENT_CREATED_AT_KEY,
  ) as StoredAppSettingRow | undefined;

  const announcementText = announcementTextRow?.value?.trim() ?? '';
  const announcementActive = parseBoolean(announcementActiveRow?.value ?? '0');
  const parsedAnnouncementCreatedAt = Number.parseInt(
    announcementCurrentCreatedAtRow?.value ?? '',
    10,
  );
  const announcementCreatedAt = announcementText
    ? Number.isFinite(parsedAnnouncementCreatedAt) && parsedAnnouncementCreatedAt > 0
      ? parsedAnnouncementCreatedAt
      : announcementTextRow
        ? announcementTextRow.updated_at * 1000
        : null
    : null;
  const seededHistory =
    announcementText && announcementCreatedAt !== null
      ? ensureAnnouncementHistoryEntry(
          parseAnnouncementHistory(announcementHistoryRow?.value),
          announcementText,
          announcementCreatedAt,
        )
      : parseAnnouncementHistory(announcementHistoryRow?.value);

  return {
    announcementText,
    announcementActive,
    announcementCreatedAt,
    announcementId:
      announcementText && announcementCreatedAt !== null
        ? buildAnnouncementNotificationId(announcementCreatedAt)
        : null,
    history: seededHistory,
  };
}

function serializeAdminAnnouncements(state: AnnouncementState): AdminAnnouncement[] {
  return state.history.map((entry) => ({
    id: entry.id,
    message: entry.message,
    createdAt: entry.createdAt,
    isActive: state.announcementActive && entry.id === state.announcementId,
  }));
}

function persistAnnouncementState(state: {
  announcementText: string;
  announcementActive: boolean;
  announcementCreatedAt: number | null;
  history: AnnouncementHistoryEntry[];
}) {
  const normalizedHistory = state.history;
  const persistedAtSeconds = Math.floor(Date.now() / 1000);
  const tx = db.transaction(() => {
    writeAppSetting(
      ANNOUNCEMENT_HISTORY_KEY,
      JSON.stringify(normalizedHistory),
      persistedAtSeconds,
    );
    writeAppSetting('announcementActive', state.announcementActive ? '1' : '0', persistedAtSeconds);
    writeAppSetting(
      ANNOUNCEMENT_CURRENT_CREATED_AT_KEY,
      state.announcementCreatedAt ? String(state.announcementCreatedAt) : '',
      persistedAtSeconds,
    );

    if (state.announcementText && state.announcementCreatedAt !== null) {
      writeAppSetting(
        'announcementText',
        state.announcementText,
        Math.floor(state.announcementCreatedAt / 1000),
      );
      return;
    }

    writeAppSetting('announcementText', '', persistedAtSeconds);
  });

  tx();
}

// Verify admin by checking if requester has a valid 3X-UI session cookie
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!xuiTarget) return res.status(503).json({ error: XUI_NOT_CONFIGURED_ERROR });
  const cookie = req.headers.cookie ?? '';
  if (!cookie) return res.status(401).json({ error: 'Unauthorized' });

  const now = Date.now();
  const cached = adminVerifyCache.get(cookie);
  if (cached && cached.expiresAt > now) {
    if (!cached.ok) return res.status(401).json({ error: 'Unauthorized' });
    return next();
  }

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

  adminVerifyCache.set(cookie, { ok, expiresAt: now + ADMIN_VERIFY_CACHE_TTL_MS });
  if (!ok) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// GET /local/admin/invite — list invite codes (most recent first, max 500)
router.get('/invite', requireAdmin, (_req, res) => {
  const codes = db
    .prepare(
      `
    SELECT i.id, i.code, i.used_at, i.expires_at, i.created_at,
           u.username as used_by_username
    FROM invite_codes i
    LEFT JOIN users u ON u.id = i.used_by
    ORDER BY i.created_at DESC
    LIMIT 500
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
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid invite id' });
  }
  db.prepare('DELETE FROM invite_codes WHERE id = ? AND used_by IS NULL').run(id);
  return res.json({ ok: true });
});

// GET /local/admin/users — list non-admin users (most recent first, max 500)
router.get('/users', requireAdmin, (_req, res) => {
  const users = db
    .prepare(
      `
    SELECT id, username, sub_id, role, created_at FROM users WHERE role = 'user' ORDER BY created_at DESC LIMIT 500
  `,
    )
    .all();
  res.json(users);
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const user = db
    .prepare('SELECT id, username, sub_id FROM users WHERE id = ? AND role = ?')
    .get(id, 'user') as { id: number; username: string; sub_id: string | null } | undefined;

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
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  const { subId } = req.body ?? {};
  db.prepare('UPDATE users SET sub_id = ? WHERE id = ? AND role = ?').run(
    subId ?? null,
    id,
    'user',
  );
  return res.json({ ok: true });
});

router.post('/users/:id/password-reset', requireAdmin, (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  const user = db
    .prepare('SELECT id, username FROM users WHERE id = ? AND role = ?')
    .get(id, 'user') as { id: number; username: string } | undefined;
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
      'DELETE FROM password_reset_tokens WHERE expires_at <= unixepoch() OR used_at IS NOT NULL OR (user_id = ? AND used_at IS NULL)',
    ).run(user.id);
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

router.get('/announcements', requireAdmin, (_req, res) => {
  res.json({ announcements: serializeAdminAnnouncements(readAnnouncementState()) });
});

router.post('/announcements', requireAdmin, (req, res) => {
  const message = String(req.body?.message ?? '').trim();
  if (!message) {
    return res.status(400).json({ error: 'Announcement message is required' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Announcement message must be 2000 characters or less' });
  }

  const nextCreatedAt = Date.now();
  const current = readAnnouncementState();
  const nextHistory = appendAnnouncementHistoryEntry(current.history, message, nextCreatedAt);

  persistAnnouncementState({
    announcementText: message,
    announcementActive: true,
    announcementCreatedAt: nextCreatedAt,
    history: nextHistory,
  });

  return res.json({
    ok: true,
    announcements: serializeAdminAnnouncements(readAnnouncementState()),
  });
});

router.delete('/announcements/:id', requireAdmin, (req, res) => {
  const targetId = String(req.params.id ?? '').trim();
  if (!targetId) {
    return res.status(400).json({ error: 'Announcement id is required' });
  }

  const current = readAnnouncementState();
  const existing = current.history.find((entry) => entry.id === targetId);
  if (!existing) {
    return res.status(404).json({ error: 'Announcement not found' });
  }

  const nextHistory = removeAnnouncementHistoryEntry(current.history, targetId);
  const deletingCurrentAnnouncement = current.announcementId === targetId;
  const fallbackAnnouncement = nextHistory[0] ?? null;

  persistAnnouncementState({
    announcementText: deletingCurrentAnnouncement
      ? current.announcementActive
        ? (fallbackAnnouncement?.message ?? '')
        : ''
      : current.announcementText,
    announcementActive: deletingCurrentAnnouncement
      ? current.announcementActive
        ? Boolean(fallbackAnnouncement)
        : false
      : current.announcementActive,
    announcementCreatedAt: deletingCurrentAnnouncement
      ? current.announcementActive
        ? (fallbackAnnouncement?.createdAt ?? null)
        : null
      : current.announcementCreatedAt,
    history: nextHistory,
  });

  return res.json({
    ok: true,
    announcements: serializeAdminAnnouncements(readAnnouncementState()),
  });
});

router.get('/node-quality', requireAdmin, (_req, res) => {
  res.json({ profiles: getNodeQualityProfiles() });
});

router.post('/node-quality/:inboundId/refresh', requireAdmin, async (req, res) => {
  const inboundId = Number.parseInt(req.params.inboundId, 10);
  if (!Number.isFinite(inboundId) || inboundId <= 0) {
    return res.status(400).json({ error: 'Invalid inbound id' });
  }

  try {
    const profile = await probeAndStoreNodeQualityProfile(inboundId);
    return res.json({ ok: true, profile });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(502).json({ error: `Node quality probe failed: ${detail}` });
  }
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

// GET /local/admin/xui-inbounds-billing - list per-inbound billing-day configs
router.get('/xui-inbounds-billing', requireAdmin, (_req, res) => {
  res.json({ configs: listBillingConfigs() });
});

// PUT /local/admin/xui-inbounds/:id/billing-day - set or clear billing day
router.put('/xui-inbounds/:id/billing-day', requireAdmin, (req, res) => {
  const inboundId = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(inboundId) || inboundId <= 0) {
    return res.status(400).json({ error: 'Invalid inbound id' });
  }
  const raw = (req.body as { billingDay?: unknown } | undefined)?.billingDay;
  if (raw === null || raw === undefined || raw === '') {
    clearBillingDay(inboundId);
    return res.json({ ok: true, billingDay: null });
  }
  const day = Number(raw);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return res.status(400).json({ error: 'billingDay must be an integer between 1 and 31' });
  }
  try {
    setBillingDay(inboundId, day);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error';
    return res.status(400).json({ error: detail });
  }
  return res.json({ ok: true, billingDay: day });
});

export default router;
