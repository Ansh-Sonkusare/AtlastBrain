import { describe, expect, it } from 'vitest';
import type { SourceRecord } from '../../server/graph/port';
import type { SourceResponse } from '../../server/pipeline/result';
import {
  buildAnswerView,
  buildDailyDigest,
  buildSourceDetail,
  buildUsage,
  dashboardHref,
  formatDate,
  mergeLibrary,
  projectColor,
  projectCoverage,
  projectsOfSource,
  sourceHref,
  toLibraryItem,
  type SourceDetail,
} from './view-model';

const record = (over: Partial<SourceRecord> = {}): SourceRecord => ({
  id: 's1',
  userId: 'demo',
  url: 'https://example.com/a',
  title: 'Article',
  kind: 'web',
  status: 'done',
  savedAt: '2026-10-01T10:00:00.000Z',
  readAt: null,
  contentHash: 'h',
  body: '',
  newRatio: 0.42,
  tldr: null,
  ...over,
});

describe('links', () => {
  it('carry no user, and encode the source id', () => {
    expect(dashboardHref()).toBe('/dashboard');
    expect(dashboardHref('/ask')).toBe('/dashboard/ask');
    expect(sourceHref('s/1')).toBe('/dashboard/source/s%2F1');
  });
});

describe('mergeLibrary', () => {
  it('merges the per-status lists newest first and tags read state', () => {
    const items = mergeLibrary([
      [record({ id: 'old', savedAt: '2026-09-01T00:00:00.000Z', readAt: '2026-09-02T00:00:00.000Z' })],
      [record({ id: 'new', savedAt: '2026-10-05T00:00:00.000Z', status: 'pending' })],
      [],
    ]);
    expect(items.map((i) => i.id)).toEqual(['new', 'old']);
    expect(items.map((i) => i.read)).toEqual([false, true]);
  });

  it('hides demo:fill placeholders', () => {
    const items = mergeLibrary([[record({ id: 'real' }), record({ id: 'demo-fill-1', url: 'fill://demo-fill-1' })]]);
    expect(items.map((i) => i.id)).toEqual(['real']);
  });

  it('shows a ratio only for checked sources, and falls back to the url for a title', () => {
    expect(toLibraryItem(record()).percentNew).toBe(42);
    expect(toLibraryItem(record({ status: 'partial' })).percentNew).toBe(42);
    expect(toLibraryItem(record({ status: 'pending', newRatio: 0 })).newRatio).toBeNull();
    expect(toLibraryItem(record({ status: 'blocked' })).percentNew).toBeNull();
    expect(toLibraryItem(record({ title: '' })).title).toBe('https://example.com/a');
  });
});

describe('buildSourceDetail', () => {
  const res: SourceResponse = {
    sourceId: 's1',
    status: 'done',
    title: 'Article',
    url: 'https://example.com/a',
    newRatio: 0.5,
    tldr: null,
    highlights: ['q'],
    verdicts: [
      { kind: 'new', text: 'A', claimId: 'c1' },
      {
        kind: 'repeat',
        text: 'B again',
        match: { claimId: 'c0', claimText: 'B', distance: 0.1, sourceId: 's0', sourceTitle: 'Old', sourceUrl: 'https://old', concepts: [] },
      },
      { kind: 'new', text: 'C', claimId: 'c2' },
    ],
  };

  it('splits claims, counts them, and keeps where each repeat was first seen', () => {
    const d = buildSourceDetail(res);
    expect(d.newClaims.map((c) => c.text)).toEqual(['A', 'C']);
    expect(d).toMatchObject({ newCount: 2, repeatCount: 1, percentNew: 50, highlights: ['q'] });
    expect(d.repeats[0]).toEqual({ text: 'B again', originalText: 'B', sourceId: 's0', sourceTitle: 'Old', sourceUrl: 'https://old' });
  });

  it('has no ratio before the source is checked', () => {
    expect(buildSourceDetail({ ...res, status: 'processing', verdicts: [] }).percentNew).toBeNull();
  });
});

