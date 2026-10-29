import { getDeps } from './deps';
import type { PipelineDeps } from './pipeline/deps';
import { processSource } from './pipeline/process';

const POLL_MS = 1000;

/** Processes every pending source once, one at a time. Returns how many it handled. */
export async function drainPending(deps: PipelineDeps): Promise<number> {
  const pending = await deps.graph.listPendingSources(10);
  for (const source of pending) {
    try {
      await processSource(deps, source.userId, source.id, { markRead: true });
    } catch (err) {
      console.error(`worker: source ${source.id} failed:`, err);
    }
  }
  return pending.length;
}

/** A source left `processing` by a worker that died mid-step goes back to `pending`. There is one worker. */
export async function requeueStuck(deps: PipelineDeps): Promise<number> {
  const stuck = await deps.graph.listProcessingSources();
  for (const s of stuck) await deps.graph.updateSource(s.id, { status: 'pending' });
  return stuck.length;
}

export async function runWorker(
  deps: PipelineDeps,
  signal?: AbortSignal,
  pollMs = POLL_MS,
): Promise<void> {
  while (!signal?.aborted) {
    try {
      if ((await drainPending(deps)) > 0) continue;
    } catch (err) {
      console.error('worker poll failed:', err);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

async function main(): Promise<void> {
  const deps = await getDeps();
  const abort = new AbortController();
  for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => abort.abort());
  console.log(`worker started (GRAPH=${process.env.GRAPH ?? 'tigergraph'}, LLM_PROFILE=${process.env.LLM_PROFILE ?? 'stub'})`);
  const requeued = await requeueStuck(deps);
  if (requeued) console.log(`worker: re-queued ${requeued} source(s) left in processing`);
  await runWorker(deps, abort.signal);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
