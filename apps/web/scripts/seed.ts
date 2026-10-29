import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { embed } from '../src/server/embed';
import { createTigerGraph, waitForVectorIndex } from '../src/server/graph/tigergraph';
import { stubProvider } from '../src/server/llm/stub';
import { capture } from '../src/server/pipeline/capture';
import { createDeps } from '../src/server/pipeline/deps';
import { conceptId, processSource } from '../src/server/pipeline/process';

const SEED_DIR = path.resolve(import.meta.dirname, '../../../fixtures/seed');
const SPREAD_DAYS = 60;
const DAY_MS = 86_400_000;

interface SeedProject { id: string; name: string; description: string }
interface SeedConcept { name: string; projects: string[] }
interface SeedArticle { id: string; url: string; title: string; read: boolean; concepts: string[]; body: string }

const load = <T>(file: string): T => JSON.parse(readFileSync(path.join(SEED_DIR, file), 'utf8')) as T;

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { user: { type: 'string', default: 'demo' } } });
  const userId = values.user!;
  const projectId = (fixtureId: string) => `${userId}::${fixtureId}`;

  const projects = load<SeedProject[]>('projects.json');
  const concepts = load<SeedConcept[]>('concepts.json');
  const articles = load<SeedArticle[]>('articles.json');

  const graph = createTigerGraph();
  await graph.deleteUser(userId);
  await graph.ensureUser(userId, `${userId}@example.com`);

  const projectVecs = await embed(projects.map((p) => `${p.name}. ${p.description}`));
  for (const [i, p] of projects.entries()) {
    await graph.upsertProject(userId, { id: projectId(p.id), name: p.name, description: p.description, embedding: projectVecs[i]! });
  }
  const conceptVecs = await embed(concepts.map((c) => c.name));
  for (const [i, c] of concepts.entries()) {
    await graph.upsertConcept(userId, { id: conceptId(userId, c.name), name: c.name, embedding: conceptVecs[i]! }, c.projects.map(projectId));
  }

  const start = Date.now();
  const monthStart = Date.UTC(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth(), 1);
  const timings: number[] = [];
  const sourceIds: string[] = [];
  for (const [i, article] of articles.entries()) {
    const t0 = Date.now();
    const span = monthStart - 1 - (start - SPREAD_DAYS * DAY_MS);
    const capturedAt = new Date(start - SPREAD_DAYS * DAY_MS + (articles.length === 1 ? 0 : (i * span) / (articles.length - 1)));
    const deps = createDeps({
      graph,
      llm: { ...stubProvider, linkConcepts: async (claims) => ({ links: claims.map((_, claimIndex) => ({ claimIndex, concepts: article.concepts })) }) },
      now: () => capturedAt,
    });
    const { source, duplicate } = await capture(deps, userId, {
      url: article.url,
      title: article.title,
      text: article.body,
      source: 'web',
      capturedAt: capturedAt.toISOString(),
    });
    if (duplicate) throw new Error(`Duplicate seed article ${article.id}`);
    await processSource(deps, userId, source.id, { markRead: article.read });
    await waitForVectorIndex();
    sourceIds.push(source.id);
    timings.push(Date.now() - t0);
    console.log(`${article.id} ${article.read ? 'read  ' : 'unread'} ${timings.at(-1)} ms`);
  }

  let made = 0;
  let repeated = 0;
  const statuses: Record<string, number> = {};
  for (const id of sourceIds) {
    const claims = await graph.sourceClaims(userId, id);
    made += claims.made.length;
    repeated += claims.repeated.length;
    const status = (await graph.getSource(userId, id))!.status;
    statuses[status] = (statuses[status] ?? 0) + 1;
  }
  const sorted = [...timings].sort((a, b) => a - b);
  console.log(JSON.stringify({
    user: userId,
    projects: (await graph.listProjects(userId)).length,
    concepts: (await graph.listConcepts(userId)).length,
    sources: sourceIds.length,
    read: articles.filter((a) => a.read).length,
    statuses,
    claimsMade: made,
    claimsRepeated: repeated,
    savesInLast60Days: await graph.countSavesSince(userId, new Date(start - SPREAD_DAYS * DAY_MS).toISOString()),
    savesThisMonth: await graph.countSavesSince(userId, new Date(monthStart).toISOString()),
    perArticleMs: { mean: Math.round(timings.reduce((a, b) => a + b, 0) / timings.length), median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1) },
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
