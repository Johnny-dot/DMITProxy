import { Router } from 'express';
import { db, hashPassword, verifyPassword, generateToken, hashToken } from '../db.js';
import {
  cleanupProvisionedClient,
  fetchClientStatsBySubId,
  fetchServerStatusForPortal,
  provisionClientForRegisteredUser,
  type AutoProvisionedClient,
  XuiAdminError,
} from '../xui-admin.js';
import { getNodeQualityProfile } from '../node-quality.js';
import { probeAndStoreNodeQualityProfile } from '../node-quality-probe.js';
import { buildLegacyAppleSharedResource, parseStoredSharedResources } from '../shared-resources.js';
import { parseStoredCommunityLinks } from '../community-links.js';
import {
  ANNOUNCEMENT_CURRENT_CREATED_AT_KEY,
  ensureAnnouncementHistoryEntry,
  parseAnnouncementHistory,
} from '../announcement-history.js';
import {
  normalizeUserAvatarStyle,
  resolveUserDisplayName,
  sanitizeUserDisplayName,
} from '../user-profile.js';
import {
  getDefaultMarketAssetId,
  getMarketChart,
  getMarketSnapshot,
  isMarketAssetId,
  MarketDataError,
  refreshMarketData,
} from '../market-data.js';
import { getNewsFeed, refreshNewsFeed, fetchArticleContent, NewsFeedError } from '../news-data.js';

const router = Router();
const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const SESSION_COOKIE_NAME = 'pd_session';
const configuredCookieSecure = (process.env.COOKIE_SECURE ?? '').trim().toLowerCase();
const SESSION_COOKIE_SECURE =
  configuredCookieSecure === 'true'
    ? true
    : configuredCookieSecure === 'false'
      ? false
      : process.env.NODE_ENV === 'production';
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: SESSION_COOKIE_SECURE,
  maxAge: SESSION_TTL * 1000,
};
const SESSION_COOKIE_CLEAR_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: SESSION_COOKIE_SECURE,
};

interface UserSessionRow {
  user_id: number;
  username: string;
  role: string;
  sub_id: string | null;
  created_at: number;
  display_name: string;
  avatar_style: string;
}

const findActiveResetTokenStmt = db.prepare(`
  SELECT t.id, t.user_id, t.expires_at, u.username
  FROM password_reset_tokens t
  JOIN users u ON u.id = t.user_id
  WHERE t.token_hash = ?
    AND t.used_at IS NULL
    AND t.expires_at > unixepoch()
    AND u.role = 'user'
  LIMIT 1
`);

class InviteCodeUnavailableError extends Error {
  constructor() {
    super('Invalid or expired invite code');
    this.name = 'InviteCodeUnavailableError';
  }
}

// Consume the invite and create the local user atomically to avoid stranded invite rows.
const createRegisteredUserTx = db.transaction(
  (username: string, hash: string, salt: string, inviteCode: string) => {
    const result = db
      .prepare('INSERT INTO users (username, password_hash, salt, sub_id) VALUES (?, ?, ?, ?)')
      .run(username, hash, salt, null) as any;
    const userId = Number(result.lastInsertRowid);
    const inviteUpdate = db
      .prepare(
        `
        UPDATE invite_codes
        SET used_by = ?, used_at = unixepoch()
        WHERE code = ?
          AND used_by IS NULL
          AND used_at IS NULL
          AND (expires_at IS NULL OR expires_at > unixepoch())
      `,
      )
      .run(userId, inviteCode) as any;

    if (inviteUpdate.changes !== 1) {
      throw new InviteCodeUnavailableError();
    }

    return userId;
  },
);

const rollbackRegisteredUserTx = db.transaction((userId: number, inviteCode: string) => {
  db.prepare(
    'UPDATE invite_codes SET used_by = NULL, used_at = NULL WHERE code = ? AND used_by = ?',
  ).run(inviteCode, userId);
  db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(userId, 'user');
});

const attachProvisionedSubIdStmt = db.prepare(`
  UPDATE users
  SET sub_id = ?
  WHERE id = ?
    AND role = 'user'
`);

