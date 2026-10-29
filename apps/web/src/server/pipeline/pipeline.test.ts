import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { embed } from '../embed';
import { createMemoryGraph } from '../graph/memory';
import type { ProjectRecord } from '../graph/port';
import { stubProvider } from '../llm/stub';
import type { LlmProvider } from '../llm';
import { canonicalUrl, capture } from './capture';
import { createDeps, type PipelineDeps } from './deps';
import { processSource } from './process';
import { getSaveResult } from './result';

const SEED = path.resolve(__dirname, '../../../../../fixtures/seed');
const read = <T>(file: string): T => JSON.parse(readFileSync(path.join(SEED, file), 'utf8')) as T;

interface SeedArticle { id: string; url: string; title: string; body: string }
const articles = read<SeedArticle[]>('articles.json').slice(0, 3);
const seedProjects = read<{ id: string; name: string; description: string }[]>('projects.json');

const USER = 'u-test';

const PARAPHRASE_ARTICLE = [
  'The x402 protocol allows software agents to pay for web resources without needing accounts, API keys, or subscriptions.',
  'Facilitators enable a resource server to accept crypto payments without operating blockchain nodes or keeping gas funds.',
  'Zero-knowledge proofs let a verifier confirm a statement without learning the secret behind it.',
  'Sourdough starters need regular feedings of flour and water to stay active.',
].join(' ');

async function freshDeps(overrides: Partial<PipelineDeps> = {}): Promise<PipelineDeps> {
  const graph = createMemoryGraph();
  const deps = createDeps({ graph, llm: stubProvider, ...overrides });
  await graph.ensureUser(USER, 'u@example.com');
  const vectors = await embed(seedProjects.map((p) => p.description));
  for (const [i, p] of seedProjects.entries()) {
    const record: ProjectRecord = { ...p, embedding: vectors[i]! };
    await graph.upsertProject(USER, record);
  }
  return deps;
}

async function saveAndProcess(deps: PipelineDeps, a: { url: string; title: string; body: string }, markRead = true) {
  const { source } = await capture(deps, USER, { url: a.url, title: a.title, text: a.body, source: 'web' });
  await processSource(deps, USER, source.id, { markRead });
  return source.id;
}

describe('pipeline', () => {
  let deps: PipelineDeps;

  beforeAll(async () => {
    deps = await freshDeps();
    for (const a of articles) await saveAndProcess(deps, a);
  });

  it('splits repeats from new claims and writes a TL;DR on the new ones only', async () => {
    const id = await saveAndProcess(deps, {
      url: 'https://example.com/new/paraphrase',
      title: 'Paraphrase',
      body: PARAPHRASE_ARTICLE,
    });
    const result = await getSaveResult(deps, USER, id);
    const repeats = result.verdicts.filter((v) => v.kind === 'repeat');
    const fresh = result.verdicts.filter((v) => v.kind === 'new');

    expect(result.status).toBe('done');
    expect(repeats.map((v) => v.kind === 'repeat' && v.match.sourceTitle).sort()).toEqual(
      [articles[0]!.title, articles[2]!.title].sort(),
    );
    expect(fresh.map((v) => v.text)).toEqual([
      'Zero-knowledge proofs let a verifier confirm a statement without learning the secret behind it.',
      'Sourdough starters need regular feedings of flour and water to stay active.',
    ]);
    expect(repeats.map((v) => v.text).sort()).toEqual(
      PARAPHRASE_ARTICLE.split(/(?<=[.!?])\s+/).slice(0, 2).sort(),
    );
    expect(result.newRatio).toBe(0.5);
    expect(result.tldr?.bullets).toEqual(fresh.map((v) => v.text));
  });

  it('links new claims to concepts and the neighbourhood shows them', async () => {
    const id = await saveAndProcess(deps, {
      url: 'https://example.com/new/linking',
      title: 'Linking',
      body: 'Sourdough starters need regular feedings of flour and water to stay active every single day.',
    });
    const hood = await deps.graph.neighborhood(USER, id);
    expect(hood.links.map((l) => l.type)).toContain('ABOUT');
  });

  it('returns the same source for a duplicate URL or identical text', async () => {
    const first = await capture(deps, USER, { url: articles[0]!.url, title: 'x', text: 'something else entirely', source: 'web' });
    const viaTrackedUrl = await capture(deps, USER, {
      url: `${articles[0]!.url.replace('https://example.com', 'HTTPS://Example.COM')}/?utm_source=x#frag`,
      title: 'x',
      text: 'different text again',
      source: 'extension',
    });
    const byText = await capture(deps, USER, { url: 'https://example.com/other', title: 'x', text: `  ${articles[0]!.body.toUpperCase()}\n`, source: 'web' });
    expect(first.duplicate).toBe(true);
    expect(viaTrackedUrl.source.id).toBe(first.source.id);
    expect(byText.source.id).toBe(first.source.id);
  });

  it('canonicalises urls', () => {
    expect(canonicalUrl('HTTPS://Example.COM/a/b/?utm_medium=x&id=3#top')).toBe('https://example.com/a/b?id=3');
    expect(canonicalUrl('https://example.com/')).toBe('https://example.com');
  });

  it('gives a url-less voice capture a voice:// url', async () => {
    const { source } = await capture(deps, USER, { title: 'note', text: 'decided to batch calls in the router', source: 'voice' });
    expect(source.url).toMatch(/^voice:\/\/\d+$/);
    expect(source.kind).toBe('voice');
  });
});

describe('pipeline failure modes', () => {
  it('leaves status blocked when the quota says no, and writes nothing', async () => {
    const deps = await freshDeps({ quota: { allow: async () => false } });
    const id = await saveAndProcess(deps, articles[0]!);
    const result = await getSaveResult(deps, USER, id);
    expect(result.status).toBe('blocked');
    expect(result.blockedReason).toBe('quota');
    expect(result.verdicts).toEqual([]);
  });

  it('leaves status partial, keeping written claims, when an LLM step throws', async () => {
    const llm: LlmProvider = {
      ...stubProvider,
      linkConcepts: async () => {
        throw new Error('boom');
      },
    };
    const deps = await freshDeps({ llm });
    const id = await saveAndProcess(deps, articles[0]!);
    const result = await getSaveResult(deps, USER, id);
    expect(result.status).toBe('partial');
    expect(result.verdicts.length).toBeGreaterThan(0);
    expect(result.tldr).toBeNull();
  });

  it('only matches claims from sources the user has read', async () => {
    const deps = await freshDeps();
    await saveAndProcess(deps, articles[0]!, false);
    const id = await saveAndProcess(deps, { url: 'https://example.com/again', title: 'again', body: articles[0]!.body.replace('2025', '2024') });
    const result = await getSaveResult(deps, USER, id);
    expect(result.newRatio).toBe(1);
    const first = await deps.graph.getSource(USER, id);
    expect(first?.readAt).not.toBeNull();
  });

  it('skips the TL;DR when under 20% of claims are new', async () => {
    const deps = await freshDeps();
    await saveAndProcess(deps, articles[0]!);
    const id = await saveAndProcess(deps, { url: 'https://example.com/copy', title: 'copy', body: articles[0]!.body.replace('2025', '2024') });
    const result = await getSaveResult(deps, USER, id);
    expect(result.newRatio).toBeLessThan(0.2);
    expect(result.tldr).toBeNull();
    expect(result.status).toBe('done');
  });
});
