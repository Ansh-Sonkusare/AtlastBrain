import type { ClaimMatch, SaveResult, Tldr } from './api-types';

export const NOTHING_NEW_BELOW = 0.2;

export interface RepeatClaim {
  text: string;
  sourceTitle: string;
  sourceUrl: string;
}

export interface SourceLink {
  title: string;
  url: string;
}

export interface NewToMeView {
  title: string;
  url: string;
  nothingNew: boolean;
  newClaims: string[];
  repeats: RepeatClaim[];
  /** Repeats collapsed under "hidden as not new". Empty unless nothingNew. */
  hiddenRepeats: RepeatClaim[];
  /** Distinct earlier sources, in first-seen order. */
  readBefore: SourceLink[];
  tldr: Tldr | null;
  partial: boolean;
}

function toRepeat(text: string, match: ClaimMatch): RepeatClaim {
  return { text, sourceTitle: match.sourceTitle, sourceUrl: match.sourceUrl };
}

export function buildNewToMeView(result: SaveResult): NewToMeView {
  const newClaims: string[] = [];
  const repeats: RepeatClaim[] = [];
  for (const v of result.verdicts) {
    if (v.kind === 'new') newClaims.push(v.text);
    else repeats.push(toRepeat(v.text, v.match));
  }

  const readBefore: SourceLink[] = [];
  const seen = new Set<string>();
  for (const r of repeats) {
    if (seen.has(r.sourceUrl)) continue;
    seen.add(r.sourceUrl);
    readBefore.push({ title: r.sourceTitle, url: r.sourceUrl });
  }

  const nothingNew = result.newRatio < NOTHING_NEW_BELOW;
  return {
    title: result.title,
    url: result.url,
    nothingNew,
    newClaims: nothingNew ? [] : newClaims,
    repeats: nothingNew ? [] : repeats,
    hiddenRepeats: nothingNew ? repeats : [],
    readBefore,
    tldr: nothingNew ? null : result.tldr,
    partial: result.status === 'partial',
  };
}
