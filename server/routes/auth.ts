import { Router } from 'express';
import { db, hashPassword, verifyPassword, generateToken, hashToken } from '../db.js';
import { autoProvisionClientForRegisteredUser, XuiAdminError } from '../xui-admin.js';

const router = Router();
const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

interface UserSessionRow {
  user_id: number;
  username: string;
  role: string;
  sub_id: string | null;
  created_at: number;
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

function getUserSession(token: string | undefined): UserSessionRow | null {
  if (!token) return null;

  const session = db
    .prepare(
      `
      SELECT s.user_id, u.username, u.role, u.sub_id, u.created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > unixepoch()
      LIMIT 1
    `,
    )
    .get(token) as UserSessionRow | undefined;

  return session ?? null;
}

router.post('/register', async (req, res) => {
  const { username, password, inviteCode } = req.body ?? {};

  if (!username || !password || !inviteCode) {
    return res.status(400).json({ error: 'username, password and inviteCode are required' });
  }
  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'username >= 3 chars, password >= 6 chars' });
  }

  const invite = db
    .prepare(
      'SELECT * FROM invite_codes WHERE code = ? AND used_by IS NULL AND (expires_at IS NULL OR expires_at > unixepoch())',
    )
    .get(inviteCode) as any;

  if (!invite) {
    return res.status(400).json({ error: 'Invalid or expired invite code' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  let subId: string | null = null;
  try {
    subId = await autoProvisionClientForRegisteredUser(username);
  } catch (error) {
    const message =
      error instanceof XuiAdminError ? error.message : 'Failed to auto-create 3X-UI client';
    return res.status(502).json({ error: message });
  }

  const { hash, salt } = hashPassword(password);

  try {
    const result = db
      .prepare('INSERT INTO users (username, password_hash, salt, sub_id) VALUES (?, ?, ?, ?)')
      .run(username, hash, salt, subId) as any;

    db.prepare('UPDATE invite_codes SET used_by = ?, used_at = unixepoch() WHERE id = ?').run(
      result.lastInsertRowid,
      invite.id,
    );
  } catch {
    return res.status(500).json({ error: 'Failed to create local user account' });
  }

  return res.json({ ok: true, subId });
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
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL;
  db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)').run(
    user.id,
    token,
    expiresAt,
  );

  res.cookie('pd_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL * 1000,
  });

  return res.json({ ok: true, role: user.role });
});

router.post('/logout', (req, res) => {
  const token = req.cookies?.pd_session;
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.clearCookie('pd_session');
  return res.json({ ok: true });
});

router.get('/password-reset/verify', (req, res) => {
  const token = String(req.query?.token ?? '').trim();
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
  const token = req.cookies?.pd_session;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const session = getUserSession(token);

  if (!session) {
    res.clearCookie('pd_session');
    return res.status(401).json({ error: 'Session expired' });
  }

  return res.json({
    id: session.user_id,
    username: session.username,
    role: session.role,
    subId: session.sub_id,
  });
});

router.get('/portal/context', (req, res) => {
  const token = req.cookies?.pd_session;
  const session = getUserSession(token);

  if (!session) {
    res.clearCookie('pd_session');
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
      WHERE key IN ('siteName', 'publicUrl', 'supportTelegram', 'announcementText', 'announcementActive')
    `,
    )
    .all() as Array<{ key: string; value: string; updated_at: number }>;

  const settingsMap = new Map(settingsRows.map((row) => [row.key, row]));
  const siteName = settingsMap.get('siteName')?.value?.trim() || 'ProxyDog';
  const publicUrl = settingsMap.get('publicUrl')?.value?.trim() || '';
  const supportTelegram = settingsMap.get('supportTelegram')?.value?.trim() || '';
  const announcementText = settingsMap.get('announcementText')?.value?.trim() || '';
  const announcementActiveRaw = settingsMap.get('announcementActive')?.value ?? '0';
  const announcementActive =
    announcementActiveRaw === '1' || announcementActiveRaw.toLowerCase() === 'true';

  const now = Date.now();
  const notifications: Array<{
    id: string;
    level: 'info' | 'success' | 'warning';
    title: string;
    message: string;
    createdAt: number;
  }> = [];

  if (session.sub_id) {
    notifications.push({
      id: 'subscription-ready',
      level: 'success',
      title: 'Subscription ready',
      message: 'Your subscription link is active. You can import or update it in your client now.',
      createdAt: now,
    });
  } else {
    notifications.push({
      id: 'subscription-pending',
      level: 'warning',
      title: 'Subscription pending',
      message:
        'Your account exists, but subscription is not assigned yet. Please contact your admin.',
      createdAt: now,
    });
  }

  if (announcementActive && announcementText) {
    notifications.push({
      id: 'admin-announcement',
      level: 'info',
      title: 'Admin announcement',
      message: announcementText,
      createdAt: (settingsMap.get('announcementText')?.updated_at ?? now / 1000) * 1000,
    });
  }

  if (supportTelegram) {
    notifications.push({
      id: 'support-contact',
      level: 'info',
      title: 'Support contact',
      message: `Need help? Contact support: ${supportTelegram}`,
      createdAt: now,
    });
  }

  return res.json({
    user: {
      id: session.user_id,
      username: session.username,
      role: session.role,
      subId: session.sub_id,
      createdAt: session.created_at,
    },
    settings: {
      siteName,
      publicUrl,
      supportTelegram,
      announcementText,
      announcementActive,
    },
    notifications,
  });
});

export default router;
