import { z } from 'zod';

export const SplitClaimsResult = z.object({ claims: z.array(z.string()) });
export type SplitClaimsResult = z.infer<typeof SplitClaimsResult>;

export const LinkConceptsResult = z.object({
  links: z.array(
    z.object({ claimIndex: z.number().int(), concepts: z.array(z.string()) }),
  ),
});
export type LinkConceptsResult = z.infer<typeof LinkConceptsResult>;

export const TldrResult = z.object({
  bullets: z.array(z.string()),
  whyItMatters: z.string(),
  projectId: z.string().nullable(),
});
export type TldrResult = z.infer<typeof TldrResult>;

export const AnswerResult = z.object({
  answer: z.string(),
  usedClaimIds: z.array(z.string()),
});
export type AnswerResult = z.infer<typeof AnswerResult>;

export type StepName = 'split' | 'link' | 'tldr' | 'answer';

export const STEP_SCHEMAS = {
  split: SplitClaimsResult,
  link: LinkConceptsResult,
  tldr: TldrResult,
  answer: AnswerResult,
} as const;

/** One JSON schema per step, shared by every provider. */
export function jsonSchemaFor(step: StepName): Record<string, unknown> {
  const { $schema: _drop, ...schema } = z.toJSONSchema(STEP_SCHEMAS[step]) as Record<string, unknown>;
  return schema;
}

export const MAX_BULLETS = 3;
export const MAX_CLAIMS = 15;
