import { ensureAccount } from '../../../../server/auth/identity';
import { createCheckout } from '../../../../server/billing/dodo';
import { isProduct } from '../../../../server/billing/products';
import { json, OPTIONS, withUser } from '../../_lib/http';

export { OPTIONS };

export const POST = withUser(async ({ request, userId, deps }) => {
  const body: unknown = await request.json().catch(() => null);
  const product = (body as { product?: unknown } | null)?.product;
  if (!isProduct(product)) return json({ error: 'product must be "pro" or "credits"' }, 400);
  const user = await ensureAccount(deps.graph, userId);
  return json({ checkoutUrl: await createCheckout(deps.graph, user, product) });
});
