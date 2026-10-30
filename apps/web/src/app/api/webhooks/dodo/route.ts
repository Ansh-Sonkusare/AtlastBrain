import { after } from 'next/server';
import { Webhook } from 'standardwebhooks';
import { withBillingLock } from '../../../../server/billing/lock';
import { handleDodoEvent } from '../../../../server/billing/webhook';
import { getDeps } from '../../../../server/deps';
import { processSource } from '../../../../server/pipeline/process';

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  if (!secret) return Response.json({ error: 'webhook key not set' }, { status: 500 });
  const rawBody = await request.text();
  const webhookId = request.headers.get('webhook-id') ?? '';
  let event: unknown;
  try {
    event = new Webhook(secret).verify(rawBody, {
      'webhook-id': webhookId,
      'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
      'webhook-signature': request.headers.get('webhook-signature') ?? '',
    });
  } catch {
    return Response.json({ error: 'invalid signature' }, { status: 400 });
  }
  const deps = await getDeps();
  const outcome = await withBillingLock(() => handleDodoEvent(deps.graph, event, webhookId, new Date()));
  // A payment can release blocked saves back to `pending`; nothing else picks them up on Vercel.
  if (outcome === 'applied') {
    after(async () => {
      for (const source of await deps.graph.listPendingSources(10)) {
        await processSource(deps, source.userId, source.id, { markRead: true }).catch((err) =>
          console.error(`webhook: source ${source.id} failed:`, err),
        );
      }
    });
  }
  return Response.json({ outcome });
}
