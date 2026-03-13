import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { chromium, type Page } from 'playwright';

type SqliteDb = Database.Database;

interface Options {
  baseUrl: string;
  dataDir: string;
  artifactDir: string;
  headed: boolean;
  timeoutMs: number;
}

interface Scenario {
  inviteCode: string;
  username: string;
  password: string;
}

interface AuditViewport {
  name: string;
  width: number;
  height: number;
}

interface ShellMetrics {
  viewportWidth: number;
  documentOverflow: number;
  headerLeft: number | null;
  headerRight: number | null;
  headerWidth: number | null;
  mainLeft: number | null;
  mainRight: number | null;
  mainWidth: number | null;
  leftDelta: number | null;
  rightDelta: number | null;
  marketLeadLeft: number | null;
  marketLeadRight: number | null;
  detailLeftWidth: number | null;
  detailRightWidth: number | null;
}

interface AuditResult {
  page: string;
  viewport: AuditViewport;
  screenshot: string;
  metrics: ShellMetrics;
  status: 'passed' | 'failed';
  note?: string;
  error?: string;
}

const AUDIT_VIEWPORTS: AuditViewport[] = [
  { name: 'laptop', width: 1366, height: 900 },
  { name: 'desktop', width: 1600, height: 1000 },
  { name: 'full-hd', width: 1920, height: 1080 },
  { name: 'qhd', width: 2560, height: 1440 },
  { name: 'uwqhd', width: 3440, height: 1440 },
];

const AUDIT_PAGES = [
  { name: 'overview', path: '/my-subscription', testId: 'my-subscription-page' },
  { name: 'market', path: '/my-subscription?section=market', testId: 'portal-market-tab' },
  { name: 'setup', path: '/my-subscription?section=setup', testId: 'portal-setup-tab' },
] as const;

