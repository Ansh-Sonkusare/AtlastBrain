import type { Project } from '../types';
import { contentWords, overlap, wordCount } from './text';
import { MAX_BULLETS, MAX_CLAIMS } from './schemas';
import type { LlmProvider } from './types';

function topWords(text: string, n: number): string[] {
  const counts = new Map<string, number>();
  for (const w of contentWords(text)) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

function bestProject(claims: string[], projects: Project[]): Project | null {
  const claimWords = new Set(claims.flatMap(contentWords));
  let best: Project | null = null;
  let bestScore = 0;
  for (const p of projects) {
    const score = overlap(new Set(contentWords(`${p.name} ${p.description}`)), claimWords);
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

const STUB_ANSWER_CLAIMS = 3;

export const stubProvider: LlmProvider = {
  async splitClaims(text) {
    const claims = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => wordCount(s) >= 4)
      .slice(0, MAX_CLAIMS);
    return { claims };
  },

  async linkConcepts(claims, knownConceptNames) {
    const known = knownConceptNames.map((name) => ({ name, words: new Set(contentWords(name)) }));
    return {
      links: claims.map((claim, claimIndex) => {
        const words = new Set(contentWords(claim));
        let best: string | null = null;
        let bestScore = 0;
        for (const k of known) {
          const score = overlap(k.words, words);
          if (score > bestScore) {
            best = k.name;
            bestScore = score;
          }
        }
        return { claimIndex, concepts: best ? [best] : topWords(claim, 2) };
      }),
    };
  },

  async writeTldr(newClaims, projects) {
    const project = bestProject(newClaims, projects);
    return {
      bullets: newClaims.slice(0, MAX_BULLETS),
      whyItMatters: project
        ? `This is new to you and matters for ${project.name}.`
        : 'This is new to you.',
      projectId: project?.id ?? null,
    };
  },

  async explainNode(node, neighbors) {
    const by = (t: string) => neighbors.filter((n) => n.type === t).map((n) => n.label);
    const parts = [`This ${node.type.toLowerCase()} is "${node.label}".`];
    for (const t of ['Source', 'Claim', 'Concept', 'Project']) {
      const labels = by(t).slice(0, 3);
      if (labels.length) parts.push(`It connects to ${by(t).length} ${t.toLowerCase()}(s), such as ${labels.map((l) => `"${l}"`).join(', ')}.`);
    }
    if (parts.length === 1) parts.push('It has no connections yet.');
    return { explanation: parts.join(' ') };
  },

  async answer(_question, claims) {
    const used = claims.slice(0, STUB_ANSWER_CLAIMS);
    return { answer: used.map((c) => c.claimText).join(' '), usedClaimIds: used.map((c) => c.claimId) };
  },
};
