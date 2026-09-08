import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, devices, type Browser, type Page } from 'playwright';
import { startDemo } from './runtime.js';
import { DEMO_INVITE, DEMO_PASSWORD } from './fixtures.js';

const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output-dir');
const outputDir = path.resolve(outputIndex >= 0 ? args[outputIndex + 1] : 'docs/images');
fs.mkdirSync(outputDir, { recursive: true });
const headed = args.includes('--headed');
const demo = await startDemo(0);
let browser: Browser | undefined;
const observations: Array<Record<string, unknown>> = [];
const pageErrors: string[] = [];
try {
  try {
    browser = await chromium.launch({ headless: !headed });
  } catch (error) {
    if (process.platform !== 'win32' || !String(error).includes("Executable doesn't exist"))
      throw error;
    console.log('[demo] Using installed Microsoft Edge; Playwright Chromium is not installed.');
    browser = await chromium.launch({ headless: !headed, channel: 'msedge' });
  }
  async function capture(page: Page, name: string) {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      );
    });
    const overflow = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - innerWidth),
    );
    assert.ok(overflow <= 1, `${name}: horizontal overflow ${overflow}px`);
    await page.screenshot({ path: path.join(outputDir, name + '.png'), animations: 'disabled' });
    observations.push({ screen: name, horizontalOverflow: overflow });
  }
  async function login(page: Page, username: string) {
    await page.goto(demo.url + '/login');
    await page.getByTestId('login-username').fill(username);
    await page.getByTestId('login-password').fill(DEMO_PASSWORD);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(username === 'admin' ? demo.url + '/' : /\/my-subscription/);
    await page.getByTestId('demo-mode-badge').waitFor();
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'zh-CN',
  });
  await context.addInitScript({
    content: `Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async function (text) { window.__demoCopied = text; } }
  });`,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(demo.url + '/login');
  await page.getByTestId('login-submit').waitFor();
  await capture(page, 'login-desktop');
  await login(page, 'admin');
  await page.getByText('Tokyo · Reality', { exact: false }).first().waitFor();
  await capture(page, 'admin-dashboard');
  await page.goto(demo.url + '/nodes');
  await page.getByText('Tokyo · Reality', { exact: false }).first().waitFor();
  await capture(page, 'admin-nodes');
  await page.goto(demo.url + '/users');
  await page.getByRole('cell').filter({ hasText: 'demo-alex' }).first().waitFor();
  await capture(page, 'admin-users');

  await context.clearCookies();
  await login(page, 'demo');
  await page.getByTestId('subscription-home-status').filter({ hasText: '可用' }).waitFor();
  await capture(page, 'portal-overview');
  await page.goto(demo.url + '/my-subscription?section=setup');
  await page.getByTestId('portal-setup-copy-link').waitFor();
  await page.getByTestId('portal-setup-copy-link').click();
  assert.match(await page.evaluate(() => (window as any).__demoCopied), /\/sub\/demo-alex/);
  observations.push({ check: 'copy subscription event', passed: true });
  await capture(page, 'subscription-desktop');
  await page.goto(demo.url + '/my-subscription?section=help');
  await page.getByTestId('portal-help-tab').waitFor();
  await capture(page, 'help-desktop');

  await page.route('**/local/auth/portal/stats', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: '{"error":"synthetic upstream unavailable"}',
    }),
  );
  await page.goto(demo.url + '/my-subscription');
  await page.getByTestId('subscription-home-usage-unavailable').waitFor();
  observations.push({
    check: 'unavailable usage is not displayed as zero or unlimited',
    passed: true,
  });
  await page.unroute('**/local/auth/portal/stats');

  await context.clearCookies();
  await page.goto(demo.url + '/register?invite=' + DEMO_INVITE);
  await page.getByTestId('register-username').fill('new_demo_user');
  await page.getByTestId('register-password').fill(DEMO_PASSWORD);
  await page.getByTestId('register-submit').click();
  await page.waitForURL(/\/my-subscription/);
  await page.getByTestId('subscription-home-status').filter({ hasText: '准备中' }).waitFor();
  observations.push({ check: 'invite registration and automatic login', passed: true });

  const mobile = await browser.newContext({ ...devices['iPhone 13'], locale: 'zh-CN' });
  const mobilePage = await mobile.newPage();
  mobilePage.setDefaultTimeout(15000);
  mobilePage.on('pageerror', (error) => pageErrors.push(error.message));
  await mobilePage.goto(demo.url + '/login');
  await mobilePage.getByTestId('login-submit').waitFor();
  await capture(mobilePage, 'login-mobile');
  await login(mobilePage, 'demo');
  await mobilePage.getByTestId('subscription-home-status').filter({ hasText: '可用' }).waitFor();
  await capture(mobilePage, 'portal-mobile');
  await mobilePage.goto(demo.url + '/my-subscription?section=setup');
  const copy = mobilePage.getByTestId('portal-setup-copy-link');
  await copy.waitFor();
  const box = await copy.boundingBox();
  assert.ok(
    box && box.y + box.height <= 844,
    'Mobile subscription action must fit in the first viewport',
  );
  observations.push({ check: 'mobile primary action above fold', bottom: box.y + box.height });
  await capture(mobilePage, 'subscription-mobile');
  await mobilePage.getByRole('button', { name: '打开导航菜单' }).click();
  await mobilePage.getByRole('dialog', { name: '导航菜单' }).waitFor();
  await mobilePage.keyboard.press('Escape');
  await mobilePage.getByRole('dialog', { name: '导航菜单' }).waitFor({ state: 'hidden' });
  observations.push({ check: 'mobile navigation closes with Escape', passed: true });
  await mobilePage.getByRole('button', { name: '打开导航菜单' }).click();
  await mobilePage.getByRole('dialog', { name: '导航菜单' }).waitFor();
  await mobilePage.setViewportSize({ width: 1024, height: 844 });
  await mobilePage.getByRole('dialog', { name: '导航菜单' }).waitFor({ state: 'hidden' });
  observations.push({ check: 'mobile navigation closes when resizing to desktop', passed: true });

  const darkContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'en-US',
  });
  await darkContext.addInitScript({ content: "localStorage.setItem('prism-theme', 'dark');" });
  const darkPage = await darkContext.newPage();
  darkPage.setDefaultTimeout(15000);
  darkPage.on('pageerror', (error) => pageErrors.push(error.message));
  await login(darkPage, 'admin');
  await darkPage.getByText('Tokyo · Reality', { exact: false }).first().waitFor();
  assert.equal(await darkPage.locator('html').getAttribute('lang'), 'en-US');
  assert.equal(await darkPage.locator('html').getAttribute('data-theme'), 'dark');
  await capture(darkPage, 'admin-dark');

  assert.deepEqual(pageErrors, [], 'No uncaught browser errors');
  fs.writeFileSync(
    path.join(outputDir, 'verification.json'),
    JSON.stringify(
      { browser: browser.version(), syntheticData: true, observations, pageErrors },
      null,
      2,
    ),
  );
  console.log(`[demo] ${observations.length} checks/captures passed. Output: ${outputDir}`);
} catch (error) {
  fs.writeFileSync(
    path.join(outputDir, 'failure.json'),
    JSON.stringify({ error: String(error), observations, pageErrors }, null, 2),
  );
  throw error;
} finally {
  await browser?.close();
  await demo.close();
}
