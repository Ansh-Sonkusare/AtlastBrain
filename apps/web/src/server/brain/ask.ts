import type { PipelineDeps } from '../pipeline/deps';
import type { BrainAnswer, ClaimMatch } from '../types';

export const NOTHING_YET = 'Nothing in your brain about that yet.';
const TOP_K = 8;

/** Answers from the user's own claims. Citations are the claims the model used, in the order it used them. */
export async function askBrain(
  deps: Pick<PipelineDeps, 'graph' | 'llm' | 'embed'>,
  userId: string,
  question: string,
): Promise<BrainAnswer> {
  const [vector] = await deps.embed([question]);
  const claims = await deps.graph.searchClaims(userId, vector!, TOP_K);
  if (claims.length === 0) return { question, answer: NOTHING_YET, citations: [] };

  const { answer, usedClaimIds } = await deps.llm.answer(question, claims);
  const byId = new Map(claims.map((c) => [c.claimId, c]));
  const citations: ClaimMatch[] = [];
  for (const id of new Set(usedClaimIds)) {
    const claim = byId.get(id);
    if (claim) citations.push(claim);
  }
  return { question, answer, citations };
}
