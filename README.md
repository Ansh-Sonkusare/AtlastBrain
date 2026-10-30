# Atlas

Atlas is a Chrome extension and a web app that keep only what is new to you. Each save is split into claims, and each claim is compared with the claims that you already read, in a TigerGraph graph. The extension side panel saves a page and shows a short receipt. The web dashboard shows the new claims, the repeats with the source you read them in, the graph, and Ask. Dodo Payments bills Pro plans and credit packs.

The repo folder and some internal names, such as the graph `SecondBrain`, keep the old name. The product spec is [`docs/PRD.md`](docs/PRD.md). The person who presents the demo uses [`DEMO.md`](DEMO.md).

## How a save moves through the system

There are three capture paths. All of them send the same payload to `POST /api/capture`:

- The extension. The **Save this page** button or Alt+S (Option+S on a Mac) sends the Readability text of the current tab.
- The **Quick note** field in the side panel. The save is a `voice` capture.
- The paste page at `http://localhost:3000/paste`. Use it when the extension fails.

The API checks the quota, then writes a `Source` vertex with the status `pending`. A separate worker process polls for pending sources. For each source, the worker splits the text into claims and embeds each claim with `all-MiniLM-L6-v2` (384 dimensions). Then it runs the `known_claims` query once per claim. A claim that is near a claim the user read becomes a `REPEATS` edge. Any other claim becomes a new `Claim` vertex. The worker then links new claims to concepts, writes a TL;DR of the new claims, and sets the status to `done`.

```
extension  --+
quick note --+--> POST /api/capture --> Source (pending) --> worker --> TigerGraph
paste page --+         |                                       |  split, embed, known_claims,
                       | over quota                            |  link concepts, TL;DR
                       v                                       v
               Dodo checkout --> POST /api/webhooks/dodo --> User.plan, User.credits
```

TigerGraph is the only database. It holds users, saves, claims, concepts, projects, embeddings, and billing state. The worker keeps its job state in the graph too, as the `status` attribute on `Source`.

### What the side panel does

The panel in `apps/extension/entrypoints/sidepanel/` only saves. It has no tabs.

- **Connect your account** appears until the extension has a token.
- **Save this page** saves the current tab. The receipt then shows the percent of the page that is new, the new claims, the count of claims you already knew, and a **See what's new in dashboard** link.
- **This session** lists the earlier saves of this panel session, each with a link to the dashboard. Closing the panel clears the list.
- The footer has the Quick note field and shows the plan and usage, such as `Free · 3 of 30 saves`. It comes from `GET /api/me`.

Text that you select on the page before you save it is stored as a highlight.

### What the dashboard does

The dashboard is at `/dashboard`, in `apps/web/src/app/dashboard/`.

- **Today's brief** (`/dashboard`) shows the latest day's saves. The right column has **Worth reading in full**, which is the Learn next list from `learn_next`, and **By project**.
- **Library** (`/dashboard/library`) lists every save, the concepts, and **Plan and usage**. **Upgrade to Pro** and **Buy a credit pack** open checkout. **Export to Obsidian** downloads a zip of markdown notes with `[[wikilinks]]` (Pro only; the GSQL query `export_user` reads the whole graph in one call).
- A save's page (`/dashboard/source/:id`) shows the TL;DR with "Why it matters", **New to you**, and **Already known** with "First read in" links. It also shows the save's graph, your highlights, and **Show the query that checks for repeats**, which shows the `known_claims` GSQL on screen.
- **Graph** (`/dashboard/graph`) shows all of your sources, claims, concepts, and projects as a force-directed graph. Known claims start hidden, and the **Known** button shows them. Clicking a node opens its connections and an explanation from `POST /api/explain`.
- **Ask** (`/dashboard/ask`) answers a question only from your own claims and lists the claims it used, each with its source. The search is the GSQL query `search_claims`: a vector search over the claims your own sources made, with each hit's source and concepts added one hop out (GraphRAG).

To remove your subgraph, use **Delete my data** under **Plan and usage** on the Library page, or call `DELETE /api/me`. Your sign-in account is kept.

The HTTP contract is in [`docs/api.md`](docs/api.md).

### How Atlas knows who you are

`requestUser` and `dashboardUser` in `apps/web/src/server/auth/identity.ts` decide the identity.

