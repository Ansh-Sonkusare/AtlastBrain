import type { ClaimVerdict, SaveResult } from '../lib/api-types';

export const newClaim = (text: string): ClaimVerdict => ({ kind: 'new', text, claimId: `c-${text}` });

export const repeatClaim = (text: string, sourceTitle: string, sourceUrl: string): ClaimVerdict => ({
  kind: 'repeat',
  text,
  match: { claimId: `r-${text}`, claimText: text, distance: 0.05, sourceId: sourceUrl, sourceTitle, sourceUrl, concepts: [] },
});

export const result = (over: Partial<SaveResult> = {}): SaveResult => ({
  sourceId: 's1',
  status: 'done',
  title: 'Article',
  url: 'https://example.com/a',
  newRatio: 0.5,
  verdicts: [],
  tldr: null,
  ...over,
});

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
