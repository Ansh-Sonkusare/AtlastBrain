import { randomUUID } from 'node:crypto';
import { cosineDistance } from '../embed';
import type { ConceptRecord, ProjectRecord } from '../graph/port';
import type { Tldr } from '../types';
import type { PipelineDeps } from './deps';

export interface ProcessOptions {
  /** Mark the source READ by the user once processed. Defaults to true. */
  markRead?: boolean;
}

interface NewClaimRow {
  id: string;
  text: string;
  embedding: number[];
}

export function conceptId(userId: string, name: string): string {
  return `${userId}::${name.trim().toLowerCase()}`;
}

function nearest<T extends { embedding: number[] }>(
  vec: number[],
  items: T[],
  maxDist: number,
): T | null {
  let best: T | null = null;
  let bestDist = maxDist;
  for (const item of items) {
    const d = cosineDistance(vec, item.embedding);
    if (d <= bestDist) {
      best = item;
      bestDist = d;
    }
  }
  return best;
}

async function linkNewClaims(
  deps: PipelineDeps,
  userId: string,
  claims: NewClaimRow[],
  projects: ProjectRecord[],
): Promise<void> {
  const { graph, llm, config } = deps;
  const concepts: ConceptRecord[] = await graph.listConcepts(userId);
  const { links } = await llm.linkConcepts(
    claims.map((c) => c.text),
    concepts.map((c) => c.name),
    projects.map(({ id, name, description }) => ({ id, name, description })),
  );

  const wanted = new Map<string, string>();
  for (const link of links) {
    for (const raw of link.concepts) {
      const name = raw.trim();
      if (name) wanted.set(name.toLowerCase(), name);
    }
  }
  const byName = new Map(concepts.map((c) => [c.name.toLowerCase(), c]));
  const toEmbed = [...wanted.entries()].filter(([key]) => !byName.has(key));
  const vectors = await deps.embed(toEmbed.map(([, name]) => name));

  const resolved = new Map<string, ConceptRecord>();
  for (const [key, c] of byName) if (wanted.has(key)) resolved.set(key, c);
  for (const [i, [key, name]] of toEmbed.entries()) {
    const vec = vectors[i]!;
    let concept = nearest(vec, concepts, config.conceptReuseDist);
    if (!concept) {
      concept = { id: conceptId(userId, name), name, embedding: vec };
      const project = nearest(vec, projects, config.conceptProjectDist);
      await graph.upsertConcept(userId, concept, project ? [project.id] : []);
      concepts.push(concept);
    }
    resolved.set(key, concept);
  }

  for (const link of links) {
    const claim = claims[link.claimIndex];
    if (!claim) continue;
    for (const raw of new Set(link.concepts.map((n) => n.trim().toLowerCase()))) {
      const concept = resolved.get(raw);
      if (concept) await graph.linkAbout(claim.id, concept.id);
    }
  }
}

/**
 * Runs the five PRD steps for one pending source. A step that throws leaves the source
 * `partial` with whatever was already written.
 */
export async function processSource(
  deps: PipelineDeps,
  userId: string,
  sourceId: string,
  options: ProcessOptions = {},
): Promise<void> {
  const { graph, llm, config } = deps;
  const source = await graph.getSource(userId, sourceId);
  if (!source || source.status !== 'pending') return;

  await graph.updateSource(sourceId, { status: 'processing' });
  try {
    if (!(await deps.quota.allow(userId))) {
      await graph.updateSource(sourceId, { status: 'blocked' });
      return;
    }

    const { claims: texts } = await llm.splitClaims(source.body);
    const vectors = await deps.embed(texts);
    const created: NewClaimRow[] = [];
    for (const [i, text] of texts.entries()) {
      const embedding = vectors[i]!;
      const [match] = await graph.knownClaims(userId, embedding, config.noveltyMaxDist);
      if (match) {
        await graph.addRepeat(sourceId, match.claimId, text, match.distance);
      } else {
        const claim = { id: randomUUID(), text, embedding };
        await graph.addClaim(sourceId, { ...claim, firstSeen: deps.now().toISOString() });
        created.push(claim);
      }
    }
    const newRatio = texts.length === 0 ? 0 : created.length / texts.length;
    await graph.updateSource(sourceId, { newRatio });

    const projects = await graph.listProjects(userId);
    if (created.length > 0) await linkNewClaims(deps, userId, created, projects);

    let tldr: Tldr | null = null;
    if (created.length > 0 && newRatio >= config.minNewRatio) {
      tldr = await llm.writeTldr(
        created.map((c) => c.text),
        projects.map(({ id, name, description }) => ({ id, name, description })),
      );
    }

    if (options.markRead ?? true) await graph.markRead(userId, sourceId, deps.now().toISOString());
    await graph.updateSource(sourceId, { tldr, status: 'done' });
  } catch (err) {
    console.error(`processSource ${sourceId} failed:`, err);
    await graph.updateSource(sourceId, { status: 'partial' });
  }
}
