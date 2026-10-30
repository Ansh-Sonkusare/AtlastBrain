import { describe, expect, it } from 'vitest';
import { Body } from './route';

const node = { type: 'Concept', label: 'Vector Search' };

describe('explain body', () => {
  it('accepts a node with up to 30 neighbors', () => {
    expect(Body.safeParse({ node, neighbors: Array(30).fill(node) }).success).toBe(true);
  });
  it('rejects a bad type, a long label, too many neighbors, or no body', () => {
    expect(Body.safeParse({ node: { ...node, type: 'Bogus' }, neighbors: [] }).success).toBe(false);
    expect(Body.safeParse({ node: { ...node, label: 'x'.repeat(301) }, neighbors: [] }).success).toBe(false);
    expect(Body.safeParse({ node, neighbors: Array(31).fill(node) }).success).toBe(false);
    expect(Body.safeParse(null).success).toBe(false);
  });
});
