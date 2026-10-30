import { describe, expect, it } from 'vitest';
import {
  boxCollide,
  buildForceData,
  buildWholeGraph,
  canvasLabel,
  CONCEPT_FILL,
  filterForceData,
  fitView,
  layoutBox,
  LINK_COLOR,
  neighborsOf,
  NEW_LINK_COLOR,
  NODE_COLORS,
  REPEAT_COLOR,
  REPEAT_LINK_COLOR,
  unitsPerPixel,
} from './graph-model';
import type { Neighborhood } from '../../server/types';

const hood: Neighborhood = {
  nodes: [
    { id: 's1', type: 'Source', label: 'Article' },
    { id: 'c1', type: 'Claim', label: 'new claim' },
    { id: 'c2', type: 'Claim', label: 'old claim', repeat: true },
    { id: 'k1', type: 'Concept', label: 'Graphs' },
    { id: 'p1', type: 'Project', label: 'Demo' },
  ],
  links: [
    { source: 's1', target: 'c1', type: 'MAKES' },
    { source: 's1', target: 'c2', type: 'MAKES' },
    { source: 'c2', target: 'c1', type: 'REPEATS' },
    { source: 'c1', target: 'k1', type: 'ABOUT' },
    { source: 'k1', target: 'p1', type: 'RELEVANT_TO' },
    { source: 'k1', target: 'missing', type: 'ABOUT' },
  ],
};

describe('buildForceData', () => {
  const data = buildForceData(hood, 's1');
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const node = (id: string) => {
    const n = byId.get(id);
    if (!n) throw new Error(`missing ${id}`);
    return n;
  };

  it('colours nodes by type', () => {
    expect(node('s1').color).toBe(NODE_COLORS.Source);
    expect(node('c1').color).toBe(NODE_COLORS.Claim);
    expect(node('k1').color).toBe(NODE_COLORS.Concept);
    expect(node('p1').color).toBe(NODE_COLORS.Project);
    expect(NODE_COLORS.Concept).toBe(CONCEPT_FILL);
  });

  it('greys repeat claims', () => {
    expect(node('c2').color).toBe(REPEAT_COLOR);
    expect(node('c2').repeat).toBe(true);
    expect(node('c1').repeat).toBe(false);
  });

  it('groups claims as New or Known', () => {
    expect(node('c1').group).toBe('New');
    expect(node('c2').group).toBe('Known');
    expect(node('s1').group).toBe('Source');
  });

  it('styles links by what they touch', () => {
    const link = (s: string, t: string) => {
      const l = data.links.find((x) => x.source === s && x.target === t);
      if (!l) throw new Error(`missing ${s}>${t}`);
      return l;
    };
    expect(link('s1', 'c1')).toMatchObject({ color: NEW_LINK_COLOR, width: 1.6, dash: null });
    expect(link('s1', 'c2')).toMatchObject({ color: REPEAT_LINK_COLOR, dash: [3, 4] });
    expect(link('c2', 'c1')).toMatchObject({ color: REPEAT_LINK_COLOR, dash: [3, 4] });
    expect(link('k1', 'p1')).toMatchObject({ color: LINK_COLOR, width: 1.2, dash: null });
  });

  it('always labels the source node only', () => {
    expect(data.nodes.filter((n) => n.alwaysLabel).map((n) => n.id)).toEqual(['s1']);
  });

  it('drops links to unknown nodes', () => {
    expect(data.links).toHaveLength(5);
  });
});

describe('whole graph', () => {
  const exp = {
    projects: [{ id: 'p', name: 'Demo', description: '' }],
    concepts: [{ id: 'k', name: 'Graphs', summary: '', projects: ['Demo', 'Gone'] }],
    sources: [
      { id: 's', title: 'Article', url: '', savedAt: '', readAt: null, tldr: null, made: [{ id: 'c', text: 'claim', concepts: ['Graphs', 'Nope'] }], repeated: [], highlights: [] },
    ],
  };
  const hood = buildWholeGraph(exp);
  const data = buildForceData(hood, '');

  it('links sources to claims, claims to concepts, concepts to projects, skipping unknown names', () => {
    expect(hood.links.map((l) => `${l.source}>${l.target}:${l.type}`).sort()).toEqual([
      'c>concept:k:ABOUT',
      'concept:k>project:p:RELEVANT_TO',
      's>c:MAKES',
    ]);
  });

  it('hides a node group with its links, and lists neighbors both ways', () => {
    const noClaims = filterForceData(data, new Set(['New']));
    expect(noClaims.nodes.map((n) => n.type)).not.toContain('Claim');
    expect(noClaims.links.map((l) => l.type).sort()).toEqual(['RELEVANT_TO', 'VIA_CLAIM']);
    expect(neighborsOf(data, 'concept:k').map((n) => n.id).sort()).toEqual(['c', 'project:p']);
  });

  it('adds a known claim for each repeated entry, once', () => {
    const repeated = { claimId: 'c', text: 'said again', claimText: 'claim', sourceId: 's', sourceTitle: 'Article' };
    const second = { id: 's2', title: 'Later', url: '', savedAt: '', readAt: null, tldr: null, made: [], repeated: [repeated, repeated], highlights: [] };
    const whole = buildForceData(buildWholeGraph({ ...exp, sources: [...exp.sources, second] }), '');
    const known = whole.nodes.filter((n) => n.group === 'Known');
    expect(known).toMatchObject([{ id: 'repeat:s2:c', type: 'Claim', label: 'said again', repeat: true, color: REPEAT_COLOR }]);
    expect(whole.links.filter((l) => l.source === 'repeat:s2:c' || l.target === 'repeat:s2:c').map((l) => `${l.source}>${l.target}:${l.type}`).sort()).toEqual([
      'repeat:s2:c>c:REPEATS',
      's2>repeat:s2:c:MAKES',
    ]);

    // Hiding Known keeps the source, bridged through the claim it repeats.
    const noKnown = filterForceData(whole, new Set(['Known']));
    expect(noKnown.nodes.map((n) => n.id)).toContain('s2');
    expect(noKnown.links).toContainEqual(expect.objectContaining({ source: 's2', target: 'concept:k', type: 'VIA_CLAIM' }));
  });
});

