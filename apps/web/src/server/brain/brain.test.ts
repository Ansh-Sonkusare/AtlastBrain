import { unzipSync, strFromU8 } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import { embed } from '../embed';
import { createMemoryGraph } from '../graph/memory';
import type { ProjectRecord } from '../graph/port';
import { stubProvider } from '../llm/stub';
import type { LlmProvider } from '../llm';
import { capture } from '../pipeline/capture';
import { createDeps, type PipelineDeps } from '../pipeline/deps';
import { processSource } from '../pipeline/process';
import { getSourceResponse } from '../pipeline/result';
import { askBrain, NOTHING_YET } from './ask';
import { buildVault, sanitizeName, zipVault } from './export';
import { GSQL_QUERIES, readGsql } from './gsql';

const A = 'user-a';
const B = 'user-b';

const X402 = [
  'The x402 protocol allows software agents to pay for web resources without needing accounts or API keys.',
  'Facilitators enable a resource server to accept crypto payments without operating blockchain nodes.',
  'Batching many small payments into one settlement cuts the overhead for each agent call.',
].join(' ');
const SOURDOUGH = [
  'Sourdough starters need regular feedings of flour and water to stay active.',
  'A hot oven with steam gives bread a crisp crust and an open crumb.',
].join(' ');

let deps: PipelineDeps;
let x402Id: string;
let sourdoughId: string;

async function save(userId: string, url: string, title: string, text: string, selection?: string) {
  const { source } = await capture(deps, userId, { url, title, text, source: 'web', selection });
  await processSource(deps, userId, source.id, { markRead: true });
  return source.id;
}

beforeAll(async () => {
  const graph = createMemoryGraph();
  deps = createDeps({ graph, llm: stubProvider });
  for (const u of [A, B]) await graph.ensureUser(u, `${u}@example.com`);
  const description = 'A payment router that batches small x402 payments between agents and facilitators.';
  const [embedding] = await embed([description]);
  const project: ProjectRecord = { id: 'p1', name: 'x402 Sentinel', description, embedding: embedding! };
  await graph.upsertProject(A, project);
  x402Id = await save(A, 'https://example.com/x402', 'x402: agents pay/charge?', X402, 'Facilitators enable\na resource server.');
  sourdoughId = await save(A, 'https://example.com/bread', 'Bread', SOURDOUGH);
  await save(B, 'https://example.com/b-secret', 'B secret', 'Quantum annealing hardware solves optimisation problems with qubits at low temperature.');
});

describe('askBrain', () => {
  it('answers from the user own claims and cites only them', async () => {
    const res = await askBrain(deps, A, 'How do agents pay for web resources?');
    expect(res.question).toBe('How do agents pay for web resources?');
    expect(res.citations.length).toBeGreaterThan(0);
    const mine = new Set([x402Id, sourdoughId]);
    expect(res.citations.every((c) => mine.has(c.sourceId))).toBe(true);
    expect(res.citations[0]!.sourceTitle).toBe('x402: agents pay/charge?');
    expect(res.answer).toContain(res.citations[0]!.claimText);
  });

  it('never returns another user claims', async () => {
    const res = await askBrain(deps, A, 'Quantum annealing hardware with qubits');
    expect(res.citations.some((c) => c.claimText.includes('annealing'))).toBe(false);
    const theirs = await askBrain(deps, B, 'Quantum annealing hardware with qubits');
    expect(theirs.citations[0]!.claimText).toContain('annealing');
  });

  it('says so, without calling the LLM, when the brain is empty', async () => {
    let calls = 0;
    const llm: LlmProvider = { ...stubProvider, answer: async () => { calls++; return { answer: 'x', usedClaimIds: [] }; } };
    const empty = createDeps({ graph: createMemoryGraph(), llm });
    const res = await askBrain(empty, 'nobody', 'anything?');
    expect(res).toEqual({ question: 'anything?', answer: NOTHING_YET, citations: [] });
    expect(calls).toBe(0);
  });

  it('orders citations by the ids the model used and drops ids it was not given', async () => {
    const llm: LlmProvider = {
      ...stubProvider,
      answer: async (_q, claims) => ({
        answer: 'Done.',
        usedClaimIds: [claims[2]!.claimId, 'not-a-claim', claims[0]!.claimId, claims[2]!.claimId],
      }),
    };
    const res = await askBrain({ ...deps, llm }, A, 'agents payments');
    const all = await deps.graph.searchClaims(A, (await embed(['agents payments']))[0]!, 8);
    expect(res.citations.map((c) => c.claimId)).toEqual([all[2]!.claimId, all[0]!.claimId]);
  });
});

