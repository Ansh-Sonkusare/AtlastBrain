import { createLlm } from './llm';
import { createDeps, type PipelineDeps } from './pipeline/deps';
import { processSource } from './pipeline/process';
import { selectGraph } from './pipeline/select-graph';

const POLL_MS = 1000;

/** Processes every pending source once, one at a time. Returns how many it handled. */
export async function drainPending(deps: PipelineDeps): Promise<number> {
  const pending = await deps.graph.listPendingSources(10);
  for (const source of pending) {
    await processSource(deps, source.userId, source.id, { markRead: true });
  }
  return pending.length;
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
  const graph = await selectGraph(process.env.GRAPH ?? 'tigergraph');
  const deps = createDeps({ graph, llm: createLlm() });
  const abort = new AbortController();
  for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => abort.abort());
  console.log(`worker started (GRAPH=${process.env.GRAPH ?? 'tigergraph'}, LLM_PROFILE=${process.env.LLM_PROFILE ?? 'stub'})`);
  await runWorker(deps, abort.signal);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
