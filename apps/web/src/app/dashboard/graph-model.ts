import type { GraphExport, GraphLink, GraphNode, Neighborhood } from '../../server/types';

export const CONCEPT_FILL = '#4F4A43';

export const NODE_COLORS: Record<GraphNode['type'], string> = {
  Source: '#736D62',
  Claim: '#C9974E',
  Concept: CONCEPT_FILL,
  Project: '#EDE8DF',
};

export const REPEAT_COLOR = '#3F3A34';
export const REPEAT_LINK_COLOR = '#2F2C28';
export const NEW_LINK_COLOR = '#C9974E';
export const SOURCE_LINK_COLOR = '#22201D';
export const LINK_COLOR = '#2F2C28';
export const NEW_RING_COLOR = 'rgba(201, 151, 78, 0.12)';
export const PROJECT_HALO_COLOR = 'rgba(237, 232, 223, 0.14)';
export const SELECTED_COLOR = '#EDE8DF';
export const CONCEPT_LABEL = '#9E978B';
export const LABEL_COLOR = '#B8B1A5';

/**
 * Half the drawn width in on-screen pixels at the fitted view.
 * A concept grows with its claims, as in the design: 4 claims is 18px wide, 8 or more is 28px.
 */
export const nodeRadius = (n: { type: GraphNode['type']; repeat: boolean }, claims = 0): number =>
  n.type === 'Project'
    ? 16
    : n.type === 'Concept'
      ? Math.min(28, 18 + Math.max(0, claims - 4) * 2.5) / 2
      : n.type === 'Source'
        ? 6
        : n.repeat
          ? 3.5
          : 4;

/** Graph units per design pixel: exact at the fitted view, then proportional to zoom within limits. */
export const unitsPerPixel = (scale: number, fitScale: number): number =>
  Math.min(3, Math.max(0.5, scale / fitScale)) / scale;

const MAX_LABEL = 60;