describe('filterForceData', () => {
  const data = buildForceData(
    {
      nodes: [
        { id: 's', type: 'Source', label: 'S' },
        { id: 'a', type: 'Claim', label: 'A' },
        { id: 'b', type: 'Claim', label: 'B' },
        { id: 'k', type: 'Concept', label: 'K' },
        { id: 'p', type: 'Project', label: 'P' },
        { id: 'alone', type: 'Project', label: 'Alone' },
      ],
      links: [
        { source: 's', target: 'a', type: 'MAKES' },
        { source: 's', target: 'b', type: 'MAKES' },
        { source: 'a', target: 'k', type: 'ABOUT' },
        { source: 'b', target: 'k', type: 'ABOUT' },
        { source: 'k', target: 'p', type: 'RELEVANT_TO' },
      ],
    },
    '',
  );

  it('keeps node objects, so positions survive a toggle, and copies links', () => {
    const out = filterForceData(data, new Set());
    expect(out.nodes[0]).toBe(data.nodes[0]);
    expect(out.links[0]).not.toBe(data.links[0]);
  });

  it('bridges hidden claims with one Source to Concept link', () => {
    const out = filterForceData(data, new Set(['New']));
    expect(out.links.filter((l) => l.type === 'VIA_CLAIM').map((l) => `${l.source}>${l.target}`)).toEqual(['s>k']);
  });

  it('drops what filtering stranded, but not what was never linked', () => {
    const out = filterForceData(data, new Set(['Concept']));
    expect(out.nodes.map((n) => n.id).sort()).toEqual(['a', 'alone', 'b', 's']);
  });
});

describe('canvas sizing', () => {
  const concept = (claims: number) =>
    buildForceData(
      {
        nodes: [{ id: 'k', type: 'Concept', label: 'K' }, ...Array.from({ length: claims }, (_, i) => ({ id: `c${i}`, type: 'Claim' as const, label: 'c' }))],
        links: Array.from({ length: claims }, (_, i) => ({ source: `c${i}`, target: 'k', type: 'ABOUT' })),
      },
      '',
    ).nodes[0]!.radius * 2;

  it('sizes concepts by claim count within the design range', () => {
    expect([concept(1), concept(4), concept(6), concept(8), concept(20)]).toEqual([18, 18, 23, 28, 28]);
  });

  it('is exact on screen at the fitted view and proportional, within limits, around it', () => {
    const onScreen = (scale: number, fit: number) => unitsPerPixel(scale, fit) * scale;
    expect(onScreen(0.6, 0.6)).toBe(1);
    expect(onScreen(1.2, 0.6)).toBe(2);
    expect(onScreen(100, 0.6)).toBe(3);
    expect(onScreen(0.01, 0.6)).toBe(0.5);
  });

  it('truncates long labels only', () => {
    expect(canvasLabel('short')).toBe('short');
    expect(canvasLabel('x'.repeat(200))).toHaveLength(60);
  });

  it('pushes overlapping boxes apart and leaves clear ones alone', () => {
    const [a, b] = buildForceData({ nodes: [{ id: 'a', type: 'Source', label: 'a' }, { id: 'b', type: 'Source', label: 'b' }], links: [] }, '').nodes;
    const near = [{ ...a!, x: 0, y: 0, vx: 0, vy: 0 }, { ...b!, x: 4, y: 0, vx: 0, vy: 0 }];
    const force = boxCollide();
    force.initialize(near);
    force();
    expect(near[0]!.vx).toBeLessThan(0);
    expect(near[1]!.vx).toBeGreaterThan(0);
    const far = [{ ...a!, x: 0, y: 0, vx: 0, vy: 0 }, { ...b!, x: 500, y: 0, vx: 0, vy: 0 }];
    force.initialize(far);
    force();
    expect(far[0]!.vx).toBe(0);
  });

  it('fits labels in view and caps the zoom on small graphs', () => {
    const [node] = buildForceData({ nodes: [{ id: 'k', type: 'Concept', label: 'A long concept name' }], links: [] }, '').nodes;
    const box = layoutBox(node!);
    const view = fitView([{ ...node!, x: 0, y: 0 }], 800, 600, 40)!;
    expect(view.k).toBe(1.5);
    expect(view.x).toBe((box.right - box.left) / 2);
    expect(fitView([node!], 800, 600, 40)).toBeNull();
  });
});
