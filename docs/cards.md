# Task cards

**Status: done (2026-10-29).** Every card is merged on `main`. Outputs: the app in `apps/web`, the extension in `apps/extension`, GSQL in `graph/`, the end-to-end check `apps/web/scripts/e2e.ts`, the browser check `scripts/ui-check.mjs`, and the run log `.audit/build.tsv`. Setup and stage steps are in `README.md` and `DEMO.md`.

Each card is one unattended session. Read `CLAUDE.md` and `docs/PRD.md` first. A card is done only when every "Done when" check passes on your branch. The lead re-runs the same checks after the merge.

Shared contracts that every lane builds on, owned by the lead: `apps/web/src/server/types.ts` and `apps/web/src/server/graph/port.ts`. Do not change them. If one is wrong for your card, write the problem in `BLOCKED.md` and stop.

## P1: LLM providers, cost guard, embeddings

Lane: pipeline. Files: `apps/web/src/server/llm/**`, `apps/web/src/server/embed.ts`, tests beside them.

Build:

1. Three step functions behind one interface, each with one JSON schema shared by every provider:
   - `splitClaims(text) -> { claims: string[] }` (5 to 15 claims for an article, 1 or more for a short note).
   - `linkConcepts(claims, knownConceptNames, projects) -> { links: { claimIndex: number, concepts: string[] }[] }` (1 to 2 short concept names per claim, reusing known names when they fit).
   - `writeTldr(newClaims, projects) -> { bullets: string[] (max 3), whyItMatters: string, projectId: string | null }`.
2. Providers:
   - `stub`: deterministic, no network. Split on sentence boundaries (`/(?<=[.!?])\s+/`), trim, drop sentences under 4 words, cap at 15. Concepts are the best-matching known concept name by word overlap, else the two most frequent non-stopword words. TL;DR bullets are the first 3 new claims. The project is the one whose name or description shares the most non-stopword words with the new claims, and `whyItMatters` names it.
   - `ollama`: native `POST /api/chat` with `format` set to the JSON schema, `options.num_ctx >= 12288`, `think: false`, model `qwen3:8b`. `OLLAMA_URL` default `http://127.0.0.1:11434`.
   - `anthropic`: the official `@anthropic-ai/sdk`. Invoke the `claude-api` skill first and follow it for structured JSON output, model ids, and effort. Every call sets effort low. Text is truncated to about 12k tokens (use 48k characters).
3. Profiles from `LLM_PROFILE`: `stub` (all stub), `local` (all ollama), `cheap` (all Haiku `claude-haiku-5-5`), `demo` (Sonnet `claude-sonnet-5-5` for split and TL;DR, Haiku for link). The factory throws when `process.env.VITEST` or `NODE_ENV=test` is set and the profile is not `stub`.
4. Cost guard: every Anthropic call appends `{ts, step, model, inputTokens, outputTokens, usd}` to `logs/cost.jsonl` (path from `COST_LOG`, default repo-root `logs/cost.jsonl`). Before a call, sum the file. Past `COST_CAP_USD` (default 5) the call throws `CostCapError`. Prices per million tokens: Haiku 5.5 $0.10 in / $0.50 out, Sonnet 5.5 $2 / $10. If an Anthropic call fails with a spend-limit or cost-cap error, fall back to ollama and log a line saying so.
5. `embed(texts: string[]): Promise<number[][]>` with `Xenova/all-MiniLM-L6-v2`, mean pooling, normalised, 384 dims, one lazily loaded pipeline per process. Also `cosineDistance(a, b)` = `1 - dot(a, b)`.

Done when:

- `pnpm --filter web test` passes, and the tests cover: stub split on a sample article, stub TL;DR naming the right project, factory throws under VITEST for `demo`, cost guard refuses past the cap (with a temp `COST_LOG`), anthropic provider request shape built correctly (unit test the request builder with no network), embed returns 384 normalised dims and a paraphrase pair is closer than an unrelated pair.
- `pnpm --filter web exec tsc --noEmit` passes.
- Commit `P1: ...`, tag `p1`.

## P2: pipeline and worker against the GraphPort

