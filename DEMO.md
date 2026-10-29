# Run the 3-minute demo

This guide is for the person on stage. It has the work to do before the demo, and the 3-minute script from `docs/PRD.md` mapped to clicks in this build. For setup from zero, see [`README.md`](README.md).

## Before the demo

### Decide which checkout to show

There are two checkout paths. Decide first, because the other steps depend on the choice.

- **The local stand-in (the default, and the only path that was tested).** Leave `DODO_PAYMENTS_API_KEY` empty in `apps/web/.env.local`. A blocked save opens `http://localhost:3000/dev/checkout`. That page says that it is a local stand-in for Dodo test checkout, and its **Pay (test)** button sends a signed webhook to the app.
- **Real Dodo test checkout (never tested).** Set `DODO_PAYMENTS_API_KEY` to a `dodo_test_` key. When the key is set, `/dev/checkout` returns 404, so all of the steps under "Set up real Dodo test mode" are necessary. If one of them is not done, leave the key empty and use the stand-in.

### Set up real Dodo test mode

Do these steps only for real Dodo checkout. Use the Dodo dashboard in test mode for each step.

1. Create a subscription product "Pro" at $5 a month. Put its id in `DODO_PRO_PRODUCT_ID`. The webhook ignores a `subscription.active` event for any other product id.
2. Create a one-time product "Credit pack" at $3. Put its id in `DODO_CREDITS_PRODUCT_ID`.
3. Put the test API key in `DODO_PAYMENTS_API_KEY`. Keep `DODO_PAYMENTS_ENVIRONMENT=test_mode`. The app refuses any other value.
4. Get a public HTTPS address for `http://localhost:3000`. The PRD plans a Cloudflare Tunnel, but `cloudflared` is not installed on the build machine and no tunnel was set up. Install it and start a tunnel to port 3000.
5. In the dashboard, add a webhook endpoint at `<tunnel address>/api/webhooks/dodo`, for the `subscription.*` and `payment.succeeded` events.
6. Copy the endpoint's signing secret into `DODO_PAYMENTS_WEBHOOK_KEY`. The secret you generated during setup does not match Dodo's signatures, and the route rejects every event signed by Dodo until you replace it.
7. Restart `next dev` so that it reads the new values.
8. Do one full payment with the test card `4242 4242 4242 4242`, expiry `06/32`, CVV `123`. Then run `pnpm --filter web seed` to reset the user.

### Do the hand-back items

These steps need a person. Do them in this order on the demo laptop.

1. Start TigerGraph, `next dev` on port 3000, and the worker, as the README describes.
2. Build the extension with `pnpm --filter extension build`. In `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select `apps/extension/.output/chrome-mv3`. Pin the extension to the toolbar.
3. Add the Wispr Flow dictionary words. Get the project and concept names for `demo`:

	```bash
	curl -H 'x-user-id: demo' http://localhost:3000/api/vocabulary
	```

	The route needs the `x-user-id` header. If you open the address in a browser tab, it returns 401. Add each line of the output to the Wispr Flow dictionary.
4. Rehearse the full script below at least one time. Every step changes the `demo` user.
5. Record a backup video of a full rehearsal. Use it if the live demo fails.
6. Reset the demo user:

	```bash
	pnpm --filter web seed
	```

	Do this after every rehearsal, after `pnpm ui-check`, and as the last step before you go on stage. The seed deletes `demo` with all of its saves, including the placeholder saves from `demo:fill`. Then it loads the seed data again, on the Free plan with 0 credits. Make sure that the output shows the same counts as the previous run.

### Know how an article gets into the panel

The three stage texts are in `fixtures/seed/demo.json`, under the keys `x402-overlap`, `voice-note`, and `fresh-topic`. The app serves the two articles as real pages:

- `http://localhost:3000/demo/x402-overlap`
- `http://localhost:3000/demo/fresh-topic`

Open the page and press Alt+S, or click **Save this page** in the side panel. `pnpm ui-check` checked that the extension reads these pages (the title and all 12 sentences). It did not press Alt+S, because a headless browser cannot send extension shortcuts, so rehearse the shortcut once.

The fallback is to paste the article's `body` into the **Quick note** box and click **Save note**. `pnpm ui-check` tested this path end to end. The save is then stored as a voice capture titled "Voice note".

## The 3-minute script

