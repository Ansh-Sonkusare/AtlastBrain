import { Webhook } from 'standardwebhooks';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryGraph } from '../graph/memory';
import type { GraphPort, SourceRecord } from '../graph/port';
import { buildDevEvent } from './dev-event';
import { createCheckout } from './dodo';
import { ALLOWANCE, decideSave, monthStart, quotaFor } from './quota';
import { handleDodoEvent } from './webhook';

const NOW = new Date('2026-10-15T12:00:00Z');
const SECRET = 'whsec_es/JOsLTta2x/pdJfKqxM9gpcGVVQIXH';
const ENV = { DODO_PRO_PRODUCT_ID: 'pdt_pro', DODO_CREDITS_PRODUCT_ID: 'pdt_credits' };

let n = 0;
function source(userId: string, status: SourceRecord['status'], savedAt = NOW.toISOString()): SourceRecord {
  n += 1;
  return {
    id: `s${n}`, userId, url: `https://example.com/${n}`, title: 't', kind: 'web', status, savedAt,
    readAt: null, contentHash: `h${n}`, body: 'b', newRatio: 0, tldr: null,
  };
}

async function setup(userId = 'u1') {
  const graph = createMemoryGraph();
  await graph.ensureUser(userId, 'u@example.com');
  await graph.updateUser(userId, { dodoCustomerId: 'cus_1' });
  return graph;
}

async function save(graph: GraphPort, userId: string, count: number, savedAt?: string) {
  for (let i = 0; i < count; i++) await graph.createSource(source(userId, 'done', savedAt));
}

describe('decideSave', () => {
  it('allows saves up to the free allowance, then blocks', async () => {
    const graph = await setup();
    await save(graph, 'u1', ALLOWANCE.free - 1);
    expect(await decideSave(graph, 'u1', NOW)).toBe('allowed');
    await save(graph, 'u1', 1);
    expect(await decideSave(graph, 'u1', NOW)).toBe('blocked');
  });

  it('gives pro 500 saves', async () => {
    const graph = await setup();
    await graph.updateUser('u1', { plan: 'pro' });
    await save(graph, 'u1', 499);
    expect(await decideSave(graph, 'u1', NOW)).toBe('allowed');
    await save(graph, 'u1', 1);
    expect(await decideSave(graph, 'u1', NOW)).toBe('blocked');
  });

  it('spends one credit past the allowance, then blocks when credits run out', async () => {
    const graph = await setup();
    await save(graph, 'u1', ALLOWANCE.free);
    await graph.updateUser('u1', { credits: 2 });
    expect(await decideSave(graph, 'u1', NOW)).toBe('credit');
    expect((await graph.getUser('u1'))!.credits).toBe(1);
    expect(await decideSave(graph, 'u1', NOW)).toBe('credit');
    expect(await decideSave(graph, 'u1', NOW)).toBe('blocked');
    expect((await graph.getUser('u1'))!.credits).toBe(0);
  });

  it('counts per UTC month and ignores blocked sources', async () => {
    const graph = await setup();
    await save(graph, 'u1', ALLOWANCE.free, '2026-09-30T23:59:59.000Z');
    for (let i = 0; i < 5; i++) await graph.createSource(source('u1', 'blocked'));
    expect(monthStart(NOW)).toBe('2026-10-01T00:00:00.000Z');
    expect(await decideSave(graph, 'u1', NOW)).toBe('allowed');
  });

  it('quotaFor never blocks a source already admitted at capture', async () => {
    expect(await quotaFor(await setup()).allow('u1')).toBe(true);
  });
});

function signed(event: object, id = 'msg_1', secret = SECRET, at: Date = NOW) {
  const body = JSON.stringify(event);
  const signature = new Webhook(secret).sign(id, at, body);
  const headers = { 'webhook-id': id, 'webhook-timestamp': String(Math.floor(at.getTime() / 1000)), 'webhook-signature': signature };
  return { body, headers };
}

function verify(event: object, id: string, secret = SECRET): unknown {
  const { body, headers } = signed(event, id, secret, new Date());
  return new Webhook(SECRET).verify(body, headers);
}

