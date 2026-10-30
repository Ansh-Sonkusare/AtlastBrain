import { after } from 'next/server';
import { createCheckout } from '../../../server/billing/dodo';
import { withBillingLock } from '../../../server/billing/lock';
import { decideSave } from '../../../server/billing/quota';
import { capture } from '../../../server/pipeline/capture';
import { processSource } from '../../../server/pipeline/process';
import { CapturePayload } from '../../../server/types';
import { ensureAccount } from '../../../server/auth/identity';
import { json, OPTIONS, withUser } from '../_lib/http';

export { OPTIONS };

/** A voice note has no URL. The save time is the server's, so a client cannot backdate saves out of the quota. */
const Body = CapturePayload.omit({ capturedAt: true }).partial({ url: true });

export const POST = withUser(async ({ request, userId, deps }) => {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400);

  const user = await ensureAccount(deps.graph, userId);
  const { source } = await withBillingLock(() =>
    capture(deps, userId, parsed.data, {
      admit: async () => ((await decideSave(deps.graph, userId, deps.now())) === 'blocked' ? 'blocked' : 'pending'),
    }),
  );
  if (source.status !== 'blocked') {
    // ponytail: a function killed mid-save leaves the source `processing`; requeueStuck needs a cron if that shows up.
    after(() =>
      processSource(deps, userId, source.id, { markRead: true }).catch((err) =>
        console.error(`capture: source ${source.id} failed:`, err),
      ),
    );
    return json({ sourceId: source.id, status: source.status }, 202);
  }
  const checkoutUrl = await createCheckout(deps.graph, user, 'pro');
  return json({ sourceId: source.id, status: 'blocked', checkoutUrl, reason: 'quota' }, 202);
});
