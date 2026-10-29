# HTTP API

The contract between `apps/web` (server) and `apps/extension` (client). Types come from `apps/web/src/server/types.ts`. The extension keeps a copy of the types it uses in `apps/extension/lib/api-types.ts`, and the lead checks that the two match.

Base URL: `http://localhost:3000` by default. The extension reads it from its options (`apiBase`).

Every request carries `x-user-id`. The server rejects a request without it with `401 {"error":"missing user"}`. The demo user is `demo`. Every route answers CORS preflight (`OPTIONS`) and sends `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: content-type, x-user-id`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`. Errors are `{"error": string}` with a 4xx or 5xx status.

| Method and path | Body | Response |
| --- | --- | --- |
| `POST /api/capture` | `CapturePayload` | `202 { sourceId, status }`. `status` is `pending`, `done` (dedup hit on an already processed source), or `blocked`. When `blocked`, the body also has `checkoutUrl` and `reason: "quota"`. |
| `GET /api/sources/:id` | | `200 SaveResult`. Poll until `status` is `done`, `partial` or `blocked`. |
| `GET /api/learn-next` | | `200 { items: LearnNextItem[] }` (top 3). |
| `GET /api/graph/:sourceId` | | `200 Neighborhood`. |
| `GET /api/me` | | `200 { user: User, usage: { used: number, limit: number, credits: number } }`. `used` counts saves since the first day of the current UTC month. |
| `POST /api/billing/checkout` | `{ product: "pro" \| "credits" }` | `200 { checkoutUrl }`. |
| `POST /api/webhooks/dodo` | Dodo webhook (Standard Webhooks signed) | `200 { ok: true }`, `401` on a bad signature. No `x-user-id`; the user comes from the event. |
| `GET /api/vocabulary` | | `200 text/plain`, one project or concept name per line, for Wispr Flow's dictionary. |

Side panel flow: `POST /api/capture`, then poll `GET /api/sources/:id` every second while it is `pending` or `processing`, showing "checking against your brain…". On `blocked`, open `checkoutUrl` in a new tab and keep polling `GET /api/sources/:id`; the webhook moves the source back to `pending` once the plan allows it, so the same poll shows the result.
