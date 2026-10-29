/**
 * Brings a user to the edge of the free allowance for the paywall step of the demo:
 * after this runs, the user's next save is blocked and opens checkout.
 * Adds placeholder saves (no claims, so no view shows them). `pnpm --filter web seed` removes them.
 *
 *   pnpm --filter web demo:fill [--user demo]
 */
import { parseArgs } from 'node:util';
import { ALLOWANCE, monthStart } from '../src/server/billing/quota';
import { createTigerGraph } from '../src/server/graph/tigergraph';

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { user: { type: 'string', default: 'demo' } } });
  const userId = values.user!;
  const graph = createTigerGraph();
  const user = await graph.getUser(userId);
  if (!user) throw new Error(`No user ${userId}; run the seed first`);
  const now = new Date();
  const used = await graph.countSavesSince(userId, monthStart(now));
  const fill = Math.max(0, ALLOWANCE[user.plan] - used);
  for (let i = 0; i < fill; i++) {
    const id = `${userId}-fill-${now.getTime()}-${i}`;
    await graph.createSource({
      id, userId, url: `fill://${id}`, title: 'placeholder save', kind: 'web', status: 'done',
      savedAt: now.toISOString(), readAt: null, contentHash: id, body: '', newRatio: 0, tldr: null,
    });
  }
  console.log(`${userId}: plan ${user.plan}, ${used} saves this month, added ${fill}; the next save is blocked`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
