/**
 * Drives every API route against a running stack, as a throwaway user.
 *
 * Start these first, each in its own shell, from the repo root:
 *   pnpm --filter web exec next dev -p 3100
 *   pnpm --filter web worker
 * TigerGraph must be up (container sb-tigergraph). Then run:
 *   pnpm --filter web exec tsx scripts/api-smoke.ts
 *
 * Env: PORT (default 3100), API_BASE (default http://localhost:$PORT).
 * The user `smoke-<timestamp>` and everything under it is deleted at the end.
 */
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { embed } from '../src/server/embed';
import { selectGraph } from '../src/server/pipeline/select-graph';

const BASE = process.env.API_BASE ?? `http://localhost:${process.env.PORT ?? 3100}`;
const USER = `smoke-${Date.now()}`;
const H = { 'content-type': 'application/json', 'x-user-id': USER };

const ARTICLE = [
  'The x402 protocol lets software agents pay for web resources without accounts or API keys.',
  'A facilitator verifies and settles each payment so the resource server runs no blockchain node.',
  'Batching many small payments into one settlement cuts the per-call overhead for agents.',
].join(' ');

async function call(method: string, path: string, init: { body?: unknown; headers?: Record<string, string> } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: init.headers ?? H,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const raw = await res.text();
  const body = res.headers.get('content-type')?.includes('json') ? JSON.parse(raw) : raw;
  return { status: res.status, headers: res.headers, body };
}

function ok(name: string, detail = ''): void {
  console.log(`ok   ${name}${detail ? `  ${detail}` : ''}`);
}

