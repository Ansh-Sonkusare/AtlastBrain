import { ALLOWANCE } from '../../server/billing/quota';
import type { SourceRecord } from '../../server/graph/port';
import type { SourceResponse } from '../../server/pipeline/result';
import type { BrainAnswer, Plan, SourceStatus, Tldr, User } from '../../server/types';

export const DEFAULT_USER = 'demo';
export const SOURCE_STATUSES: SourceStatus[] = ['pending', 'processing', 'done', 'partial', 'blocked'];

/** `?user=` as Next hands it over: absent, empty, or repeated all fall back sensibly. */
export function resolveUser(param: string | string[] | undefined): string {
  const value = Array.isArray(param) ? param[0] : param;
  return value?.trim() || DEFAULT_USER;
}

export function dashboardHref(user: string, path = ''): string {
  return `/dashboard${path}?user=${encodeURIComponent(user)}`;
}

export const sourceHref = (user: string, sourceId: string) => dashboardHref(user, `/source/${encodeURIComponent(sourceId)}`);

/** A source's ratio only means something once the pipeline has checked it. */
export const isChecked = (status: SourceStatus) => status === 'done' || status === 'partial';

export interface LibraryItem {
  id: string;
  title: string;
  url: string;
  status: SourceStatus;
  savedAt: string;
  readAt: string | null;
  read: boolean;
  /** Null until the source has been checked. */
  newRatio: number | null;
  percentNew: number | null;
}

export function toLibraryItem(s: SourceRecord): LibraryItem {
  const newRatio = isChecked(s.status) ? s.newRatio : null;
  return {
    id: s.id,
    title: s.title || s.url,
    url: s.url,
    status: s.status,
    savedAt: s.savedAt,
    readAt: s.readAt,
    read: s.readAt !== null,
    newRatio,
    percentNew: newRatio === null ? null : Math.round(newRatio * 100),
  };
}

/** One list from the per-status lists the graph returns, newest save first. */
export function mergeLibrary(lists: SourceRecord[][]): LibraryItem[] {
  return lists
    .flat()
    .map(toLibraryItem)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export interface SourceDetail {
  id: string;
  title: string;
  url: string;
  status: SourceStatus;
  newCount: number;
  repeatCount: number;
  percentNew: number | null;
  newClaims: { id: string; text: string }[];
  repeats: { text: string; originalText: string; sourceId: string; sourceTitle: string; sourceUrl: string }[];
  tldr: Tldr | null;
  highlights: string[];
}

export function buildSourceDetail(res: SourceResponse): SourceDetail {
  const newClaims: SourceDetail['newClaims'] = [];
  const repeats: SourceDetail['repeats'] = [];
  for (const v of res.verdicts) {
    if (v.kind === 'new') newClaims.push({ id: v.claimId, text: v.text });
    else
      repeats.push({
        text: v.text,
        originalText: v.match.claimText,
        sourceId: v.match.sourceId,
        sourceTitle: v.match.sourceTitle,
        sourceUrl: v.match.sourceUrl,
      });
  }
  return {
    id: res.sourceId,
    title: res.title || res.url,
    url: res.url,
    status: res.status,
    newCount: newClaims.length,
    repeatCount: repeats.length,
    percentNew: isChecked(res.status) ? Math.round(res.newRatio * 100) : null,
    newClaims,
    repeats,
    tldr: res.tldr,
    highlights: res.highlights,
  };
}

export interface Usage {
  plan: Plan;
  used: number;
  limit: number;
  credits: number;
  /** Share of the monthly allowance spent, capped at 100. */
  percentUsed: number;
}

export function buildUsage(user: Pick<User, 'plan' | 'credits'>, used: number): Usage {
  const limit = ALLOWANCE[user.plan];
  return { plan: user.plan, used, limit, credits: user.credits, percentUsed: Math.min(100, Math.round((used / limit) * 100)) };
}

export interface AnswerView {
  answer: string;
  /** Cited claims, once each, with the save they came from. */
  citations: { claimId: string; text: string; sourceId: string; sourceTitle: string }[];
}

export function buildAnswerView(res: BrainAnswer): AnswerView {
  const seen = new Set<string>();
  const citations: AnswerView['citations'] = [];
  for (const c of res.citations) {
    if (seen.has(c.claimId)) continue;
    seen.add(c.claimId);
    citations.push({ claimId: c.claimId, text: c.claimText, sourceId: c.sourceId, sourceTitle: c.sourceTitle });
  }
  return { answer: res.answer.trim(), citations };
}

const DATE = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

/** "Oct 29, 2026", in UTC so the server and any client agree. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : DATE.format(d);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}
