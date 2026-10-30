import { buildVault, zipVault } from '../../../server/brain/export';
import { createCheckout } from '../../../server/billing/dodo';
import { CORS_HEADERS } from '../../../server/billing/cors';
import { ensureAccount } from '../../../server/auth/identity';
import { json, OPTIONS, withUser } from '../_lib/http';

export { OPTIONS };

export const GET = withUser(async ({ userId, deps }) => {
  const user = await ensureAccount(deps.graph, userId);
  if (user.plan !== 'pro') {
    const checkoutUrl = await createCheckout(deps.graph, user, 'pro');
    return json({ error: 'Export to Obsidian is a Pro feature', checkoutUrl }, 402);
  }
  const zip = zipVault(buildVault(await deps.graph.exportGraph(userId)));
  return new Response(new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), {
    headers: { ...CORS_HEADERS, 'content-disposition': 'attachment; filename="second-brain.zip"' },
  });
});
