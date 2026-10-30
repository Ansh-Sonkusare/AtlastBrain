import { z } from 'zod';
import { MAX_LABEL_CHARS, MAX_NEIGHBORS } from '../../../server/llm';
import { json, OPTIONS, withUser } from '../_lib/http';

export { OPTIONS };

const Node = z.object({
  type: z.enum(['Source', 'Claim', 'Concept', 'Project']),
  label: z.string().trim().min(1).max(MAX_LABEL_CHARS),
});
export const Body = z.object({ node: Node, neighbors: z.array(Node).max(MAX_NEIGHBORS) });

export const POST = withUser(async ({ request, deps }) => {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'node and neighbors (at most 30) with a type and a short label are required' }, 400);
  return json(await deps.llm.explainNode(parsed.data.node, parsed.data.neighbors));
});
