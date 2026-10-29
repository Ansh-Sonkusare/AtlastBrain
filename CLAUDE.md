# Second Brain

A browser extension and local API that keep only what is new to the user. The PRD is `docs/PRD.md`. Read it before you start a card. The cards are in `docs/cards.md`.

## Layout

- `apps/web` is one Next.js 16 app. It holds the API routes, the paste page, and the server code in `src/server/`. The worker runs as a separate Node process from the same package (`pnpm --filter web worker`).
- `apps/extension` is the WXT + React Chrome extension with a side panel.
- `graph/` holds the TigerGraph schema and GSQL queries, and the script that loads them.
- `fixtures/seed/` holds the seed corpus and the labelled pairs for threshold tuning.
- `apps/web/src/server/types.ts` holds the shared data shapes. Change it only when your card says so.

Next.js 16 has breaking changes. Read the guide in `apps/web/node_modules/next/dist/docs/` before you write route or page code.

## Running things

- TigerGraph CE 4.2.5 runs in the Docker container `sb-tigergraph` on `127.0.0.1:14240`. Docker on this machine needs `DOCKER_CONFIG=/tmp/sb-docker-config` for pulls, because the default config names a Windows credential helper.
- Local embeddings use `Xenova/all-MiniLM-L6-v2` through `@huggingface/transformers`, 384 dimensions. Network calls from Node need `SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt` on the first model download.
- Install dependencies only from the repo root with `pnpm install`. Do not add a dependency unless your card names it.

## LLM profiles

`LLM_PROFILE` selects the provider for each pipeline step: `stub`, `local`, `cheap`, or `demo` (see the PRD). `stub` is deterministic and makes no network calls. Tests use `stub` only, and the provider factory throws when it runs under a test with any other profile. There is no Anthropic key and no Ollama on this machine, so `local`, `cheap`, and `demo` are built to their docs but are not run here.

## Autopilot rules

- One card per session. Do only that card, run its "Done when" checks, then `git commit -m "<ID>: ..."` and `git tag -m "<ID>" <id>` (tags are signed here and need a message), and stop.
- Two strikes. If a check fails, fix it once. If it fails again, write `BLOCKED.md` (what failed, logs, best guess) and stop. Never loop.
- Tests never call Claude or Dodo. Dodo test mode only; live keys are forbidden.
- Build only what the card lists. Put other ideas in `IDEAS.md`.
- App cards treat the GSQL queries in `graph/` as a fixed API and never edit them.
- Never commit `.env`. Never force-push. Never rewrite tagged history.
- Each test run that writes to TigerGraph uses its own user id, so parallel runs do not collide.
- Stop the worker before `pnpm --filter web test`. The worker processes every pending source, so it races the TigerGraph test that lists pending sources.