- A web user signs in with Clerk. `apps/web/src/proxy.ts` denies by default: only the marketing pages, `/demo`, `/dev`, and `/api` skip its sign-in check. API routes do their own check and answer 401.
- The extension sends a signed token from `/extension/connect`. The panel opens that page, the user clicks **Connect extension**, and the page hands the token to the extension. Chrome allows this only from `http://localhost:3000` and the origin in `WXT_APP_ORIGIN`. A token lasts 90 days and has no per-token revocation. Rotating `EXTENSION_TOKEN_SECRET` revokes all of them.
- `DEMO_MODE=1` honours `x-user-id`, `?user=`, and a demo cookie that `?user=` sets, so `/dashboard?user=demo` skips Clerk locally. `demoModeEnabled` refuses it when `NODE_ENV` is `production` and on Vercel production and preview deployments.

## Set up from zero on a laptop

You need Node, pnpm, Chrome or Chromium, and either Docker or a TigerGraph Cloud instance. Local TigerGraph needs a lot of memory. Plan for 16 GB or more (see `docs/research/tigergraph.md`, section 1).

1. Start TigerGraph Community Edition 4.2.5, unless you use TigerGraph Cloud:

	```bash
	docker run -d --init -p 14240:14240 --ulimit nofile=1000000:1000000 --name sb-tigergraph tigergraph/community:4.2.5
	```

	The user and the password are `tigergraph` and `tigergraph`. On a machine where the default Docker configuration names a Windows credential helper, `docker pull` needs `DOCKER_CONFIG=/tmp/sb-docker-config`.

2. Install the dependencies from the repo root:

	```bash
	pnpm install
	```

3. Copy the environment file:

	```bash
	cp .env.example apps/web/.env.local
	```

	Then set the values that the next section marks as required. Generate your own secrets. The repo does not ship them, because anyone who knows `DODO_PAYMENTS_WEBHOOK_KEY` can sign billing webhooks, and anyone who knows `EXTENSION_TOKEN_SECRET` can sign in as any user.

	```bash
	echo "whsec_$(openssl rand -base64 24)"   # DODO_PAYMENTS_WEBHOOK_KEY
	openssl rand -hex 32                      # EXTENSION_TOKEN_SECRET
	```

4. Create the graph, the schema, and the queries:

	```bash
	pnpm --filter web graph:load --reset
	```

	This runs two schema change jobs and one `INSTALL QUERY` statement for the 15 queries in `graph/queries/`, and it takes minutes, because TigerGraph compiles each installed query. Without `--reset`, the script keeps the graph and installs the queries again.

5. Load the seed data for the user `demo`:

	```bash
	pnpm --filter web seed
	```

	The seed deletes `demo`, then loads 3 projects, 15 concepts, and 30 articles through the real pipeline, with the `stub` LLM provider. The save dates are in the previous 60 days and before this month, so they do not count against this month's quota. With local embeddings, the first run downloads the model. On a machine where Node does not find the system certificates, set `SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt` for that run.

6. Start the web app and the API in one terminal. `DEMO_MODE=1` is what lets you skip Clerk:

	```bash
	DEMO_MODE=1 pnpm --filter web exec next dev -p 3000
	```

7. Start the worker in a second terminal:

	```bash
	pnpm --filter web worker
	```

8. Build the extension:

	```bash
	pnpm --filter extension build
	```

9. Open `http://localhost:3000/dashboard?user=demo` in Chrome. Use `localhost`, not `127.0.0.1`, because the connect page works only from an allowed origin.

10. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select `apps/extension/.output/chrome-mv3`.

11. Click the Atlas toolbar button, click **Connect your account** in the side panel, and click **Connect extension** on the page that opens. The extension now saves as `demo`. The extension options hold the API base URL (default `http://localhost:3000`) and a **Disconnect** button.

### Environment variables

`.env.example` lists every variable. "Required" below means that the named feature does not work without it.

