import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { chromium, type ConsoleMessage, type Locator, type Page } from 'playwright';

type SqliteDb = Database.Database;
type ViewportName = 'desktop' | 'mobile';

interface Options {
  baseUrl: string;
  dataDir: string;
  artifactDir: string;
  headed: boolean;
  slowMo: number;
  timeoutMs: number;
}

interface Scenario {
  inviteCode: string;
  username: string;
  password: string;
  subId: string;
}

interface CheckResult {
  name: string;
  url: string;
  viewport: ViewportName;
  language: 'zh-CN' | 'en-US';
  status: 'passed' | 'failed';
  screenshot: string | null;
  note?: string;
  error?: string;
}

interface CapturedConsoleMessage {
  type: string;
  text: string;
  location?: {
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
}

interface CapturedNetworkIssue {
  url: string;
  method: string;
  status: number;
}

const VIEWPORTS: Record<ViewportName, { width: number; height: number }> = {
  desktop: { width: 1440, height: 960 },
  mobile: { width: 390, height: 844 },
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    baseUrl: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
    dataDir: path.resolve(process.env.DATA_DIR ?? './data'),
    artifactDir: path.resolve(process.env.PLAYWRIGHT_ARTIFACT_DIR ?? './output/playwright'),
    headed: false,
    slowMo: 0,
    timeoutMs: 30_000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--headed') {
      options.headed = true;
      continue;
    }
    if (arg === '--base-url' && argv[index + 1]) {
      options.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--data-dir' && argv[index + 1]) {
      options.dataDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--artifact-dir' && argv[index + 1]) {
      options.artifactDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--slow-mo' && argv[index + 1]) {
      options.slowMo = Number.parseInt(argv[index + 1] ?? '0', 10) || 0;
      index += 1;
      continue;
    }
    if (arg === '--timeout-ms' && argv[index + 1]) {
      options.timeoutMs = Number.parseInt(argv[index + 1] ?? '0', 10) || options.timeoutMs;
      index += 1;
    }
  }

  options.baseUrl = options.baseUrl.replace(/\/+$/, '');
  return options;
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createDb(dbPath: string): SqliteDb {
  ensureDir(path.dirname(dbPath));

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      sub_id TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      used_by INTEGER REFERENCES users(id),
      used_at INTEGER,
      expires_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  return db;
}

function buildScenario(): Scenario {
  const suffix = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  return {
    inviteCode: `pw-${randomBytes(6).toString('hex')}`,
    username: `pw_${suffix}`,
    password: `Pw_${randomBytes(6).toString('hex')}!123`,
    subId: `sub-${randomBytes(8).toString('hex')}`,
  };
}

function seedInvite(db: SqliteDb, inviteCode: string) {
  db.prepare('INSERT INTO invite_codes (code) VALUES (?)').run(inviteCode);
}

