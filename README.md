# Second Brain

Second Brain is a Chrome extension and a local API that keep only what is new to you. Each save is split into claims, and each claim is compared with the claims that you already read, in a TigerGraph graph. The side panel shows the new claims, greys out the repeats with a "you read this in" link, and bills Pro plans and credit packs through Dodo Payments.

The product spec is [`docs/PRD.md`](docs/PRD.md). The person who presents the demo uses [`DEMO.md`](DEMO.md).

## How a save moves through the system

There are three capture paths. All of them send the same payload to `POST /api/capture`:

- The extension. The **Save this page** button or Alt+S sends the Readability text of the current tab.
- The **Quick note** box in the side panel. Wispr Flow types into this box, and the save is a `voice` capture.
- The paste page at `http://localhost:3000/`. This is a fallback for when the extension fails.

The API checks the quota, then writes a `Source` vertex with the status `pending`. A separate worker process polls for pending sources. For each source, the worker splits the text into claims and embeds each claim with `all-MiniLM-L6-v2` (384 dimensions, local). Then it runs the `known_claims` query once per claim. A claim that is near a claim the user read becomes a `REPEATS` edge. Any other claim becomes a new `Claim` vertex. The worker then links new claims to concepts, writes a TL;DR of the new claims, and sets the status to `done`.

```
extension ─┐
quick note ─┼─> POST /api/capture ──> Source (pending) ──> worker ──> TigerGraph
paste page ─┘         │                                     │  split, embed, known_claims,
                      │ over quota                          │  link concepts, TL;DR
                      v                                     v
              Dodo checkout ──> POST /api/webhooks/dodo ──> User.plan, User.credits
```

TigerGraph is the only database. It holds users, saves, claims, concepts, projects, embeddings, and billing state. The worker keeps its job state in the graph too, as the `status` attribute on `Source`.

The PRD names four side panel views. This build has all four as tabs:

- **What's new to me** shows the new claims, the repeats with links, and the TL;DR with "why it matters". It reads `GET /api/sources/:id`.
- **Learn next** shows concepts that your projects need and that you did not read yet. It reads `GET /api/learn-next`.
- **Graph** shows the source, its claims, their concepts, and the projects as a force-directed graph. Repeats are grey. It reads `GET /api/graph/:sourceId`.
- **Ask** answers a question only from your own claims and lists the claims it used, each with its source. It reads `POST /api/ask`. The search is the GSQL query `search_claims`: a vector search over the claims your own sources made, with each hit's source and concepts added one hop out (GraphRAG).

The Graph tab also has **Show the query**, which shows the `known_claims` GSQL on screen. Under **Your data**, **Export to Obsidian** downloads a zip of markdown notes with `[[wikilinks]]` (Pro only; the GSQL query `export_user` reads the whole graph in one call), and **Delete my data** removes your subgraph. Text that you select on the page before you save it is stored as a highlight and shown under the saved page.

The **Pro** badge in the panel header comes from `GET /api/me`.

The HTTP contract is in [`docs/api.md`](docs/api.md).

## Set up from zero on a laptop

You need Docker, Node, pnpm, and Chrome or Chromium. TigerGraph needs a lot of memory. Plan for 16 GB or more (see `docs/research/tigergraph.md`, section 1).

1. Start TigerGraph Community Edition 4.2.5:

	```bash
	docker run -d --init -p 14240:14240 --ulimit nofile=1000000:1000000 --name sb-tigergraph tigergraph/community:4.2.5
	```

	The user and the password are `tigergraph` and `tigergraph`. On the build machine, `docker pull` needs `DOCKER_CONFIG=/tmp/sb-docker-config`, because the default Docker configuration names a Windows credential helper.

2. Install the dependencies from the repo root:

	```bash
	pnpm install
	```

3. Copy the environment file:

	```bash
	cp .env.example apps/web/.env.local
	sed -i "s#^DODO_PAYMENTS_WEBHOOK_KEY=.*#DODO_PAYMENTS_WEBHOOK_KEY=whsec_$(openssl rand -base64 24)#" apps/web/.env.local
	```

	The values in `.env.example` select the `stub` LLM profile, the local TigerGraph, and the local checkout stand-in. The second command makes your own webhook signing secret. The repo does not ship one, because anyone who knows the secret can sign billing webhooks.

