import type { GraphPort } from './graph/port';
import { selectGraph } from './pipeline/select-graph';

let graph: Promise<GraphPort> | undefined;

/** One graph per process, created on first use. */
export function getGraph(): Promise<GraphPort> {
  graph ??= selectGraph();
  return graph;
}
