import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMemoryGraph } from './memory';
import type { GraphPort, SourceRecord } from './port';
import { createTigerGraph, tigerGraphConfigFromEnv, waitForVectorIndex } from './tigergraph';

const config = tigerGraphConfigFromEnv();

async function reachable(): Promise<boolean> {
  try {
    const res = await fetch(`${config.url}/api/ping`, { signal: AbortSignal.timeout(15000) });
    return res.ok;
  } catch {
    return false;
  }
}

const online = await reachable();
const suite = online ? 'TigerGraph GraphPort' : `TigerGraph GraphPort (skipped: ${config.url} is unreachable, set TG_URL)`;

const DIM = 384;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32 - 0.5;
  };
}

function normalize(v: number[]) {
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
}

function randomVec(seed: number) {
  const r = rng(seed);
  return normalize(Array.from({ length: DIM }, r));
}

/** A vector at cosine distance of roughly `noise^2 / 2` from `base`. */
function near(base: number[], seed: number, noise = 0.05) {
  const r = rng(seed);
  return normalize(base.map((x) => x + (r() * noise) / Math.sqrt(DIM / 12)));
}

const run = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const A = `g1test-${run}-a`;
const B = `g1test-${run}-b`;
const C = `g1test-${run}-c`;
const D = `g1test-${run}-d`;
const id = (s: string) => `${run}-${s}`;
const day = (d: number) => `2026-10-${String(d).padStart(2, '0')}T12:00:00.000Z`;

function source(userId: string, key: string, savedDay: number, patch: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: id(key),
    userId,
    url: `https://example.com/${run}/${key}`,
    title: `Title ${key}`,
    kind: 'extension',
    status: 'done',
    savedAt: day(savedDay),
    readAt: null,
    contentHash: `hash-${run}-${key}`,
    body: `body ${key}`,
    newRatio: 1,
    tldr: null,
    ...patch,
  };
}

const vX402 = randomVec(1);
const vErc = randomVec(2);
const vNew = randomVec(3);
const vOther = randomVec(4);