4. Create the graph, the schema, and the queries:

	```bash
	pnpm --filter web graph:load --reset
	```

	This takes about 4 minutes. Each of the two schema change jobs takes about 31 seconds. The one `INSTALL QUERY` statement for the 12 queries takes about 2.5 minutes, because TigerGraph compiles each installed query. Without `--reset`, the script keeps the graph and installs the queries again.

5. Load the seed data for the user `demo`:

	```bash
	pnpm --filter web seed
	```

	The seed deletes `demo`, then loads 3 projects, the concepts, and 30 articles through the real pipeline. The save dates are in the previous 60 days, so they do not count against this month's quota. The first run downloads the embedding model. On a machine where Node does not find the system certificates, set `SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt` for that run.

6. Start the web app and the API in one terminal:

	```bash
	pnpm --filter web exec next dev -p 3000
	```

7. Start the worker in a second terminal:

	```bash
	pnpm --filter web worker
	```

8. Build the extension:

	```bash
	pnpm --filter extension build
	```

9. In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select `apps/extension/.output/chrome-mv3`. The extension options hold `apiBase` (default `http://localhost:3000`) and `userId` (default `demo`).

### Which processes read `.env.local`

All of them. `next dev` reads `apps/web/.env.local` by itself. The `worker`, `seed`, `graph:load`, `tune`, and `demo:fill` scripts load it with `tsx --env-file-if-exists=.env.local`, and `e2e` needs it (`--env-file`). A value set on the command line wins over the file.

## LLM profiles and the cost guard

`LLM_PROFILE` selects the model for each pipeline step:

| Profile | Claim split | Concept link | TL;DR | Run on this build |
| --- | --- | --- | --- | --- |
| `stub` | sentence split | word overlap | first 3 new claims | Yes. All tests, the seed, and the e2e check use it. |
| `local` | Ollama `qwen3:8b` | Ollama `qwen3:8b` | Ollama `qwen3:8b` | Yes, by hand on an RTX 4060 (see below). Tests do not use it. |
| `cheap` | `claude-haiku-5-5` | `claude-haiku-5-5` | `claude-haiku-5-5` | No. There is no Anthropic key. |
| `demo` | `claude-sonnet-5-5` | `claude-haiku-5-5` | `claude-sonnet-5-5` | No. There is no Anthropic key. |

`stub` makes no network calls and gives the same output for the same input. The embeddings are real in every profile. The novelty check always compares real vectors.

The `demo` profile ran on real Claude once, on the stage article: Sonnet split it into 12 claims (3 new, 9 repeats, all as labelled), Haiku linked the concepts, and Sonnet wrote a TL;DR of the 3 new claims that names x402 Sentinel. The save cost $0.0093. That run found one bug that the stub could not: Zod adds integer `minimum`/`maximum` to JSON schemas, and Claude's structured output rejects them, so the code now removes them. The `cheap` profile and the Claude answer step of Ask have only a unit test of the request shape.

The `local` profile ran on the real model. The stage article went through the full pipeline on TigerGraph with `qwen3:8b` on the GPU. It gave 12 claims: 8 repeats with the right sources, the 3 planted new facts, and 1 labelled-known sentence that the model reworded past the threshold. Warm timings per save are about 8.6 s for the claim split, 2.5 s for concept links, and 4 s for the TL;DR. A cold first save also loads the 5 GB model, so the provider asks Ollama to keep it loaded for 30 minutes. `OLLAMA_MODEL=qwen2.5:7b` selects the PRD's fallback model.

