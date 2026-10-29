# Task cards

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
3. `pipeline/process.ts`: `processSource(deps, sourceId)`, the 5 PRD steps for one pending source: split, embed, `knownClaims` per claim with `NOVELTY_MAX_DIST` (default 0.35, read from env; G2 tunes it), repeat → `addRepeat`, new → `addClaim`; link new claims to concepts (reuse an existing concept when the name matches case-insensitively or its embedding is within 0.25; else create one, related to the projects the stub or model picked); TL;DR on new claims only, and none when under 20% new; mark the source read by the user; set `newRatio`, `tldr`, status `done`. Any step that throws sets status `partial` and keeps what was written. A quota check is a dependency (`deps.quota.allow(userId)`) called before the novelty step; if it says no, set status `blocked` and stop.
4. `pipeline/result.ts`: `getSaveResult(deps, userId, sourceId): SaveResult` from `getSource` + `sourceClaims`.
5. `worker.ts`: a loop that polls `listPendingSources` every second and processes them one at a time. `scripts/process-file.ts` runs capture + process on a text file for a given user with the memory graph or TigerGraph (`GRAPH=memory|tigergraph`), and prints the SaveResult as JSON.
6. `deps` is one object: `{ graph: GraphPort, llm, embed, quota, now(), config }`. Do not import TigerGraph from the pipeline.

Done when:

- Tests with the memory graph and stub LLM, using `fixtures/seed/` if present: seed 3 read articles, then process an article that paraphrases two of their sentences and adds two new ones. Assert 2 repeats with the right source titles, 2 new claims, `newRatio` 0.5, TL;DR bullets equal to the new claims only. Assert a duplicate URL capture returns the same source id. Assert a blocked quota leaves status `blocked`. Assert a throwing LLM leaves status `partial`.
- `tsc --noEmit` and `pnpm --filter web test` pass.
- Commit `P2: ...`, tag `p2`.
