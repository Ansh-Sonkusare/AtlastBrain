import { z } from 'zod';
import type { GraphPort } from '../graph/port';
import type { Plan, User } from '../types';
import { CREDITS_PER_PACK, productIds, type Env } from './products';
import { decideSave } from './quota';

const eventSchema = z.object({
  type: z.string(),
  data: z.looseObject({
    customer: z.looseObject({ customer_id: z.string().optional() }).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    product_id: z.string().optional(),
    product_cart: z.array(z.looseObject({ product_id: z.string() })).nullish(),
  }),
});

export type DodoWebhookOutcome = 'applied' | 'duplicate' | 'ignored' | 'unknown_user' | 'invalid';

const PLAN_BY_EVENT: Record<string, Plan> = {
  'subscription.active': 'pro',
  'subscription.renewed': 'pro',
  'subscription.cancelled': 'free',
  'subscription.expired': 'free',
  'subscription.on_hold': 'free',
};

async function findUser(graph: GraphPort, data: z.infer<typeof eventSchema>['data']): Promise<User | null> {
  const customerId = data.customer?.customer_id;
  const byCustomer = customerId ? await graph.findUserByDodoCustomer(customerId) : null;
  if (byCustomer) return byCustomer;
  const userId = data.metadata?.user_id;
  return typeof userId === 'string' ? graph.getUser(userId) : null;
}

/** Applies one verified Dodo event. Each webhook id applies once. */
export async function handleDodoEvent(
  graph: GraphPort,
  event: unknown,
  webhookId: string,
  now: Date,
  env: Env = process.env,
): Promise<DodoWebhookOutcome> {
  const parsed = eventSchema.safeParse(event);
  if (!parsed.success) return 'invalid';
  const { type, data } = parsed.data;
  const ids = productIds(env);

  const plan = PLAN_BY_EVENT[type];
  const isCreditPack =
    type === 'payment.succeeded' && (data.product_cart ?? []).some((item) => item.product_id === ids.credits);
  if (plan === undefined && !isCreditPack) return 'ignored';
  if (plan !== undefined && data.product_id !== undefined && data.product_id !== ids.pro) return 'ignored';

  const user = await findUser(graph, data);
  if (!user) return 'unknown_user';
  // Recorded before applying: a credit grant must never run twice. A crash between the two loses one event.
  if (!(await graph.recordWebhookEvent(webhookId, now.toISOString()))) return 'duplicate';

  if (plan !== undefined) await graph.updateUser(user.id, { plan });
  else await graph.updateUser(user.id, { credits: user.credits + CREDITS_PER_PACK });

  if (plan !== 'free') {
    const blocked = await graph.listSourcesByStatus(user.id, 'blocked');
    blocked.sort((a, b) => a.savedAt.localeCompare(b.savedAt));
    for (const source of blocked) {
      if ((await decideSave(graph, user.id, now)) === 'blocked') break;
      await graph.updateSource(source.id, { status: 'pending' });
    }
  }
  return 'applied';
}
