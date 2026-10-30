// Browser check of the side panel page: connect, save, receipt, the save's dashboard page, free limit, Pay (test), Pro, blocked save completes.
// It opens the panel page in a tab, because Playwright cannot open a real side panel or press Chrome's Alt+S command.
//
// Needs, for API_BASE (default http://localhost:3100):
//   DEMO_MODE=1 APP_URL=$API_BASE LLM_PROFILE=stub DODO_PAYMENTS_API_KEY= pnpm --filter web exec next dev -p 3100
//   LLM_PROFILE=stub pnpm --filter web worker
//   WXT_APP_ORIGIN=$API_BASE pnpm --filter extension build     (the connect page works only from an origin the build allows)
// Run: pnpm ui-check. CHROMIUM_PATH overrides Playwright's Chromium. Screenshots go to UI_CHECK_OUT (default /tmp/sb-ui-check).
import assert from 'node:assert/strict';
import { api, BASE, demo, shot, webScript, withUser } from './ui-check-lib.mjs';

const log = (...a) => console.log(...a);

await withUser('ui', async ({ ctx, user }) => {
  let [sw] = ctx.serviceWorkers();
  sw ??= await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const panel = await ctx.newPage();
  panel.on('console', (m) => m.type() === 'error' && log('panel console error:', m.text()));
  await panel.goto(`chrome-extension://${new URL(sw.url()).host}/sidepanel.html`);

  // Connect: the ?user= visit sets the demo cookie that the connect page signs a token for.
  const web = await ctx.newPage();
  await web.goto(`${BASE}/dashboard?user=${user}`);
  await web.close();
  const [connectTab] = await Promise.all([ctx.waitForEvent('page'), panel.getByRole('link', { name: 'Connect your account' }).click()]);
  await connectTab.getByRole('button', { name: 'Connect extension' }).click();
  await connectTab.getByText(/You can close this tab/).waitFor({ timeout: 30000 });
  await connectTab.close();
  await panel.getByRole('button', { name: 'Save this page' }).waitFor({ timeout: 15000 });
  await panel.getByText(/Free · 0 of 30 saves/).waitFor({ timeout: 15000 });
  log('ok connect: panel shows Save this page and Free · 0 of 30 saves');
  await shot(panel, '1-panel-connected');

  // Save the stage article from the panel.
  const article = await ctx.newPage();
  await article.goto(`${BASE}/demo/x402-overlap`);
  await article.bringToFront();
  const t0 = Date.now();
  await panel.getByRole('button', { name: 'Save this page' }).click();
  const heading = panel.getByRole('heading', { name: /new ideas?/ });
  await heading.waitFor({ timeout: 60000 });
  const receipt = await panel.locator('section.result').innerText();
  log(`ok save: receipt after ${Date.now() - t0} ms: ${await heading.innerText()}, ${await panel.locator('.summary p').innerText()}, ${await panel.locator('.pct-label').innerText()} new`);
  assert.match(receipt, /you already knew/);
  await shot(panel, '2-receipt');

  // The receipt's link opens the save's page.
  const [sourcePage] = await Promise.all([ctx.waitForEvent('page'), panel.getByRole('link', { name: /See what's new in dashboard/ }).click()]);
  await sourcePage.getByRole('heading', { name: 'Already known' }).waitFor({ timeout: 30000 });
  await sourcePage.getByText('New to you').first().waitFor();
  await sourcePage.getByText(/Why it matters/).waitFor();
  await sourcePage.locator('text=Show').first().click();
  await sourcePage.getByText(/First read in/).first().waitFor();
  await shot(sourcePage, '3-source-page');
  log('ok source page:', sourcePage.url());

  // Which stage sentences the novelty threshold got right, by label.
  const sourceId = sourcePage.url().split('/source/')[1].split('?')[0];
  const { verdicts } = await (await api(user, `/api/sources/${sourceId}`)).json();
  const labels = demo['x402-overlap'].labels;
  const wrong = labels.filter((l) => {
    const v = verdicts.find((x) => x.text === l.sentence);
    return v && (v.kind === 'repeat') !== l.known;
  });
  const unmatched = labels.filter((l) => !verdicts.some((x) => x.text === l.sentence));
  log(`threshold: ${verdicts.filter((v) => v.kind === 'new').length} new, ${verdicts.filter((v) => v.kind === 'repeat').length} repeat; ${labels.length} labels, ${wrong.length} wrong, ${unmatched.length} not matched to a verdict`);
  for (const l of wrong) log(`  wrong (label known=${l.known}): ${l.sentence}`);
  await sourcePage.close();

  // Bring the user to the free limit and see what the dashboard shows.
  webScript('demo-fill.ts', '--user', user);
  const brief = await ctx.newPage();
  await brief.goto(`${BASE}/dashboard?user=${user}`);
  await brief.getByText(/Worth reading in full/).first().waitFor({ timeout: 30000 });
  await shot(brief, '4-brief-after-fill');
  const title = demo['x402-overlap'].title;
  assert.ok((await brief.locator('body').innerText()).includes(title), "Today's brief lost the real save");
  assert.equal(await brief.getByText('placeholder save').count(), 0, "Today's brief shows placeholders");
  log("ok after fill, Today's brief: real save listed, no placeholders");
  await brief.goto(`${BASE}/dashboard/library?user=${user}`);
  await brief.getByRole('heading', { name: 'Library' }).waitFor({ timeout: 30000 });
  await shot(brief, '5-library-after-fill');
  assert.equal(await brief.getByText('placeholder save').count(), 0, 'Library shows placeholders');
  log('ok after fill, Library: no placeholders');
  await brief.goto(`${BASE}/dashboard/graph?user=${user}`);
  await brief.locator('canvas').first().waitFor({ timeout: 30000 });
  await shot(brief, '5b-graph-after-fill');
  // The canvas has no DOM, so read the node list the server page sends to GraphExplorer.
  assert.ok(!(await (await fetch(`${BASE}/dashboard/graph?user=${user}`)).text()).includes('placeholder save'), 'graph has placeholder source nodes');
  log('ok after fill, graph: no placeholder source nodes');
  await brief.close();

  // The blocked save, Pay (test), and the save finishing on its own.
  const fresh = await ctx.newPage();
  await fresh.goto(`${BASE}/demo/fresh-topic`);
  await fresh.bringToFront();
  await panel.reload();
  await panel.getByText(/Free · 30 of 30 saves/).waitFor({ timeout: 15000 });
  const [checkout] = await Promise.all([ctx.waitForEvent('page', { timeout: 30000 }), panel.getByRole('button', { name: 'Save this page' }).click()]);
  await checkout.waitForLoadState();
  assert.match(checkout.url(), /\/dev\/checkout/, `checkout went to ${checkout.url()}: the server needs DODO_PAYMENTS_API_KEY empty`);
  await panel.getByText(/Free limit reached/).waitFor({ timeout: 15000 });
  await panel.getByText(/Waiting for checkout/).waitFor();
  await shot(panel, '6-blocked');
  log('ok blocked: panel waits, checkout tab open at', new URL(checkout.url()).pathname);
  for (const route of ['/dashboard', '/dashboard/library', '/dashboard/graph']) {
    const html = await (await fetch(`${BASE}${route}?user=${user}`)).text();
    assert.ok(!html.includes('placeholder save'), `${route} shows placeholders while the save is blocked`);
  }
  log('ok while blocked: brief, library and graph show no placeholders');

  await checkout.getByRole('button', { name: 'Pay (test)' }).click();
  await checkout.getByText(/Paid\. You can close this tab/).waitFor({ timeout: 30000 });
  await shot(checkout, '7-paid');
  await panel.getByRole('heading', { name: /new ideas?/ }).waitFor({ timeout: 60000 });
  await panel.getByText(/Pro · \d+ of 500 saves/).waitFor({ timeout: 15000 });
  await shot(panel, '8-pro-receipt');
  log(`ok paywall: ${await panel.getByRole('heading', { name: /new ideas?/ }).innerText()}, footer: ${await panel.getByText(/Pro · /).innerText()}`);
  const me = await (await api(user, '/api/me')).json();
  assert.equal(me.user.plan, 'pro');
  log('ALL PANEL CHECKS PASSED');
});