To run Ollama on this machine, start the server with `ollama-serve` (a wrapper in `~/.local/bin` that puts WSL's CUDA driver on the library path), then set `LLM_PROFILE=local` in `apps/web/.env.local` and restart the worker. The provider factory throws when it runs under a test with any profile other than `stub`.

The cost guard is in `apps/web/src/server/llm/cost.ts`. Each Anthropic call adds a line to `logs/cost.jsonl` (or the path in `COST_LOG`). Before each call, the guard adds up the file. When the total is more than `COST_CAP_USD` (default 5), the call throws `CostCapError`. If an Anthropic call fails on a spend limit or on the cap, the provider falls back to Ollama and logs the fallback. Input text is cut to 48,000 characters, about 12,000 tokens.

## Run the checks

Unit and integration tests:

```bash
pnpm --filter web test
```

Stop the worker before you run this command. The TigerGraph tests create a pending source and then list pending sources. A running worker takes that source first, and the test fails. If TigerGraph is not reachable, the TigerGraph suite is skipped with a message.

The end-to-end check of the PRD's "Must work in the demo" list:

```bash
pnpm --filter web e2e
```

This check needs all of these things first:

1. The file `apps/web/.env.local` must exist, because the script starts with `tsx --env-file=.env.local`.
2. TigerGraph must be up, with the graph loaded by `pnpm --filter web graph:load`.
3. A `next dev` server must run on port 3100 with `APP_URL` set to the same address: `APP_URL=http://localhost:3100 pnpm --filter web exec next dev -p 3100`. To use another address, set `API_BASE` for the e2e command.
4. The worker must run with the `stub` profile: `pnpm --filter web worker`. The TL;DR assertion expects stub output.

The check seeds a new user `e2e-<timestamp>`, saves the stage article, and checks the repeats, the TL;DR, the graph, Learn next, and the voice note. Then it fills the quota with placeholder saves, makes sure that the next save is blocked, sends a signed test payment, and makes sure that the plan becomes Pro and the save completes. At the end, it deletes the user.

A browser check of the built extension and the checkout page:

```bash
CHROMIUM_PATH=/path/to/chromium pnpm ui-check
```

This check needs `next dev` on port 3000, the worker, the seeded `demo` user, and the built extension. It saves screenshots to `/tmp/sb-ui-check/`. It saves an article as `demo` and pays for Pro as `demo`. Right after it, `CHROMIUM_PATH=… pnpm ui-check:brain` asks a question in the Ask tab, opens Show the query, and downloads the Obsidian export. After the checks, run `pnpm --filter web seed` again to reset `demo`.

## For the TigerGraph judges

TigerGraph does the novelty check, Learn next, and the graph view, and it also stores the billing state. There is no other database.

The schema is in [`graph/schema.gsql`](graph/schema.gsql). It is one local graph, `SecondBrain`:

- Vertices: `User` (plan, credits, `dodo_customer_id`), `Source` (status, `new_ratio`, `tldr`), `Claim`, `Highlight`, `Concept`, `Project`, and `WebhookEvent`.
- `Claim`, `Concept`, and `Project` each have a 384-dimension `embedding` vector attribute with the `COSINE` metric.
- Edges, all directed with reverse edges: `OWNS` (User to Source, Project, or Concept), `READ` (User to Source), `MAKES` and `REPEATS` (Source to Claim), `ABOUT` (Claim to Concept), `RELEVANT_TO` (Concept to Project), and `HIGHLIGHTS` (Highlight to Source).

`graph:load` loads the schema and the 12 queries in `graph/queries/`. This is the novelty query, `graph/queries/known_claims.gsql`, exactly as installed:

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

The traversal `User -READ-> Source -MAKES-> Claim` builds the set `mine`. The vector search then runs only inside that set. This is what makes the result personal. A claim is "known" only when this user read a source that made it. A global nearest-neighbor search marks a claim as known when another user read it, or when the user saved a source and never read it. The same query then follows `MAKES` back to the source for the "you read this in" link and `ABOUT` out to the concepts. One query does the vector search and the graph traversal, and there is no second store to keep in sync. For a user with no reads, the `IF` guard skips the vector search and the query prints nothing. On TigerGraph 4.2.5, an empty `candidate_set` also returns no hits, not a global search.

The TigerGraph tests check this isolation on the live container. Two users have similar claims, and `knownClaims` for user A never returns the claim of user B. A claim from a saved but unread source is not known.

Learn next, in `graph/queries/learn_next.gsql`, is a traversal with no vector search:

1. Mark every source that the user READ.
2. Mark every concept that a read source reaches through `MAKES` or `REPEATS`, then `ABOUT`. These concepts are known.
3. Go from the user's projects (`OWNS`) back through `RELEVANT_TO` to concepts that are not known. These are the candidates.
4. For each candidate, collect the user's own unread sources that reach it through `MAKES` or `REPEATS`, then `ABOUT`.
5. Sort by the number of unread sources, then by name, and return the first `lim` results.

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
2. For a blocked save, the capture route calls `createCheckout` in `dodo.ts` and returns its `checkoutUrl` in the same response. `createCheckout` makes one Dodo customer for each user with `metadata.user_id`, stores `dodo_customer_id` on the `User` vertex, and calls `checkoutSessions.create` for the Pro product. The client refuses any environment other than `test_mode`.
3. The side panel shows "Free limit reached", opens `checkoutUrl` in a new tab, and keeps polling the source.
4. Dodo sends a webhook to `POST /api/webhooks/dodo`. The route reads the raw body and verifies the Standard Webhooks signature with `DODO_PAYMENTS_WEBHOOK_KEY`.
5. `handleDodoEvent` in `webhook.ts` finds the user by `customer_id`, or by `metadata.user_id` if that fails. `subscription.active` and `subscription.renewed` set the plan to `pro`. `subscription.cancelled`, `subscription.expired`, and `subscription.on_hold` set it to `free`. `payment.succeeded` for the credit pack adds 200 credits.
6. When the plan or the credits change, the webhook moves the user's blocked sources back to `pending`. The worker processes them, and the panel's poll shows the result. The user does not save again.

What changes live is product behavior, not a number on a page. The plan and the credits are attributes on the `User` vertex, and the quota check reads them on the next save.

Each `webhook-id` is applied once. The handler writes a `WebhookEvent` vertex with that id before it changes the user, and a repeated id returns `duplicate`. Dodo makes up to 8 delivery attempts and can send an event more than one time, so this check is necessary. The id is recorded before the change, so a crash between the two steps loses that one event. It never applies a credit grant two times.

Only test mode is used. There is no live key anywhere in the repo.

When `DODO_PAYMENTS_API_KEY` is empty, `createCheckout` returns `/dev/checkout?product=...&user=...`. That page is a local stand-in for Dodo test checkout, and it says so. Its **Pay (test)** button builds the event that Dodo sends, signs it with `DODO_PAYMENTS_WEBHOOK_KEY` through `standardwebhooks`, and posts it to the same webhook route. The automated checks use this stand-in. The real Dodo path ran once by hand in test mode: the app created the customer and the checkout session, a person paid with the `4242` test card (US billing, USD), Dodo's signed webhook came in through a Cloudflare quick tunnel, the plan became Pro, and the blocked save finished. With India billing, Dodo refused the same test card (`PAYMENT_METHOD_UNSUPPORTED`).

## Known limits

- The novelty threshold has a thin margin. In the 40 labelled pairs, the farthest "same" pair is at distance 0.347 and the nearest "different" pair is at 0.378. The whole gap is 0.031. The threshold 0.36 is 0.013 above the farthest "same" pair and 0.018 below the nearest "different" pair. See [`docs/threshold.md`](docs/threshold.md).
- On the original stage article, the threshold got 11 of 12 sentences right. Sentence 7 (the `outputSchema` line) was a new fact that matched a seed claim, so the article had too few new claims for a TL;DR. The lead replaced that sentence in `fixtures/seed/demo.json` with a clearly new fact. The addendum in `docs/threshold.md` records this. The threshold, the seed, and the labelled pairs did not change.
- There is no authentication. The server trusts the `x-user-id` header. Anyone who can reach the API can act as any user. With no Dodo key, anyone who can reach `/dev/checkout?product=pro&user=<id>` can upgrade any user to Pro.
- Wispr Flow was not tested. The quick note box is a normal textarea.
- `cloudflared` is installed (`~/.local/bin/cloudflared`), but no tunnel was started. A tunnel puts the API on the public internet, and the API has no authentication. Start one only for the Dodo test: `cloudflared tunnel --url http://localhost:3000`.
- Real Claude ran once with the `demo` profile (see LLM profiles). The `cheap` profile was not run.
- Ask the brain can miss a claim that was saved in the last few seconds, because TigerGraph's vector index takes a moment to include new vectors. With the `stub` profile the answer is the top 3 claims joined, not a written answer.
- The Obsidian export is one-way. Concept notes have no summary, because nothing writes `Concept.summary` yet.