async function waitDone(sourceId: string) {
  const start = Date.now();
  for (;;) {
    const { body } = await call('GET', `/api/sources/${sourceId}`);
    if (!['pending', 'processing'].includes(body.status)) return body;
    assert.ok(Date.now() - start < 120_000, 'timed out waiting for the worker (is it running?)');
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function main(): Promise<void> {
  const graph = await selectGraph('tigergraph');
  try {
    await graph.ensureUser(USER, `${USER}@example.com`);
    const description = 'A payment router that batches small x402 payments between AI agents and facilitators.';
    const [embedding] = await embed([description]);
    await graph.upsertProject(USER, { id: `${USER}-proj`, name: 'Smoke Sentinel', description, embedding: embedding! });
    ok('setup', USER);

    const noUser = await call('GET', '/api/me', { headers: {} });
    assert.equal(noUser.status, 401);
    assert.deepEqual(noUser.body, { error: 'missing user' });
    assert.equal(noUser.headers.get('access-control-allow-origin'), '*');
    ok('401 without x-user-id');

    for (const path of ['/api/capture', '/api/sources/x', '/api/me', '/api/graph/x', '/api/vocabulary', '/api/learn-next', '/api/billing/checkout', '/api/ask', '/api/export', '/api/gsql/known_claims']) {
      const pre = await call('OPTIONS', path, { headers: { origin: 'chrome-extension://x', 'access-control-request-method': 'POST' } });
      assert.equal(pre.status, 204, path);
      assert.equal(pre.headers.get('access-control-allow-origin'), '*');
      assert.match(pre.headers.get('access-control-allow-headers') ?? '', /x-user-id/);
      assert.match(pre.headers.get('access-control-allow-methods') ?? '', /POST/);
    }
    const preDelete = await call('OPTIONS', '/api/me', { headers: { origin: 'chrome-extension://x', 'access-control-request-method': 'DELETE' } });
    assert.match(preDelete.headers.get('access-control-allow-methods') ?? '', /DELETE/);
    ok('OPTIONS preflight on every route');

    const bad = await call('POST', '/api/capture', { body: { text: '' } });
    assert.equal(bad.status, 400);
    ok('400 on an invalid capture');

    const payload = { url: 'https://example.com/smoke-article?utm_source=x', title: 'Smoke article', text: ARTICLE, source: 'web' };
    const t0 = Date.now();
    const cap = await call('POST', '/api/capture', { body: payload });
    assert.equal(cap.status, 202);
    assert.equal(cap.body.status, 'pending');
    assert.ok(cap.body.sourceId);
    const sourceId: string = cap.body.sourceId;
    ok('capture', `${cap.body.status} ${sourceId}`);

    const result = await waitDone(sourceId);
    const latencyMs = Date.now() - t0;
    assert.equal(result.status, 'done');
    assert.equal(result.sourceId, sourceId);
    assert.ok(Array.isArray(result.verdicts) && result.verdicts.length > 0);
    assert.ok(result.verdicts.every((v: { kind: string; text: string }) => ['new', 'repeat'].includes(v.kind) && v.text));
    assert.equal(result.newRatio, 1);
    assert.ok(result.tldr?.bullets?.length > 0);
    ok('poll to done', `${latencyMs} ms capture to done, ${result.verdicts.length} claims`);

    const selection = 'Batching many small payments into one settlement cuts the per-call overhead for agents.';
    const dup = await call('POST', '/api/capture', { body: { ...payload, url: 'https://example.com/smoke-article', selection } });
    assert.equal(dup.status, 202);
    assert.equal(dup.body.sourceId, sourceId);
    assert.equal(dup.body.status, 'done');
    ok('dedup capture returns the same source, done');

    const withHighlight = await call('GET', `/api/sources/${sourceId}`);
    assert.deepEqual(withHighlight.body.highlights, [selection]);
    ok('highlight from a deduplicated capture', JSON.stringify(withHighlight.body.highlights.length));

    const noQuestion = await call('POST', '/api/ask', { body: { question: '  ' } });
    assert.equal(noQuestion.status, 400);
    const ask = await call('POST', '/api/ask', { body: { question: 'How do agents pay for web resources?' } });
    assert.equal(ask.status, 200);
    assert.equal(ask.body.question, 'How do agents pay for web resources?');
    assert.ok(typeof ask.body.answer === 'string' && ask.body.answer.length > 0);
    assert.ok(ask.body.citations.length > 0, 'cites at least one claim');
    assert.ok(ask.body.citations.every((c: { sourceId: string }) => c.sourceId === sourceId), 'cites only this user claims');
    ok('ask', `${ask.body.citations.length} citations`);

    const gsqlNames = ['known_claims', 'search_claims', 'learn_next', 'neighborhood'];
    for (const name of gsqlNames) {
      const q = await call('GET', `/api/gsql/${name}`);
      assert.equal(q.status, 200, name);
      assert.match(q.headers.get('content-type') ?? '', /text\/plain/);
      assert.match(q.body as string, new RegExp(`QUERY\\s+${name}`, 'i'));
    }
    for (const name of ['delete_user', '..%2Fgraph%2Fschema', 'schema']) {
      assert.equal((await call('GET', `/api/gsql/${name}`)).status, 404, name);
    }
    ok('gsql allow-list', gsqlNames.join(', '));

    const missing = await call('GET', '/api/sources/does-not-exist');
    assert.equal(missing.status, 404);
    ok('404 on an unknown source');

    const next = await call('GET', '/api/learn-next');
    assert.equal(next.status, 200);
    assert.ok(Array.isArray(next.body.items) && next.body.items.length <= 3);
    ok('learn-next', `${next.body.items.length} items`);

    const g = await call('GET', `/api/graph/${sourceId}`);
    assert.equal(g.status, 200);
    assert.ok(g.body.nodes.some((n: { type: string; id: string }) => n.type === 'Source' && n.id === sourceId));
    assert.ok(g.body.nodes.some((n: { type: string }) => n.type === 'Claim'));
    assert.ok(Array.isArray(g.body.links) && g.body.links.length > 0);
    ok('graph', `${g.body.nodes.length} nodes, ${g.body.links.length} links`);

    const me = await call('GET', '/api/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.id, USER);
    assert.equal(me.body.user.plan, 'free');
    assert.deepEqual(me.body.usage, { used: 1, limit: 30, credits: 0 });
    ok('me', JSON.stringify(me.body.usage));

    const vocab = await call('GET', '/api/vocabulary');
    assert.equal(vocab.status, 200);
    assert.match(vocab.headers.get('content-type') ?? '', /text\/plain/);
    const names = (vocab.body as string).split('\n');
    assert.ok(names.includes('Smoke Sentinel'));
    assert.ok(names.length > 1, 'concepts included');
    ok('vocabulary', `${names.length} names`);

    const checkout = await call('POST', '/api/billing/checkout', { body: { product: 'pro' } });
    assert.equal(checkout.status, 200);
    assert.match(checkout.body.checkoutUrl, /^https?:\/\//);
    const badProduct = await call('POST', '/api/billing/checkout', { body: { product: 'gold' } });
    assert.equal(badProduct.status, 400);
    ok('checkout', checkout.body.checkoutUrl);

    const note = await call('POST', '/api/capture', { body: { title: 'Voice note', text: 'Remember to batch the settlement calls for the sentinel.', source: 'voice' } });
    assert.equal(note.status, 202);
    assert.ok(note.body.sourceId);
    ok('voice capture without a URL', note.body.status);
    await waitDone(note.body.sourceId);

    const filler = Array.from({ length: 30 }, (_, i) => ({
      id: `${USER}-fill-${i}`, userId: USER, url: `fill://${i}`, title: 'filler', kind: 'web' as const,
      status: 'done' as const, savedAt: new Date().toISOString(), readAt: null, contentHash: `fill-${i}`, body: '', newRatio: 0, tldr: null,
    }));
    for (const f of filler) await graph.createSource(f);
    const blocked = await call('POST', '/api/capture', { body: { url: 'https://example.com/over-limit', title: 'Over', text: ARTICLE + ' Extra sentence for a new hash.', source: 'web' } });
    assert.equal(blocked.status, 202);
    assert.equal(blocked.body.status, 'blocked');
    assert.equal(blocked.body.reason, 'quota');
    assert.match(blocked.body.checkoutUrl, /^https?:\/\//);
    const blockedPoll = await call('GET', `/api/sources/${blocked.body.sourceId}`);
    assert.equal(blockedPoll.body.status, 'blocked');
    assert.equal(blockedPoll.body.blockedReason, 'quota');
    ok('over-limit capture is blocked with a checkoutUrl');

    const free = await call('GET', '/api/export');
    assert.equal(free.status, 402);
    assert.match(free.body.checkoutUrl, /^https?:\/\//);
    ok('export is 402 with a checkoutUrl for a free user');

    await graph.updateUser(USER, { plan: 'pro' });
    const zipRes = await fetch(`${BASE}/api/export`, { headers: H });
    assert.equal(zipRes.status, 200);
    assert.match(zipRes.headers.get('content-type') ?? '', /application\/zip/);
    const zip = new Uint8Array(await zipRes.arrayBuffer());
    assert.deepEqual([...zip.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
    const zipNames = Object.keys(unzipSync(zip));
    assert.ok(zipNames.includes('Sources/Smoke article.md'), zipNames.join(', '));
    assert.ok(zipNames.includes('Projects/Smoke Sentinel.md'));
    assert.ok(zipNames.some((n) => n.startsWith('Concepts/')));
    ok('export zip for a Pro user', `${zip.length} bytes, ${zipNames.length} files`);

    const del = await call('DELETE', '/api/me');
    assert.equal(del.status, 204);
    assert.equal((await call('GET', `/api/sources/${sourceId}`)).status, 404);
    ok('DELETE /api/me removes the user data');

    console.log(`PASS  capture-to-done latency ${latencyMs} ms`);
  } finally {
    await graph.deleteUser(USER);
    console.log(`cleanup: deleted ${USER}`);
  }
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
