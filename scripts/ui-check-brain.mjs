// Browser check of the dashboard: Export on Free opens checkout, Pay (test), Export on Pro downloads, Show the query, Ask, Delete my data.
// Needs the same server, worker and build as ui-check.mjs. Run: pnpm ui-check:brain
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { api, BASE, OUT, shot, withUser } from './ui-check-lib.mjs';

await withUser('ui-brain', async ({ ctx, user }) => {
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && console.log('console error:', m.text()));
  await page.goto(`${BASE}/dashboard/library?user=${user}`);
  const exportButton = page.getByRole('button', { name: 'Export to Obsidian' });
  await exportButton.waitFor({ timeout: 30000 });

  const [checkout] = await Promise.all([ctx.waitForEvent('page', { timeout: 30000 }), exportButton.click()]);
  await checkout.waitForLoadState();
  assert.match(checkout.url(), /\/dev\/checkout/, `checkout went to ${checkout.url()}: the server needs DODO_PAYMENTS_API_KEY empty`);
  console.log('ok export on Free opens checkout');
  await checkout.getByRole('button', { name: 'Pay (test)' }).click();
  await checkout.getByText(/Paid\. You can close this tab/).waitFor({ timeout: 30000 });
  await checkout.close();

  await page.reload();
  await page.getByText(/^Pro$/).first().waitFor({ timeout: 30000 });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), exportButton.click()]);
  assert.equal(dl.suggestedFilename(), 'atlas.zip');
  const zip = `${OUT}/${dl.suggestedFilename()}`;
  await dl.saveAs(zip);
  assert.ok(statSync(zip).size > 1000);
  console.log(`ok export on Pro: ${zip}, ${statSync(zip).size} bytes`);
  await shot(page, 'brain-1-library-pro');

  await page.locator('a[href*="/dashboard/source/"]').first().click();
  const show = page.getByRole('button', { name: 'Show the query that checks for repeats' });
  await show.waitFor({ timeout: 30000 });
  await show.click();
  const gsql = await page.locator('pre.gsql').innerText();
  assert.match(gsql, /vectorSearch/);
  assert.match(gsql, /READ/);
  await shot(page, 'brain-2-query');
  console.log('ok show query:', gsql.split('\n')[0].slice(0, 80));

  await page.getByRole('link', { name: 'Ask', exact: true }).first().click();
  const box = page.getByLabel('Your question');
  await box.waitFor({ timeout: 30000 });
  await box.fill('What do I know about x402 batching?');
  await box.press('Enter');
  await page.getByText(/Built from \d+ of your claims/).waitFor({ timeout: 60000 });
  await page.getByText(/Batching Micropayments in x402/).first().waitFor({ timeout: 5000 });
  await shot(page, 'brain-3-ask');
  console.log(`ok ask: ${await page.getByText(/Built from \d+ of your claims/).innerText()}`);

  // Delete my data, on its own user. It only needs one save to have something to remove.
  const doomed = `ui-check-del-${Date.now()}`;
  try {
    const save = await fetch(`${BASE}/api/capture`, {
      method: 'POST',
      headers: { 'x-user-id': doomed, 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/ui-check-delete', title: 'Delete me', text: 'One sentence to save. Another sentence to save.', source: 'extension' }),
    });
    assert.equal(save.status < 300, true, `capture HTTP ${save.status}`);
    await page.goto(`${BASE}/dashboard/library?user=${doomed}`);
    await page.getByText('Delete me').first().waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: 'Delete my data' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Confirm delete' });
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    assert.equal(await dialog.count(), 0);
    assert.ok((await (await api(doomed, '/api/me')).json()).usage.used > 0, 'Cancel must keep the data');
    await page.getByRole('button', { name: 'Delete my data' }).click();
    await shot(page, 'brain-4-delete-confirm');
    await dialog.getByRole('button', { name: 'Yes, delete everything' }).click();
    await page.waitForURL(`${BASE}/`, { timeout: 30000 });
    await shot(page, 'brain-5-deleted-redirect');
    // GET /api/me re-creates an empty account, so "removed" reads as a fresh Free user with no saves.
    const after = await (await api(doomed, '/api/me')).json();
    assert.deepEqual([after.usage.used, after.user.plan], [0, 'free']);
    console.log('ok delete my data: Cancel keeps data, two-step confirm removes the user and redirects to /');
  } finally {
    await api(doomed, '/api/me', { method: 'DELETE' });
  }
  console.log('ALL DASHBOARD CHECKS PASSED');
});