| Variable | Needed for | Notes |
| --- | --- | --- |
| `LLM_PROFILE` | Pipeline | `stub`, `local`, `cheap`, or `demo`. See the next section. |
| `ANTHROPIC_API_KEY` | `cheap` and `demo` | |
| `COST_CAP_USD` | Cost guard | Defaults to 5. |
| `OLLAMA_URL`, `OLLAMA_MODEL` | `local`, and the fallback of `cheap` and `demo` | |
| `EMBED_PROVIDER`, `HF_TOKEN` | Embeddings | See "Embeddings" below. |
| `NOVELTY_MAX_DIST` | Novelty check | 0.36. See [`docs/threshold.md`](docs/threshold.md). |
| `TG_URL`, `TG_GRAPH`, `TG_USER`, `TG_PASSWORD` | All graph access | The defaults fit local Docker. |
| `TG_SECRET` | TigerGraph Cloud | Leave it empty for local Docker. |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Required for all checkout | Signs and verifies webhooks. |
| `DODO_PAYMENTS_API_KEY`, `DODO_PRO_PRODUCT_ID`, `DODO_CREDITS_PRODUCT_ID` | Real Dodo test checkout | With no API key, checkout uses `/dev/checkout`. |
| `DODO_PAYMENTS_ENVIRONMENT` | Dodo | Must be `test_mode`. The client refuses any other value. |
| `APP_URL` | Checkout links | `http://localhost:3000` locally. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk sign-in | Running `DEMO_MODE=1` with both empty is not tested on this build. |
| `EXTENSION_TOKEN_SECRET` | Required to connect the extension | Without it, the connect page says that connections are not set up. |
| `DEMO_MODE` | Local demos and scripts | Set it on the command line or in the file. |
| `NEXT_PUBLIC_EXTENSION_ID` | Production | Only this extension id can receive a token. |
| `NEXT_PUBLIC_EXTENSION_INSTALL_URL` | Web Store link | Unset, the install link goes to `/extension/connect`. |
| `WXT_APP_ORIGIN` | Extension build | The production origin that the extension accepts and calls by default. |

### Which processes read `.env.local`

All of them. `next dev` reads `apps/web/.env.local` by itself. The `worker`, `seed`, `graph:load`, `tune`, and `demo:fill` scripts load it with `tsx --env-file-if-exists=.env.local`, and `e2e` needs it (`--env-file`). A value set on the command line wins over the file.

### TigerGraph Cloud

To use TigerGraph Cloud, set `TG_URL` to the instance URL and `TG_SECRET` to its secret. `authHeaders` in `apps/web/src/server/graph/tigergraph.ts` exchanges the secret for a bearer token and caches it. With `TG_SECRET` empty, the client sends no auth header, which fits local Community Edition. `graph:load`, `seed`, the worker, and the app all use this client, so they all write to the graph that `TG_URL` names. On this build, `seed` and full saves ran against TigerGraph Cloud. `graph:load` against Cloud is not tested on this build.

### Embeddings

`embed.ts` has two providers, and both use the same `all-MiniLM-L6-v2` weights at 384 dimensions.

- `local` runs `Xenova/all-MiniLM-L6-v2` in-process through `@huggingface/transformers`.
- `hf` calls the Hugging Face Inference router. It needs `HF_TOKEN` with the "Inference Providers" permission.

With `EMBED_PROVIDER` empty, the provider is `hf` when `HF_TOKEN` is set and `local` otherwise. A production build or a Vercel deployment throws unless the provider is `hf`.

## LLM profiles and the cost guard

`LLM_PROFILE` selects the model for each pipeline step:

| Profile | Claim split | Concept link | TL;DR | Ask answer | Graph explanation |
| --- | --- | --- | --- | --- | --- |
| `stub` | sentence split | word overlap | first 3 new claims | top 3 claims joined | no model |
| `local` | Ollama `qwen3:8b` | Ollama `qwen3:8b` | Ollama `qwen3:8b` | Ollama `qwen3:8b` | Ollama `qwen3:8b` |
| `cheap` | `claude-haiku-5-5` | `claude-haiku-5-5` | `claude-haiku-5-5` | `claude-haiku-5-5` | `claude-haiku-5-5` |
| `demo` | `claude-sonnet-5-5` | `claude-haiku-5-5` | `claude-sonnet-5-5` | `claude-sonnet-5-5` | `claude-haiku-5-5` |

All tests use `stub`, and the provider factory throws when it runs under a test with any other profile. `stub` makes no network calls and gives the same output for the same input. The embeddings are real in every profile, so the novelty check always compares real vectors.