/** Canvas labels only. The detail panel shows the full text. */
export const canvasLabel = (label: string): string =>
  label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1).trimEnd()}…` : label;

/** What the filter buttons switch: claims split into New and Known, the rest by type. */
export type NodeGroup = 'Project' | 'Concept' | 'Source' | 'New' | 'Known';

export const groupOf = (n: { type: GraphNode['type']; repeat: boolean }): NodeGroup =>
  n.type === 'Claim' ? (n.repeat ? 'Known' : 'New') : n.type;

export interface ForceNode {
  id: string;
  type: GraphNode['type'];
  label: string;
  color: string;
  repeat: boolean;
  radius: number;
  group: NodeGroup;
  alwaysLabel: boolean;
}

export interface ForceLink {
  source: string;
  target: string;
  type: string;
  color: string;
  width: number;
  dash: number[] | null;
}

export interface ForceData {
  nodes: ForceNode[];
  links: ForceLink[];
}

function styleLink(type: string, ends: (GraphNode | undefined)[]): Pick<ForceLink, 'color' | 'width' | 'dash'> {
  const claim = ends.find((n) => n?.type === 'Claim');
  if (type === 'REPEATS' || claim?.repeat) return { color: REPEAT_LINK_COLOR, width: 1, dash: [3, 4] };
  if (claim) return { color: NEW_LINK_COLOR, width: 1.6, dash: null };
  if (type === 'RELEVANT_TO') return { color: LINK_COLOR, width: 1.2, dash: null };
  if (ends.some((n) => n?.type === 'Source')) return { color: SOURCE_LINK_COLOR, width: 1, dash: null };
  return { color: LINK_COLOR, width: 1, dash: null };
}

export function buildForceData(hood: Neighborhood, sourceId: string): ForceData {
  const ids = new Set(hood.nodes.map((n) => n.id));
  const byId = new Map(hood.nodes.map((n) => [n.id, n]));
  const claims = new Map<string, number>();
  for (const l of hood.links) {
    if (l.type === 'ABOUT' && ids.has(l.source)) claims.set(l.target, (claims.get(l.target) ?? 0) + 1);
  }
  return {
    nodes: hood.nodes.map((n) => {
      const repeat = n.type === 'Claim' && n.repeat === true;
      return {
        id: n.id,
        type: n.type,
        label: n.label,
        repeat,
        radius: nodeRadius({ type: n.type, repeat }, claims.get(n.id)),
        group: groupOf({ type: n.type, repeat }),
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
        ...styleLink(l.type, [byId.get(l.source), byId.get(l.target)]),
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
    // A source can repeat one claim twice, and a node id must be unique.
    for (const claimId of new Set(s.repeated.map((r) => r.claimId))) {
      const r = s.repeated.find((x) => x.claimId === claimId)!;
      const id = `repeat:${s.id}:${claimId}`;
      nodes.push({ id, type: 'Claim', label: r.text, repeat: true });
      links.push({ source: s.id, target: id, type: 'MAKES' });
      links.push({ source: id, target: claimId, type: 'REPEATS' });
    }
  }
  return { nodes, links };
}

export const endId = (end: string | { id: string }) => (typeof end === 'string' ? end : end.id);

/**
 * Drop the node groups a viewer switched off and every link that touched one.
 * A hidden claim is bridged by a direct Source to Concept link, through what it repeats too,
 * and a node that loses all its links goes with them. Nodes keep their identity so the layout keeps its positions.
 */
export function filterForceData(data: ForceData, hidden: ReadonlySet<NodeGroup>): ForceData {
  const shown = data.nodes.filter((n) => !hidden.has(n.group));
  const ids = new Set(shown.map((n) => n.id));
  // Copies, because the force layout rewrites link ends into node objects in place.
  const links: ForceLink[] = data.links
    .filter((l) => ids.has(endId(l.source)) && ids.has(endId(l.target)))
    .map((l) => ({ ...l, source: endId(l.source), target: endId(l.target) }));

  const outOf = (type: string, from: string) =>
    data.links.filter((l) => l.type === type && endId(l.source) === from).map((l) => endId(l.target));
  const seen = new Set(links.map((l) => `${l.source}>${l.target}`));
  for (const l of data.links) {
    const [source, claim] = [endId(l.source), endId(l.target)];
    if (l.type !== 'MAKES' || !ids.has(source) || ids.has(claim)) continue;
    for (const via of [claim, ...outOf('REPEATS', claim)]) {
      for (const target of outOf('ABOUT', via)) {
        const key = `${source}>${target}`;
        if (!ids.has(target) || seen.has(key)) continue;
        seen.add(key);
        links.push({ source, target, type: 'VIA_CLAIM', color: SOURCE_LINK_COLOR, width: 1, dash: null });
      }
    }
  }

  const linkedBefore = new Set(data.links.flatMap((l) => [endId(l.source), endId(l.target)]));
  const linkedNow = new Set(links.flatMap((l) => [l.source, l.target]));
  return { nodes: shown.filter((n) => linkedNow.has(n.id) || !linkedBefore.has(n.id)), links };
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

type Placed = ForceNode & { x?: number; y?: number; vx?: number; vy?: number };

const LINK_DISTANCE: Record<string, number> = { RELEVANT_TO: 170, VIA_CLAIM: 110, ABOUT: 70, MAKES: 50, REPEATS: 60 };

/** Layout length of a link in graph units: the design's rings, project to concept to source. */
export const linkDistance = (l: { type: string }): number => LINK_DISTANCE[l.type] ?? 60;

/** How far a node and its always-on label reach from its centre, at the fitted view's pixels. */
export function layoutBox(n: ForceNode): { left: number; right: number; top: number; bottom: number } {
  const r = n.radius;
  const text = canvasLabel(n.label).length;
  if (n.type === 'Concept') {
    const half = Math.max(r, 9);
    return { left: r, right: r + 10 + text * 6.5, top: half, bottom: half };
  }
  if (n.type === 'Project') {
    const side = Math.max(r + 10, (text * 7.5) / 2);
    return { left: side, right: side, top: r + 10, bottom: r + 10 + 18 };
  }
  return { left: r + 4, right: r + 4, top: r + 4, bottom: r + 4 };
}

/** A d3 force that pushes overlapping layout boxes apart along their shallower axis, labels included. */
export function boxCollide(margin = 8) {
  let nodes: Placed[] = [];
  // ponytail: O(n^2) per tick, fine into the low thousands of nodes; use a quadtree if whole graphs outgrow that.
  const force = () => {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const [a, b] = [nodes[i]!, nodes[j]!];
        const [p, q] = [layoutBox(a), layoutBox(b)];
        const [ax, ay, bx, by] = [a.x ?? 0, a.y ?? 0, b.x ?? 0, b.y ?? 0];
        const dx = bx + (q.right - q.left) / 2 - (ax + (p.right - p.left) / 2);
        const dy = by + (q.bottom - q.top) / 2 - (ay + (p.bottom - p.top) / 2);
        const ox = (p.left + p.right + q.left + q.right) / 2 + margin - Math.abs(dx);
        const oy = (p.top + p.bottom + q.top + q.bottom) / 2 + margin - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        const push = (Math.min(ox, oy) / 2) * 0.5;
        const [px, py] = ox < oy ? [dx < 0 ? -push : push, 0] : [0, dy < 0 ? -push : push];
        a.vx = (a.vx ?? 0) - px;
        a.vy = (a.vy ?? 0) - py;
        b.vx = (b.vx ?? 0) + px;
        b.vy = (b.vy ?? 0) + py;
      }
    }
  };
  force.initialize = (n: object[]) => {
    nodes = n as Placed[];
  };
  return force;
}

/** A d3 force that pulls every node toward the middle, so unlinked nodes and separate clusters stay close. */
export function gravity(strength = 0.1) {
  let nodes: Placed[] = [];
  const force = (alpha: number) => {
    for (const n of nodes) {
      n.vx = (n.vx ?? 0) - (n.x ?? 0) * strength * alpha;
      n.vy = (n.vy ?? 0) - (n.y ?? 0) * strength * alpha;
    }
  };
  force.initialize = (n: object[]) => {
    nodes = n as Placed[];
  };
  return force;
}

/** Centre and zoom that frame every node and its label. Small graphs stop at `maxScale` instead of filling the canvas. */
export function fitView(nodes: Placed[], width: number, height: number, padding: number, maxScale = 1.5) {
  const placed = nodes.filter((n) => n.x !== undefined && n.y !== undefined);
  if (placed.length === 0) return null;
  const boxes = placed.map((n) => ({ n, b: layoutBox(n) }));
  const x0 = Math.min(...boxes.map(({ n, b }) => n.x! - b.left));
  const x1 = Math.max(...boxes.map(({ n, b }) => n.x! + b.right));
  const y0 = Math.min(...boxes.map(({ n, b }) => n.y! - b.top));
  const y1 = Math.max(...boxes.map(({ n, b }) => n.y! + b.bottom));
  const k = Math.min(maxScale, (width - padding * 2) / (x1 - x0), (height - padding * 2) / (y1 - y0));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, k: Math.max(0.05, k) };
}