async function waitForUser(db: SqliteDb, username: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const user = db
      .prepare('SELECT id, username, sub_id FROM users WHERE username = ? LIMIT 1')
      .get(username) as { id: number; username: string; sub_id: string | null } | undefined;

    if (user) return user;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for user creation: ${username}`);
}

function assignSubId(db: SqliteDb, username: string, subId: string) {
  const result = db.prepare('UPDATE users SET sub_id = ? WHERE username = ?').run(subId, username);
  if ((result.changes ?? 0) !== 1) {
    throw new Error(`Failed to assign subId for ${username}`);
  }
}

function sanitizeName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-');
}

async function waitForVisible(locator: Locator, timeoutMs: number) {
  await locator.waitFor({ state: 'visible', timeout: timeoutMs });
}

async function expectTextContains(locator: Locator, expected: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const current = (await locator.textContent())?.trim() ?? '';
    if (current.includes(expected)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const actual = (await locator.textContent())?.trim() ?? '';
  throw new Error(`Expected text to include "${expected}", got "${actual}"`);
}

async function waitForIdle(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 200));
}

async function assertDocumentLanguage(page: Page, expected: 'zh-CN' | 'en-US', timeoutMs: number) {
  await page.waitForFunction((language) => document.documentElement.lang === language, expected, {
    timeout: timeoutMs,
  });
}

async function assertNoHorizontalOverflow(page: Page, maxOverflowPx = 4) {
  const overflow = await page.evaluate(() => {
    const docOverflow = document.documentElement.scrollWidth - window.innerWidth;
    const bodyOverflow = document.body ? document.body.scrollWidth - window.innerWidth : 0;
    return Math.max(docOverflow, bodyOverflow, 0);
  });

  if (overflow > maxOverflowPx) {
    throw new Error(`Detected horizontal overflow of ${overflow}px`);
  }
}

async function openPage(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForIdle(page);
}

async function setStableClientState(page: Page, language: 'zh-CN' | 'en-US' = 'zh-CN') {
  await page.addInitScript((selectedLanguage) => {
    if (!window.localStorage.getItem('proxydog:lang')) {
      window.localStorage.setItem('proxydog:lang', selectedLanguage);
    }
    if (!window.localStorage.getItem('proxydog-theme')) {
      window.localStorage.setItem('proxydog-theme', 'dark');
    }
  }, language);
}

async function setClientLanguage(page: Page, language: 'zh-CN' | 'en-US') {
  if (!/^https?:/i.test(page.url())) return;
  await page.evaluate((selectedLanguage) => {
    window.localStorage.setItem('proxydog:lang', selectedLanguage);
  }, language);
}

async function setViewport(page: Page, viewport: ViewportName) {
  await page.setViewportSize(VIEWPORTS[viewport]);
}

async function captureStep(page: Page, dirPath: string, step: string) {
  const filePath = path.join(dirPath, `${step}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function openRegister(page: Page, baseUrl: string, inviteCode: string, stepDir: string) {
  await openPage(page, `${baseUrl}/register?invite=${encodeURIComponent(inviteCode)}`);
  await waitForVisible(page.getByTestId('register-page'), 15_000);
  await captureStep(page, stepDir, '01-register-page');
}

async function completeRegistration(page: Page, scenario: Scenario, stepDir: string) {
  await page.getByTestId('register-invite').fill(scenario.inviteCode);
  await page.getByTestId('register-username').fill(scenario.username);
  await page.getByTestId('register-password').fill(scenario.password);

  await Promise.all([
    page.waitForURL(/\/my-subscription(?:\?|$)/, { timeout: 20_000 }),
    page.getByTestId('register-submit').click(),
  ]);

  await waitForIdle(page);
  await captureStep(page, stepDir, '02-after-register');
}

async function verifyHome(
  page: Page,
  username: string,
  timeoutMs: number,
  viewport: ViewportName = 'desktop',
) {
  await waitForVisible(page.getByTestId('my-subscription-page'), timeoutMs);
  await waitForVisible(page.getByTestId('subscription-home-account-status'), timeoutMs);
  await waitForVisible(page.getByTestId('subscription-home-status'), timeoutMs);
  await waitForVisible(page.getByTestId('subscription-home-admin-messages'), timeoutMs);
  await waitForVisible(page.getByTestId('navbar-theme-toggle'), timeoutMs);
  if (viewport === 'desktop') {
    await waitForVisible(page.getByTestId('sidebar-user-my-subscription'), timeoutMs);
    await waitForVisible(page.getByTestId('sidebar-user-display-name'), timeoutMs);
    await waitForVisible(page.getByTestId('navbar-signout'), timeoutMs);
  } else {
    await waitForVisible(page.getByTestId('navbar-language-toggle-mobile'), timeoutMs);
    await waitForVisible(page.getByTestId('navbar-signout-mobile'), timeoutMs);
  }
  await expectTextContains(
    page.getByTestId('subscription-home-account-status'),
    username,
    timeoutMs,
  );
}

async function verifySubscriptionPending(page: Page, timeoutMs: number) {
  await page.getByTestId('my-subscription-tab-subscription').click();
  await waitForIdle(page);
  await waitForVisible(page.getByTestId('subscription-tab'), timeoutMs);
  await waitForVisible(page.getByTestId('subscription-not-ready'), timeoutMs);
}

async function verifySubscriptionReady(
  page: Page,
  baseUrl: string,
  subId: string,
  timeoutMs: number,
) {
  await openPage(page, `${baseUrl}/my-subscription?section=subscription`);
  await waitForVisible(page.getByTestId('subscription-tab'), timeoutMs);
  await waitForVisible(page.getByTestId('subscription-active-url'), timeoutMs);
  await waitForVisible(page.getByTestId('subscription-downloads-section'), timeoutMs);
  await waitForVisible(page.getByTestId('subscription-guide-section'), timeoutMs);
  await waitForVisible(page.getByTestId('subscription-troubleshooting-section'), timeoutMs);
  await expectTextContains(page.getByTestId('subscription-active-url'), subId, timeoutMs);
}

async function verifyNotifications(page: Page, timeoutMs: number) {
  await page.getByTestId('my-subscription-tab-notifications').click();
  await waitForIdle(page);
  await waitForVisible(page.getByTestId('subscription-notifications'), timeoutMs);
  const count = await page.getByTestId('subscription-notification-item').count();
  if (count < 1) {
    throw new Error('Expected at least one notification item to render');
  }
  return count;
}

async function logout(page: Page, timeoutMs: number, viewport: ViewportName = 'desktop') {
  const buttonTestId = viewport === 'desktop' ? 'navbar-signout' : 'navbar-signout-mobile';
  await Promise.all([
    page.waitForURL(/\/login(?:\?|$)/, { timeout: timeoutMs }),
    page.getByTestId(buttonTestId).click(),
  ]);
  await waitForVisible(page.getByTestId('login-page'), timeoutMs);
  await waitForIdle(page);
}

async function loginAgain(page: Page, scenario: Scenario, timeoutMs: number) {
  await page.getByTestId('login-username').fill(scenario.username);
  await page.getByTestId('login-password').fill(scenario.password);

  await Promise.all([
    page.waitForURL(/\/my-subscription(?:\?|$)/, { timeout: timeoutMs }),
    page.getByTestId('login-submit').click(),
  ]);

  await waitForIdle(page);
}

function isExpectedConsoleObservation(message: CapturedConsoleMessage) {
  const text = message.text.toLowerCase();
  const locationUrl = message.location?.url?.toLowerCase() ?? '';
  return (
    text.includes('401') &&
    (text.includes('/local/auth/me') || locationUrl.includes('/local/auth/me'))
  );
}

function isExpectedNetworkObservation(issue: CapturedNetworkIssue) {
  const url = issue.url.toLowerCase();
  return issue.status === 401 && url.includes('/local/auth/me');
}

function toCapturedConsoleMessage(message: ConsoleMessage): CapturedConsoleMessage {
  const location = message.location();
  return {
    type: message.type(),
    text: message.text(),
    location: location.url
      ? {
          url: location.url,
          lineNumber: location.lineNumber,
          columnNumber: location.columnNumber,
        }
      : undefined,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dbPath = path.join(options.dataDir, 'proxydog.db');
  const runDir = path.join(options.artifactDir, sanitizeName(runStamp));
  const stepDir = path.join(runDir, 'steps');
  const tracePath = path.join(runDir, 'site-display-audit-trace.zip');
  const summaryPath = path.join(runDir, 'summary.json');
  const consolePath = path.join(runDir, 'console.json');
  const networkPath = path.join(runDir, 'network.json');
  const errorsPath = path.join(runDir, 'page-errors.json');

  ensureDir(stepDir);

  const db = createDb(dbPath);
  const scenario = buildScenario();
  seedInvite(db, scenario.inviteCode);

  const consoleMessages: CapturedConsoleMessage[] = [];
  const networkIssues: CapturedNetworkIssue[] = [];
  const pageErrors: string[] = [];
  const checks: CheckResult[] = [];
  let stepIndex = 0;

  console.log(`[playwright] baseUrl=${options.baseUrl}`);
  console.log(`[playwright] dataDir=${options.dataDir}`);
  console.log(`[playwright] runDir=${runDir}`);
  console.log(`[playwright] inviteCode=${scenario.inviteCode}`);
  console.log(`[playwright] username=${scenario.username}`);

  const browser = await chromium.launch({
    headless: !options.headed,
    slowMo: options.slowMo,
  });

  const context = await browser.newContext({
    viewport: VIEWPORTS.desktop,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(options.timeoutMs);
  page.on('console', (message) => {
    consoleMessages.push(toCapturedConsoleMessage(message));
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    networkIssues.push({
      url: response.url(),
      method: response.request().method(),
      status: response.status(),
    });
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  await setStableClientState(page, 'zh-CN');
  await context.tracing.start({ screenshots: true, snapshots: true });

  const runCheck = async (
    name: string,
    viewport: ViewportName,
    language: 'zh-CN' | 'en-US',
    url: string,
    slug: string,
    action: () => Promise<string | void>,
  ) => {
    try {
      const noteResult = await action();
      const note = typeof noteResult === 'string' ? noteResult : undefined;
      await assertDocumentLanguage(page, language, 5_000);
      await assertNoHorizontalOverflow(page);
      stepIndex += 1;
      const screenshot = await captureStep(
        page,
        stepDir,
        `${String(stepIndex).padStart(2, '0')}-${viewport}-${language === 'zh-CN' ? 'zh' : 'en'}-${slug}`,
      );
      checks.push({ name, url, viewport, language, status: 'passed', screenshot, note });
    } catch (error) {
      stepIndex += 1;
      const screenshot = await captureStep(
        page,
        stepDir,
        `${String(stepIndex).padStart(2, '0')}-${viewport}-${language === 'zh-CN' ? 'zh' : 'en'}-${slug}-failed`,
      ).catch(() => null);
      checks.push({
        name,
        url,
        viewport,
        language,
        status: 'failed',
        screenshot,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  try {
    await runCheck(
      'Public login page renders correctly',
      'desktop',
      'zh-CN',
      `${options.baseUrl}/login`,
      'login-public',
      async () => {
        await setViewport(page, 'desktop');
        await setClientLanguage(page, 'zh-CN');
        await openPage(page, `${options.baseUrl}/login`);
        await waitForVisible(page.getByTestId('login-page'), options.timeoutMs);
        await waitForVisible(page.getByTestId('login-username'), options.timeoutMs);
        await waitForVisible(page.getByTestId('login-password'), options.timeoutMs);
        await waitForVisible(page.getByTestId('login-submit'), options.timeoutMs);
        await waitForVisible(page.getByTestId('public-language-toggle'), options.timeoutMs);
        await waitForVisible(page.getByTestId('public-theme-toggle'), options.timeoutMs);
        await waitForVisible(page.getByTestId('login-reset-link'), options.timeoutMs);
        await page.getByTestId('public-language-toggle').click();
        await assertDocumentLanguage(page, 'en-US', options.timeoutMs);
        await page.getByTestId('public-language-toggle').click();
        return 'Verified login form, language switch, theme toggle, and reset link.';
      },
    );

    await runCheck(
      'Public register page renders correctly',
      'desktop',
      'zh-CN',
      `${options.baseUrl}/register?invite=${encodeURIComponent(scenario.inviteCode)}`,
      'register-public',
      async () => {
        await openPage(
          page,
          `${options.baseUrl}/register?invite=${encodeURIComponent(scenario.inviteCode)}`,
        );
        await waitForVisible(page.getByTestId('register-page'), options.timeoutMs);
        await waitForVisible(page.getByTestId('register-invite'), options.timeoutMs);
        await waitForVisible(page.getByTestId('register-username'), options.timeoutMs);
        await waitForVisible(page.getByTestId('register-password'), options.timeoutMs);
        await waitForVisible(page.getByTestId('register-submit'), options.timeoutMs);
        await waitForVisible(page.getByTestId('register-login-link'), options.timeoutMs);
        await waitForVisible(page.getByTestId('public-language-toggle'), options.timeoutMs);
        await waitForVisible(page.getByTestId('public-theme-toggle'), options.timeoutMs);
      },
    );

    await runCheck(
      'Reset password page renders validation state correctly',
      'desktop',
      'zh-CN',
      `${options.baseUrl}/reset-password`,
      'reset-password-public',
      async () => {
        await openPage(page, `${options.baseUrl}/reset-password`);
        await waitForVisible(page.getByTestId('reset-password-page'), options.timeoutMs);
        await waitForVisible(page.getByTestId('reset-password-invalid'), options.timeoutMs);
        await waitForVisible(page.getByTestId('reset-password-back-login'), options.timeoutMs);
        await waitForVisible(page.getByTestId('public-language-toggle'), options.timeoutMs);
        await waitForVisible(page.getByTestId('public-theme-toggle'), options.timeoutMs);
      },
    );

    await runCheck(
      'Register flow lands on user overview',
      'desktop',
      'zh-CN',
      `${options.baseUrl}/my-subscription`,
      'register-submit-home',
      async () => {
        await openPage(
          page,
          `${options.baseUrl}/register?invite=${encodeURIComponent(scenario.inviteCode)}`,
        );
        await page.getByTestId('register-invite').fill(scenario.inviteCode);
        await page.getByTestId('register-username').fill(scenario.username);
        await page.getByTestId('register-password').fill(scenario.password);
        await Promise.all([
          page.waitForURL(/\/my-subscription(?:\?|$)/, { timeout: options.timeoutMs }),
          page.getByTestId('register-submit').click(),
        ]);
        await waitForIdle(page);
        await verifyHome(page, scenario.username, options.timeoutMs, 'desktop');
      },
    );

    await runCheck(
      'Legacy /portal redirects to /my-subscription',
      'desktop',
      'zh-CN',
      `${options.baseUrl}/portal`,
      'portal-redirect',
      async () => {
        await openPage(page, `${options.baseUrl}/portal`);
        await page.waitForURL(/\/my-subscription(?:\?|$)/, { timeout: options.timeoutMs });
        await verifyHome(page, scenario.username, options.timeoutMs, 'desktop');
      },
    );

    await runCheck(
      'Subscription pending state renders correctly',
      'desktop',
      'zh-CN',
      `${options.baseUrl}/my-subscription?section=subscription`,
      'subscription-pending',
      async () => {
        await verifySubscriptionPending(page, options.timeoutMs);
      },
    );

    await runCheck(
      'Notifications page renders correctly',
      'desktop',
      'zh-CN',
      `${options.baseUrl}/my-subscription?section=notifications`,
      'notifications-zh',
      async () => {
        const count = await verifyNotifications(page, options.timeoutMs);
        return `${count} notification item(s) visible`;
      },
    );

    await waitForUser(db, scenario.username, options.timeoutMs);
    assignSubId(db, scenario.username, scenario.subId);

    await runCheck(
      'Assigned subscription renders active content correctly',
      'desktop',
      'zh-CN',
      `${options.baseUrl}/my-subscription?section=subscription`,
      'subscription-ready',
      async () => {
        await verifySubscriptionReady(page, options.baseUrl, scenario.subId, options.timeoutMs);
      },
    );

    await runCheck(
      'Logout returns to login page',
      'desktop',
      'zh-CN',
      `${options.baseUrl}/login`,
      'logout-zh',
      async () => {
        await logout(page, options.timeoutMs, 'desktop');
        await waitForVisible(page.getByTestId('login-page'), options.timeoutMs);
      },
    );

    await runCheck(
      'Re-login restores user overview correctly',
      'desktop',
      'zh-CN',
      `${options.baseUrl}/my-subscription`,
      'relogin-home',
      async () => {
        await loginAgain(page, scenario, options.timeoutMs);
        await verifyHome(page, scenario.username, options.timeoutMs, 'desktop');
      },
    );

    await runCheck(
      'English overview spot-check renders correctly',
      'desktop',
      'en-US',
      `${options.baseUrl}/my-subscription`,
      'overview-en',
      async () => {
        await page.getByTestId('navbar-language-en').click();
        await verifyHome(page, scenario.username, options.timeoutMs, 'desktop');
      },
    );

    await runCheck(
      'English subscription spot-check renders correctly',
      'desktop',
      'en-US',
      `${options.baseUrl}/my-subscription?section=subscription`,
      'subscription-en',
      async () => {
        await verifySubscriptionReady(page, options.baseUrl, scenario.subId, options.timeoutMs);
      },
    );

    await runCheck(
      'English login page spot-check renders correctly',
      'desktop',
      'en-US',
      `${options.baseUrl}/login`,
      'login-en',
      async () => {
        await logout(page, options.timeoutMs, 'desktop');
        await waitForVisible(page.getByTestId('login-page'), options.timeoutMs);
        await waitForVisible(page.getByTestId('login-username'), options.timeoutMs);
        await waitForVisible(page.getByTestId('login-password'), options.timeoutMs);
      },
    );

    await runCheck(
      'Mobile login page renders correctly',
      'mobile',
      'zh-CN',
      `${options.baseUrl}/login`,
      'login-mobile',
      async () => {
        await setViewport(page, 'mobile');
        await setClientLanguage(page, 'zh-CN');
        await openPage(page, `${options.baseUrl}/login`);
        await waitForVisible(page.getByTestId('login-page'), options.timeoutMs);
        await waitForVisible(page.getByTestId('login-username'), options.timeoutMs);
        await waitForVisible(page.getByTestId('login-password'), options.timeoutMs);
        await waitForVisible(page.getByTestId('login-submit'), options.timeoutMs);
        await waitForVisible(page.getByTestId('public-language-toggle'), options.timeoutMs);
      },
    );

    await runCheck(
      'Mobile register page renders correctly',
      'mobile',
      'zh-CN',
      `${options.baseUrl}/register?invite=${encodeURIComponent(scenario.inviteCode)}`,
      'register-mobile',
      async () => {
        await openPage(
          page,
          `${options.baseUrl}/register?invite=${encodeURIComponent(scenario.inviteCode)}`,
        );
        await waitForVisible(page.getByTestId('register-page'), options.timeoutMs);
        await waitForVisible(page.getByTestId('register-invite'), options.timeoutMs);
        await waitForVisible(page.getByTestId('register-username'), options.timeoutMs);
        await waitForVisible(page.getByTestId('register-password'), options.timeoutMs);
      },
    );

    await runCheck(
      'Mobile reset password page renders correctly',
      'mobile',
      'zh-CN',
      `${options.baseUrl}/reset-password`,
      'reset-password-mobile',
      async () => {
        await openPage(page, `${options.baseUrl}/reset-password`);
        await waitForVisible(page.getByTestId('reset-password-page'), options.timeoutMs);
        await waitForVisible(page.getByTestId('reset-password-invalid'), options.timeoutMs);
        await waitForVisible(page.getByTestId('reset-password-back-login'), options.timeoutMs);
      },
    );

    await runCheck(
      'Mobile user overview renders correctly',
      'mobile',
      'zh-CN',
      `${options.baseUrl}/my-subscription`,
      'overview-mobile',
      async () => {
        await openPage(page, `${options.baseUrl}/login`);
        await loginAgain(page, scenario, options.timeoutMs);
        await verifyHome(page, scenario.username, options.timeoutMs, 'mobile');
      },
    );

    await runCheck(
      'Mobile subscription page renders correctly',
      'mobile',
      'zh-CN',
      `${options.baseUrl}/my-subscription?section=subscription`,
      'subscription-mobile',
      async () => {
        await verifySubscriptionReady(page, options.baseUrl, scenario.subId, options.timeoutMs);
      },
    );

    await runCheck(
      'Mobile notifications page renders correctly',
      'mobile',
      'zh-CN',
      `${options.baseUrl}/my-subscription?section=notifications`,
      'notifications-mobile',
      async () => {
        const count = await verifyNotifications(page, options.timeoutMs);
        return `${count} notification item(s) visible`;
      },
    );

    const summary = {
      baseUrl: options.baseUrl,
      dataDir: options.dataDir,
      runDir,
      tracePath,
      scenario,
      checks,
      observations: {
        expectedConsoleErrors: consoleMessages.filter(
          (message) => message.type === 'error' && isExpectedConsoleObservation(message),
        ),
        expectedNetworkIssues: networkIssues.filter(isExpectedNetworkObservation),
      },
      unexpected: {
        consoleErrors: consoleMessages.filter(
          (message) => message.type === 'error' && !isExpectedConsoleObservation(message),
        ),
        networkIssues: networkIssues.filter((issue) => !isExpectedNetworkObservation(issue)),
      },
      counts: {
        totalChecks: checks.length,
        passedChecks: checks.filter((check) => check.status === 'passed').length,
        failedChecks: checks.filter((check) => check.status === 'failed').length,
        consoleErrorCount: consoleMessages.filter((message) => message.type === 'error').length,
        pageErrorCount: pageErrors.length,
        networkIssueCount: networkIssues.length,
      },
      status: 'passed',
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    fs.writeFileSync(consolePath, JSON.stringify(consoleMessages, null, 2));
    fs.writeFileSync(networkPath, JSON.stringify(networkIssues, null, 2));
    fs.writeFileSync(errorsPath, JSON.stringify(pageErrors, null, 2));
    console.log(`[playwright] summary=${summaryPath}`);
  } catch (error) {
    const failurePath = path.join(runDir, 'failure.png');
    await page.screenshot({ path: failurePath, fullPage: true }).catch(() => {});
    const summary = {
      baseUrl: options.baseUrl,
      dataDir: options.dataDir,
      runDir,
      tracePath,
      scenario,
      checks,
      counts: {
        totalChecks: checks.length,
        passedChecks: checks.filter((check) => check.status === 'passed').length,
        failedChecks: checks.filter((check) => check.status === 'failed').length,
        consoleErrorCount: consoleMessages.filter((message) => message.type === 'error').length,
        pageErrorCount: pageErrors.length,
        networkIssueCount: networkIssues.length,
      },
      fatalError: error instanceof Error ? error.message : String(error),
      status: 'failed',
    };
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    fs.writeFileSync(consolePath, JSON.stringify(consoleMessages, null, 2));
    fs.writeFileSync(networkPath, JSON.stringify(networkIssues, null, 2));
    fs.writeFileSync(errorsPath, JSON.stringify(pageErrors, null, 2));
    throw error;
  } finally {
    await context.tracing.stop({ path: tracePath }).catch(() => {});
    await browser.close().catch(() => {});
    db.close();
    console.log(`[playwright] trace=${tracePath}`);
  }
}

main().catch((error) => {
  console.error(
    `[playwright] invite onboarding flow failed: ${error instanceof Error ? error.stack : String(error)}`,
  );
  process.exitCode = 1;
});
