import type { GraphNode, Neighborhood } from '../../server/types';

export const NODE_COLORS: Record<GraphNode['type'], string> = {
  Source: '#2f5bea',
  Claim: '#12a57a',
  Concept: '#d99a00',
  Project: '#8e3fc4',
};

export const REPEAT_COLOR = '#a8a8b2';
export const REPEAT_LINK_COLOR = '#c4c4cc';
export const LINK_COLOR = '#8a8a94';

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
