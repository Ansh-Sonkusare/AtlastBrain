import { CORS_HEADERS } from '../../../../server/billing/cors';
import { createCheckout } from '../../../../server/billing/dodo';
import { isProduct } from '../../../../server/billing/products';
import { getGraph } from '../../../../server/deps';

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request): Promise<Response> {
  const userId = request.headers.get('x-user-id');
  if (!userId) return json({ error: 'missing user' }, 401);
  const body: unknown = await request.json().catch(() => null);
  const product = (body as { product?: unknown } | null)?.product;
  if (!isProduct(product)) return json({ error: 'product must be "pro" or "credits"' }, 400);
  try {
    const graph = await getGraph();
    const user = await graph.ensureUser(userId, `${userId}@example.invalid`);
    return json({ checkoutUrl: await createCheckout(graph, user, product) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'checkout failed' }, 500);
  }
}