function isUniqueUsernameConstraintError(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed: users\.username/i.test(error.message);
}

function isInviteCodeUnavailableError(error: unknown): boolean {
  return error instanceof InviteCodeUnavailableError;
}

function getUserSession(token: string | undefined): UserSessionRow | null {
  if (!token) return null;
  const sessionTokenHash = hashToken(token);

  const session = db
    .prepare(
      `
      SELECT s.user_id, u.username, u.role, u.sub_id, u.created_at, u.display_name, u.avatar_style
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > unixepoch()
      LIMIT 1
    `,
    )
    .get(sessionTokenHash) as UserSessionRow | undefined;

  return session ?? null;
}

function hasCookie(rawCookies: Record<string, string> | undefined, cookieName: string): boolean {
  if (!rawCookies) return false;
  const normalizedCookieName = cookieName.toLowerCase();
  return Object.keys(rawCookies).some((name) => name.toLowerCase() === normalizedCookieName);
}

function hasXuiAdminCookie(rawCookies: Record<string, string> | undefined): boolean {
  return hasCookie(rawCookies, '3x-ui');
}

function hasUserSessionCookie(rawCookies: Record<string, string> | undefined): boolean {
  return hasCookie(rawCookies, SESSION_COOKIE_NAME);
}

function serializeUserSession(session: UserSessionRow) {
  return {
    id: session.user_id,
    username: session.username,
    displayName: resolveUserDisplayName(session.display_name, session.username),
    avatarStyle: normalizeUserAvatarStyle(session.avatar_style),
    role: session.role,
    subId: session.sub_id,
    createdAt: session.created_at,
  };
}

router.post('/register', async (req, res) => {
  const { username, password, inviteCode } = req.body ?? {};

  if (!username || !password || !inviteCode) {
    return res.status(400).json({ error: 'username, password and inviteCode are required' });
  }
  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'username >= 3 chars, password >= 6 chars' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  const { hash, salt } = hashPassword(password);

  let userId: number;
  try {
    userId = createRegisteredUserTx(username, hash, salt, inviteCode);
  } catch (error) {
    if (isUniqueUsernameConstraintError(error)) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    if (isInviteCodeUnavailableError(error)) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to create local user account' });
  }

  let provisionedClient: AutoProvisionedClient | null = null;
  try {
    provisionedClient = await provisionClientForRegisteredUser(username);
    if (provisionedClient?.subId) {
      const attachResult = attachProvisionedSubIdStmt.run(provisionedClient.subId, userId) as any;
      if (attachResult.changes !== 1) {
        throw new Error('Failed to attach provisioned 3X-UI client to local user');
      }
    }
  } catch (error) {
    if (provisionedClient) {
      try {
        await cleanupProvisionedClient(provisionedClient);
      } catch (cleanupError) {
        console.warn(
          '[Prism] Failed to clean up provisioned 3X-UI client after register error:',
          cleanupError,
        );
      }
    }

    rollbackRegisteredUserTx(userId, inviteCode);

    const message =
      error instanceof XuiAdminError
        ? error.message
        : provisionedClient
          ? 'Failed to finalize local user after provisioning 3X-UI client'
          : 'Failed to auto-create 3X-UI client';
    const status = error instanceof XuiAdminError ? 502 : 500;
    return res.status(status).json({ error: message });
  }

  return res.json({ ok: true, subId: provisionedClient?.subId ?? null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.role !== 'user') {
    return res.status(403).json({ error: 'Admin account must use /login (3X-UI admin panel).' });
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL;
  db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)').run(
    user.id,
    tokenHash,
    expiresAt,
  );

  res.cookie(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);

  return res.json({ ok: true, role: user.role });
});

router.post('/logout', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(hashToken(token));
  }
  res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_CLEAR_OPTIONS);
  return res.json({ ok: true });
});

