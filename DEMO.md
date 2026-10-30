# Run the 3-minute Atlas demo

This guide is for the person on stage. It has the work to do before the demo, and the 3-minute script from `docs/PRD.md` mapped to exact clicks in this build. For setup from zero, see [`README.md`](README.md).

The extension side panel only saves and shows a receipt. Everything else on stage happens in the web dashboard.

## Before the demo

### Decide which checkout to show

There are two checkout paths. Decide first, because the other steps depend on the choice.

- **The local stand-in (works with no Dodo account).** Leave `DODO_PAYMENTS_API_KEY` empty in `apps/web/.env.local`. A blocked save opens `http://localhost:3000/dev/checkout`. That page says that it is a local stand-in for Dodo test checkout, and its **Pay (test)** button sends a signed webhook to the app.
- **Real Dodo test checkout (tested once, end to end, on 2026-10-29, before the panel redesign).** Real Dodo checkout was last verified by hand before the redesign, and it is not tested on this build. Set `DODO_PAYMENTS_API_KEY` to a `dodo_test_` key. When the key is set, `/dev/checkout` returns 404, so all of the steps under "Set up real Dodo test mode" are necessary. If one of them is not done, leave the key empty and use the stand-in.

Check `apps/web/.env.local` before you rehearse. `DODO_PAYMENTS_API_KEY` picks the checkout, `LLM_PROFILE` picks the models, and `TG_URL` picks the graph that the seed resets.

### Set up real Dodo test mode

Do these steps only for real Dodo checkout. Use the Dodo dashboard in test mode for each step.

1. Create a subscription product "Pro" at $5 a month. Put its id in `DODO_PRO_PRODUCT_ID`. The webhook ignores a `subscription.active` event for any other product id.
2. Create a one-time product "Credit pack" at $3. Put its id in `DODO_CREDITS_PRODUCT_ID`.
3. Put the test API key in `DODO_PAYMENTS_API_KEY`. Keep `DODO_PAYMENTS_ENVIRONMENT=test_mode`. The app refuses any other value.
4. Get a public HTTPS address for `http://localhost:3000`. Run `cloudflared tunnel --url http://localhost:3000`. It prints a `https://….trycloudflare.com` address, which changes on every start. Stop the tunnel after the demo.
5. In the dashboard, add a webhook endpoint at `<tunnel address>/api/webhooks/dodo`, for the `subscription.*` and `payment.succeeded` events.
6. Copy the endpoint's signing secret into `DODO_PAYMENTS_WEBHOOK_KEY`. A secret that you generated yourself does not match Dodo's signatures, and the route rejects every event signed by Dodo until you replace it.
7. Restart `next dev` so that it reads the new values.
8. Do one full payment with the test card `4242 4242 4242 4242`, expiry `06/32`, CVV `123`. Then run `pnpm --filter web seed` to reset the user.

### Start the app and connect the extension

These steps need a person. Do them in this order on the demo laptop.

1. Make sure that TigerGraph is reachable and that `EXTENSION_TOKEN_SECRET` is set in `apps/web/.env.local`.
2. Start the web app in one terminal:

	```bash
	DEMO_MODE=1 pnpm --filter web exec next dev -p 3000
	```

3. Start the worker in a second terminal:

	```bash
	pnpm --filter web worker
	```

4. In Chrome, open `http://localhost:3000/dashboard?user=demo`. Use `localhost`, not `127.0.0.1`. This sets a demo cookie, so later dashboard links in this Chrome profile stay on `demo` without Clerk.
5. Build the extension with `pnpm --filter extension build`.
6. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select `apps/extension/.output/chrome-mv3`. Pin Atlas to the toolbar.
7. Click the Atlas toolbar button. The side panel opens and shows **Connect your account**.
8. Click **Connect your account**. In the tab that opens, click **Connect extension**. The page says "Connected. You can close this tab."

The panel now shows **Save this page** and saves as `demo`. The token lasts 90 days, and a reset does not remove it. `pnpm ui-check` ran this connect flow under `DEMO_MODE=1` on this build.

### Add the Wispr Flow dictionary words

Get the project and concept names for `demo`:

```bash
curl -H 'x-user-id: demo' http://localhost:3000/api/vocabulary
```

The `x-user-id` header works only with `DEMO_MODE=1`. Add each line of the output to the Wispr Flow dictionary. Wispr Flow is still untested on this build, so rehearse it or plan to type.

### Rehearse, record, and reset

