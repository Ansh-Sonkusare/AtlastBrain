import type { GraphPort } from '../graph/port';
import { createMemoryGraph } from '../graph/memory';

/**
 * The pipeline never imports TigerGraph statically. The specifier is a variable so the
 * module is only loaded when `GRAPH=tigergraph`, and typecheck passes before it exists.
 */
const TIGERGRAPH_MODULE = '../graph/tigergraph';

export async function selectGraph(kind: string = process.env.GRAPH ?? 'memory'): Promise<GraphPort> {
  if (kind === 'memory') return createMemoryGraph();
  if (kind === 'tigergraph') {
    const mod = (await import(TIGERGRAPH_MODULE)) as { createTigerGraph: () => GraphPort };
    return mod.createTigerGraph();
  }
  throw new Error(`Unknown GRAPH: ${kind} (expected memory or tigergraph)`);
}
