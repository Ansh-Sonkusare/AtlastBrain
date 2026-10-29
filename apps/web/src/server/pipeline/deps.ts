import { embed } from '../embed';
import type { GraphPort } from '../graph/port';
import type { LlmProvider } from '../llm';

export interface PipelineConfig {
  /** A claim closer than this to a claim the user has read is a repeat. */
  noveltyMaxDist: number;
  /** A concept name closer than this to an existing concept reuses it. */
  conceptReuseDist: number;
  /** A new concept links to the nearest project within this distance. */
  conceptProjectDist: number;
  /** Below this share of new claims there is no TL;DR. */
  minNewRatio: number;
}

export interface Quota {
  allow(userId: string): Promise<boolean>;
}

export interface PipelineDeps {
  graph: GraphPort;
  llm: LlmProvider;
  embed: (texts: string[]) => Promise<number[][]>;
  quota: Quota;
  now: () => Date;
  config: PipelineConfig;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): PipelineConfig {
  const noveltyMaxDist = env.NOVELTY_MAX_DIST === undefined ? 0.36 : Number(env.NOVELTY_MAX_DIST);
  if (!Number.isFinite(noveltyMaxDist) || noveltyMaxDist <= 0) {
    throw new Error(`Invalid NOVELTY_MAX_DIST: ${env.NOVELTY_MAX_DIST}`);
  }
  return { noveltyMaxDist, conceptReuseDist: 0.25, conceptProjectDist: 0.6, minNewRatio: 0.2 };
}

export function createDeps(parts: Pick<PipelineDeps, 'graph' | 'llm'> & Partial<PipelineDeps>): PipelineDeps {
  return {
    embed,
    quota: { allow: async () => true },
    now: () => new Date(),
    config: configFromEnv(),
    ...parts,
  };
}