1. Rehearse the full script below at least one time. Every step changes the `demo` user.
2. Record a backup video of a full rehearsal. Use it if the live demo fails.
3. Reset the demo user:

	```bash
	pnpm --filter web seed
	```

	Do this after every rehearsal and as the last step before you go on stage. The seed deletes `demo` with all of its saves, including the placeholder saves from `demo:fill`. Then it loads the seed data again, on the Free plan with 0 credits. Make sure that the output shows `projects` 3, `sources` 30, `read` 26, and `savesThisMonth` 0.

4. Close the side panel and open it again, so that **This session** is empty.
5. Reload `http://localhost:3000/dashboard?user=demo`.

### Know how an article gets into the panel

The three stage texts are in `fixtures/seed/demo.json`, under the keys `x402-overlap`, `voice-note`, and `fresh-topic`. The app serves the two articles as real pages:

- `http://localhost:3000/demo/x402-overlap`
- `http://localhost:3000/demo/fresh-topic`

Open the page and press Alt+S (Option+S on a Mac), or click **Save this page** in the side panel. `pnpm ui-check` clicked **Save this page** on this build, and page extraction worked. Alt+S is not tested on this build, so rehearse it once.

There are two fallbacks. The first is the **Quick note** field: paste the article's `body` and press Enter. The save is then stored as a voice capture titled "Voice note". The second is the dashboard's **Paste a page** button, which opens `/paste`.

## The 3-minute script

The stage numbers come from the PRD. The "Expected" lines separate what the fixtures and the checks say from what you can promise on stage. At the start, you have one Chrome tab on `http://localhost:3000/dashboard` and the side panel closed.

### 1. Hook (15 seconds)

1. Point at **Library** in the dashboard sidebar. Its count is 30.
2. Point at **By project** in the right column, with x402 Sentinel, Ribozome, and Second Brain. Second Brain here is a seeded project name.
3. Say that this account saved 30 articles, read 26 of them, and owns 3 projects.
4. Click the Atlas toolbar button.

The audience sees the panel with **Save this page**, "Nothing saved yet. Each save shows how much of it was new to you.", and `Free · 0 of 30 saves` in the footer.

### 2. First save (45 seconds)

1. Open `http://localhost:3000/demo/x402-overlap` in a new tab (the article "How Autonomous Agents Pay for APIs With x402").
2. Press Alt+S. If the shortcut does nothing, click **Save this page**.

The audience sees the button change to "Reading it for you…", then "Saved". The receipt shows a percent ring, "N new ideas", "N you already knew", and the new claims.

3. Click **See what's new in dashboard**. A new tab opens on the save's page.
4. Point at **What's new, in short** and **Why it matters**, which names x402 Sentinel.
5. Next to **Already known**, click **Show**. Point at a "First read in" link.

Expected: the labels in `demo.json` say 5 new sentences and 10 known ones, 15 in all, which is the most a save keeps (`MAX_CLAIMS`). One save on `demo` on this build gave 14 claims, 5 new and 9 repeats, in about 15 s, for $0.0114, and all 5 new claims were the planted ones. The count on `demo` can change from save to save, because Claude writes the claims. The e2e check requires at least 9 repeats, 1 or more new claims, a TL;DR that mentions only new claims, and a "why it matters" that names x402 Sentinel. It also requires capture to `done` in under 10 seconds with the `stub` profile. Rehearse with the profile you will use. Say "most of this you already know", and do not promise an exact count.

### 3. The graph (30 seconds)

1. Stay on the save's page. Scroll to **Where it connects**.
2. Click **Show the query that checks for repeats**. Point at the `mine` line (the claims from sources this user read) and the `vectorSearch` line that runs only inside that set.
3. Click **Graph** in the sidebar.
4. Click the **Known** button in the toolbar. Known claims start hidden, and they appear in grey.
5. Click a node. The right side shows the node's explanation and its connections.

The audience sees sources, claims, concepts, and projects across the whole account. The explanation comes from the active LLM profile, so it can take a moment.

### 4. Voice (20 seconds)

1. In the side panel, click the **Jot a thought…** field.
2. Dictate with Wispr Flow: "Decided to use batching for the router because per-call overhead was too high." This is the `voice-note` text. If Wispr Flow fails, type or paste the same text.
3. Press Enter, or click the arrow button.

The audience sees the note checked like any other save, with a new receipt. The earlier save moves to **This session**. The label in `demo.json` marks this note as new. The e2e check proved only that the note gets one or more claims. No check proved that it links to the batching concept, so do not promise that link. Wispr Flow was never tested on this build.