const subEvent = (type: string, customerId = 'cus_1') => ({
  type, data: { payload_type: 'Subscription', product_id: 'pdt_pro', customer: { customer_id: customerId } },
});
const creditEvent = (customerId = 'cus_1') => ({
  type: 'payment.succeeded',
  data: { payload_type: 'Payment', customer: { customer_id: customerId }, product_cart: [{ product_id: 'pdt_credits', quantity: 1 }], metadata: {} },
});

describe('signature check', () => {
  it('accepts a good signature and rejects a bad one', () => {
    expect(verify(subEvent('subscription.active'), 'msg_a')).toMatchObject({ type: 'subscription.active' });
    expect(() => verify(subEvent('subscription.active'), 'msg_a', 'whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).toThrow();
  });

  it('rejects a body changed after signing', () => {
    const { body, headers } = signed(subEvent('subscription.active'), 'msg_1', SECRET, new Date());
    expect(() => new Webhook(SECRET).verify(body.replace('active', 'cancelled'), headers)).toThrow();
  });
});

describe('handleDodoEvent', () => {
  it('sets pro on subscription.active and back to free on cancel', async () => {
    const graph = await setup();
    expect(await handleDodoEvent(graph, subEvent('subscription.active'), 'm1', NOW, ENV)).toBe('applied');
    expect((await graph.getUser('u1'))!.plan).toBe('pro');
    expect(await handleDodoEvent(graph, subEvent('subscription.cancelled'), 'm2', NOW, ENV)).toBe('applied');
    expect((await graph.getUser('u1'))!.plan).toBe('free');
  });

  it.each(['subscription.renewed'])('treats %s as pro', async (type) => {
    const graph = await setup();
    await handleDodoEvent(graph, subEvent(type), 'm1', NOW, ENV);
    expect((await graph.getUser('u1'))!.plan).toBe('pro');
  });

  it.each(['subscription.expired', 'subscription.on_hold'])('treats %s as free', async (type) => {
    const graph = await setup();
    await graph.updateUser('u1', { plan: 'pro' });
    await handleDodoEvent(graph, subEvent(type), 'm1', NOW, ENV);
    expect((await graph.getUser('u1'))!.plan).toBe('free');
  });

  it('ignores a replayed webhook id', async () => {
    const graph = await setup();
    expect(await handleDodoEvent(graph, creditEvent(), 'same', NOW, ENV)).toBe('applied');
    expect(await handleDodoEvent(graph, creditEvent(), 'same', NOW, ENV)).toBe('duplicate');
    expect((await graph.getUser('u1'))!.credits).toBe(200);
  });

  it('adds 200 credits for the credits product only', async () => {
    const graph = await setup();
    await handleDodoEvent(graph, creditEvent(), 'm1', NOW, ENV);
    const other = { type: 'payment.succeeded', data: { customer: { customer_id: 'cus_1' }, product_cart: [{ product_id: 'other' }] } };
    expect(await handleDodoEvent(graph, other, 'm2', NOW, ENV)).toBe('ignored');
    expect((await graph.getUser('u1'))!.credits).toBe(200);
  });

  it('finds the user by metadata.user_id when the customer is unknown', async () => {
    const graph = await setup();
    const event = { type: 'subscription.active', data: { customer: { customer_id: 'cus_new' }, metadata: { user_id: 'u1' } } };
    expect(await handleDodoEvent(graph, event, 'm1', NOW, ENV)).toBe('applied');
    expect((await graph.getUser('u1'))!.plan).toBe('pro');
  });

  it('reports an unknown user without recording the id', async () => {
    const graph = await setup();
    expect(await handleDodoEvent(graph, subEvent('subscription.active', 'cus_x'), 'm1', NOW, ENV)).toBe('unknown_user');
    expect(await graph.recordWebhookEvent('m1', NOW.toISOString())).toBe(true);
  });

  it('rejects malformed events and ignores other types', async () => {
    const graph = await setup();
    expect(await handleDodoEvent(graph, { nope: 1 }, 'm1', NOW, ENV)).toBe('invalid');
    expect(await handleDodoEvent(graph, subEvent('subscription.plan_changed'), 'm2', NOW, ENV)).toBe('ignored');
  });

  it('moves blocked sources back to pending on upgrade and on credits, not on cancel', async () => {
    const graph = await setup();
    const a = source('u1', 'blocked');
    const b = source('u1', 'blocked');
    await graph.createSource(a);
    await graph.createSource(b);
    await handleDodoEvent(graph, subEvent('subscription.cancelled'), 'm0', NOW, ENV);
    expect(await graph.listSourcesByStatus('u1', 'blocked')).toHaveLength(2);
    await handleDodoEvent(graph, subEvent('subscription.active'), 'm1', NOW, ENV);
    expect(await graph.listSourcesByStatus('u1', 'blocked')).toHaveLength(0);
    expect(await graph.listSourcesByStatus('u1', 'pending')).toHaveLength(2);
    await graph.updateSource(a.id, { status: 'blocked' });
    await handleDodoEvent(graph, creditEvent(), 'm2', NOW, ENV);
    expect(await graph.listSourcesByStatus('u1', 'blocked')).toHaveLength(0);
  });

  it('spends a credit for each blocked save a credit pack admits', async () => {
    const graph = await setup();
    await save(graph, 'u1', 30);
    for (let i = 0; i < 3; i++) await graph.createSource(source('u1', 'blocked'));
    await handleDodoEvent(graph, creditEvent(), 'm1', NOW, ENV);
    expect(await graph.listSourcesByStatus('u1', 'pending')).toHaveLength(3);
    expect((await graph.getUser('u1'))!.credits).toBe(197);
  });

  it('applies the dev checkout events the stand-in sends', async () => {
    const graph = await setup();
    const env = { DODO_PRO_PRODUCT_ID: '', DODO_CREDITS_PRODUCT_ID: '' };
    const pro = buildDevEvent('pro', 'cus_1', NOW, env);
    const credits = buildDevEvent('credits', 'cus_1', NOW, env);
    await handleDodoEvent(graph, pro, 'm1', NOW, env);
    await handleDodoEvent(graph, credits, 'm2', NOW, env);
    expect(await graph.getUser('u1')).toMatchObject({ plan: 'pro', credits: 200 });
  });
});

describe('createCheckout', () => {
  it('returns the dev checkout URL when no API key is set', async () => {
    const graph = await setup();
    const user = (await graph.getUser('u1'))!;
    const url = await createCheckout(graph, user, 'pro', { APP_URL: 'http://localhost:3000' });
    expect(url).toBe('http://localhost:3000/dev/checkout?product=pro&user=u1');
  });

  it('refuses a mode other than test_mode', async () => {
    const graph = await setup();
    const user = (await graph.getUser('u1'))!;
    const env = { DODO_PAYMENTS_API_KEY: 'k', DODO_PAYMENTS_ENVIRONMENT: 'live_mode' };
    await expect(createCheckout(graph, user, 'pro', env)).rejects.toThrow('test_mode');
  });
});

describe('webhook route', () => {
  it('verifies the signature, applies the event, and rejects a bad one', async () => {
    vi.stubEnv('DODO_PAYMENTS_WEBHOOK_KEY', SECRET);
    vi.stubEnv('GRAPH', 'memory');
    const { getGraph } = await import('../deps');
    const { POST } = await import('../../app/api/webhooks/dodo/route');
    const graph = await getGraph();
    await graph.ensureUser('r1', 'r@example.com');
    await graph.updateUser('r1', { dodoCustomerId: 'cus_route' });
    const event = { type: 'subscription.active', data: { customer: { customer_id: 'cus_route' } } };
    const { body, headers } = signed(event, 'route_1', SECRET, new Date());
    const post = (b: string, h: Record<string, string>) =>
      POST(new Request('http://x/api/webhooks/dodo', { method: 'POST', body: b, headers: h }));
    expect((await post(body, headers)).status).toBe(200);
    expect((await graph.getUser('r1'))!.plan).toBe('pro');
    expect((await post(body.replace('active', 'cancelled'), headers)).status).toBe(400);
    vi.unstubAllEnvs();
  });
});
