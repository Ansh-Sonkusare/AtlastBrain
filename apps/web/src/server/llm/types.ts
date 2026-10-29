import type { ClaimMatch, Project } from '../types';
import type { AnswerResult, LinkConceptsResult, SplitClaimsResult, TldrResult } from './schemas';

export interface LlmProvider {
  splitClaims(text: string): Promise<SplitClaimsResult>;
  linkConcepts(
    claims: string[],
    knownConceptNames: string[],
    projects: Project[],
  ): Promise<LinkConceptsResult>;
  writeTldr(newClaims: string[], projects: Project[]): Promise<TldrResult>;
  /** Answers from the given claims only. `usedClaimIds` names the claims the answer relied on, in order. */
  answer(question: string, claims: ClaimMatch[]): Promise<AnswerResult>;
}

export type LlmProfile = 'stub' | 'local' | 'cheap' | 'demo';
