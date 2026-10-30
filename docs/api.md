# HTTP API

The contract between `apps/web` (server) and `apps/extension` (client). Types come from `apps/web/src/server/types.ts`. The extension keeps a copy of the types it uses in `apps/extension/lib/api-types.ts`, and the lead checks that the two match.

Base URL: `http://localhost:3000` by default. The extension reads it from its options (`apiBase`).

Every request needs a verified identity: a Clerk session cookie (the web app), or `Authorization: Bearer <token>` (the extension, with a token from `/extension/connect`). The server rejects anything else with `401 {"error":"missing user"}`. `x-user-id` is honoured only when the server runs with `DEMO_MODE=1`, which production refuses; the demo user is `demo`. Every route answers CORS preflight (`OPTIONS`) and sends `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: content-type, authorization, x-user-id`, `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`. Errors are `{"error": string}` with a 4xx or 5xx status.

| Method and path | Body | Response |
| --- | --- | --- |
| `POST /api/capture` | `CapturePayload` | `202 { sourceId, status }`. `status` is `pending`, `done` (dedup hit on an already processed source), or `blocked`. When `blocked`, the body also has `checkoutUrl` and `reason: "quota"`. |
| `GET /api/sources/:id` | | `200 SaveResult & { highlights: string[] }`. Poll until `status` is `done`, `partial` or `blocked`. |
| `GET /api/learn-next` | | `200 { items: LearnNextItem[] }` (top 3). |
| `GET /api/graph/:sourceId` | | `200 Neighborhood`. |
| `GET /api/me` | | `200 { user: User, usage: { used: number, limit: number, credits: number } }`. `used` counts saves since the first day of the current UTC month. |
| `POST /api/billing/checkout` | `{ product: "pro" \| "credits" }` | `200 { checkoutUrl }`. |
| `POST /api/webhooks/dodo` | Dodo webhook (Standard Webhooks signed) | `200 { outcome }` (`applied`, `duplicate`, `ignored`, `unknown_user`, or `invalid`), `400` on a bad signature. No user auth; the user comes from the signed event. |
| `GET /api/vocabulary` | | `200 text/plain`, one project or concept name per line, for Wispr Flow's dictionary. |
| `DELETE /api/me` | | `204`. Deletes the user and everything they own. |
| `POST /api/ask` | `{ question }` | `200 BrainAnswer`. Answered from the user's own claims; not metered. |
| `GET /api/export` | | `200 application/zip` of Obsidian markdown (`Sources/`, `Concepts/`, `Projects/`). Pro only: a free user gets `402 { error, checkoutUrl }`. |
| `GET /api/gsql/:name` | | `200 text/plain` GSQL for `known_claims`, `search_claims`, `learn_next` or `neighborhood`; `404` for any other name. |

Side panel flow: `POST /api/capture`, then poll `GET /api/sources/:id` every second while it is `pending` or `processing`, showing "checking against your brain…". On `blocked`, open `checkoutUrl` in a new tab and keep polling `GET /api/sources/:id`; the webhook moves the source back to `pending` once the plan allows it, so the same poll shows the result.