Lane: pipeline. Starts after P1. Files: `apps/web/src/server/pipeline/**`, `apps/web/src/server/graph/memory.ts`, `apps/web/src/server/worker.ts`, `apps/web/scripts/process-file.ts`.

Build:

1. `graph/memory.ts`: an in-memory `GraphPort` for tests. `knownClaims` does a brute-force cosine scan over claims from sources the user has READ (MAKES edges only), joined to the source and its concepts.
2. `pipeline/capture.ts`: `capture(deps, userId, payload)`. Canonicalise the URL (lowercase host, drop hash, drop `utm_*` params, drop trailing slash), hash the normalised text (sha256). Dedup by URL or hash: return the existing source. Otherwise create a Source with status `pending`. Voice captures with no URL get `voice://<timestamp>`.
3. `pipeline/process.ts`: `processSource(deps, sourceId)`, the 5 PRD steps for one pending source: split, embed, `knownClaims` per claim with `NOVELTY_MAX_DIST` (default 0.36 after G2 tuning, see `docs/threshold.md`), repeat → `addRepeat`, new → `addClaim`; link new claims to concepts (reuse an existing concept when the name matches case-insensitively or its embedding is within 0.25; else create one, related to the projects the stub or model picked); TL;DR on new claims only, and none when under 20% new; mark the source read by the user; set `newRatio`, `tldr`, status `done`. Any step that throws sets status `partial` and keeps what was written. A quota check is a dependency (`deps.quota.allow(userId)`) called before the novelty step; if it says no, set status `blocked` and stop.
4. `pipeline/result.ts`: `getSaveResult(deps, userId, sourceId): SaveResult` from `getSource` + `sourceClaims`.
5. `worker.ts`: a loop that polls `listPendingSources` every second and processes them one at a time. `scripts/process-file.ts` runs capture + process on a text file for a given user with the memory graph or TigerGraph (`GRAPH=memory|tigergraph`), and prints the SaveResult as JSON.
6. `deps` is one object: `{ graph: GraphPort, llm, embed, quota, now(), config }`. Do not import TigerGraph from the pipeline.

Done when:

- Tests with the memory graph and stub LLM, using `fixtures/seed/` if present: seed 3 read articles, then process an article that paraphrases two of their sentences and adds two new ones. Assert 2 repeats with the right source titles, 2 new claims, `newRatio` 0.5, TL;DR bullets equal to the new claims only. Assert a duplicate URL capture returns the same source id. Assert a blocked quota leaves status `blocked`. Assert a throwing LLM leaves status `partial`.
- `tsc --noEmit` and `pnpm --filter web test` pass.
- Commit `P2: ...`, tag `p2`.

Addendum to P2 from the lead: saving and reading are separate. `processSource(deps, sourceId, { markRead })` marks the source READ only when `markRead` is true. Captures from the extension, voice, and web default to `markRead: true` (the user is on the page and reads the delta). The seed loader passes `false` for unread articles. The novelty check only matches claims from READ sources.

## G1: TigerGraph schema, queries, and the TigerGraph GraphPort

Lane: graph. Files: `graph/**`, `apps/web/src/server/graph/tigergraph.ts`, `apps/web/src/server/graph/tigergraph.test.ts`, `apps/web/scripts/graph-load.ts`.

Facts the lead already proved on this container (see `docs/research/tigergraph.md` for the rest):

- `POST http://127.0.0.1:14240/gsql/v1/statements` with basic auth `tigergraph:tigergraph` and `Content-Type: text/plain` runs a multi-statement GSQL script (`CREATE GRAPH`, `USE GRAPH`, schema change jobs, `CREATE QUERY`, `INSTALL QUERY`). Each schema change job takes about 30 s. `INSTALL QUERY` takes about 30 s, so install all queries in one `INSTALL QUERY q1, q2, ...` statement.
- RESTPP needs no auth: `POST /restpp/graph/<graph>` upserts vertices and edges; a vector attribute goes in as `"embedding": {"value": [floats]}`.
- Call an installed query with `POST /restpp/query/<graph>/<query>` and a JSON body. A `VERTEX<User>` parameter is passed as `{"id": "...", "type": "User"}`.
- `GET /restpp/vector/status/<graph>/<VertexType>/<attr>` returns `"status": "Ready_for_query"` when the HNSW index has caught up, and `"Rebuild_processing"` before that.
- This query shape works on 4.2.5 and scopes the vector search to the user's own read claims:

