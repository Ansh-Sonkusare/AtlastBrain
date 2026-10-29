# Second Brain: hackathon PRD

14 Oct 2026 · @Teak. Copied from the PRD the operator pasted into the build session on 2026-10-29. Tables are kept as lists where the paste lost their layout.

## Pitch

Second Brain is a browser extension that reads what you save and keeps only what's new to you. Every article, thread or voice note is split into claims and checked against a TigerGraph knowledge graph of everything you've already read; repeats become links, new ideas get a personal TL;DR, and the graph tells you what to learn next. Pro plans and AI credits are billed through Dodo Payments.

One-line demo: save two articles on the same topic; the second one comes back as "80% you already know, here's the one new idea, and it matters for your project because…".

The problem: people save far more than they read, and most of what they read repeats what they already know. Read-later apps summarise every article in full, every time, so the pile grows and nothing tells you what's actually new.

Built solo in 24 hours, fully self-hosted, for a hackathon sponsored by TigerGraph and Dodo Payments, and designed so each sponsor is load-bearing, not decorative:

- TigerGraph is the only database: claims, concepts, projects and embeddings in one graph, and the novelty check is a single GSQL query combining vectorSearch() with a graph traversal.
- Dodo Payments handles real money in the demo: a free tier with a monthly save limit, a Pro subscription, and AI credits for heavy users, with Dodo as merchant of record.
- Wispr Flow makes voice capture free to build: dictate into the extension's quick box and the note goes through the same pipeline.

## Market gaps

Every existing tool covers one stage of the loop; none connects reading to thinking to a memory of the user, in files the user owns.

- Readwise Reader. Strong: reader, highlights, RSS, AI Q&A, export to Obsidian; $9.99/mo annual, no free tier. Missing: no canvas; AI works one document at a time; RSS is an unfiltered stream.
- Instapaper / Matter. Strong: clean reading, offline, text-to-speech. Missing: no AI organisation, no boards.
- Milanote / Heptabase / Kosmik. Strong: visual boards and cards; Heptabase adds a clipper and AI. Missing: no reading queue or feeds; data lives inside the app.
- Recall. Strong: AI summaries, auto-linking, graph, quizzes. Missing: no canvas, no RSS, markdown export only.
- Karakeep / Wallabag. Strong: self-hosted, AI tags, RSS auto-save. Missing: no canvas, no reader polish, saves everything from a feed.
- Axiom (reference repo). Strong: right-click save, AI category/summary/relationships, dedup, graph UI. Missing: manual capture only; Postgres app, no vault; no model of the user.

