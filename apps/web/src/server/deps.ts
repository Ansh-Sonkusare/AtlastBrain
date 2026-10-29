import { createLlm } from './llm';
import { quotaFor } from './billing/quota';
import { createDeps, type PipelineDeps } from './pipeline/deps';
import { selectGraph } from './pipeline/select-graph';
import type { GraphPort } from './graph/port';

let deps: Promise<PipelineDeps> | undefined;

/** The one deps object for this process (routes and worker), built on first use. */
export function getDeps(): Promise<PipelineDeps> {
  deps ??= (async () => {
    const graph = await selectGraph(process.env.GRAPH ?? 'tigergraph');
    return createDeps({ graph, llm: createLlm(), quota: quotaFor(graph) });
  })();
  deps.catch(() => {
    deps = undefined;
  });
  return deps;
}

export async function getGraph(): Promise<GraphPort> {
  return (await getDeps()).graph;
}
