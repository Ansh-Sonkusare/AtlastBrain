import { Webhook } from 'standardwebhooks';
import { handleDodoEvent } from '../../../../server/billing/webhook';
import { getGraph } from '../../../../server/deps';

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
  const outcome = await handleDodoEvent(await getGraph(), event, webhookId, new Date());
  return Response.json({ outcome });
}