router.post('/password-reset/verify', (req, res) => {
  const token = String(req.body?.token ?? '').trim();
  if (!token) {
    return res.status(400).json({ error: 'Reset token is required' });
  }

  const tokenRow = findActiveResetTokenStmt.get(hashToken(token)) as
    | { id: number; user_id: number; expires_at: number; username: string }
    | undefined;

  if (!tokenRow) {
    return res.status(400).json({ error: 'Reset link is invalid or expired' });
  }

  return res.json({
    ok: true,
    username: tokenRow.username,
    expiresAt: tokenRow.expires_at,
  });
});

router.post('/password-reset/confirm', (req, res) => {
  const token = String(req.body?.token ?? '').trim();
  const password = String(req.body?.password ?? '').trim();

  if (!token) {
    return res.status(400).json({ error: 'Reset token is required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const tokenRow = findActiveResetTokenStmt.get(hashToken(token)) as
    | { id: number; user_id: number; expires_at: number; username: string }
    | undefined;

  if (!tokenRow) {
    return res.status(400).json({ error: 'Reset link is invalid or expired' });
  }

  const { hash, salt } = hashPassword(password);
  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(
      hash,
      salt,
      tokenRow.user_id,
    );
    db.prepare('UPDATE password_reset_tokens SET used_at = unixepoch() WHERE id = ?').run(
      tokenRow.id,
    );
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ? AND id != ?').run(
      tokenRow.user_id,
      tokenRow.id,
    );
    // Force re-login on all devices after password change.
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(tokenRow.user_id);
  });

  tx();
  return res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const session = getUserSession(token);

  if (!session) {
    res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_CLEAR_OPTIONS);
    return res.status(401).json({ error: 'Session expired' });
  }

  return res.json(serializeUserSession(session));
});

router.get('/profile', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const session = getUserSession(token);
  if (!session) {
    res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_CLEAR_OPTIONS);
    return res.status(401).json({ error: 'Session expired' });
  }

  if (session.role !== 'user') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return res.json({
    username: session.username,
    displayName: sanitizeUserDisplayName(session.display_name),
    resolvedDisplayName: resolveUserDisplayName(session.display_name, session.username),
    avatarStyle: normalizeUserAvatarStyle(session.avatar_style),
  });
});

router.patch('/profile', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const session = getUserSession(token);
  if (!session) {
    res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_CLEAR_OPTIONS);
    return res.status(401).json({ error: 'Session expired' });
  }

  if (session.role !== 'user') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const displayName = sanitizeUserDisplayName(req.body?.displayName);
  const avatarStyle = normalizeUserAvatarStyle(req.body?.avatarStyle);

  db.prepare('UPDATE users SET display_name = ?, avatar_style = ? WHERE id = ? AND role = ?').run(
    displayName,
    avatarStyle,
    session.user_id,
    'user',
  );

  return res.json({
    ok: true,
    profile: {
      username: session.username,
      displayName,
      resolvedDisplayName: resolveUserDisplayName(displayName, session.username),
      avatarStyle,
    },
  });
});

router.get('/admin-session-hint', (req, res) => {
  return res.json({
    hasAdminCookie: hasXuiAdminCookie(req.cookies),
    hasUserSessionCookie: hasUserSessionCookie(req.cookies),
  });
});

