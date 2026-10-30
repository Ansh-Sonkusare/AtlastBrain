import { describe, expect, it } from 'vitest';
import { buildForceData, buildWholeGraph, filterForceData, neighborsOf, NODE_COLORS, REPEAT_COLOR, REPEAT_LINK_COLOR } from './graph-model';
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

  it('hides a node type with its links, and lists neighbors both ways', () => {
    const noClaims = filterForceData(data, new Set(['Claim']));
    expect(noClaims.nodes.map((n) => n.type)).not.toContain('Claim');
    expect(noClaims.links.map((l) => l.type)).toEqual(['RELEVANT_TO']);
    expect(neighborsOf(data, 'concept:k').map((n) => n.id).sort()).toEqual(['c', 'project:p']);
  });
});
