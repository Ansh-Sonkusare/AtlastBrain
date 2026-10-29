import { json, OPTIONS, withUser } from '../_lib/http';

export { OPTIONS };

export const GET = withUser(async ({ userId, deps }) => json({ items: await deps.graph.learnNext(userId, 3) }));