router.get('/portal/context', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const session = getUserSession(token);

  if (!session) {
    res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_CLEAR_OPTIONS);
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (session.role !== 'user') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const settingsRows = db
    .prepare(
      `
      SELECT key, value, updated_at
      FROM app_settings
      WHERE key IN (
        'siteName',
        'publicUrl',
        'supportTelegram',
        'announcementText',
        'announcementActive',
        'announcementHistory',
        ?,
        'sharedResources',
        'communityLinks',
        'sharedAppleIdTitle',
        'sharedAppleIdContent',
        'sharedAppleIdActive'
      )
    `,
    )
    .all(ANNOUNCEMENT_CURRENT_CREATED_AT_KEY) as Array<{
    key: string;
    value: string;
    updated_at: number;
  }>;

  const settingsMap = new Map(settingsRows.map((row) => [row.key, row]));
  const siteName = settingsMap.get('siteName')?.value?.trim() || 'Prism';
  const publicUrl = settingsMap.get('publicUrl')?.value?.trim() || '';
  const supportTelegram = settingsMap.get('supportTelegram')?.value?.trim() || '';
  const announcementText = settingsMap.get('announcementText')?.value?.trim() || '';
  const announcementActiveRaw = settingsMap.get('announcementActive')?.value ?? '0';
  const announcementActive =
    announcementActiveRaw === '1' || announcementActiveRaw.toLowerCase() === 'true';
  const sharedResourcesRow = settingsMap.get('sharedResources')?.value;
  const sharedResources =
    sharedResourcesRow !== undefined
      ? parseStoredSharedResources(sharedResourcesRow)
      : buildLegacyAppleSharedResource(
          settingsMap.get('sharedAppleIdTitle')?.value?.trim() || '',
          settingsMap.get('sharedAppleIdContent')?.value?.trim() || '',
          (() => {
            const raw = settingsMap.get('sharedAppleIdActive')?.value ?? '0';
            return raw === '1' || raw.toLowerCase() === 'true';
          })(),
        );
  const communityLinks = parseStoredCommunityLinks(settingsMap.get('communityLinks')?.value);

  const notifications: Array<{
    id: string;
    level: 'info' | 'success' | 'warning';
    title: string;
    message: string;
    createdAt: number;
  }> = [];
  const userCreatedAt = session.created_at * 1000;
  const supportContactCreatedAt =
    (settingsMap.get('supportTelegram')?.updated_at ?? session.created_at) * 1000;
  const parsedCurrentAnnouncementCreatedAt = Number.parseInt(
    settingsMap.get(ANNOUNCEMENT_CURRENT_CREATED_AT_KEY)?.value ?? '',
    10,
  );
  const currentAnnouncementCreatedAt =
    Number.isFinite(parsedCurrentAnnouncementCreatedAt) && parsedCurrentAnnouncementCreatedAt > 0
      ? parsedCurrentAnnouncementCreatedAt
      : (settingsMap.get('announcementText')?.updated_at ?? session.created_at) * 1000;
  let announcementHistory = parseAnnouncementHistory(settingsMap.get('announcementHistory')?.value);

  if (announcementActive && announcementText) {
    announcementHistory = ensureAnnouncementHistoryEntry(
      announcementHistory,
      announcementText,
      currentAnnouncementCreatedAt,
    );
  }

  if (session.sub_id) {
    notifications.push({
      id: 'subscription-ready',
      level: 'success',
      title: 'Subscription ready',
      message: 'Your subscription link is active. You can import or update it in your client now.',
      createdAt: userCreatedAt,
    });
  } else {
    notifications.push({
      id: 'subscription-pending',
      level: 'warning',
      title: 'Subscription pending',
      message:
        'Your account exists, but subscription is not assigned yet. Please check Help for support details.',
      createdAt: userCreatedAt,
    });
  }

  for (const announcement of announcementHistory) {
    notifications.push({
      id: announcement.id,
      level: 'info',
      title: 'Admin announcement',
      message: announcement.message,
      createdAt: announcement.createdAt,
    });
  }

  if (supportTelegram) {
    notifications.push({
      id: 'support-contact',
      level: 'info',
      title: 'Support contact',
      message: `Need help? Contact support: ${supportTelegram}`,
      createdAt: supportContactCreatedAt,
    });
  }

  notifications.sort((left, right) => right.createdAt - left.createdAt);

  return res.json({
    user: {
      ...serializeUserSession(session),
    },
    settings: {
      siteName,
      publicUrl,
      supportTelegram,
      announcementText,
      announcementActive,
      sharedResources,
      communityLinks,
    },
    notifications,
  });
});

router.get('/portal/market', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const session = getUserSession(token);
  if (!session || session.role !== 'user') {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const snapshot = await getMarketSnapshot();
    return res.json({
      snapshot,
      defaultAssetId: getDefaultMarketAssetId(),
    });
  } catch (error) {
    if (error instanceof MarketDataError) {
      return res.status(error.status).json({ error: error.message });
    }
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(502).json({ error: `Failed to load market snapshot: ${detail}` });
  }
});

