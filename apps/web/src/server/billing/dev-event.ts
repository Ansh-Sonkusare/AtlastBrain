import { randomUUID } from 'node:crypto';
import { Webhook } from 'standardwebhooks';
import type { GraphPort } from '../graph/port';
import { appUrl, CREDITS_PER_PACK, productIds, type Product, type Env } from './products';

export function buildDevEvent(product: Product, customerId: string, now: Date, env: Env = process.env) {
  const productId = productIds(env)[product];
  const customer = { customer_id: customerId, email: `${customerId}@example.invalid`, name: customerId };
  const timestamp = now.toISOString();
  if (product === 'pro') {
    return {
      type: 'subscription.active',
      timestamp,
      data: { payload_type: 'Subscription', subscription_id: `dev_sub_${customerId}`, status: 'active', product_id: productId, customer },
    };
  }
  return {
    type: 'payment.succeeded',
    timestamp,
    data: {
      payload_type: 'Payment',
      payment_id: `dev_pay_${randomUUID()}`,
      status: 'succeeded',
      customer,
      product_cart: [{ product_id: productId, quantity: 1 }],
      metadata: { kind: 'credit_pack', credits: CREDITS_PER_PACK },
    },
  };
}

/** Stands in for Dodo: signs the event the way Dodo would and posts it to our own webhook. */
export async function sendDevPayment(
  graph: GraphPort,
  userId: string,
  product: Product,
  env: Env = process.env,
  now: Date = new Date(),
): Promise<number> {
  const secret = env.DODO_PAYMENTS_WEBHOOK_KEY;
  if (!secret) throw new Error('DODO_PAYMENTS_WEBHOOK_KEY is not set');
  const user = (await graph.getUser(userId)) ?? (await graph.ensureUser(userId, `${userId}@example.invalid`));
  const customerId = user.dodoCustomerId || `dev_cus_${userId}`;
  if (!user.dodoCustomerId) await graph.updateUser(userId, { dodoCustomerId: customerId });

  const body = JSON.stringify(buildDevEvent(product, customerId, now, env));
  const id = `msg_${randomUUID()}`;
  const res = await fetch(`${appUrl(env)}/api/webhooks/dodo`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(now.getTime() / 1000)),
      'webhook-signature': new Webhook(secret).sign(id, now, body),
    },
    body,
  });
  return res.status;
}
