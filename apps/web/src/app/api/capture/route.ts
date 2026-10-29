import { createCheckout } from '../../../server/billing/dodo';
import { decideSave } from '../../../server/billing/quota';
import { capture } from '../../../server/pipeline/capture';
import { CapturePayload } from '../../../server/types';
import { json, OPTIONS, placeholderEmail, withUser } from '../_lib/http';

export { OPTIONS };

/** A voice note has no URL. */
const Body = CapturePayload.partial({ url: true });

export const POST = withUser(async ({ request, userId, deps }) => {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400);

  const user = await deps.graph.ensureUser(userId, placeholderEmail(userId));
  const { source } = await capture(deps, userId, parsed.data, {
    admit: async () => ((await decideSave(deps.graph, userId, deps.now())) === 'blocked' ? 'blocked' : 'pending'),
  });
  if (source.status !== 'blocked') return json({ sourceId: source.id, status: source.status }, 202);
  const checkoutUrl = await createCheckout(deps.graph, user, 'pro');
  return json({ sourceId: source.id, status: 'blocked', checkoutUrl, reason: 'quota' }, 202);
});