router.get('/portal/market/:assetId', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const session = getUserSession(token);
  if (!session || session.role !== 'user') {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const assetId = String(req.params.assetId ?? '').trim();
  if (!isMarketAssetId(assetId)) {
    return res.status(404).json({ error: 'Unknown market asset' });
  }

  try {
    const detail = await getMarketChart(assetId);
    return res.json({ detail });
  } catch (error) {
    if (error instanceof MarketDataError) {
      return res.status(error.status).json({ error: error.message });
    }
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(502).json({ error: `Failed to load market chart: ${detail}` });
  }
});

router.post('/portal/market/refresh', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const session = getUserSession(token);
  if (!session || session.role !== 'user') {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const rawAssetId = req.body?.assetId;
  const assetId =
    typeof rawAssetId === 'string' && rawAssetId.trim()
      ? rawAssetId.trim()
      : getDefaultMarketAssetId();
  if (!isMarketAssetId(assetId)) {
    return res.status(400).json({ error: 'Unknown market asset' });
  }

  try {
    const payload = await refreshMarketData(assetId);
    return res.json({ ok: true, ...payload });
  } catch (error) {
    if (error instanceof MarketDataError) {
      return res.status(error.status).json({ error: error.message });
    }
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(502).json({ error: `Failed to refresh market data: ${detail}` });
  }
});

router.get('/portal/news', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const session = getUserSession(token);
  if (!session || session.role !== 'user') {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const feed = await getNewsFeed();
    return res.json({ feed });
  } catch (error) {
    if (error instanceof NewsFeedError) {
      return res.status(error.status).json({ error: error.message });
    }
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(502).json({ error: `Failed to load news feed: ${detail}` });
  }
});

router.post('/portal/news/refresh', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const session = getUserSession(token);
  if (!session || session.role !== 'user') {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const payload = await refreshNewsFeed();
    return res.json({ ok: true, ...payload });
  } catch (error) {
    if (error instanceof NewsFeedError) {
      return res.status(error.status).json({ error: error.message });
    }
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(502).json({ error: `Failed to refresh news feed: ${detail}` });
  }
});

router.get('/portal/news/article-content', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const session = getUserSession(token);
  if (!session || session.role !== 'user') {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const url = typeof req.query.url === 'string' ? req.query.url.trim() : null;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const content = await fetchArticleContent(url);
    return res.json(content);
  } catch (error) {
    if (error instanceof NewsFeedError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(502).json({ error: 'Failed to fetch article content' });
  }
});

router.get('/portal/stats', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const session = getUserSession(token);
  if (!session || session.role !== 'user') {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const serverStatusPromise = fetchServerStatusForPortal().catch((error) => {
    console.error('[Prism] /portal/stats: fetchServerStatusForPortal failed:', error);
    return null;
  });

  try {
    if (!session.sub_id) {
      return res.json({
        stats: null,
        nodeQuality: null,
        serverStatus: await serverStatusPromise,
      });
    }

    const [stats, serverStatus] = await Promise.all([
      fetchClientStatsBySubId(session.sub_id),
      serverStatusPromise,
    ]);
    return res.json({
      stats,
      nodeQuality: stats ? getNodeQualityProfile(stats.inboundId) : null,
      serverStatus,
    });
  } catch (error) {
    console.error('[Prism] /portal/stats: fetchClientStatsBySubId failed:', error);
    return res.status(502).json({ error: 'Unable to fetch usage stats from upstream' });
  }
});

router.post('/portal/node-quality/refresh', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const session = getUserSession(token);
  if (!session || session.role !== 'user') {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!session.sub_id) {
    return res.status(400).json({ error: 'No subscription assigned yet' });
  }

  try {
    const stats = await fetchClientStatsBySubId(session.sub_id);
    if (!stats) {
      return res.status(404).json({ error: 'Unable to resolve current node stats' });
    }

    const nodeQuality = await probeAndStoreNodeQualityProfile(stats.inboundId, {
      preferredSubId: session.sub_id,
    });
    return res.json({ ok: true, stats, nodeQuality });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(502).json({ error: `Node quality probe failed: ${detail}` });
  }
});

export default router;
