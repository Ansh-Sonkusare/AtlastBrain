import type { GraphExport, GraphLink, GraphNode, Neighborhood } from '../../server/types';

export const NODE_COLORS: Record<GraphNode['type'], string> = {
  Source: '#5c5c5c',
  Claim: '#4ade80',
  Concept: '#8f8f8f',
  Project: '#ededed',
};

export const REPEAT_COLOR = '#3a3a3a';
export const REPEAT_LINK_COLOR = '#262626';
export const LINK_COLOR = '#3f3f3f';

export interface ForceNode {
  id: string;
  type: GraphNode['type'];
  label: string;
  color: string;
  repeat: boolean;
  alwaysLabel: boolean;
}

export interface ForceLink {
  source: string;
  target: string;
  type: string;
  color: string;
}

export interface ForceData {
  nodes: ForceNode[];
  links: ForceLink[];
}

export interface LegendEntry {
  label: string;
  color: string;
}

export const LEGEND: LegendEntry[] = [
  ...(Object.keys(NODE_COLORS) as GraphNode['type'][]).map((t) => ({ label: t, color: NODE_COLORS[t] })),
  { label: 'Repeat', color: REPEAT_COLOR },
];

export function buildForceData(hood: Neighborhood, sourceId: string): ForceData {
  const ids = new Set(hood.nodes.map((n) => n.id));
  return {
    nodes: hood.nodes.map((n) => {
      const repeat = n.type === 'Claim' && n.repeat === true;
      return {
        id: n.id,
        type: n.type,
        label: n.label,
        repeat,
        color: repeat ? REPEAT_COLOR : NODE_COLORS[n.type],
        alwaysLabel: n.id === sourceId,
      };
    }),
    links: hood.links
      .filter((l) => ids.has(l.source) && ids.has(l.target))
      .map((l) => ({
        source: l.source,
        target: l.target,
        type: l.type,
        color: l.type === 'REPEATS' ? REPEAT_LINK_COLOR : LINK_COLOR,
      })),
  };
}

/** One graph of everything a user owns, from the export the Obsidian vault is built from. */
export function buildWholeGraph(exp: GraphExport): Neighborhood {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const projectId = new Map(exp.projects.map((p) => [p.name, `project:${p.id}`]));
  const conceptId = new Map(exp.concepts.map((c) => [c.name, `concept:${c.id}`]));
  for (const p of exp.projects) nodes.push({ id: `project:${p.id}`, type: 'Project', label: p.name });
  for (const c of exp.concepts) {
    nodes.push({ id: `concept:${c.id}`, type: 'Concept', label: c.name });
    for (const name of c.projects) {
      const target = projectId.get(name);
      if (target) links.push({ source: `concept:${c.id}`, target, type: 'RELEVANT_TO' });
    }
  }
  for (const s of exp.sources) {
    nodes.push({ id: s.id, type: 'Source', label: s.title });
    for (const claim of s.made) {
      nodes.push({ id: claim.id, type: 'Claim', label: claim.text });
      links.push({ source: s.id, target: claim.id, type: 'MAKES' });
      for (const name of claim.concepts) {
        const target = conceptId.get(name);
        if (target) links.push({ source: claim.id, target, type: 'ABOUT' });
      }
    }
  }
  return { nodes, links };
}

const endId = (end: string | { id: string }) => (typeof end === 'string' ? end : end.id);

/** Drop the node types a viewer switched off, and every link that touched one. */
export function filterForceData(data: ForceData, hidden: ReadonlySet<GraphNode['type']>): ForceData {
  // Copies, because the force layout rewrites link ends into node objects in place.
  const nodes = data.nodes.filter((n) => !hidden.has(n.type)).map((n) => ({ ...n }));
  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, links: data.links.filter((l) => ids.has(endId(l.source)) && ids.has(endId(l.target))).map((l) => ({ ...l, source: endId(l.source), target: endId(l.target) })) };
}

/** Nodes one link away from `id`, in either direction. */
export function neighborsOf(data: ForceData, id: string): ForceNode[] {
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const out = new Map<string, ForceNode>();
  for (const l of data.links) {
    const [a, b] = [endId(l.source), endId(l.target)];
    const other = a === id ? b : b === id ? a : null;
    const node = other === null ? undefined : byId.get(other);
    if (node) out.set(node.id, node);
  }
  return [...out.values()];
}
