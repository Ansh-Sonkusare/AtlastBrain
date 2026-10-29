import { describe, expect, it } from 'vitest';
import { cosineDistance, embed } from './embed';

describe('embed', () => {
  it('returns normalised 384-dim vectors and ranks a paraphrase closer than an unrelated pair', async () => {
    const [a, b, c] = await embed([
      'The cat sat on the warm windowsill.',
      'A kitten was resting on the sunny window ledge.',
      'Quarterly tax filings are due next month.',
    ]);
    for (const v of [a!, b!, c!]) {
      expect(v).toHaveLength(384);
      expect(Math.hypot(...v)).toBeCloseTo(1, 4);
    }
    expect(cosineDistance(a!, a!)).toBeCloseTo(0, 5);
    expect(cosineDistance(a!, b!)).toBeLessThan(cosineDistance(a!, c!));
  });

  it('returns nothing for no input', async () => {
    expect(await embed([])).toEqual([]);
  });
});
