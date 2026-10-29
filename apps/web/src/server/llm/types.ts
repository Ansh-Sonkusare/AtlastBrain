import type { Project } from '../types';
import type { LinkConceptsResult, SplitClaimsResult, TldrResult } from './schemas';

export interface LlmProvider {
  splitClaims(text: string): Promise<SplitClaimsResult>;
  linkConcepts(
    claims: string[],
    knownConceptNames: string[],
    projects: Project[],
  ): Promise<LinkConceptsResult>;
  writeTldr(newClaims: string[], projects: Project[]): Promise<TldrResult>;
}

export type LlmProfile = 'stub' | 'local' | 'cheap' | 'demo';