describe.skipIf(!online)(suite, () => {
  const graph = createTigerGraph(config);

  beforeAll(async () => {
    await graph.ensureUser(A, 'a@example.com');
    await graph.ensureUser(B, 'b@example.com');
    await graph.ensureUser(C, 'c@example.com');

    await graph.upsertProject(A, { id: id('proj'), name: 'Ribozome', description: 'payments router', embedding: vOther });

    await graph.createSource(source(A, 'a-read', 10));
    await graph.markRead(A, id('a-read'), day(10));
    await graph.addClaim(id('a-read'), { id: id('a-read:0'), text: 'x402 batches payments', embedding: vX402, firstSeen: day(10) });
    await graph.upsertConcept(A, { id: `${A}::x402`, name: 'x402', embedding: vX402 }, [id('proj')]);
    await graph.linkAbout(id('a-read:0'), `${A}::x402`);

    await graph.createSource(source(A, 'a-unread', 12));
    await graph.addClaim(id('a-unread'), { id: id('a-unread:0'), text: 'ERC-4626 vaults share yield', embedding: vErc, firstSeen: day(12) });
    await graph.upsertConcept(A, { id: `${A}::erc-4626`, name: 'ERC-4626', embedding: vErc }, [id('proj')]);
    await graph.linkAbout(id('a-unread:0'), `${A}::erc-4626`);

    await graph.createSource(source(A, 'a-second', 20));
    await graph.markRead(A, id('a-second'), day(20));
    await graph.addRepeat(id('a-second'), id('a-read:0'), 'x402 groups payments into batches', 0.04);
    await graph.addClaim(id('a-second'), { id: id('a-second:1'), text: 'facilitators settle on chain', embedding: vNew, firstSeen: day(20) });
    await graph.linkAbout(id('a-second:1'), `${A}::x402`);

    await graph.createSource(source(A, 'a-blocked', 21, { status: 'blocked' }));
    await graph.createSource(source(A, 'a-pending', 22, { status: 'pending' }));

    await graph.createSource(source(B, 'b-read', 10));
    await graph.markRead(B, id('b-read'), day(10));
    await graph.addClaim(id('b-read'), { id: id('b-read:0'), text: 'x402 batches payments too', embedding: near(vX402, 9), firstSeen: day(10) });

    await waitForVectorIndex(60_000, config);
  }, 180_000);

  afterAll(async () => {
    for (const u of [A, B, C, D]) await graph.deleteUser(u);
  }, 60_000);

  it('knownClaims returns only the asking user\'s read claims', async () => {
    const probe = near(vX402, 7);
    const forA = await graph.knownClaims(A, probe, 0.35);
    expect(forA.map((m) => m.claimId)).toEqual([id('a-read:0')]);
    expect(forA[0]).toMatchObject({
      sourceId: id('a-read'),
      sourceTitle: 'Title a-read',
      sourceUrl: `https://example.com/${run}/a-read`,
      concepts: ['x402'],
    });
    expect(forA[0].distance).toBeGreaterThanOrEqual(0);
    expect(forA[0].distance).toBeLessThan(0.05);

    const forB = await graph.knownClaims(B, probe, 0.35);
    expect(forB.map((m) => m.claimId)).toEqual([id('b-read:0')]);
  });

  it('knownClaims is empty for a user with no reads and for an unknown user', async () => {
    expect(await graph.knownClaims(C, near(vX402, 8), 0.35)).toEqual([]);
    expect(await graph.knownClaims(`${run}-nobody`, vX402, 0.35)).toEqual([]);
  });

  it('a claim from a saved but unread source is not known', async () => {
    expect(await graph.knownClaims(A, near(vErc, 5), 0.35)).toEqual([]);
  });

  it('knownClaims respects maxDist', async () => {
    expect(await graph.knownClaims(A, vOther, 0.35)).toEqual([]);
  });

  it('learnNext returns the concept with no read source and its unread source', async () => {
    const items = await graph.learnNext(A, 3);
    expect(items).toEqual([
      {
        concept: 'ERC-4626',
        project: 'Ribozome',
        unreadSources: [{ id: id('a-unread'), title: 'Title a-unread', url: `https://example.com/${run}/a-unread` }],
      },
    ]);
  });

  it('neighborhood returns MAKES, REPEATS, ABOUT and RELEVANT_TO links', async () => {
    const n = await graph.neighborhood(A, id('a-second'));
    const types = new Set(n.links.map((l) => l.type));
    expect([...types].sort()).toEqual(['ABOUT', 'MAKES', 'RELEVANT_TO', 'REPEATS']);
    expect(n.links).toContainEqual({ source: id('a-second'), target: id('a-read:0'), type: 'REPEATS' });
    expect(n.links).toContainEqual({ source: `${A}::x402`, target: id('proj'), type: 'RELEVANT_TO' });
    expect(n.nodes.find((x) => x.id === id('a-read:0'))).toMatchObject({ type: 'Claim', repeat: true });
    expect(n.nodes.find((x) => x.id === id('a-second:1'))).toMatchObject({ type: 'Claim', repeat: false });
    expect(n.nodes.find((x) => x.id === id('proj'))).toMatchObject({ type: 'Project', label: 'Ribozome' });

    expect(await graph.neighborhood(B, id('a-second'))).toEqual({ nodes: [], links: [] });
  });

  it('sourceClaims returns repeats with the original source and the stored sentence', async () => {
    const sc = await graph.sourceClaims(A, id('a-second'));
    expect(sc.made).toEqual([{ id: id('a-second:1'), text: 'facilitators settle on chain' }]);
    expect(sc.repeated).toHaveLength(1);
    expect(sc.repeated[0]).toMatchObject({
      claimId: id('a-read:0'),
      claimText: 'x402 batches payments',
      text: 'x402 groups payments into batches',
      sourceId: id('a-read'),
      sourceTitle: 'Title a-read',
      concepts: ['x402'],
    });
    expect(sc.repeated[0].distance).toBeCloseTo(0.04, 5);
    expect(await graph.sourceClaims(B, id('a-second'))).toEqual({ made: [], repeated: [] });
  });

  it('countSavesSince counts owned saves since a date and skips blocked ones', async () => {
    expect(await graph.countSavesSince(A, day(1))).toBe(4);
    expect(await graph.countSavesSince(A, day(15))).toBe(2);
    expect(await graph.countSavesSince(C, day(1))).toBe(0);
  });

  it('round-trips users, sources and status lists', async () => {
    expect(await graph.getUser(A)).toEqual({ id: A, email: 'a@example.com', plan: 'free', credits: 0, dodoCustomerId: '' });
    await graph.ensureUser(A, 'ignored@example.com');
    const cust = `cus_${run}`;
    expect(await graph.updateUser(A, { plan: 'pro', dodoCustomerId: cust })).toMatchObject({ plan: 'pro', credits: 0, email: 'a@example.com' });
    expect((await graph.findUserByDodoCustomer(cust))?.id).toBe(A);
    expect(await graph.findUserByDodoCustomer(`cus_${run}_none`)).toBeNull();

    expect((await graph.findSource(A, `https://example.com/${run}/a-read`, 'x'))?.id).toBe(id('a-read'));
    expect((await graph.findSource(A, 'x', `hash-${run}-a-unread`))?.id).toBe(id('a-unread'));
    expect(await graph.findSource(B, `https://example.com/${run}/a-read`, 'x')).toBeNull();
    expect(await graph.getSource(B, id('a-read'))).toBeNull();

    const tldr = { bullets: ['one'], whyItMatters: 'because', projectId: id('proj') };
    await graph.updateSource(id('a-second'), { tldr, newRatio: 0.5, status: 'done' });
    const s = await graph.getSource(A, id('a-second'));
    expect(s).toMatchObject({ tldr, newRatio: 0.5, readAt: day(20), title: 'Title a-second', body: 'body a-second' });
    expect((await graph.getSource(A, id('a-unread')))?.readAt).toBeNull();

    expect((await graph.listSourcesByStatus(A, 'blocked')).map((x) => x.id)).toEqual([id('a-blocked')]);
    expect((await graph.listPendingSources(1000)).map((x) => x.id)).toContain(id('a-pending'));

    const concepts = await graph.listConcepts(A);
    expect(concepts.map((c) => c.name).sort()).toEqual(['ERC-4626', 'x402']);
    expect(concepts[0].embedding).toHaveLength(DIM);
    const projects = await graph.listProjects(A);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ id: id('proj'), name: 'Ribozome', description: 'payments router' });
    expect(projects[0].embedding[0]).toBeCloseTo(vOther[0], 5);
  });

  it('lists embeddings written a moment ago', async () => {
    await graph.upsertProject(B, { id: id('b-proj'), name: 'Fresh', description: 'd', embedding: vNew });
    await graph.upsertConcept(B, { id: `${B}::fresh`, name: 'fresh', embedding: vErc }, [id('b-proj')]);
    const [project] = await graph.listProjects(B);
    const [concept] = await graph.listConcepts(B);
    expect(project.embedding[0]).toBeCloseTo(vNew[0], 5);
    expect(concept.embedding[0]).toBeCloseTo(vErc[0], 5);
  });

  it('rejects edges to vertices that do not exist', async () => {
    await expect(graph.addRepeat(id('a-second'), id('ghost'), 't', 0.1)).rejects.toThrow(/addRepeat/);
    await expect(graph.linkAbout(id('ghost'), `${A}::x402`)).rejects.toThrow(/linkAbout/);
    await expect(graph.updateSource(id('ghost'), { status: 'done' })).rejects.toThrow(/Unknown source/);
  });

  it('recordWebhookEvent applies each event once', async () => {
    expect(await graph.recordWebhookEvent(id('evt'), day(1))).toBe(true);
    expect(await graph.recordWebhookEvent(id('evt'), day(2))).toBe(false);
    await fetch(`${config.url}/restpp/graph/${config.graph}/vertices/WebhookEvent/${id('evt')}`, { method: 'DELETE' });
  });

  it('searchClaims ranks all of the user\'s own claims, read or not, and never another user\'s', async () => {
    const probe = near(vX402, 11);
    const forA = await graph.searchClaims(A, probe, 10);
    expect(forA.map((m) => m.claimId).sort()).toEqual([id('a-read:0'), id('a-second:1'), id('a-unread:0')].sort());
    expect(forA[0]).toMatchObject({
      claimId: id('a-read:0'),
      claimText: 'x402 batches payments',
      sourceId: id('a-read'),
      sourceTitle: 'Title a-read',
      sourceUrl: `https://example.com/${run}/a-read`,
      concepts: ['x402'],
    });
    expect(forA[0].distance).toBeLessThan(0.05);
    expect(forA.map((m) => m.distance)).toEqual([...forA.map((m) => m.distance)].sort((a, b) => a - b));

    expect((await graph.searchClaims(A, probe, 1)).map((m) => m.claimId)).toEqual([id('a-read:0')]);
    expect((await graph.searchClaims(A, near(vErc, 12), 1)).map((m) => m.claimId)).toEqual([id('a-unread:0')]);
    expect((await graph.searchClaims(B, probe, 10)).map((m) => m.claimId)).toEqual([id('b-read:0')]);
    expect(await graph.searchClaims(C, probe, 10)).toEqual([]);
    expect(await graph.searchClaims(`${run}-nobody`, probe, 10)).toEqual([]);
    expect(await graph.searchClaims(A, probe, 0)).toEqual([]);
  });

  it('highlights are listed oldest first and only to the source owner', async () => {
    const late = { id: id('hl-late'), sourceId: id('a-read'), text: 'late mark', createdAt: day(12) };
    const early = { id: id('hl-early'), sourceId: id('a-read'), text: 'early mark', createdAt: day(11) };
    await graph.addHighlight(A, late);
    await graph.addHighlight(A, early);
    expect(await graph.listHighlights(A, id('a-read'))).toEqual([early, late]);
    expect(await graph.listHighlights(A, id('a-unread'))).toEqual([]);
    expect(await graph.listHighlights(B, id('a-read'))).toEqual([]);

    const stolen = { id: id('hl-stolen'), sourceId: id('a-read'), text: 'not yours', createdAt: day(13) };
    await expect(graph.addHighlight(B, stolen)).rejects.toThrow(/Unknown source/);
    await expect(graph.addHighlight(A, { ...stolen, sourceId: id('ghost') })).rejects.toThrow(/Unknown source/);
    const res = await fetch(`${config.url}/restpp/graph/${config.graph}/vertices/Highlight/${encodeURIComponent(stolen.id)}`);
    expect(((await res.json()) as { error: boolean }).error).toBe(true);
    expect(await graph.listHighlights(A, id('a-read'))).toEqual([early, late]);
  });

  it('exportGraph returns what was written, equal to the memory graph', async () => {
    const seed = async (g: GraphPort) => {
      await g.ensureUser(D, 'd@example.com');
      await g.upsertProject(D, { id: id('d-proj2'), name: 'Aproj', description: 'unlinked', embedding: vNew });
      await g.upsertProject(D, { id: id('d-proj'), name: 'Dproj', description: 'd project', embedding: vOther });
      await g.upsertConcept(D, { id: `${D}::alpha`, name: 'alpha', embedding: vX402 }, [id('d-proj')]);
      await g.upsertConcept(D, { id: `${D}::beta`, name: 'beta', embedding: vErc }, []);
      const tldr = { bullets: ['b1', 'b2'], whyItMatters: 'w', projectId: id('d-proj') };
      await g.createSource(source(D, 'd-one', 3, { tldr }));
      await g.markRead(D, id('d-one'), day(4));
      await g.addClaim(id('d-one'), { id: id('d-one:0'), text: 'd first', embedding: vX402, firstSeen: day(3) });
      await g.addClaim(id('d-one'), { id: id('d-one:1'), text: 'd second', embedding: vErc, firstSeen: day(3) });
      await g.linkAbout(id('d-one:0'), `${D}::alpha`);
      await g.linkAbout(id('d-one:0'), `${D}::beta`);
      await g.createSource(source(D, 'd-blocked', 4, { status: 'blocked' }));
      await g.createSource(source(D, 'd-fill', 4, { url: 'fill://d-fill' }));
      await g.createSource(source(D, 'd-two', 5));
      await g.addClaim(id('d-two'), { id: id('d-two:0'), text: 'd third', embedding: vNew, firstSeen: day(5) });
      await g.addRepeat(id('d-two'), id('d-one:0'), 'd restated', 0.03);
      await g.addHighlight(D, { id: id('d-hl-2'), sourceId: id('d-one'), text: 'second mark', createdAt: day(7) });
      await g.addHighlight(D, { id: id('d-hl-1'), sourceId: id('d-one'), text: 'first mark', createdAt: day(6) });
    };
    const memory = createMemoryGraph();
    await seed(memory);
    await seed(graph);

    const exported = await graph.exportGraph(D);
    expect(exported).toEqual(await memory.exportGraph(D));
    expect(exported.projects.map((p) => p.name)).toEqual(['Aproj', 'Dproj']);
    expect(exported.concepts).toEqual([
      { id: `${D}::alpha`, name: 'alpha', summary: '', projects: ['Dproj'] },
      { id: `${D}::beta`, name: 'beta', summary: '', projects: [] },
    ]);
    expect(exported.sources.map((s) => s.id)).toEqual([id('d-one'), id('d-two')]);
    expect(exported.sources[0]).toMatchObject({
      readAt: day(4),
      tldr: { bullets: ['b1', 'b2'], whyItMatters: 'w', projectId: id('d-proj') },
      made: [
        { id: id('d-one:0'), text: 'd first', concepts: ['alpha', 'beta'] },
        { id: id('d-one:1'), text: 'd second', concepts: [] },
      ],
      repeated: [],
      highlights: ['first mark', 'second mark'],
    });
    expect(exported.sources[1]).toMatchObject({
      readAt: null,
      tldr: null,
      repeated: [
        { claimId: id('d-one:0'), text: 'd restated', claimText: 'd first', sourceId: id('d-one'), sourceTitle: 'Title d-one' },
      ],
      highlights: [],
    });
    expect(await graph.exportGraph(`${run}-nobody`)).toEqual({ projects: [], concepts: [], sources: [] });
  });

  it('deleteUser leaves nothing', async () => {
    const owned = {
      User: [C],
      Source: [] as string[],
      Claim: [] as string[],
      Concept: [] as string[],
      Project: [] as string[],
      Highlight: [] as string[],
    };
    await graph.createSource(source(C, 'c-src', 5));
    await graph.addHighlight(C, { id: id('c-hl'), sourceId: id('c-src'), text: 'c mark', createdAt: day(5) });
    owned.Highlight.push(id('c-hl'));
    await graph.addClaim(id('c-src'), { id: id('c-src:0'), text: 'c claim', embedding: vNew, firstSeen: day(5) });
    await graph.upsertProject(C, { id: id('c-proj'), name: 'P', description: 'd', embedding: vNew });
    await graph.upsertConcept(C, { id: `${C}::k`, name: 'k', embedding: vNew }, [id('c-proj')]);
    owned.Source.push(id('c-src'));
    owned.Claim.push(id('c-src:0'));
    owned.Project.push(id('c-proj'));
    owned.Concept.push(`${C}::k`);

    await graph.deleteUser(C);
    expect(await graph.getUser(C)).toBeNull();
    for (const [type, ids] of Object.entries(owned)) {
      for (const vid of ids) {
        const res = await fetch(`${config.url}/restpp/graph/${config.graph}/vertices/${type}/${encodeURIComponent(vid)}`);
        expect(((await res.json()) as { error: boolean }).error, `${type} ${vid}`).toBe(true);
      }
    }
    expect(await graph.listConcepts(C)).toEqual([]);
    expect(await graph.countSavesSince(C, day(1))).toBe(0);
  });
});