describe('highlights', () => {
  it('saves a selection on capture and returns it in the source response', async () => {
    const res = await getSourceResponse(deps, A, x402Id);
    expect(res.highlights).toEqual(['Facilitators enable\na resource server.']);
  });

  it('adds a highlight on a deduplicated capture, once per distinct selection', async () => {
    const again = (selection?: string) =>
      capture(deps, A, { url: 'https://example.com/bread', title: 'Bread', text: 'whatever', source: 'extension', selection });
    const first = await again('A hot oven gives a crisp crust.');
    expect(first.duplicate).toBe(true);
    await again('A hot oven gives a crisp crust.');
    await again('   ');
    await again(undefined);
    expect((await getSourceResponse(deps, A, sourdoughId)).highlights).toEqual(['A hot oven gives a crisp crust.']);
  });

  it('keeps a user highlights off another user source', async () => {
    expect((await getSourceResponse(deps, B, x402Id).catch(() => null))).toBeNull();
    expect(await deps.graph.listHighlights(B, x402Id)).toEqual([]);
  });
});

describe('export', () => {
  it('names files safely and keeps every wikilink target equal to a file name', async () => {
    const vault = buildVault(await deps.graph.exportGraph(A));
    const files = Object.keys(vault);
    expect(files).toContain('Sources/x402 agents pay charge.md');
    expect(files).toContain('Sources/Bread.md');
    expect(files).toContain('Projects/x402 Sentinel.md');
    expect(files.some((f) => f.startsWith('Concepts/'))).toBe(true);
    for (const f of files) expect(f.split('/').slice(1).join('/')).not.toMatch(/[\\/:*?"<>|#^[\]]/);

    const names = new Set(files.map((f) => f.replace(/^[^/]+\//, '').replace(/\.md$/, '')));
    let links = 0;
    for (const md of Object.values(vault)) {
      for (const m of md.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
        links++;
        expect(names.has(m[1]!), `unresolved link ${m[0]}`).toBe(true);
      }
    }
    expect(links).toBeGreaterThan(0);
  });

  it('writes a source note with url, TL;DR, concept links and highlight quotes', async () => {
    const note = buildVault(await deps.graph.exportGraph(A))['Sources/x402 agents pay charge.md']!;
    expect(note).toMatch(/^---\nurl: "https:\/\/example.com\/x402"\nsaved: \d{4}-/);
    expect(note).toContain('## TL;DR');
    expect(note).toContain('## New claims');
    expect(note).toMatch(/- The x402 protocol allows .* \[\[[^\]]+\]\]/);
    expect(note).toContain('## Highlights\n\n> Facilitators enable\n> a resource server.');
    console.log(note);
  });

  it('lists repeats with a link to the source that made the claim, and backlinks on concepts', async () => {
    await save(A, 'https://example.com/x402-again', 'x402 again', X402.replace('allows', 'lets'));
    const vault = buildVault(await deps.graph.exportGraph(A));
    const again = vault['Sources/x402 again.md']!;
    expect(again).toContain('## Repeats');
    expect(again).toContain('[[x402 agents pay charge|x402: agents pay/charge?]]');
    const concept = Object.entries(vault).find(([f, md]) => f.startsWith('Concepts/') && md.includes('## Sources'))!;
    expect(concept[1]).toMatch(/- \[\[x402 agents pay charge(\|[^\]]*)?\]\]/);
  });

  it('keeps names unique across folders and across equal titles', () => {
    const vault = buildVault({
      projects: [{ id: 'p', name: 'Router', description: 'd' }],
      concepts: [{ id: 'c', name: 'router', summary: '', projects: ['Router'] }],
      sources: ['a', 'b'].map((id) => ({
        id, title: 'Voice note', url: `voice://${id}`, savedAt: '2026-01-01T00:00:00.000Z', readAt: null, tldr: null,
        made: [{ id: `${id}c`, text: 'Use the router.', concepts: ['router'] }], repeated: [], highlights: [],
      })),
    });
    expect(Object.keys(vault).sort()).toEqual([
      'Concepts/router (2).md', 'Projects/Router.md', 'Sources/Voice note (2).md', 'Sources/Voice note.md',
    ]);
  });

  it('zips the vault', async () => {
    const vault = buildVault(await deps.graph.exportGraph(A));
    const zip = zipVault(vault);
    expect([...zip.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const out = unzipSync(zip);
    expect(Object.keys(out).sort()).toEqual(Object.keys(vault).sort());
    expect(strFromU8(out['Sources/Bread.md']!)).toBe(vault['Sources/Bread.md']);
  });

  it('sanitizes names', () => {
    expect(sanitizeName('a/b:c?d#e^f[g]h|i')).toBe('a b c d e f g h i');
    expect(sanitizeName('  ...  ')).toBe('Untitled');
    expect(sanitizeName('x'.repeat(300))).toHaveLength(100);
  });
});

describe('gsql allow-list', () => {
  it('serves allow-listed query text and nothing else', async () => {
    expect(await readGsql('known_claims')).toMatch(/QUERY known_claims/i);
    for (const name of GSQL_QUERIES) {
      const text = await readGsql(name);
      if (text !== null) expect(text).toContain(name);
    }
    for (const bad of ['delete_user', '../known_claims', 'known_claims.gsql', '..%2Fgraph', '', 'schema']) {
      expect(await readGsql(bad)).toBeNull();
    }
  });
});