An Anthropic key is configured, and the `demo` profile has run on real Claude. One save of the current 28-sentence stage article on this build gave 14 claims (5 new, 9 repeats) in 17 s for $0.0136: Sonnet split the article, Haiku linked the concepts, and Sonnet wrote a TL;DR that names x402 Sentinel. One of the 5 new claims merged three known safeguards, so it was marked new although the facts were known. That run found one bug that the stub could not: Zod adds integer `minimum`/`maximum` to JSON schemas, and Claude's structured output rejects them, so the code now removes them. The `cheap` profile and the Claude answer step of Ask have only a unit test of the request shape. Neither is tested on this build.

The `local` profile ran on the real model, on the same 12-sentence article, on an RTX 4060 machine. It gave 12 claims: 8 repeats with the right sources, the 3 planted new facts, and 1 labelled-known sentence that the model reworded past the threshold. Warm timings per save were about 8.6 s for the claim split, 2.5 s for concept links, and 4 s for the TL;DR. This run is older than this build, and `local` is not tested on this build. A cold first save also loads the model, so the provider asks Ollama to keep it loaded for 30 minutes. `OLLAMA_MODEL=qwen2.5:7b` selects the PRD's fallback model.

To run Ollama on the WSL build machine, start the server with `ollama-serve` (a wrapper in `~/.local/bin` that puts WSL's CUDA driver on the library path), then set `LLM_PROFILE=local` in `apps/web/.env.local` and restart the worker.

The cost guard is in `apps/web/src/server/llm/cost.ts`. Each Anthropic call adds a line to `logs/cost.jsonl` (or the path in `COST_LOG`). Before each call, the guard adds up the file. When the total is more than `COST_CAP_USD` (default 5), the call throws `CostCapError`. If an Anthropic call fails on a spend limit or on the cap, the provider falls back to Ollama and logs the fallback. Input text is cut to 48,000 characters, about 12,000 tokens.

## Run the checks

Unit and integration tests:

```bash
pnpm --filter web test
pnpm --filter extension test
```

Stop the worker before you run the web tests. The TigerGraph tests create a pending source and then list pending sources. A running worker takes that source first, and the test fails. If TigerGraph is not reachable, the TigerGraph suite is skipped with a message.

The end-to-end check of the PRD's "Must work in the demo" list:

```bash
pnpm --filter web e2e
```

This check needs all of these things first:

1. The file `apps/web/.env.local` must exist, because the script starts with `tsx --env-file=.env.local`.
2. TigerGraph must be up, with the graph loaded by `pnpm --filter web graph:load`.
3. A `next dev` server must run on port 3100 with demo mode on and `APP_URL` set to the same address: `DEMO_MODE=1 APP_URL=http://localhost:3100 pnpm --filter web exec next dev -p 3100`. To use another address, set `API_BASE` for the e2e command. The dev checkout path also needs `DODO_PAYMENTS_API_KEY` empty.
4. The worker must run with the `stub` profile: `LLM_PROFILE=stub pnpm --filter web worker`. The TL;DR assertion expects the project name in stub output.

The check seeds a new user `e2e-<timestamp>`, saves the stage article, and checks the repeats, the TL;DR, the graph, Learn next, and the voice note. Then it fills the quota with placeholder saves, makes sure that the next save is blocked, sends a signed test payment, and makes sure that the plan becomes Pro and the save completes. At the end, it deletes the user. It talks to the HTTP API with `x-user-id`, so it does not cover the side panel or the dashboard pages. It passes on this build. A save keeps at most 15 claims, so with the `stub` profile the check sees the first 15 sentences of the 28-sentence article: 3 new and 12 repeats.

`pnpm ui-check` drives the side panel page in a tab: connect, save, receipt, the save's dashboard page, no placeholders after a fill, a blocked save, **Pay (test)**, and Pro. `pnpm ui-check:brain` drives the dashboard: Export on Free and Pro, **Show the query**, Ask, and **Delete my data**. Both pass on this build. They do not press Alt+S or open a real side panel, because Playwright cannot do that.

## For the TigerGraph judges

TigerGraph does the novelty check, Learn next, and the graph view, and it also stores the billing state. There is no other database.

The schema is in [`graph/schema.gsql`](graph/schema.gsql). It is one local graph, `SecondBrain`:

- Vertices: `User` (plan, credits, `dodo_customer_id`), `Source` (status, `new_ratio`, `tldr`), `Claim`, `Highlight`, `Concept`, `Project`, and `WebhookEvent`.
- `Claim`, `Concept`, and `Project` each have a 384-dimension `embedding` vector attribute with the `COSINE` metric.
- Edges, all directed with reverse edges: `OWNS` (User to Source, Project, or Concept), `READ` (User to Source), `MAKES` and `REPEATS` (Source to Claim), `ABOUT` (Claim to Concept), `RELEVANT_TO` (Concept to Project), and `HIGHLIGHTS` (Highlight to Source).

`graph:load` loads the schema and the 15 queries in `graph/queries/`. This is the novelty query, `graph/queries/known_claims.gsql`, exactly as installed. A save's page in the dashboard also shows it, through **Show the query that checks for repeats**:

```gsql
CREATE OR REPLACE QUERY known_claims(VERTEX<User> u, LIST<FLOAT> claim_vec, FLOAT max_dist, INT k) FOR GRAPH SecondBrain SYNTAX v3 {
  MapAccum<VERTEX, FLOAT> @@dist;
  SumAccum<FLOAT> @distance;
  SumAccum<STRING> @source_id, @source_title, @source_url;
  SetAccum<STRING> @concepts;
  start = {u};
  mine = SELECT c FROM (s:start)-[:READ]->(src:Source)-[:MAKES]->(c:Claim);
  IF mine.size() > 0 THEN
    near = vectorSearch({Claim.embedding}, claim_vec, k, {candidate_set: mine, distance_map: @@dist});
    known = SELECT c FROM (c:near) WHERE @@dist.get(c) < max_dist POST-ACCUM c.@distance = @@dist.get(c);
    made = SELECT c FROM (c:known)<-[:MAKES]-(src:Source)
           ACCUM c.@source_id = src.id, c.@source_title = src.title, c.@source_url = src.url;
    tagged = SELECT c FROM (c:known)-[:ABOUT]->(t:Concept) ACCUM c.@concepts += t.name;
    PRINT known;
  END;
}
```

The traversal `User -READ-> Source -MAKES-> Claim` builds the set `mine`. The vector search then runs only inside that set. This is what makes the result personal. A claim is "known" only when this user read a source that made it. A global nearest-neighbor search marks a claim as known when another user read it, or when the user saved a source and never read it. The same query then follows `MAKES` back to the source for the "First read in" link and `ABOUT` out to the concepts. One query does the vector search and the graph traversal, and there is no second store to keep in sync. For a user with no reads, the `IF` guard skips the vector search and the query prints nothing. On TigerGraph 4.2.5, an empty `candidate_set` also returns no hits, not a global search.

The TigerGraph tests check this isolation on a live instance. Two users have similar claims, and `knownClaims` for user A never returns the claim of user B. A claim from a saved but unread source is not known.

Learn next, in `graph/queries/learn_next.gsql`, is a traversal with no vector search. The dashboard shows it as **Worth reading in full**:

1. Mark every source that the user READ.
2. Mark every concept that a read source reaches through `MAKES` or `REPEATS`, then `ABOUT`. These concepts are known.
3. Go from the user's projects (`OWNS`) back through `RELEVANT_TO` to concepts that are not known. These are the candidates.
4. For each candidate, collect the user's own unread sources that reach it through `MAKES` or `REPEATS`, then `ABOUT`.
5. Sort by the number of unread sources, then by name, and return the first `lim` results. The app asks for 3.

With the seed data, the result includes "ERC-4626" for the Ribozome project, with 2 unread sources. The e2e check asserts this.

## For the Dodo Payments judges

The plans are in `apps/web/src/server/billing/`:

| Plan | Price | What you get | Dodo product |
| --- | --- | --- | --- |
| Free | $0 | 30 saves each UTC month | None |
| Pro | $5 a month | 500 saves each UTC month | Subscription, `DODO_PRO_PRODUCT_ID` |
| Credit pack | $3 one time | 200 extra saves after the monthly allowance | One-time product, `DODO_CREDITS_PRODUCT_ID` |

The checkout flow:

1. `POST /api/capture` decides the save before it writes the source (`decideSave` in `quota.ts`). Inside the allowance, the save goes through. Past the allowance, one credit pays for the save if the user has credits. Otherwise the source is stored as `blocked`.
2. For a blocked save, the capture route calls `createCheckout` in `dodo.ts` and returns its `checkoutUrl` in the same response. `createCheckout` makes one Dodo customer for each user with `metadata.user_id`, stores `dodo_customer_id` on the `User` vertex, and calls `checkoutSessions.create` for the Pro product. The session returns to `/dashboard` after payment. The client refuses any environment other than `test_mode`.
3. The side panel shows "Free limit reached. Finish checkout in the new tab.", opens `checkoutUrl` in a new tab, and keeps polling the source. **Upgrade to Pro** and **Buy a credit pack** in the dashboard's Library page call `POST /api/billing/checkout` for the same checkout.
4. Dodo sends a webhook to `POST /api/webhooks/dodo`. The route reads the raw body and verifies the Standard Webhooks signature with `DODO_PAYMENTS_WEBHOOK_KEY`.
5. `handleDodoEvent` in `webhook.ts` finds the user by `customer_id`, or by `metadata.user_id` if that fails. `subscription.active` and `subscription.renewed` set the plan to `pro`. `subscription.cancelled`, `subscription.expired`, and `subscription.on_hold` set it to `free`. `payment.succeeded` for the credit pack adds 200 credits.
6. When the plan or the credits change, the webhook moves the user's blocked sources back to `pending`. The worker processes them, and the panel's poll shows the result. The user does not save again.

What changes live is product behavior, not a number on a page. The plan and the credits are attributes on the `User` vertex, and the quota check reads them on the next save.

Each `webhook-id` is applied once. The handler writes a `WebhookEvent` vertex with that id before it changes the user, and a repeated id returns `duplicate`. Dodo makes up to 8 delivery attempts and can send an event more than one time, so this check is necessary. The id is recorded before the change, so a crash between the two steps loses that one event. It never applies a credit grant two times.

Only test mode is used. No live key is checked in, and the client throws on any environment other than `test_mode`.

When `DODO_PAYMENTS_API_KEY` is empty, `createCheckout` returns `/dev/checkout?product=...&user=...`. That page is a local stand-in for Dodo test checkout, and it says so. Its **Pay (test)** button builds the event that Dodo sends, signs it with `DODO_PAYMENTS_WEBHOOK_KEY` through `standardwebhooks`, and posts it to the same webhook route. The automated checks use this stand-in. The real Dodo path ran once by hand in test mode: the app created the customer and the checkout session, a person paid with the `4242` test card (US billing, USD), Dodo's signed webhook came in through a Cloudflare quick tunnel, the plan became Pro, and the blocked save finished. With India billing, Dodo refused the same test card (`PAYMENT_METHOD_UNSUPPORTED`). This was last verified by hand before the redesign, and it is not tested on this build.

## Known limits

- The novelty threshold has a thin margin. In the 40 labelled pairs, the farthest "same" pair is at distance 0.347 and the nearest "different" pair is at 0.378. The whole gap is 0.031. The threshold 0.36 is 0.013 above the farthest "same" pair and 0.018 below the nearest "different" pair. See [`docs/threshold.md`](docs/threshold.md).
- `docs/threshold.md` measured the earlier 12-sentence stage article, where the threshold got 11 of 12 sentences right. The stage article in `fixtures/seed/demo.json` now has 28 labelled sentences, 19 known and 9 new. At 0.36 on this build, a direct `known_claims` check of all 28 sentences against a stub-seeded user got 28 of 28 right. A save checks at most 15 claims.
- Identity comes from a Clerk session or a signed extension token. `DEMO_MODE=1` is local only. Extension tokens have no per-token revocation. `/dev/checkout` is off in production and when a Dodo API key is set.
- **Delete my data** (Library page) and `DELETE /api/me` remove your graph data but not your Clerk sign-in account.
- Wispr Flow is untested. The Quick note field is a normal single-line text input.
- `cloudflared` puts the API on the public internet. Start a tunnel only for the Dodo test: `cloudflared tunnel --url http://localhost:3000`.
- Ask can miss a claim that was saved in the last few seconds, because TigerGraph's vector index takes a moment to include new vectors. With the `stub` profile the answer is the top 3 claims joined, not a written answer.
- The Obsidian export is one-way. Concept notes have no summary, because nothing writes `Concept.summary` yet.
