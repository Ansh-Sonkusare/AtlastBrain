# Dodo Payments integration (Node / TypeScript / Next.js, TEST mode)

Researched 2026-10-29. Sources: docs.dodopayments.com (the `.md` form of each page), the `dodopayments@2.59.0` npm tarball (read `.d.ts` and `.js` files directly), the `standardwebhooks` npm package, and GitHub `dodopayments/*`.
"VERIFIED LOCALLY" means I ran the code in a scratch directory on 2026-10-29. "UNCONFIRMED" means I found no primary source.
Dodo ships SDK versions very fast (2.57, 2.58, 2.59 within 5 days, see CHANGELOG). Pin the version.

---

## 1. Package, client construction, base URLs

- npm package: `dodopayments`. Latest on 2026-10-29 is `2.59.0` (published 2026-10-28). Source: https://registry.npmjs.org/dodopayments (repo: https://github.com/dodopayments/dodopayments-typescript). It depends on `standardwebhooks@^1.0.0`. Node 20+ required: https://docs.dodopayments.com/developer-resources/integration-guide.md
- Install: `npm install dodopayments` (add `standardwebhooks` only if you verify by hand).
- The TypeScript SDK replaces the legacy Node.js SDK: https://docs.dodopayments.com/developer-resources/dodo-payments-sdks.md
- Env var for the bearer token: `DODO_PAYMENTS_API_KEY` (SDK reads it by default). Env var for the webhook secret: `DODO_PAYMENTS_WEBHOOK_KEY`. Env var for a base URL override: `DODO_PAYMENTS_BASE_URL`. Source: SDK `client.js` lines 74 and the README, https://github.com/dodopayments/dodopayments-typescript
- `environment` accepts `'test_mode'` or `'live_mode'`. The default is `live_mode`. A wrong default is the most common mistake, so always set it explicitly.
- Base URLs (SDK `client.js` line 53-54, and https://docs.dodopayments.com/miscellaneous/test-mode-vs-live-mode.md):
  - test: `https://test.dodopayments.com`
  - live: `https://live.dodopayments.com`
- Do not pass both `baseURL` and `environment`. The SDK throws "Ambiguous URL" (`client.js` line 125-126).
- Key prefixes: test keys start with `dodo_test_`, live keys with `dodo_live_`. A test key sent to the live host (or the reverse) returns `401`. Products, API keys and webhooks are separate per mode. Source: test-mode-vs-live-mode page above.

```ts
// lib/dodo.ts
import DodoPayments from 'dodopayments';

export const dodo = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY,   // dodo_test_...
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY, // whsec_...  (used by client.webhooks.unwrap)
  environment: 'test_mode',                          // default is 'live_mode'
});
// VERIFIED LOCALLY: new DodoPayments({ environment: 'test_mode' }).baseURL === 'https://test.dodopayments.com'
```

Optional: the official Next.js adapter `@dodopayments/nextjs` (latest 0.3.9, 2026-08-24; peer dep zod 3.25 or 4). It gives `Checkout`, `CustomerPortal` and `Webhooks` route handlers, with env var `DODO_PAYMENTS_ENVIRONMENT="test_mode"`. Source: https://docs.dodopayments.com/developer-resources/nextjs-adaptor.md and https://registry.npmjs.org/@dodopayments/nextjs. You do not need it. The plain SDK is enough and gives more control.

---

## 2. Creating a checkout (subscription and one-time)

**Current API: Checkout Sessions, `client.checkoutSessions.create` (`POST /checkouts`).** Use it for both product types.

- The Next.js adapter page calls Checkout Sessions "the recommended flow" and marks dynamic payment links as "deprecated": https://docs.dodopayments.com/developer-resources/nextjs-adaptor.md
- In SDK 2.59.0, `client.payments.create` carries a bare `@deprecated` JSDoc tag (`resources/payments.d.ts` line 21). The `payment_link` boolean on `payments.create` / `subscriptions.create` is the old "dynamic payment link" path. Do not use it for new code.
- Checkout Sessions page: https://docs.dodopayments.com/developer-resources/checkout-session.md . Subscription guide: https://docs.dodopayments.com/developer-resources/subscription-integration-guide.md

### Request fields (from `resources/checkout-sessions.d.ts` in dodopayments@2.59.0, and the docs page)

| Field | Type / notes |
|---|---|
| `product_cart` | REQUIRED. `Array<{ product_id: string; quantity: number; addons?; amount?; credit_entitlements? }>`. Max 20 items. A cart may mix one-time products with ONE subscription product. A cart of 2+ subscription products cannot hold one-time products. |
| `customer` | Optional. Either `{ customer_id }` (existing) or `{ email, name?, phone_number? }` (new). |
| `return_url` | Optional string. Customer goes here after success or failure. Dodo appends query params: `payment_id` or `subscription_id`, `status`, `email`, `license_key`. Do not trust the redirect for fulfilment. Use webhooks. |
| `cancel_url` | Optional. Back/cancel button target. Without it no back button is shown. |
| `metadata` | Optional `Record<string, string \| number \| boolean>`. Max 50 keys, key up to 40 chars, string value up to 500 chars. No nested objects, arrays or null. |
| `subscription_data` | Optional `{ trial_period_days?, on_demand? }`. Applies to subscription products only. |
| `billing_address` | Optional. `country` (ISO alpha-2) is required if you pass it. |
| `discount_codes` | Optional, up to 20. Singular `discount_code` is deprecated. |
| `allowed_payment_method_types`, `billing_currency`, `confirm`, `short_link`, `customization`, `feature_flags`, `custom_fields`, `tax_id`, `force_3ds`, `minimal_address`, `show_saved_payment_methods`, `payment_method_id`, `product_collection_id` | Optional. See the `.d.ts`. |

### Response fields (`CheckoutSessionResponse`)

- `session_id` (always; prefix `cks_`)
- `checkout_url` (hosted page; `null` only if you passed `payment_method_id`)
- `payment_id`, `client_secret`, `publishable_key` (only when `confirm: true`)
- Example response in test mode: `{ "session_id": "cks_Gi6KGJ2zFJo9rq9Ukifwa", "checkout_url": "https://test.checkout.dodopayments.com/session/cks_Gi6KGJ2zFJo9rq9Ukifwa" }` (subscription guide).
- The checkout URL is single use. Sessions expire after 24 h (15 min when `confirm: true`).

### (a) Subscription product

```ts
const session = await dodo.checkoutSessions.create({
  product_cart: [{ product_id: 'pdt_SUBSCRIPTION_ID', quantity: 1 }],
  customer: { email: user.email, name: user.name },
  return_url: `${process.env.APP_URL}/billing/success`,
  metadata: { user_id: user.id, kind: 'subscription' },
  // subscription_data: { trial_period_days: 14 }, // optional
});
// redirect the browser to session.checkout_url ; store session.session_id if you want to poll
```

### (b) One-time product (for example a credit pack)

```ts
const session = await dodo.checkoutSessions.create({
  product_cart: [{ product_id: 'pdt_CREDIT_PACK_ID', quantity: 1 }],
  customer: { email: user.email, name: user.name },
  return_url: `${process.env.APP_URL}/billing/success`,
  metadata: { user_id: user.id, kind: 'credit_pack', credits: 100 },
});
```

### Does `metadata` come back in webhooks?

- Yes for payments. The checkout request field is documented as "Additional metadata associated with the payment" (API reference, https://docs.dodopayments.com/api-reference/checkout-sessions/create.md). The `Payment` type has `metadata: Metadata` and `checkout_session_id`, so `payment.succeeded` carries `data.metadata.user_id`. The metadata guide says the API "returns metadata in API responses and webhooks": https://docs.dodopayments.com/api-reference/metadata.md
- `GET /checkouts/{id}` does NOT return metadata (metadata guide, same page). Read it from the payment.
- UNCONFIRMED: whether checkout-session `metadata` is copied onto the resulting Subscription object, so that `subscription.active` has `data.metadata.user_id`. The `Subscription` type has its own `metadata` field, and `subscription_data` in the checkout request has no metadata field. I found no doc sentence that says "copied". Official demo repos read metadata from both payment and subscription (`dodopayments/dodo-checkout-demo`, `src/app/api/verify-payment/route.ts`), which is not proof. **Safe design:** on `payment.succeeded` (which has `data.metadata.user_id` AND `data.subscription_id`), save a `subscription_id -> user_id` row. On every `subscription.*` event, look the user up by `data.subscription_id`, and fall back to `data.customer.customer_id` / `data.customer.email`. Also test it in test mode: create one checkout with metadata, then log the `subscription.active` body.
- You can also set metadata on a subscription later: `PATCH /subscriptions/{id}` accepts metadata (https://docs.dodopayments.com/features/subscription.md line ~780).

---

## 3. Webhooks

### Scheme

- Dodo webhooks follow the Standard Webhooks spec: https://docs.dodopayments.com/developer-resources/webhooks.md and https://standardwebhooks.com/
- Headers: `webhook-id`, `webhook-timestamp` (Unix seconds), `webhook-signature` (one or more space-separated `v1,<base64>` values).
- Signed content: `{webhook-id}.{webhook-timestamp}.{raw body}`. Algorithm: HMAC-SHA256, base64. Key: the secret with the `whsec_` prefix removed, then base64-decoded. Reject timestamps more than 5 minutes off (the Standard Webhooks libraries do this). Source: "Manual Verification" section of the webhooks page above.
- The secret shows on the endpoint's Overview tab (Dashboard -> Developer -> Webhooks -> your endpoint). Dodo gives it in `whsec_...` form. Endpoints are per mode, so create the test-mode endpoint in test mode. Rotation keeps the old secret valid 24 h.
- Delivery: 8 attempts total (immediate, 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 10 h). 30 s timeout. Any non-2xx is a failure. Events can arrive out of order and can repeat, so dedupe on `webhook-id` and order by the payload `timestamp`. Source: same page.
- Local forwarding: `dodo wh listen` (CLI, test-mode keys only) forwards real signed test events to localhost. `dodo wh trigger` sends mock payloads that are NOT signed, so use `client.webhooks.unsafeUnwrap` for those. Dashboard -> Webhook -> Testing tab -> "Send example" sends signed examples. Source: same page.

### Verify in Next.js (App Router), SDK helper

`client.webhooks.unwrap(body, { headers, key? })` is synchronous. It builds a `standardwebhooks` `Webhook` from `key ?? client.webhookKey`, calls `verify`, then `JSON.parse`. It throws on a bad signature. Source: `resources/webhooks/webhooks.js` lines 98-108 in dodopayments@2.59.0.

```ts
// app/api/webhooks/dodo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dodo } from '@/lib/dodo';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const raw = await req.text(); // RAW body. Never req.json() before verifying.
  let event;
  try {
    event = dodo.webhooks.unwrap(raw, {
      headers: {
        'webhook-id': req.headers.get('webhook-id') ?? '',
        'webhook-signature': req.headers.get('webhook-signature') ?? '',
        'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
      },
    });
  } catch {
    return new NextResponse('invalid signature', { status: 401 });
  }
  // TODO: dedupe on req.headers.get('webhook-id') in your DB, then handle event.type
  return NextResponse.json({ received: true });
}
```

### Verify with `standardwebhooks` directly (the docs' own Next.js example)

```ts
import { Webhook } from 'standardwebhooks';
const webhook = new Webhook(process.env.DODO_PAYMENTS_WEBHOOK_KEY!);
await webhook.verify(rawBody, { 'webhook-id': id, 'webhook-signature': sig, 'webhook-timestamp': ts });
```
Source: https://docs.dodopayments.com/developer-resources/integration-guide.md

### SIGN a test payload locally (no Dodo needed)

VERIFIED LOCALLY on 2026-10-29 with `standardwebhooks@1.1.1` and `dodopayments@2.59.0`: the signature from `Webhook.sign()` verified through both `Webhook.verify()` and `client.webhooks.unwrap()`, a one-byte body change was rejected ("No matching signature found"), and a hand-rolled HMAC matched the library output.

```ts
// scripts/send-test-webhook.ts   (run: npx tsx scripts/send-test-webhook.ts)
import { Webhook } from 'standardwebhooks';

const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY!; // must be the same whsec_... your server uses.
// For a throwaway secret: 'whsec_' + crypto.randomBytes(24).toString('base64')
const wh = new Webhook(secret);

const body = JSON.stringify({
  business_id: 'bus_test',
  type: 'payment.succeeded',
  timestamp: new Date().toISOString(),
  data: {
    payload_type: 'Payment',
    payment_id: 'pay_test_1',
    subscription_id: null,
    status: 'succeeded',
    total_amount: 500,
    currency: 'USD',
    customer: { customer_id: 'cus_test', email: 'a@b.co', name: 'A' },
    product_cart: [{ product_id: 'pdt_CREDIT_PACK_ID', quantity: 1 }],
    metadata: { user_id: 'user_123', kind: 'credit_pack', credits: 100 },
  },
});

const id = `msg_${crypto.randomUUID()}`;
const ts = new Date();
const signature = wh.sign(id, ts, body); // returns "v1,<base64>"

const res = await fetch('http://localhost:3000/api/webhooks/dodo', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'webhook-id': id,
    'webhook-timestamp': String(Math.floor(ts.getTime() / 1000)),
    'webhook-signature': signature,
  },
  body,
});
console.log(res.status, await res.text());
```

Manual equivalent, no library (matched the library output byte for byte in my test):

```ts
import crypto from 'node:crypto';
const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
const sig = 'v1,' + crypto.createHmac('sha256', key).update(`${id}.${tsSeconds}.${body}`).digest('base64');
```

Note: the sample body above is hand-built to match the SDK types. It is not a captured Dodo payload. Fields not listed in Section 4 may be missing.

---

## 4. Event types and payload shapes

Envelope for every event (webhooks page; SDK `WebhookEvent` types):
`{ business_id, type, timestamp (ISO 8601), data: {...} }`. `data.payload_type` is `"Payment"` or `"Subscription"` etc. Source: https://docs.dodopayments.com/developer-resources/webhooks.md and `resources/webhooks/webhooks.d.ts`.

The full list of subscription events is in https://docs.dodopayments.com/developer-resources/webhooks/intents/webhook-events-guide.md . The `UnwrapWebhookEvent` union in the SDK has `payment.{succeeded,failed,processing,cancelled}`, `subscription.{active,updated,past_due,on_hold,paused,unpaused,renewed,plan_changed,update_payment_method,cancelled,failed,expired}`, `refund.*`, `dispute.*`, `credit.*`, `dunning.*`, `entitlement_grant.*`, and more.

### payment.succeeded -> `data` is `Payment` (`resources/payments.d.ts` line 244)

| What you need | Field |
|---|---|
| payment id | `data.payment_id` |
| customer id / email | `data.customer.customer_id`, `data.customer.email`, `data.customer.name` (`CustomerLimitedDetails`; it also has its own optional `metadata`) |
| subscription id | `data.subscription_id` (optional; set when the payment is for a subscription). Also `data.subscription_ids[]` (required array, for multi-subscription carts) |
| product id | `data.product_cart?: [{ product_id, quantity }]` (optional). For subscription payments use the Subscription event's `data.product_id`. |
| metadata | `data.metadata` (required object) |
| other | `status`, `total_amount` (smallest unit), `currency`, `checkout_session_id`, `charge_type` (`new`/`renewal`/`plan_change`/`on_demand`, null for one-time), `service_periods[]`, `invoice_url`, `error_code`/`error_message` |

### subscription.* -> `data` is `Subscription` (`resources/subscriptions.d.ts`) plus `past_due_ends_at?` and `payment_id?`

Same data shape for `active`, `renewed`, `cancelled`, `on_hold`, `expired` (SDK types `SubscriptionActiveWebhookEvent` etc. all extend `SubscriptionsAPI.Subscription`).

| What you need | Field |
|---|---|
| subscription id | `data.subscription_id` |
| customer id | `data.customer.customer_id` (also `email`, `name`) |
| product id | `data.product_id` |
| metadata | `data.metadata` (see the UNCONFIRMED propagation note in Section 2) |
| status | `data.status`: `pending \| active \| on_hold \| paused \| cancelled \| failed \| expired \| past_due` |
| dates | `next_billing_date`, `previous_billing_date`, `created_at`, `cancelled_at?`, `expires_at?`, `cancel_at_next_billing_date` |
| other | `currency`, `recurring_pre_tax_amount`, `quantity`, `payment_frequency_*`, `subscription_period_*`, `trial_period_days` |
| `payment_id` | Set ONLY on `subscription.renewed` (id of the renewal payment). Null on all other subscription events. |
| `past_due_ends_at` | Present when a grace period applies (`past_due`). |

When each event fires (https://docs.dodopayments.com/developer-resources/subscription-integration-guide.md, https://docs.dodopayments.com/developer-resources/webhooks/intents/subscription.md):
- `subscription.active`: mandate authorized, subscription activated. With a trial it fires at checkout and no charge is taken yet.
- `payment.succeeded` for a first charge arrives "within 2-10 minutes of checkout" (guide wording). Do not assume it arrives before `subscription.active`.
- `subscription.renewed`: every successful renewal, ALWAYS alongside `payment.succeeded`. The guide's recommendation is to use `subscription.renewed` to extend access. But a `renewal`-type payment does not always extend access (usage settlement of a paused subscription), so check `service_periods`.
- `subscription.on_hold`: renewal or plan-change charge failed (or grace period over). The subscription will not renew until the payment method is updated.
- `subscription.past_due`: only if the merchant enabled a grace period.
- `subscription.cancelled`: cancelled by merchant or customer. Check `cancel_at_next_billing_date` and `cancelled_at`. UNCONFIRMED: whether a "cancel at period end" request fires this event immediately or at the period end. Check in test mode.
- `subscription.expired`: reached the end of `subscription_period_*` (see the 20-year warning in Section 7).
- `subscription.updated` fires on any field change. It is a good single sync event.
- `subscription.failed`: mandate creation failed. Terminal.

---

## 5. Credits and usage-based billing

What Dodo offers (primary docs: https://docs.dodopayments.com/features/credit-based-billing.md and https://docs.dodopayments.com/developer-resources/usage-based-billing-guide.md ):

- **Credit entitlements** ("Credit-Based Billing", added in changelog v1.86.0, 2026-03-02): a credit unit is either a custom unit (tokens, API calls) or fiat credits. Attach it to a subscription product (reissued every cycle), a one-time product (issued once at purchase, "ideal for credit top-up packs") or a usage-based product. Options: rollover, overage, expiry.
- **Meters + usage events**: send events with `client.usageEvents.ingest({ events: [{ event_id, customer_id, event_name, timestamp, metadata }] })`. A meter on a usage-based product can "Bill usage in Credits", so events deduct from the balance (docs example in the credit page). Up to 50 meters per subscription.
- **API for balances** (SDK 2.59.0): `client.creditEntitlements.{create,list,retrieve,update,delete}`, `client.creditEntitlements.balances.{list,retrieve,listGrants,listLedger,createLedgerEntry}`. `createLedgerEntry` with `entry_type: 'credit' | 'debit'` lets you debit manually. A `409` means the idempotency key already exists (`resources/credit-entitlements/balances.d.ts`).
- **Credit webhooks**: `credit.added`, `credit.deducted`, `credit.expired`, `credit.rolled_over`, `credit.rollover_forfeited`, `credit.overage_charged`, `credit.overage_reset`, `credit.manual_adjustment`, `credit.balance_low`. Ledger events carry the `metadata` of the source payment or subscription (credit page, "Webhooks" section).
- Checkout can override the credit amount per session: `product_cart[].credit_entitlements: [{ credit_entitlement_id, credits_amount }]` (checkout-session page, `credit_entitlements` field).

**Answer for a simple one-time credit pack (my judgment, not a Dodo statement):** yes, a one-time product plus your own counter is the simplest correct approach for a hackathon.
1. Create one-time product(s) per pack.
2. Checkout with `metadata: { user_id, credits }` (or look the credits up from `product_id` on your side, which is safer than trusting metadata amounts).
3. On `payment.succeeded`, in ONE DB transaction: insert `webhook-id` into a processed table, check `status === 'succeeded'`, and add credits to the user's balance. Dedupe on `data.payment_id` too.
4. Handle `refund.succeeded` (and `dispute.lost`) if you want to claw credits back.

Dodo's native credits would replace your counter, but they add setup (create the entitlement, attach it to the product, call the balances API) and make Dodo the source of truth for the balance. Use them only if you want rollover, expiry or meter-based deduction. Meters are for per-event metered billing and are overkill here.

---

## 6. Test mode

Source: https://docs.dodopayments.com/miscellaneous/testing-process.md and https://docs.dodopayments.com/miscellaneous/test-mode-vs-live-mode.md

- "Every API endpoint is available in test mode" and webhooks fire for test transactions "the same way as in production".
- Success cards (any future expiry, CVV `123`):

| Region | Brand | Number | Expiry |
|---|---|---|---|
| US | Visa | `4242424242424242` | 06/32 |
| US | Mastercard | `5555555555554444` | 06/32 |
| India | Visa | `4576238912771450` | 06/32 |
| India | Mastercard | `5409162669381034` | 06/32 |

- Decline cards: `4000000000000002` (generic decline), `4000000000009995` (insufficient funds), `4706131211212123` and `5105105105105100` (India, generic decline).
- Subscription renewal-failure card: `4000000000000341`, expiry 12/34, CVV 123. Use it as the new payment method on an active test subscription, so the next renewal fails (`payment.failed` + `subscription.on_hold`, or `past_due` first with a grace period).
- UPI: `success@upi` and `failure@upi`. Requirements: billing country `IN`, currency `INR`, and Adaptive Currency enabled for non-Indian merchants.
- **Subscriptions work end to end in test mode.** They renew on their billing schedule and fire the usual webhooks, with simulated payments. They keep renewing after you stop testing, so cancel old test subscriptions: `PATCH /subscriptions/{id}` with `status: 'cancelled'`. To trigger a renewal sooner, `PATCH /subscriptions/{id}` with `next_billing_date` set to a future UTC timestamp (must end in `Z` and must be in the future). Source: the two pages above.
- Test mode sends real emails to the real address, subjects start with `[TEST MODE]`, capped at 100 per week. It can be turned off in Settings -> Communication -> Email.
- Apple Pay needs HTTPS, so it will not show on plain `localhost`.

---

## 7. Creating products

**Both.** The dashboard (Products) and the API `client.products.create` (`POST /products`) work. Source: https://docs.dodopayments.com/features/products.md ("manage products through the dashboard or programmatically via API"). Products are per mode. A product made in test mode can be copied to live mode in the dashboard, and there is a Terraform provider.

`ProductCreateParams` (SDK 2.59.0, `resources/products/products.d.ts` line 806):
required `name`, `price`, `tax_category` (`'digital_products' | 'saas' | 'e_book' | 'edtech' | 'live_tutoring'`).
Optional `description`, `metadata`, `brand_id`, `credit_entitlements`, `entitlements`, `addons`, `license_key_*`, `pricing_mode`, `digital_product_delivery`.

- Price amounts are in the smallest currency unit: "to charge $1.00, pass `100`" (SDK doc comment on both `OneTimePrice.price` and `RecurringPrice.price`).
- The minimum for a non-zero subscription price is $1.00 in USD (products page).
- Interval enum values are capitalised: `'Day' | 'Week' | 'Month' | 'Year'` (`TimeInterval` in `subscriptions.d.ts`).

```ts
// One-time price: $5.00 credit pack
const pack = await dodo.products.create({
  name: '100 credits',
  description: 'One-time credit pack',
  tax_category: 'digital_products',
  price: { type: 'one_time_price', currency: 'USD', price: 500, discount: 0 },
  metadata: { credits: 100 },
});
// pack.product_id -> use in product_cart

// Recurring monthly price: $9.00 / month, renews until cancelled
const pro = await dodo.products.create({
  name: 'Pro monthly',
  tax_category: 'saas',
  price: {
    type: 'recurring_price',
    currency: 'USD',
    price: 900,
    discount: 0,
    payment_frequency_count: 1,
    payment_frequency_interval: 'Month',   // billing cycle
    subscription_period_count: 20,          // total life of the subscription
    subscription_period_interval: 'Year',
  },
});
```

**Gotcha, from the SDK doc comment:** `subscription_period_*` is the total lifetime, not the billing cycle. Dodo recommends `20` `Year` (also the maximum) for "renews until cancelled". "Do not set the subscription period to `1` `month` for a monthly plan: the subscription then expires after one month." (`RecurringPrice.subscription_period_count`). The subscription guide repeats the warning.

Not run against the API: I had no test-mode key. The three calls above (both `products.create` calls and the `checkoutSessions.create` call from Section 2) type-check with `tsc --strict` against dodopayments@2.59.0 (VERIFIED LOCALLY, with `discount` omitted). The response field is `product_id` (`Product` type). `discount` is deprecated in favour of `discount_bps`, so drop the `discount: 0` lines.

---

## Confidence and gaps

- High: package name and version, client options, base URLs, env var names, Checkout Sessions as the current API, request and response fields, the signing scheme, `unwrap` behaviour (read the code and ran it), local signing (ran it), test cards, event names, and the product price fields.
- UNCONFIRMED: (1) whether checkout `metadata` is copied to the Subscription object and appears in `subscription.*` events. Use the payment-based mapping in Section 2. (2) Exact `subscription.cancelled` timing for cancel-at-period-end. (3) The docs' per-event payload pages (`/webhooks/intents/payment.md`, `/subscription.md`) have no schema text in the markdown form. The tables above come from the SDK types, not from captured payloads. (4) Whether `payment.succeeded` for a subscription's first charge carries `product_cart`. It is optional in the type. Use `subscription.product_id` instead.
- Not checked: Dodo account verification, country restrictions on test accounts, rate limits, and API-reference pages for individual endpoints (the OpenAPI file path in `llms.txt` returned a 404 page).
