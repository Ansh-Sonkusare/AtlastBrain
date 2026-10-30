# Blocked: e2e save time on the 15-sentence stage article

**What failed:** `pnpm --filter web e2e` stopped twice at its first check, the 10 s limit on capture to done with the `stub` profile.

- Run 1: `FAIL save took 10261 ms, PRD wants under 10 s`
- Run 2: `FAIL save took 10706 ms, PRD wants under 10 s`
- Last passing run, on the 28-sentence article: 7787 ms

**Not exercised on the new article:** every e2e check after that one (repeats, TL;DR, graph, Learn next, voice note, paywall loop), because the script stops at the first failure.

**What passed on this tree:** `tsc`; web tests, 149 of 149 with `LLM_PROFILE=stub`; one real `demo` save of the new article, 14 claims, 5 new, 9 repeats, $0.0114, about 15 s.

**Best guess, not confirmed:** cold start. Both runs started a fresh `next dev` on port 3100 and made the save the first request to its routes, on TigerGraph Cloud. The passing run may have had a warmer server, or Cloud may simply be slower now. The article got shorter, so it is unlikely to be the cause.

**Next step:** warm the routes, then run e2e again. If it still exceeds 10 s, measure which step is slow. Do not raise the limit without that measurement.
