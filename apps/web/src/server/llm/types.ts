import type { ClaimMatch, GraphNode, Project } from '../types';
import type { AnswerResult, ExplainResult, LinkConceptsResult, SplitClaimsResult, TldrResult } from './schemas';

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
  /** Explains a graph node from its own label and its neighbors' types and labels. No graph lookup. */
  explainNode(node: ExplainNode, neighbors: ExplainNode[]): Promise<ExplainResult>;
}

export type ExplainNode = Pick<GraphNode, 'type' | 'label'>;

export type LlmProfile = 'stub' | 'local' | 'cheap' | 'demo';