The stage numbers come from the PRD. The "expected" lines say what the e2e check and the browser check measured on this build.

### 1. Hook (15 seconds)

1. Open a browser tab and click the Second Brain toolbar button. The side panel opens.
2. Say that this account saved 30 articles, read 26 of them, and owns 3 projects: x402 Sentinel, Ribozome, and Second Brain.

The audience sees the panel with "Save a page to see what is new to you." and the three tabs.

### 2. First save (45 seconds)

1. Open `http://localhost:3000/demo/x402-overlap` (the article "How Autonomous Agents Pay for APIs With x402").
2. Press Alt+S. If the shortcut does nothing, click **Save this page**, or paste the `body` into the **Quick note** box and click **Save note**.

The audience sees "checking against your brain…", then the result in **What's new to me**. The panel shows the new claims, the repeated claims in grey with "you read this in" links to the seed articles, a TL;DR of the new claims only, and "Why it matters" that names x402 Sentinel.

Expected: the labels in `demo.json` say 3 new sentences and 9 known ones. The new sentences are about Solana support, the Apache 2.0 licence, and the x402 Bazaar. The e2e check requires 8 or more repeats and 1 or more new claims, and it measured the save from capture to `done` in under 10 seconds. Say "most of this you already know" and do not promise an exact count.

### 3. The graph (30 seconds)

1. Click the **Graph** tab.
2. Hover over a node to show its label.

The audience sees the source, its claims, their concepts, and the projects. Repeated claims and `REPEATS` links are grey.

3. Show `graph/queries/known_claims.gsql` in an editor, or the copy in the README. Point at the `mine` line (the claims from sources this user read) and the `vectorSearch` line that runs only inside that set.

### 4. Voice (20 seconds)

1. Click in the **Quick note** box.
2. Dictate with Wispr Flow: "Decided to use batching for the router because per-call overhead was too high." This is the `voice-note` text. If Wispr Flow fails, type or paste the same text.
3. Click **Save note**.

The audience sees the note checked like any other save. The label in `demo.json` marks this note as new. The e2e check only proved that the note gets one or more claims. No check proved that it links to the batching concept, so do not promise that link. Wispr Flow was never tested on this build.

### 5. Learn next (25 seconds)

1. Click the **Learn next** tab.

The audience sees up to 3 concepts that a project needs and that the user did not read. The list includes "ERC-4626" for the Ribozome project, with 2 saved but unread sources as links. The e2e check asserts this.

2. During this step, bring the user to the free limit. In a terminal that the audience does not see, run:

	```bash
	pnpm --filter web demo:fill
	```

	The script adds placeholder saves up to the plan's allowance. They have no claims, so no view shows them. It prints a line that ends with "the next save is blocked". Do not run it before step 2, because then the first save is blocked. It works only when `demo` is on the Free plan with 0 credits, which is the state after `seed`.

### 6. Paywall (35 seconds)

1. Open `http://localhost:3000/demo/fresh-topic` (the article "CRDTs for Local-First Apps").
2. Press Alt+S, or click **Save this page**.

The audience sees "Free limit reached. Finish checkout in the new tab." A new tab opens with the checkout.

3. Pay:
	- With the stand-in, click **Pay (test)**. The page then says "Paid. You can close this tab."
	- With real Dodo, pay with the test card `4242 4242 4242 4242`, expiry `06/32`, CVV `123`.
4. Go back to the side panel.

The audience sees the **Pro** badge in the panel header, and the blocked save completes without another click. The labels in `demo.json` mark all 8 sentences of this article as new.

This full loop in the side panel was not run as one browser flow. The e2e check ran it over HTTP with a signed test payment. The browser check clicked **Pay (test)** on a checkout page that it opened directly. Rehearse this step.

### 7. Close (10 seconds)

Say the pitch from the PRD: it compares each save with what you already read and shows only the delta. TigerGraph does the comparison and the traversal in one query. Dodo changed the plan live through a signed webhook.

## If something fails on stage

- If the panel stays on "checking against your brain…", the worker is not running. Start it with `pnpm --filter web worker`. The source is still pending and completes when the worker starts.
- If the paywall save is not blocked, `demo:fill` did not run, or `demo` has credits or is already Pro. Run `pnpm --filter web demo:fill` and save again, or play the backup video for this step.
- If anything else fails, play the backup video.
