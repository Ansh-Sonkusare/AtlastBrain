// Browser check of Ask the brain, "Show the query" and Export to Obsidian in the built extension. Needs the same
// setup as ui-check.mjs, and `demo` on the Pro plan (run it right after `pnpm ui-check`). Run: pnpm ui-check:brain
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const EXT = `${ROOT}/apps/extension/.output/chrome-mv3`;
const ctx = await chromium.launchPersistentContext('/tmp/sb-ui-check/profile-brain-' + Date.now(), {
  executablePath: process.env.CHROMIUM_PATH, headless: true, acceptDownloads: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--headless=new'], viewport: { width: 420, height: 900 },
});
try {
  let [sw] = ctx.serviceWorkers(); sw ??= await ctx.waitForEvent('serviceworker');
  const panel = await ctx.newPage();
  panel.on('console', (m) => m.type() === 'error' && console.log('console error:', m.text()));
  await panel.goto(`chrome-extension://${new URL(sw.url()).host}/sidepanel.html`);
  await panel.getByRole('tab', { name: /^ask$/i }).or(panel.getByRole('button', { name: /^ask$/i })).first().click();
  await panel.getByPlaceholder('Ask your brain').fill('What do I know about x402 batching?');
  await panel.locator('button.primary', { hasText: 'Ask' }).click();
  await panel.getByText(/Batching Micropayments in x402/).first().waitFor({ timeout: 30000 });
  await panel.screenshot({ path: '/tmp/sb-ui-check/brain-ask.png', fullPage: true });
  console.log('ok ask:', (await panel.locator('body').innerText()).slice(0, 500).replace(/\n+/g, ' | '));

  await panel.getByRole('tab', { name: /graph/i }).or(panel.getByRole('button', { name: /^graph$/i })).first().click();
  await panel.getByRole('button', { name: 'Show the query' }).click();
  const q = await panel.locator('pre, code').first().innerText();
  assert.match(q, /vectorSearch/); assert.match(q, /READ/);
  await panel.screenshot({ path: '/tmp/sb-ui-check/brain-query.png', fullPage: true });
  console.log('ok show query:', q.split('\n')[0]);

  await panel.getByText('Your data').click();
  const [dl] = await Promise.all([panel.waitForEvent('download', { timeout: 20000 }), panel.getByRole('button', { name: 'Export to Obsidian' }).click()]);
  const path = '/tmp/sb-ui-check/brain-' + dl.suggestedFilename(); await dl.saveAs(path);
  console.log('ok export download:', path);
} finally { await ctx.close(); }
