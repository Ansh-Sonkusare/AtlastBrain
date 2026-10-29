import { ALLOWANCE, monthStart } from '../../../server/billing/quota';
import { CORS_HEADERS } from '../../../server/billing/cors';
import { json, OPTIONS, placeholderEmail, withUser } from '../_lib/http';

export { OPTIONS };

export const GET = withUser(async ({ userId, deps }) => {
  const user = await deps.graph.ensureUser(userId, placeholderEmail(userId));
  const used = await deps.graph.countSavesSince(userId, monthStart(deps.now()));
  return json({ user, usage: { used, limit: ALLOWANCE[user.plan], credits: user.credits } });
});

export const DELETE = withUser(async ({ userId, deps }) => {
  await deps.graph.deleteUser(userId);
  return new Response(null, { status: 204, headers: CORS_HEADERS });
});
