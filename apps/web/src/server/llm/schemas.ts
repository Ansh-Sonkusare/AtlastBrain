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

export type StepName = 'split' | 'link' | 'tldr';

export const STEP_SCHEMAS = {
  split: SplitClaimsResult,
  link: LinkConceptsResult,
  tldr: TldrResult,
} as const;

/** One JSON schema per step, shared by every provider. */
export function jsonSchemaFor(step: StepName): Record<string, unknown> {
  const { $schema: _drop, ...schema } = z.toJSONSchema(STEP_SCHEMAS[step]) as Record<string, unknown>;
  return stripIntegerBounds(schema) as Record<string, unknown>;
}

// Zod adds safe-integer minimum/maximum to every .int(); Claude's structured output rejects them.
function stripIntegerBounds(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripIntegerBounds);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if ((node as Record<string, unknown>).type === 'integer' && (key === 'minimum' || key === 'maximum')) continue;
    out[key] = stripIntegerBounds(value);
  }
  return out;
}

export const MAX_BULLETS = 3;
export const MAX_CLAIMS = 15;