describe('buildUsage', () => {
  it('measures against the plan allowance and caps at 100', () => {
    expect(buildUsage({ plan: 'free', credits: 3 }, 15)).toMatchObject({ limit: 30, percentUsed: 50, credits: 3 });
    expect(buildUsage({ plan: 'free', credits: 0 }, 99).percentUsed).toBe(100);
    expect(buildUsage({ plan: 'pro', credits: 0 }, 0).limit).toBeGreaterThan(30);
  });
});

describe('buildAnswerView', () => {
  const c = (id: string) => ({ claimId: id, claimText: `claim ${id}`, distance: 0.1, sourceId: `s-${id}`, sourceTitle: id, sourceUrl: `https://e/${id}`, concepts: [] });
  it('trims the answer and lists each cited claim once, in order', () => {
    const v = buildAnswerView({ question: 'q', answer: ' Yes. ', citations: [c('b'), c('a'), c('b')] });
    expect(v.answer).toBe('Yes.');
    expect(v.citations.map((x) => x.claimId)).toEqual(['b', 'a']);
    expect(v.citations[0]).toMatchObject({ sourceId: 's-b', text: 'claim b' });
  });
});

describe('formatDate', () => {
  it('formats in UTC and returns empty for garbage', () => {
    expect(formatDate('2026-10-29T23:59:00.000Z')).toBe('Oct 29, 2026');
    expect(formatDate('nope')).toBe('');
  });
});

describe('projectCoverage', () => {
  it('counts a project concept as read only when a read save made a claim about it', () => {
    const exp = {
      projects: [{ id: 'p', name: 'Demo', description: '' }],
      concepts: [
        { id: 'a', name: 'A', summary: '', projects: ['Demo'] },
        { id: 'b', name: 'B', summary: '', projects: ['Demo'] },
        { id: 'c', name: 'C', summary: '', projects: [] },
      ],
      sources: [
        { id: 's1', title: '', url: '', savedAt: '', readAt: '2026-10-01', tldr: null, made: [{ id: 'x', text: '', concepts: ['A', 'C'] }], repeated: [], highlights: [] },
        { id: 's2', title: '', url: '', savedAt: '', readAt: null, tldr: null, made: [{ id: 'y', text: '', concepts: ['B'] }], repeated: [], highlights: [] },
      ],
    };
    expect(projectCoverage(exp)).toEqual([{ name: 'Demo', read: 1, total: 2 }]);
    // A save belongs to a project through the concepts its claims are about.
    expect(projectsOfSource(exp, 's2')).toEqual([{ name: 'Demo', color: projectColor(0) }]);
    expect(projectsOfSource(exp, 'nope')).toEqual([]);
  });
});

describe('buildDailyDigest', () => {
  const d = (id: string, newIds: string[], repeatCount = 0) =>
    ({ id, title: id.toUpperCase(), newCount: newIds.length, repeatCount, percentNew: 50, newClaims: newIds.map((c) => ({ id: c, text: c })) }) as SourceDetail;

  it('groups saves by UTC day, newest first, and sums the day', () => {
    const days = buildDailyDigest([
      { detail: d('a', ['a1']), savedAt: '2026-10-28T09:00:00Z' },
      { detail: d('b', ['b1', 'b2'], 3), savedAt: '2026-10-29T08:00:00Z' },
      { detail: d('c', ['c1'], 1), savedAt: '2026-10-29T20:00:00Z' },
    ]);
    expect(days.map((x) => x.day)).toEqual(['2026-10-29', '2026-10-28']);
    expect([days[0].newTotal, days[0].knownTotal]).toEqual([3, 4]);
    expect(days[0].saves.map((s) => s.id)).toEqual(['c', 'b']);
  });

  it('takes ideas round-robin across saves and caps them', () => {
    const [day] = buildDailyDigest(
      [
        { detail: d('a', ['a1', 'a2', 'a3']), savedAt: '2026-10-29T10:00:00Z' },
        { detail: d('b', ['b1']), savedAt: '2026-10-29T09:00:00Z' },
      ],
      3,
    );
    expect(day.ideas.map((i) => i.id)).toEqual(['a1', 'b1', 'a2']);
    expect(day.ideas[1].sourceTitle).toBe('B');
  });
});
