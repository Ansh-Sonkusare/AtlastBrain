import { describe, expect, it } from 'vitest';
import { buildNewToMeView } from '../lib/view-model';
import { newClaim, repeatClaim, result } from './helpers';

const tldr = { bullets: ['point'], whyItMatters: 'because', projectId: null };

describe('buildNewToMeView', () => {
  it('splits new claims from repeats and keeps the TL;DR', () => {
    const view = buildNewToMeView(
      result({
        newRatio: 0.5,
        tldr,
        verdicts: [newClaim('A'), repeatClaim('B', 'Old post', 'https://old/1'), newClaim('C')],
      }),
    );
    expect(view.nothingNew).toBe(false);
    expect(view.newClaims).toEqual(['A', 'C']);
    expect(view.repeats).toEqual([{ text: 'B', sourceTitle: 'Old post', sourceUrl: 'https://old/1' }]);
    expect(view.hiddenRepeats).toEqual([]);
    expect(view.tldr).toEqual(tldr);
  });

  it('lists each earlier source once, in first-seen order', () => {
    const view = buildNewToMeView(
      result({
        verdicts: [
          repeatClaim('A', 'One', 'https://one'),
          repeatClaim('B', 'Two', 'https://two'),
          repeatClaim('C', 'One', 'https://one'),
        ],
      }),
    );
    expect(view.readBefore).toEqual([
      { title: 'One', url: 'https://one' },
      { title: 'Two', url: 'https://two' },
    ]);
  });

  it('shows nothing new under 20% and hides the repeats in a collapsed list', () => {
    const view = buildNewToMeView(
      result({
        newRatio: 0.19,
        tldr,
        verdicts: [newClaim('A'), repeatClaim('B', 'Old', 'https://old')],
      }),
    );
    expect(view.nothingNew).toBe(true);
    expect(view.newClaims).toEqual([]);
    expect(view.repeats).toEqual([]);
    expect(view.tldr).toBeNull();
    expect(view.hiddenRepeats.map((r) => r.text)).toEqual(['B']);
    expect(view.readBefore).toEqual([{ title: 'Old', url: 'https://old' }]);
  });

  it('treats exactly 20% as having new material', () => {
    expect(buildNewToMeView(result({ newRatio: 0.2 })).nothingNew).toBe(false);
  });

  it('flags a partial result', () => {
    expect(buildNewToMeView(result({ status: 'partial' })).partial).toBe(true);
  });
});