```
CREATE OR REPLACE QUERY probe_known(VERTEX<PUser> u, LIST<FLOAT> v, FLOAT max_dist) SYNTAX v3 {
  MapAccum<VERTEX, FLOAT> @@dist;
  start = {u};
  mine = SELECT c FROM (s:start)-[:PREAD]->(src:PSource)-[:PMAKES]->(c:PClaim);
  near = vectorSearch({PClaim.embedding}, v, 5, {candidate_set: mine, distance_map: @@dist});
  known = SELECT h FROM (h:near) WHERE @@dist.get(h) < max_dist;
  PRINT known, @@dist;
}
```

- Cosine distance is `1 - cosine similarity`. A probe graph `Probe` exists on the container. Drop it.

Build:

1. `graph/schema.gsql`: graph `SecondBrain` with local types. Vertices: `User(id, email, plan, credits INT, dodo_customer_id)`, `Source(id, user_id, url, title, kind, status, saved_at, read_at, content_hash, body, new_ratio DOUBLE, tldr)` (times are ISO strings, `tldr` is JSON text), `Claim(id, text, first_seen)` + vector `embedding` 384 COSINE, `Highlight(id, text, created_at)`, `Concept(id, user_id, name, summary)` + vector `embedding`, `Project(id, user_id, name, description)` + vector `embedding`, `WebhookEvent(id, received_at)` (for idempotent webhooks). Use `primary_id_as_attribute="true"`. Edges, all directed with reverse edges: `OWNS` (User → Source | User → Project | User → Concept), `READ` (User → Source, attribute `read_at`), `MAKES` and `REPEATS` (Source → Claim), `ABOUT` (Claim → Concept), `RELEVANT_TO` (Concept → Project), `HIGHLIGHTS` (Highlight → Source). Concept ids are per user: `<userId>::<lowercased name>`.
2. `graph/queries/*.gsql`, one query per file, all installed together:
   - `known_claims(u, claim_vec, max_dist, k)`: the PRD novelty query. Candidate set is claims MADE by sources the user READ. Prints each known claim with its distance, the source that MADE it (id, title, url), and its concept names.
   - `learn_next(u, lim)`: concepts RELEVANT_TO a project the user OWNS, where no claim ABOUT the concept comes (via MAKES or REPEATS) from a source the user READ. For each, the user's owned unread sources whose claims are ABOUT it. Rank by number of unread sources, then name. Return at most `lim`.
   - `neighborhood(u, src)`: the source, its MAKES and REPEATS claims, their concepts, and those concepts' projects, as nodes and links. Check that the source is owned by `u`, else return nothing.
   - `source_claims(u, src)`: claims MADE by the source, and claims it REPEATS with the source that originally MADE each and the distance not needed.
   - `count_saves_since(u, since)`, `list_concepts(u)`, `list_projects(u)` (with embeddings: use `PRINT ... WITH VECTOR` or an accumulator), `pending_sources(lim)`, `delete_user(u)` (deletes the user and every vertex it owns, plus claims made by those sources and highlights).
3. `apps/web/scripts/graph-load.ts` (`pnpm --filter web graph:load [--reset]`): idempotent. Creates the graph and schema if missing, `--reset` drops and recreates. Always (re)creates and installs all queries. Prints timings.
4. `apps/web/src/server/graph/tigergraph.ts`: `createTigerGraph(config)` implementing every `GraphPort` method with RESTPP upserts, built-in vertex GETs, and the installed queries. Config from env `TG_URL` (default `http://127.0.0.1:14240`), `TG_GRAPH` (`SecondBrain`), `TG_USER`, `TG_PASSWORD`. Also export `waitForVectorIndex(timeoutMs)` that polls the status endpoint for Claim, Concept and Project.
5. Do not use the deprecated `{"id"...}` form for SET parameters without checking it; test every query through the client.

Done when:

- `pnpm --filter web graph:load --reset` succeeds from scratch, and a second `pnpm --filter web graph:load` run succeeds without `--reset`.
- `apps/web/src/server/graph/tigergraph.test.ts` runs against the live container (skip with a clear message when `TG_URL` is unreachable), uses a unique user id per run and deletes it at the end, and covers: two users with similar claims where `knownClaims` for user A never returns user B's claim; a claim from a saved but unread source is not known; `learnNext` returns a concept with no read source and lists the unread source; `neighborhood` returns MAKES, REPEATS, ABOUT and RELEVANT_TO links; `sourceClaims` returns repeats with the original source title; `countSavesSince`; `deleteUser` leaves nothing.
- `pnpm --filter web typecheck` and `pnpm --filter web test` pass.
- Commit `G1: ...`, tag `g1`.

## G2: seed loader and threshold tuning

Lane: graph. Starts after G1 and P2 are merged. Files: `apps/web/scripts/seed.ts`, `apps/web/scripts/tune-threshold.ts`, `docs/threshold.md`.

Build:

1. `pnpm --filter web seed [--user demo]`: deletes the user, then loads `fixtures/seed/projects.json`, `concepts.json` (with RELEVANT_TO edges) and `articles.json` for user `demo` (email `demo@example.com`, plan free, credits 0). Each article goes through the real pipeline (`capture` + `processSource`) with `LLM_PROFILE=stub`, `markRead` from the fixture, except that concept links use the fixture's `concepts` field instead of the stub linker. Saved dates are spread over the previous 60 days, so they do not count against this month's quota. Waits for the vector index at the end. Prints counts.
2. `tune-threshold.ts`: embeds `fixtures/seed/pairs.json`, prints the distance of every pair, and the threshold that maximises accuracy, with precision and recall. Then runs `demo.json`'s `x402-overlap` against the seeded `demo` user through `knownClaims` and prints per-sentence predicted vs labelled. Write the results and the chosen `NOVELTY_MAX_DIST` to `docs/threshold.md`.

Done when: seed runs twice in a row with the same counts; `docs/threshold.md` exists with the numbers; on `x402-overlap` the chosen threshold gets at least 10 of 12 sentences right. Commit `G2: ...`, tag `g2`.

## W1: API routes and the worker in the app

Lane: product. Starts after G1, P2 and B1 are merged. Files: `apps/web/src/app/api/**`, `apps/web/src/server/deps.ts`, `apps/web/src/app/page.tsx` (paste page), `apps/web/src/app/api/_lib/**`.

Build every route in `docs/api.md` except the two billing routes, which B1 owns. `deps.ts` builds the one `deps` object (TigerGraph graph, LLM profile, embed, quota from B1) lazily, once per process. Capture runs the quota check synchronously, so an over-limit capture returns `blocked` with a `checkoutUrl` at once. The page at `/` is a paste box (URL, title, text) that posts a `web` capture for the demo user and shows the SaveResult. Read `apps/web/node_modules/next/dist/docs/` for route handler conventions in Next.js 16 before writing them.

Done when: with the worker running and TigerGraph seeded, a script `apps/web/scripts/api-smoke.ts` drives every route against `next dev` and checks status codes and shapes (including CORS preflight and the 401 without `x-user-id`); typecheck and tests pass. Commit `W1: ...`, tag `w1`.

## B1: billing with Dodo Payments

Lane: product. Starts after G1 is merged. Files: `apps/web/src/server/billing/**`, `apps/web/src/app/api/billing/**`, `apps/web/src/app/api/webhooks/dodo/**`, `apps/web/src/app/dev/checkout/**`. Read `docs/research/dodo.md` first.

Build:

1. `quota.ts`: `allow(userId)` and `consume(userId)`. Free: 30 saves per UTC month. Pro: 500. Past the allowance, a save spends one credit if `credits > 0`, else it is blocked. Use `graph.countSavesSince` and `graph.updateUser`.
2. `dodo.ts`: a Dodo client in `test_mode` only (throw if `DODO_PAYMENTS_ENVIRONMENT` is anything else). `createCheckout(user, product)`: create the Dodo customer once (`metadata.user_id`) and store `dodo_customer_id`, then `checkoutSessions.create` with `DODO_PRO_PRODUCT_ID` or `DODO_CREDITS_PRODUCT_ID` and `return_url`.
3. Dev checkout when `DODO_PAYMENTS_API_KEY` is unset: `createCheckout` returns `/dev/checkout?product=...&user=...`. That page shows the product and a "Pay (test)" button, which posts to a server action that builds the same event Dodo would send, signs it with `DODO_PAYMENTS_WEBHOOK_KEY` (a `whsec_` secret; `.env.example` has a generated dev one) using `standardwebhooks`, and POSTs it to `/api/webhooks/dodo`. The page says plainly that it is a local stand-in for Dodo test checkout.
4. Webhook route: verify with `standardwebhooks` against `DODO_PAYMENTS_WEBHOOK_KEY`, reading the raw body. Find the user by `data.customer.customer_id` (fallback `data.metadata.user_id`). `subscription.active` and `subscription.renewed` set plan `pro`. `subscription.cancelled`, `subscription.expired` and `subscription.on_hold` set plan `free`. `payment.succeeded` for the credits product adds 200 credits. Each `webhook-id` is processed once (`WebhookEvent` vertex; add a `GraphPort`-free helper in billing that talks to TigerGraph through the existing client, or ask the lead). Then move the user's `blocked` sources back to `pending`.

Done when: unit tests cover quota rules and webhook handling with locally signed payloads (good signature, bad signature, replayed id, credits pack, cancel); typecheck and tests pass. Commit `B1: ...`, tag `b1`.

## X1: extension save, What's new to me, Learn next, quick note

Lane: product. Can start now. Files: `apps/extension/**` only.

Build a Chrome MV3 extension with WXT + React:

1. Side panel entrypoint (`entrypoints/sidepanel/`), opened by the toolbar button. `Alt+S` command saves the current tab.
2. Save: the background script injects a content script that runs `@mozilla/readability` on a clone of the document and returns `{ url, title, text, selection }`. The side panel posts it to `POST /api/capture` with `source: "extension"`, then polls per `docs/api.md`.
3. Views, as tabs in the side panel: "What's new to me" (new claims highlighted, repeats greyed with "you read this in <title>" links, the TL;DR bullets and "why it matters"; under 20% new shows "nothing new" and the links; a collapsed "hidden as not new" list), "Learn next" (top 3 items with their unread sources as links), and a "Graph" tab placeholder that X2 fills.
4. Quick note box: a textarea and a save button posting `source: "voice"` with no URL and `title: "Voice note"`. This is where Wispr Flow types.
5. Blocked: show "Free limit reached", open `checkoutUrl` in a new tab, keep polling, and show a "Pro" badge from `GET /api/me` when it flips.
6. Options: `apiBase` (default `http://localhost:3000`) and `userId` (default `demo`), stored in `chrome.storage.local`.
7. `lib/api.ts` is the only module that calls fetch. `lib/api-types.ts` copies the types it needs from the server's `types.ts`.

Done when: `pnpm --filter extension build` produces `.output/chrome-mv3` with a manifest that has `side_panel`, `commands`, the needed permissions (`activeTab`, `scripting`, `sidePanel`, `storage`) and host permission for `http://localhost:3000/*`; `pnpm --filter extension compile` passes; vitest tests cover the poll loop and the view model (repeat grouping, nothing-new rule) with a fake fetch. Commit `X1: ...`, tag `x1`.

## X2: graph view

Lane: product. Starts after X1. Files: `apps/extension/entrypoints/sidepanel/graph/**`.

The Graph tab draws `GET /api/graph/:sourceId` with `react-force-graph-2d`: source, claims, concepts, projects, with REPEATS links and repeat claims in grey. Node labels on hover. Fits the side panel width. Done when compile, build and a view-model test pass. Commit `X2: ...`, tag `x2`.

## D1: end-to-end check, demo reset, docs

Lead-owned. `scripts/e2e.ts` runs the PRD's must-work list against the real stack (TigerGraph, `next dev`, worker, stub LLM): seed, save the overlap article, check repeats and TL;DR, learn next, hit the quota, pay through the dev checkout, see the plan flip and the save complete, save the voice note. `DEMO.md` and `README.md` explain setup, the hand-back steps, and what each sponsor's judges see.
