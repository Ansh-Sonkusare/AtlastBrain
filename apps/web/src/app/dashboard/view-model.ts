import { ALLOWANCE } from '../../server/billing/quota';
import { isPlaceholder, type SourceRecord } from '../../server/graph/port';
import type { SourceResponse } from '../../server/pipeline/result';
import type { BrainAnswer, GraphExport, Plan, SourceStatus, Tldr, User } from '../../server/types';

export const SOURCE_STATUSES: SourceStatus[] = ['pending', 'processing', 'done', 'partial', 'blocked'];

export const dashboardHref = (path = '') => `/dashboard${path}`;

export const sourceHref = (sourceId: string) => dashboardHref(`/source/${encodeURIComponent(sourceId)}`);

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

/** One list from the per-status lists the graph returns, newest save first, without quota placeholders. */
export function mergeLibrary(lists: SourceRecord[][]): LibraryItem[] {
  return lists
    .flat()
    .filter((s) => !isPlaceholder(s))
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

export interface DigestDay {
  /** "2026-10-29", the UTC day the saves were made. */
  day: string;
  newTotal: number;
  knownTotal: number;
  saves: { id: string; title: string; newCount: number; percentNew: number | null }[];
  /** The day's new ideas, a few per save so one long article does not crowd out the rest. */
  ideas: { id: string; text: string; sourceId: string; sourceTitle: string }[];
}

/** Checked saves grouped into one summary per day, newest day first. */
export function buildDailyDigest(saves: { detail: SourceDetail; savedAt: string }[], ideasPerDay = 6): DigestDay[] {
  const byDay = new Map<string, SourceDetail[]>();
  for (const { detail, savedAt } of [...saves].sort((a, b) => b.savedAt.localeCompare(a.savedAt))) {
    const day = savedAt.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), detail]);
  }
  return [...byDay].map(([day, details]) => {
    const ideas: DigestDay['ideas'] = [];
    // Round-robin across the day's saves.
    for (let i = 0; ideas.length < ideasPerDay && details.some((d) => i < d.newClaims.length); i++) {
      for (const d of details) {
        const c = d.newClaims[i];
        if (c && ideas.length < ideasPerDay) ideas.push({ id: c.id, text: c.text, sourceId: d.id, sourceTitle: d.title });
      }
    }
    return {
      day,
      newTotal: details.reduce((n, d) => n + d.newCount, 0),
      knownTotal: details.reduce((n, d) => n + d.repeatCount, 0),
      saves: details.map((d) => ({ id: d.id, title: d.title, newCount: d.newCount, percentNew: d.percentNew })),
      ideas,
    };
  });
}

export function formatDay(day: string): string {
  return DAY.format(new Date(`${day}T00:00:00Z`));
}

const DAY = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });

export interface ProjectCoverage {
  name: string;
  /** Concepts tied to the project that appear in at least one save you have read. */
  read: number;
  total: number;
}

export function projectCoverage(exp: GraphExport): ProjectCoverage[] {
  const readConcepts = new Set(exp.sources.filter((s) => s.readAt !== null).flatMap((s) => s.made.flatMap((c) => c.concepts)));
  return exp.projects.map((p) => {
    const mine = exp.concepts.filter((c) => c.projects.includes(p.name));
    return { name: p.name, read: mine.filter((c) => readConcepts.has(c.name)).length, total: mine.length };
  });
}

/** Project label colors, cycled by position so a project keeps its color across pages. */
const PROJECT_COLORS = ['#8FA98C', '#C27C5E', '#7F9BB3', '#C9974E', '#D9AE6C'];
export const projectColor = (index: number) => PROJECT_COLORS[((index % PROJECT_COLORS.length) + PROJECT_COLORS.length) % PROJECT_COLORS.length];

/** Projects a save touches, through the concepts its claims are about. */
export function projectsOfSource(exp: GraphExport, sourceId: string): { name: string; color: string }[] {
  const src = exp.sources.find((s) => s.id === sourceId);
  if (!src) return [];
  const concepts = new Set(src.made.flatMap((c) => c.concepts));
  return exp.projects.flatMap((p, i) =>
    exp.concepts.some((c) => concepts.has(c.name) && c.projects.includes(p.name)) ? [{ name: p.name, color: projectColor(i) }] : [],
  );
}
