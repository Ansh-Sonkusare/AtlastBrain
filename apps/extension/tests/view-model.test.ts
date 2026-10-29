import { describe, expect, it } from 'vitest';
import { buildReceipt, dashboardUrl } from '../lib/view-model';
import { newClaim, repeatClaim, result } from './helpers';

describe('buildReceipt', () => {
  it('counts new and repeated claims and rounds the ratio', () => {
    const r = buildReceipt(
      result({
        newRatio: 0.666,
        verdicts: [newClaim('A'), repeatClaim('B', 'Old', 'https://old'), newClaim('C')],
      }),
    );
    expect(r).toMatchObject({ title: 'Article', newCount: 2, repeatCount: 1, percentNew: 67, nothingNew: false, partial: false });
  });

  it('flags nothing new under 20%, but not at exactly 20%', () => {
    expect(buildReceipt(result({ newRatio: 0.19 })).nothingNew).toBe(true);
    expect(buildReceipt(result({ newRatio: 0.2 })).nothingNew).toBe(false);
  });

  it('falls back to the url for an untitled page and flags a partial result', () => {
    const r = buildReceipt(result({ title: '', status: 'partial' }));
    expect(r.title).toBe('https://example.com/a');
    expect(r.partial).toBe(true);
  });
});

describe('dashboardUrl', () => {
  it('links the library and one source, carrying the user', () => {
    expect(dashboardUrl('http://x/', 'u 1')).toBe('http://x/dashboard?user=u%201');
    expect(dashboardUrl('http://x', 'u1', 's/1')).toBe('http://x/dashboard/source/s%2F1?user=u1');
  });
});