function parseArgs(argv: string[]): Options {
  const options: Options = {
    baseUrl: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
    dataDir: path.resolve(process.env.DATA_DIR ?? './data'),
    artifactDir: path.resolve(process.env.PLAYWRIGHT_ARTIFACT_DIR ?? './output/playwright'),
    headed: false,
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

function openDb(dbPath: string): SqliteDb {
  ensureDir(path.dirname(dbPath));
  const db = new Database(dbPath);
  db.pragma('busy_timeout = 5000');
  return db;
}

function buildScenario(): Scenario {
  const suffix = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  return {
    inviteCode: `layout-${randomBytes(5).toString('hex')}`,
    username: `layout_${suffix}`,
    password: `Layout_${randomBytes(6).toString('hex')}!123`,
  };
}

function seedInvite(db: SqliteDb, inviteCode: string) {
  db.prepare('INSERT INTO invite_codes (code) VALUES (?)').run(inviteCode);
}

async function waitForUser(db: SqliteDb, username: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const user = db.prepare('SELECT id FROM users WHERE username = ? LIMIT 1').get(username) as
      | { id: number }
      | undefined;
    if (user) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for user creation: ${username}`);
}

async function waitForIdle(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(250);
}

async function openPage(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForIdle(page);
}

async function setStableClientState(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('prism:lang', 'zh-CN');
    window.localStorage.setItem('prism-theme', 'dark');
  });
}

async function registerUser(page: Page, baseUrl: string, scenario: Scenario, timeoutMs: number) {
  await openPage(page, `${baseUrl}/register?invite=${encodeURIComponent(scenario.inviteCode)}`);
  await page.getByTestId('register-invite').fill(scenario.inviteCode);
  await page.getByTestId('register-username').fill(scenario.username);
  await page.getByTestId('register-password').fill(scenario.password);

  await Promise.all([
    page.waitForURL(/\/my-subscription(?:\?|$)/, { timeout: timeoutMs }),
    page.getByTestId('register-submit').click(),
  ]);

  await waitForIdle(page);
  await page.getByTestId('my-subscription-page').waitFor({ state: 'visible', timeout: timeoutMs });
}

async function captureStep(page: Page, dirPath: string, fileName: string) {
  const filePath = path.join(dirPath, `${fileName}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function collectShellMetrics(page: Page): Promise<ShellMetrics> {
  return page.evaluate(() => {
    const headerCard = document.querySelector('.content-shell-wide > header.surface-card');
    const mainShell = document.querySelector('[data-testid="my-subscription-page"]');
    const marketLead = document.querySelector('[data-testid="portal-market-tab"] > section');
    const detailGrid = document.querySelector('[data-testid="portal-market-tab"] .grid.gap-4');
    const detailChildren =
      detailGrid instanceof HTMLElement ? Array.from(detailGrid.children).slice(0, 2) : [];
    const detailLeft = detailChildren[0] ?? null;
    const detailRight = detailChildren[1] ?? null;

    const headerRect =
      headerCard instanceof HTMLElement
        ? (() => {
            const rect = headerCard.getBoundingClientRect();
            return {
              left: Math.round(rect.left * 100) / 100,
              right: Math.round(rect.right * 100) / 100,
              width: Math.round(rect.width * 100) / 100,
            };
          })()
        : null;
    const mainRect =
      mainShell instanceof HTMLElement
        ? (() => {
            const rect = mainShell.getBoundingClientRect();
            const style = window.getComputedStyle(mainShell);
            const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
            const paddingRight = Number.parseFloat(style.paddingRight) || 0;
            const contentLeft = rect.left + paddingLeft;
            const contentRight = rect.right - paddingRight;
            return {
              left: Math.round(contentLeft * 100) / 100,
              right: Math.round(contentRight * 100) / 100,
              width: Math.round((contentRight - contentLeft) * 100) / 100,
            };
          })()
        : null;
    const marketRect =
      marketLead instanceof HTMLElement
        ? (() => {
            const rect = marketLead.getBoundingClientRect();
            return {
              left: Math.round(rect.left * 100) / 100,
              right: Math.round(rect.right * 100) / 100,
              width: Math.round(rect.width * 100) / 100,
            };
          })()
        : null;
    const detailLeftRect =
      detailLeft instanceof HTMLElement
        ? (() => {
            const rect = detailLeft.getBoundingClientRect();
            return {
              left: Math.round(rect.left * 100) / 100,
              right: Math.round(rect.right * 100) / 100,
              width: Math.round(rect.width * 100) / 100,
            };
          })()
        : null;
    const detailRightRect =
      detailRight instanceof HTMLElement
        ? (() => {
            const rect = detailRight.getBoundingClientRect();
            return {
              left: Math.round(rect.left * 100) / 100,
              right: Math.round(rect.right * 100) / 100,
              width: Math.round(rect.width * 100) / 100,
            };
          })()
        : null;
    const overflow = Math.max(
      document.documentElement.scrollWidth - window.innerWidth,
      document.body ? document.body.scrollWidth - window.innerWidth : 0,
      0,
    );

    return {
      viewportWidth: window.innerWidth,
      documentOverflow: Math.round(overflow * 100) / 100,
      headerLeft: headerRect?.left ?? null,
      headerRight: headerRect?.right ?? null,
      headerWidth: headerRect?.width ?? null,
      mainLeft: mainRect?.left ?? null,
      mainRight: mainRect?.right ?? null,
      mainWidth: mainRect?.width ?? null,
      leftDelta:
        headerRect && mainRect
          ? Math.round(Math.abs(headerRect.left - mainRect.left) * 100) / 100
          : null,
      rightDelta:
        headerRect && mainRect
          ? Math.round(Math.abs(headerRect.right - mainRect.right) * 100) / 100
          : null,
      marketLeadLeft: marketRect?.left ?? null,
      marketLeadRight: marketRect?.right ?? null,
      detailLeftWidth: detailLeftRect?.width ?? null,
      detailRightWidth: detailRightRect?.width ?? null,
    };
  });
}

function assertShellMetrics(pageName: string, metrics: ShellMetrics) {
  if (metrics.documentOverflow > 4) {
    throw new Error(`${pageName}: horizontal overflow ${metrics.documentOverflow}px`);
  }

  if (metrics.leftDelta === null || metrics.rightDelta === null) {
    throw new Error(`${pageName}: failed to resolve shared shell metrics`);
  }

  if (metrics.leftDelta > 1.5 || metrics.rightDelta > 1.5) {
    throw new Error(
      `${pageName}: shell misalignment detected (left ${metrics.leftDelta}px, right ${metrics.rightDelta}px)`,
    );
  }
}

async function auditPageAtViewport(
  page: Page,
  baseUrl: string,
  viewport: AuditViewport,
  auditPage: (typeof AUDIT_PAGES)[number],
  stepDir: string,
): Promise<AuditResult> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await openPage(page, `${baseUrl}${auditPage.path}`);
  await page.getByTestId(auditPage.testId).waitFor({ state: 'visible', timeout: 15_000 });

  const metrics = await collectShellMetrics(page);
  const screenshot = await captureStep(page, stepDir, `${auditPage.name}-${viewport.name}`);

  try {
    assertShellMetrics(auditPage.name, metrics);
    return {
      page: auditPage.name,
      viewport,
      screenshot,
      metrics,
      status: 'passed',
      note:
        auditPage.name === 'market' && metrics.detailLeftWidth && metrics.detailRightWidth
          ? `detail split ${metrics.detailLeftWidth}px / ${metrics.detailRightWidth}px`
          : undefined,
    };
  } catch (error) {
    return {
      page: auditPage.name,
      viewport,
      screenshot,
      metrics,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(options.artifactDir, `layout-audit-${runStamp}`);
  const stepDir = path.join(runDir, 'steps');
  const dbPath = path.join(options.dataDir, 'prism.db');
  const summaryPath = path.join(runDir, 'summary.json');

  ensureDir(stepDir);

  const db = openDb(dbPath);
  const scenario = buildScenario();
  seedInvite(db, scenario.inviteCode);

  const browser = await chromium.launch({ headless: !options.headed });
  const context = await browser.newContext({
    viewport: { width: AUDIT_VIEWPORTS[0].width, height: AUDIT_VIEWPORTS[0].height },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(options.timeoutMs);
  await setStableClientState(page);

  const results: AuditResult[] = [];

  try {
    await registerUser(page, options.baseUrl, scenario, options.timeoutMs);
    await waitForUser(db, scenario.username, options.timeoutMs);

    for (const viewport of AUDIT_VIEWPORTS) {
      for (const auditPage of AUDIT_PAGES) {
        results.push(
          await auditPageAtViewport(page, options.baseUrl, viewport, auditPage, stepDir),
        );
      }
    }

    const failedResults = results.filter((result) => result.status === 'failed');
    const summary = {
      baseUrl: options.baseUrl,
      dataDir: options.dataDir,
      runDir,
      scenario,
      viewports: AUDIT_VIEWPORTS,
      results,
      counts: {
        total: results.length,
        passed: results.length - failedResults.length,
        failed: failedResults.length,
      },
      status: failedResults.length > 0 ? 'failed' : 'passed',
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    if (failedResults.length > 0) {
      throw new Error(
        failedResults
          .map((result) => `${result.page}@${result.viewport.name}: ${result.error}`)
          .join('; '),
      );
    }
  } finally {
    await browser.close().catch(() => {});
    db.close();
  }

  console.log(`[layout-audit] summary=${summaryPath}`);
}

main().catch((error) => {
  console.error(`[layout-audit] failed: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