The gap we demo: none of these tools knows what you already know. They summarise each article from scratch; we compare it against your graph and show only the delta. That comparison is a graph problem (claims linked to concepts linked to what you've read), which is why TigerGraph is the core of the build, not a bolt-on.

## Hackathon goals

Win by showing one loop that works live, uses both sponsors deeply, and makes judges say "I'd use that".

### Must work in the demo

1. Save a page from the extension in one click; it appears in the graph within 10 seconds.
2. Save a second, overlapping article; the side panel shows new claims vs repeated claims, with links to where you saw the repeats.
3. The TL;DR covers only the new claims and names the project it matters for.
4. "Learn next" lists concepts your projects depend on that you haven't read about yet.
5. Hitting the free-tier limit opens Dodo checkout; after paying, the plan flips to Pro and the save goes through.
6. Dictate a note with Wispr Flow into the quick box; it's checked for novelty like any other save.

### What each sponsor's judges should see

- TigerGraph. Show: the graph schema, a live graph view of one save, and the novelty GSQL query. Why it's deep: it's the only database; vector search and traversal run in one query; learning gaps are a traversal.
- Dodo Payments. Show: Free → Pro upgrade in the demo, plus AI credits charged per heavy operation. Why it's deep: subscriptions, usage credits and a webhook that changes product behaviour live.

Out of scope for the hackathon: boards, feeds, Telegram/Hermes, flashcards, explain-back, GitHub sync, chat import, digital garden, two-way Obsidian sync, Supermemory.

## At a glance

Three capture paths feed one worker. The worker writes claims to TigerGraph and reads back what the user already knows; Dodo's webhook sets the user's plan on the same graph; all four demo views are queries over it.

## Capture (MVP)

Three ways in for the hackathon, all posting the same payload to one endpoint: `url`, `title`, `text`, `selection?`, `source` (`extension`, `voice`, `web`), `capturedAt`.

1. Browser extension (WXT, Chrome): toolbar button or Alt+S saves the page; selecting text and saving makes a highlight. The extension sends Readability text so the backend never has to fetch pages.
2. Voice with Wispr Flow: the side panel has a quick note box. Wispr Flow types the text in, and it's saved as a voice capture. No integration code. Export the graph's project and concept names as a word list for Wispr's dictionary.
3. Web app paste box: paste a URL or text, as a fallback if the extension misbehaves.

Seed data: before the demo, import about 30 articles and 3 projects for one demo user, so the graph already "knows" things.

## Processing pipeline

1. Extract. Use the text the extension sent; YouTube transcript and GitHub README as stretch goals. Model: none.
2. Dedup. Same canonical URL or content hash → attach to the existing Source and stop. Model: none.
3. Novelty. Split the text into 5–15 claims; embed each; one GSQL query per save finds the nearest known claims among sources the user has read. Distance under the threshold → REPEATS edge; otherwise a new Claim vertex. Model: Claude Haiku (claim split) + local embeddings.
4. TL;DR. 3 bullets on the new claims only, plus "why it matters" naming the closest Project; under 20% new → no TL;DR, just "nothing new" with links. Model: Claude Sonnet.
5. Link. ABOUT edges from new claims to existing or new Concept vertices; RELEVANT_TO edges to projects. Model: Claude Haiku + local embeddings.

Embeddings run locally in Node (all-MiniLM-L6-v2 via transformers.js, 384 dimensions).

## Model routing and budget

Profiles, one env var `LLM_PROFILE`:

- `local` (building and tests): Ollama qwen3:8b for every step.
- `cheap` (spot checks): Haiku 5.5 (`claude-haiku-5-5`) for every step.
- `demo` (seed import and stage): Sonnet 5.5 (`claude-sonnet-5-5`) for claim split and TL;DR, Haiku 5.5 for concept link.

Rules: the same JSON schema goes to both providers; every Claude call sets effort low; if a Claude call fails on the spend limit, fall back to local and log it. Hard caps: an in-app counter in `logs/cost.jsonl` that refuses calls past `COST_CAP_USD`; articles truncated to about 12k tokens; tests never call Claude.

Prices per million tokens (input/output): Haiku 5.5 $0.10/$0.50, Sonnet 5.5 $2/$10, Opus 5.5 $4/$20.

## The novelty query (sketch; exact 4.2 syntax to confirm)

```
CREATE QUERY known_claims(VERTEX<User> u, LIST<FLOAT> claim_vec, FLOAT max_dist) {
  MapAccum<VERTEX, FLOAT> @@dist;
  mine = SELECT c FROM User:s -(READ>)- Source -(MAKES>)- Claim:c WHERE s == u;
  near = vectorSearch({Claim.embedding}, claim_vec, 5,
                      {candidate_set: mine, distance_map: @@dist});
  known = SELECT h FROM near:h WHERE @@dist.get(h) < max_dist;
  ctx = SELECT k FROM known -(ABOUT>)- Concept:k;
  PRINT known, ctx, @@dist;
}
```

The per-user candidate set is the point: a claim is "known" only if this user has read it.

Only new information, in practice:

- An article that restates three known things and adds one new idea gets a TL;DR of that one idea, plus "repeats: [[x402 batching]], [[facilitator model]]".
- A voice note saying something already known adds no new fact, only a mentioned edge with today's date.
- The novelty threshold is per user; the reader shows a "hidden as not new" list so nothing is lost silently.

Rules:

- Pipeline runs as a background job; the side panel polls and shows "checking against your brain…".
- Each save costs AI credits; the job checks the user's plan before step 3.
- A failed step leaves the Source with `status: partial`; the demo never shows a blank card.

## Demo surfaces

Four views in the extension side panel:

- What's new to me. For the page just saved: new claims highlighted, repeated claims greyed with "you read this in …" links, and the TL;DR of the new part. Backed by known_claims + TL;DR.
- Ask the brain (stretch). Question answered from the user's own claims, with source links.
- Learn next. Top 3 concepts linked to an active project that have no read source, each with a saved-but-unread item to start with. Traversal: Project ← RELEVANT_TO ← Concept with no READ path.
- Graph. A live force-directed view of the save: source → claims → concepts → project, repeats drawn in grey. GSQL returning the 2-hop neighbourhood; rendered with react-force-graph.

## Storage: TigerGraph

TigerGraph is the only database: users, saves, claims, concepts, projects, embeddings and billing state.

Vertices:

- User: id, email, plan, credits, dodo_customer_id
- Source: url, title, kind, status, saved_at, read_at, new_ratio, tldr
- Claim: text, first_seen; vector `embedding`
- Highlight: text, created_at
- Concept: name, summary; vector `embedding` (name)
- Project: name, description; vector `embedding` (description)

Edges:

- OWNS: User → Source, Project
- READ: User → Source, with date. Candidate set for novelty; Learn next.
- MAKES: Source → Claim. Claims first stated by this source.
- REPEATS: Source → Claim. This source restated a claim the user already knew.
- ABOUT: Claim → Concept.
- RELEVANT_TO: Concept → Project.
- HIGHLIGHTS: Highlight → Source.

New vectors can take a moment to appear in the HNSW index, so dedup also checks URL and content hash.

Hosting: TigerGraph Community Edition in Docker on the laptop, schema and queries loaded by one script from the repo.

Obsidian export (stretch): download the graph as a zip of markdown notes with [[wikilinks]].

## Billing: Dodo Payments

- Free. $0. 30 saves a month, novelty check, TL;DR. No Dodo product.
- Pro. $5/month (₹399/month in India). 500 saves a month, Learn next, graph view, Obsidian export. Subscription.
- Credit pack. $3 one-time (₹249). 200 extra saves, used after the monthly allowance. One-time purchase.

Flow:

1. A save checks User.plan and User.credits in TigerGraph before the novelty step.
2. Over the limit → the API creates a Dodo checkout for the Pro product and the side panel opens it.
3. Dodo's webhook (signature verified) reports the payment or subscription change; the API updates plan, credits and dodo_customer_id on the User vertex.
4. The side panel re-polls, sees Pro, and the blocked save runs. Test mode for the demo.

## Privacy

Every query starts from the User vertex through OWNS and READ edges; the API never runs a query without a user id. The extension sends only pages the user explicitly saves. Account deletion removes the user's subgraph.

## Tech stack

- Extension: WXT + React, Chrome side panel.
- Web app + API: one Next.js app running locally. API routes for capture, views, Dodo checkout and webhook; a tiny paste page.
- Public URL: Cloudflare Tunnel to the laptop.
- Worker: a loop inside the same Node app polling Source vertices with `status: pending`. Job state lives in the graph.
- Database: TigerGraph CE in Docker; REST++ for upserts, installed GSQL queries for reads. Schema and queries in `graph/`.
- LLM: Anthropic API; costs logged per save.
- Embeddings: transformers.js, 384 dimensions.
- Graph view: react-force-graph in the side panel.
- Billing: Dodo checkout, subscription, credits, webhook. Test mode.
- Voice: Wispr Flow typing into the quick note box.

Build order: 1. TigerGraph + schema + seed. 2. Worker (claim split, embeddings, known_claims, TL;DR), tested from a script. 3. Extension save + What's new. 4. Learn next. 5. Dodo. 6. Graph view. 7. Stretch: Ask the brain, Obsidian export, Wispr vocabulary export.

## Autopilot rules

- One card per session. Do only that card, run its "Done when" checks, commit `<ID>: …`, tag, stop.
- Two strikes. If a check fails, fix once. If it fails again, write BLOCKED.md and stop.
- Budget. Tests never call Claude.
- Payments. Dodo test mode only; live keys are forbidden.
- Scope. Build only what the card lists; ideas go in IDEAS.md. App cards treat the GSQL queries in `graph/` as a fixed API.
- Safety. Never commit .env, never force-push, never rewrite tagged history.
- Hand back to the human: registering the tunnel URL as Dodo's webhook, loading the unpacked extension in Chrome, recording the backup video.

## Demo script (3 minutes)

1. Hook: open the side panel on a seeded account: 30 sources, 3 projects.
2. First save: an article on x402 agent payments. "What's new to me" shows 3 new claims out of 12, the other 9 greyed with "you read this in …" links. TL;DR covers just the 3; "why it matters" points at the x402 Sentinel project.
3. The graph: source → claims → concepts → project, repeats in grey. Flash the known_claims GSQL.
4. Voice: "decided to use batching for the router because per-call overhead was too high". It lands as a claim, linked to the same concept.
5. Learn next: "ERC-4626 blocks your Ribozome project; you've saved two pieces on it and read neither."
6. Paywall: the next save hits the free limit. Dodo checkout opens, pay in test mode, the webhook flips the plan to Pro live, and the save completes.
7. Close.
