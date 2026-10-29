import { z } from 'zod';
import { askBrain } from '../../../server/brain/ask';
import { json, OPTIONS, withUser } from '../_lib/http';

export { OPTIONS };

const Body = z.object({ question: z.string().trim().min(1).max(2000) });

export const POST = withUser(async ({ request, userId, deps }) => {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'question: a non-empty string is required' }, 400);
  return json(await askBrain(deps, userId, parsed.data.question));
});
