import { describe, expect, it } from 'vitest';
import { buildForceData, NODE_COLORS, REPEAT_COLOR, REPEAT_LINK_COLOR } from '../entrypoints/sidepanel/graph/graph-model';
import type { Neighborhood } from '../lib/api-types';

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
  });

  it('greys repeat claims', () => {
    expect(node('c2').color).toBe(REPEAT_COLOR);
    expect(node('c2').repeat).toBe(true);
    expect(node('c1').repeat).toBe(false);
  });

  it('greys REPEATS links only', () => {
    const colors = Object.fromEntries(data.links.map((l) => [l.type, l.color]));
    expect(colors.REPEATS).toBe(REPEAT_LINK_COLOR);
    expect(colors.MAKES).not.toBe(REPEAT_LINK_COLOR);
  });

  it('always labels the source node only', () => {
    expect(data.nodes.filter((n) => n.alwaysLabel).map((n) => n.id)).toEqual(['s1']);
  });

  it('drops links to unknown nodes', () => {
    expect(data.links).toHaveLength(5);
  });
});
