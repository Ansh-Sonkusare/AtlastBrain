import DodoPayments from 'dodopayments';
import type { GraphPort } from '../graph/port';
import type { User } from '../types';
import { appUrl, devCheckoutEnabled, productIds, type Product, type Env } from './products';

function client(env: Env): DodoPayments {
  const environment = env.DODO_PAYMENTS_ENVIRONMENT ?? 'test_mode';
  if (environment !== 'test_mode') throw new Error(`Dodo runs in test_mode only, got ${environment}`);
  return new DodoPayments({ bearerToken: env.DODO_PAYMENTS_API_KEY, environment: 'test_mode' });
}

export function devCheckoutUrl(user: User, product: Product, env: Env = process.env): string {
  const query = new URLSearchParams({ product, user: user.id });
  return `${appUrl(env)}/dev/checkout?${query}`;
}

/** Returns a Dodo test checkout URL, or the local stand-in when no API key is set. */
export async function createCheckout(
  graph: GraphPort,
  user: User,
  product: Product,
  env: Env = process.env,
): Promise<string> {
  if (devCheckoutEnabled(env)) return devCheckoutUrl(user, product, env);
  if (!env.DODO_PAYMENTS_API_KEY) throw new Error('Checkout is not configured');
  const dodo = client(env);
  let customerId = user.dodoCustomerId;
  if (!customerId) {
    const customer = await dodo.customers.create({ email: user.email, name: user.email.split('@')[0], metadata: { user_id: user.id } });
    customerId = customer.customer_id;
    await graph.updateUser(user.id, { dodoCustomerId: customerId });
  }
  const session = await dodo.checkoutSessions.create({
    product_cart: [{ product_id: productIds(env)[product], quantity: 1 }],
    customer: { customer_id: customerId },
    return_url: `${appUrl(env)}/dashboard`,
    metadata: { user_id: user.id, kind: product },
  });
  if (!session.checkout_url) throw new Error('Dodo returned no checkout_url');
  return session.checkout_url;
}
