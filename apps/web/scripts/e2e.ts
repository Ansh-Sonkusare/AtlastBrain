/**
 * Runs the PRD's "Must work in the demo" list against the real stack, as a throwaway user.
 *
 * Needs, from the repo root: TigerGraph up and loaded (`pnpm --filter web graph:load`),
 *   DEMO_MODE=1 pnpm --filter web exec next dev -p 3100      (with APP_URL=http://localhost:3100)
 *   pnpm --filter web worker
 * Then: pnpm --filter web e2e
 *
 * The user `e2e-<timestamp>` is seeded from fixtures/seed and deleted at the end.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sendDevPayment } from '../src/server/billing/dev-event';
import { selectGraph } from '../src/server/pipeline/select-graph';
import type { LearnNextItem, Neighborhood, SaveResult } from '../src/server/types';

const BASE = process.env.API_BASE ?? 'http://localhost:3100';
const USER = `e2e-${Date.now()}`;
const H = { 'content-type': 'application/json', 'x-user-id': USER };
const ROOT = path.resolve(import.meta.dirname, '../../..');
const demo = JSON.parse(readFileSync(path.join(ROOT, 'fixtures/seed/demo.json'), 'utf8'));

async function call<T>(method: string, route: string, body?: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(BASE + route, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: (res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text) as T };
}

async function waitSettled(sourceId: string, timeoutMs = 60_000): Promise<SaveResult> {
  const start = Date.now();
  for (;;) {
    const { body } = await call<SaveResult>('GET', `/api/sources/${sourceId}`);
    if (!['pending', 'processing'].includes(body.status)) return body;
    assert.ok(Date.now() - start < timeoutMs, `source ${sourceId} still ${body.status} after ${timeoutMs} ms (is the worker running?)`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function save(article: { url?: string; title: string; body: string }, source: 'extension' | 'voice' | 'web') {
  const t0 = Date.now();
  const res = await call<{ sourceId: string; status: string; checkoutUrl?: string }>('POST', '/api/capture', {
    url: article.url, title: article.title, text: article.body, source,
  });
  assert.equal(res.status, 202, `capture returned ${res.status}`);
  return { ...res.body, t0 };
}

function pass(n: string, detail: string): void {
  console.log(`PASS ${n}  ${detail}`);
}

async function main(): Promise<void> {
  console.log(`seeding ${USER} from fixtures/seed …`);
  execFileSync('pnpm', ['exec', 'tsx', 'scripts/seed.ts', '--user', USER], { cwd: path.join(ROOT, 'apps/web'), stdio: 'ignore' });
  const graph = await selectGraph('tigergraph');
  try {
    const overlap = demo['x402-overlap'];
    const s = await save(overlap, 'extension');
    const result = await waitSettled(s.sourceId);
    const ms = Date.now() - s.t0;
    assert.equal(result.status, 'done');
    assert.ok(ms < 10_000, `save took ${ms} ms, PRD wants under 10 s`);
    pass('1 save appears in the graph', `${ms} ms capture to done`);

    const repeats = result.verdicts.filter((v) => v.kind === 'repeat');
    const fresh = result.verdicts.filter((v) => v.kind === 'new');
    const labelledKnown = overlap.labels.filter((l: { known: boolean }) => l.known).length;
    assert.ok(repeats.length >= labelledKnown - 1, `${repeats.length} repeats, labels say ${labelledKnown}`);
    assert.ok(fresh.length >= 1, 'no new claims');
    for (const r of repeats) {
      assert.ok(r.kind === 'repeat' && r.match.sourceTitle && r.match.sourceUrl.startsWith('http'), 'repeat without a "you read this in" link');
    }
    pass('2 new vs repeated with links', `${fresh.length} new, ${repeats.length} repeated of ${result.verdicts.length} (labels: ${overlap.labels.length - labelledKnown} new)`);

    assert.ok(result.tldr, 'no TL;DR');
    const freshTexts = new Set(fresh.map((v) => v.text));
    assert.ok(result.tldr.bullets.every((b) => freshTexts.has(b)), 'TL;DR mentions a repeated claim');
    assert.equal(result.tldr.projectId, `${USER}::proj-x402-sentinel`);
    assert.match(result.tldr.whyItMatters, /x402 Sentinel/);
    pass('3 TL;DR covers only new claims and names the project', result.tldr.whyItMatters);

    const g = await call<Neighborhood>('GET', `/api/graph/${s.sourceId}`);
    const types = new Set(g.body.nodes.map((n) => n.type));
    assert.deepEqual([...types].sort(), ['Claim', 'Concept', 'Project', 'Source']);
    assert.ok(g.body.links.some((l) => l.type === 'REPEATS'), 'no REPEATS link in the graph view');
    pass('  graph view', `${g.body.nodes.length} nodes, ${g.body.links.length} links`);

    const ln = await call<{ items: LearnNextItem[] }>('GET', '/api/learn-next');
    const erc = ln.body.items.find((i) => i.concept === 'ERC-4626');
    assert.ok(erc, `ERC-4626 not in learn next: ${ln.body.items.map((i) => i.concept).join(', ')}`);
    assert.equal(erc.project, 'Ribozome');
    assert.equal(erc.unreadSources.length, 2);
    pass('4 learn next', ln.body.items.map((i) => `${i.concept} (${i.unreadSources.length} unread)`).join('; '));

    const voice = await save({ title: 'Voice note', body: demo['voice-note'].body }, 'voice');
    const voiceResult = await waitSettled(voice.sourceId);
    assert.equal(voiceResult.status, 'done');
    assert.ok(voiceResult.verdicts.length >= 1);
    pass('6 voice note checked for novelty', voiceResult.verdicts.map((v) => `${v.kind}: ${v.text}`).join(' | '));

    const me0 = await call<{ user: { plan: string }; usage: { used: number; limit: number } }>('GET', '/api/me');
    const fill = me0.body.usage.limit - me0.body.usage.used;
    for (let i = 0; i < fill; i++) {
      await graph.createSource({
        id: `${USER}-fill-${i}`, userId: USER, url: `fill://${i}`, title: 'filler', kind: 'web', status: 'done',
        savedAt: new Date().toISOString(), readAt: null, contentHash: `${USER}-fill-${i}`, body: '', newRatio: 0, tldr: null,
      });
    }
    const blocked = await save(demo['fresh-topic'], 'extension');
    assert.equal(blocked.status, 'blocked');
    assert.ok(blocked.checkoutUrl, 'blocked capture has no checkoutUrl');
    const page = await fetch(blocked.checkoutUrl.replace(/^https?:\/\/[^/]+/, BASE));
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Pay/);
    const hook = await sendDevPayment(graph, USER, 'pro', { ...process.env, APP_URL: BASE });
    assert.equal(hook, 200);
    const after = await waitSettled(blocked.sourceId);
    const me1 = await call<{ user: { plan: string } }>('GET', '/api/me');
    assert.equal(me1.body.user.plan, 'pro');
    assert.equal(after.status, 'done');
    pass('5 free limit → checkout → webhook → Pro → save completes', `filled ${fill}, blocked, paid, plan ${me1.body.user.plan}, ${after.verdicts.length} claims`);

    console.log('ALL MUST-WORK CHECKS PASSED');
  } finally {
    await graph.deleteUser(USER);
    console.log(`cleanup: deleted ${USER}`);
  }
}

main().catch((err) => {
  console.error('FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});