### 5. Learn next (25 seconds)

1. Click **Today's brief** in the dashboard sidebar.
2. Point at the headline, which counts today's saves, and at the new ideas under it.
3. Point at **Worth reading in full** in the right column.

The audience sees "ERC-4626 is a gap in Ribozome." with 2 saved but unread sources as links. The e2e check asserts this.

4. During this step, bring the user to the free limit. In a terminal that the audience does not see, run:

	```bash
	pnpm --filter web demo:fill
	```

	The script adds placeholder saves up to the plan's allowance. It prints a line that ends with "the next save is blocked". Do not run it before step 2, because then the first save is blocked. It works only when `demo` is on the Free plan with 0 credits, which is the state after `seed`.

	The placeholder saves have a `fill://` url. Library, Today's brief and the sidebar Recent list hide them, so you can open those pages after this command. They still count toward the quota.

### 6. Paywall (35 seconds)

1. Open `http://localhost:3000/demo/fresh-topic` in a new tab (the article "CRDTs for Local-First Apps").
2. Press Alt+S, or click **Save this page**.

The audience sees "Waiting for checkout…" and "Free limit reached. Finish checkout in the new tab. This page saves on its own when the plan changes." A new tab opens with the checkout.

3. Pay:
	- With the stand-in, click **Pay (test)**. The page then says "Paid. You can close this tab."
	- With real Dodo, switch **Pay in INR** to **USD** and set the billing country to **United States** (any address), then pay with the test card `4242 4242 4242 4242`, expiry `06/32`, CVV `123`. Dodo picks India from the venue's location, and with India billing it refuses the test card with `PAYMENT_METHOD_UNSUPPORTED`. The name and email fields are filled in from the app and cannot be edited. After payment, Dodo returns that tab to `/dashboard`,.
4. Look at the side panel.

The audience sees the blocked save complete without another click. The footer changes to `Pro · N of 500 saves`, and the receipt appears. The labels in `demo.json` mark all 8 sentences of this article as new.

5. Click **See what's new in dashboard** if you have time.

`pnpm ui-check` ran this full loop in the side panel with **Pay (test)** on this build. Real Dodo checkout was last verified by hand before the redesign, and it is not tested on this build.

### 7. Close (10 seconds)

Say the pitch from the PRD: it compares each save with what you already read and shows only the delta. TigerGraph does the comparison and the traversal in one query. Dodo changed the plan live through a signed webhook.

## If judges ask for more

Use these after the script, and reset afterward.

- **Ask.** Click **Ask** in the sidebar, type "What do I know about x402 batching?", and press Enter. The answer lists the claims that it used, each with its source. `pnpm ui-check:brain` ran this on this build with the `stub` profile.
- **Export.** Click **Library**. Under **Plan and usage**, click **Export to Obsidian**. On Pro, it downloads `atlas.zip`. On Free, it opens checkout. `pnpm ui-check:brain` ran both cases on this build.
- **Credit pack.** On the Free plan, click **Buy a credit pack** under **Plan and usage**. It opens the $3 checkout for 200 saves.
- **Delete.** On the **Library** page, **Plan and usage** has a **Delete my data** button. It asks for a second click, then removes the saves, claims, projects and plan record and signs you out. It does not delete the Clerk sign-in account. For the `demo` user, delete it with `curl -X DELETE -H 'x-user-id: demo' http://localhost:3000/api/me`, then run the seed.

## If something fails on stage

- If the panel stays on "Reading it for you…", the worker is not running. Start it with `pnpm --filter web worker`. The source is still pending and completes when the worker starts.
- If the paywall save is not blocked, `demo:fill` did not run, or `demo` has credits or is already Pro. Run `pnpm --filter web demo:fill` and save again, or play the backup video for this step.
- If the panel shows **Connect your account** again, the token was rejected, which happens when `EXTENSION_TOKEN_SECRET` changed or when `next dev` runs without it. Fix the secret and connect again.
- If the connect page says "Install the extension first", the page is not on `http://localhost:3000`, or the extension is not loaded.
- If the connect page says "Extension connections are not set up on this server", set `EXTENSION_TOKEN_SECRET` and restart `next dev`.
- If `/dashboard` redirects to sign-in, this Chrome profile lost the demo cookie, or `next dev` runs without `DEMO_MODE=1`. Open `http://localhost:3000/dashboard?user=demo` again.
- If the extension fails, click **Paste a page** in the dashboard, or paste into the Quick note field.
- If anything else fails, play the backup video.
