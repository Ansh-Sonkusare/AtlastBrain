// Browser check of the built extension and the dev checkout. Needs `next dev -p 3000`, the worker, a seeded `demo` user,
// and CHROMIUM_PATH pointing at a Chromium binary. Screenshots go to /tmp/sb-ui-check/. Run: pnpm ui-check
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const EXT = `${ROOT}/apps/extension/.output/chrome-mv3`;
const demo = JSON.parse(readFileSync(`${ROOT}/fixtures/seed/demo.json`, 'utf8'));
const out = (n) => `/tmp/sb-ui-check/${n}.png`;
const log = (...a) => console.log(...a);

const ctx = await chromium.launchPersistentContext('/tmp/sb-ui-check/profile-' + Date.now(), {
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--headless=new'],
  viewport: { width: 420, height: 900 },
});
try {
  let [sw] = ctx.serviceWorkers();
  sw ??= await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const extId = new URL(sw.url()).host;
  log('extension loaded', extId);

  const panel = await ctx.newPage();
  panel.on('console', (m) => m.type() === 'error' && log('panel console error:', m.text()));
  await panel.goto(`chrome-extension://${extId}/sidepanel.html`);
  await panel.waitForLoadState('networkidle');
  await panel.screenshot({ path: out('1-panel-empty'), fullPage: true });

  const note = panel.locator('textarea').first();
  await note.fill(demo['x402-overlap'].body);
  await panel.getByRole('button', { name: /save note/i }).click();
  await panel.getByText(/checking against your brain/i).first().waitFor({ timeout: 5000 }).then(
    () => log('saw "checking against your brain…"'),
    () => log('did not catch the checking state (may have finished fast)'),
  );
  await panel.getByText(/you read this in/i).first().waitFor({ timeout: 30000 });
  await panel.screenshot({ path: out('2-whats-new'), fullPage: true });
  const text = await panel.locator('body').innerText();
  log('--- What\'s new to me (panel text) ---\n' + text.slice(0, 1800));

  await panel.getByRole('tab', { name: /learn next/i }).or(panel.getByRole('button', { name: /learn next/i })).first().click();
  await panel.getByText(/ERC-4626/).first().waitFor({ timeout: 15000 });
  await panel.screenshot({ path: out('3-learn-next'), fullPage: true });
  log('--- Learn next ---\n' + (await panel.locator('body').innerText()).slice(0, 600));

  await panel.getByRole('tab', { name: /graph/i }).or(panel.getByRole('button', { name: /^graph$/i })).first().click();
  await panel.waitForTimeout(4000);
  await panel.screenshot({ path: out('4-graph'), fullPage: true });
  log('--- Graph tab ---\n' + (await panel.locator('body').innerText()).slice(0, 500));
  log('canvas count', await panel.locator('canvas').count());
  await panel.locator('canvas').first().waitFor({ timeout: 15000 });
  await panel.waitForTimeout(2500);
  await panel.screenshot({ path: out('4-graph'), fullPage: true });
  log('graph canvas drawn');

  const article = await ctx.newPage();
  await article.goto('http://localhost:3000/demo/x402-overlap');
  await article.bringToFront();
  const extracted = await panel.evaluate(() => chrome.runtime.sendMessage({ type: 'extract-active-tab' }));
  if (!extracted?.ok) throw new Error(`extraction failed: ${JSON.stringify(extracted)}`);
  const sentences = extracted.page.text.split(/(?<=[.!?])\s+/).length;
  if (sentences < 12) throw new Error(`extraction merged paragraphs: ${sentences} sentences`);
  log('extracted', JSON.stringify(extracted.page.title), extracted.page.text.split(/(?<=[.!?])\s+/).length, 'sentences from', extracted.page.url);

  const web = await ctx.newPage();
  await web.setViewportSize({ width: 900, height: 900 });
  await web.goto('http://localhost:3000/dev/checkout?product=pro&user=demo');
  await web.screenshot({ path: out('5-dev-checkout'), fullPage: true });
  await web.getByRole('button', { name: /pay/i }).click();
  await web.waitForTimeout(3000);
  await web.screenshot({ path: out('6-after-pay'), fullPage: true });
  const me = await (await fetch('http://localhost:3000/api/me', { headers: { 'x-user-id': 'demo' } })).json();
  log('plan after clicking Pay (test):', me.user.plan);
  if (me.user.plan !== 'pro') throw new Error(`plan is ${me.user.plan} after Pay (test)`);
} finally {
  await ctx.close();
}
