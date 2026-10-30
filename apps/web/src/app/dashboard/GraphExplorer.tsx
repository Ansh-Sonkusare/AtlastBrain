'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { GraphNode } from '../../server/types';
import { explain } from './client-api';
import { GraphCanvas } from './GraphView';
import { filterForceData, NODE_COLORS, neighborsOf, type ForceData } from './graph-model';
import { sourceHref } from './view-model';

const TOGGLES: { type: GraphNode['type']; label: string }[] = [
  { type: 'Project', label: 'Projects' },
  { type: 'Concept', label: 'Concepts' },
  { type: 'Claim', label: 'Claims' },
  { type: 'Source', label: 'Sources' },
];

const clip = (n: { type: GraphNode['type']; label: string }) => ({ type: n.type, label: n.label.slice(0, 300) });

type Explained = { state: 'loading' } | { state: 'done'; text: string } | { state: 'error'; message: string };

export function GraphExplorer({ user, data }: { user: string; data: ForceData }) {
  const [hidden, setHidden] = useState<Set<GraphNode['type']>>(new Set());
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const visible = useMemo(() => {
    const base = filterForceData(data, hidden);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    // Keep matches and what touches them, so a search shows a neighborhood rather than orphans.
    const keep = new Set<string>();
    for (const n of base.nodes) {
      if (!n.label.toLowerCase().includes(q)) continue;
      keep.add(n.id);
      for (const m of neighborsOf(base, n.id)) keep.add(m.id);
    }
    return { nodes: base.nodes.filter((n) => keep.has(n.id)), links: base.links.filter((l) => keep.has(l.source) && keep.has(l.target)) };
  }, [data, hidden, query]);

  const node = visible.nodes.find((n) => n.id === selected) ?? null;
  const around = node ? neighborsOf(visible, node.id) : [];

  // Cached per node id for the life of the page, so reselecting never refetches.
  const [explained, setExplained] = useState<Record<string, Explained>>({});
  const [retry, setRetry] = useState(0);
  const aroundKey = around.map((n) => n.id).join(',');
  useEffect(() => {
    if (!node || explained[node.id]?.state === 'done') return;
    const id = node.id;
    let live = true;
    setExplained((e) => ({ ...e, [id]: { state: 'loading' } }));
    explain(user, clip(node), around.slice(0, 30).map(clip))
      .then((r) => live && setExplained((e) => ({ ...e, [id]: { state: 'done', text: r.explanation } })))
      .catch((err: unknown) =>
        live && setExplained((e) => ({ ...e, [id]: { state: 'error', message: err instanceof Error ? err.message : 'Could not explain this node.' } })),
      );
    return () => {
      live = false;
    };
    // ponytail: refetches only on node, neighbor set, or Retry; `explained`/`around` objects are intentionally not deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, aroundKey, retry, user]);
  const exp = node ? explained[node.id] : undefined;

  const toggle = (t: GraphNode['type']) =>
    setHidden((h) => {
      const next = new Set(h);
      if (!next.delete(t)) next.add(t);
      return next;
    });

  return (
    <div className="explorer">
      <aside className="rail" aria-label="Filters">
        <div className="stack">
          <label className="eyebrow" htmlFor="graph-q">
            Focus
          </label>
          <input id="graph-q" type="search" value={query} placeholder="Search the graph" onChange={(e) => setQuery(e.target.value)} />
        </div>
        <fieldset className="stack">
          <legend className="eyebrow">Show</legend>
          {TOGGLES.map((t) => (
            <label key={t.type} className="check">
              <input type="checkbox" checked={!hidden.has(t.type)} onChange={() => toggle(t.type)} />
              <span className="dot" style={{ background: NODE_COLORS[t.type] }} aria-hidden="true" />
              {t.label}
            </label>
          ))}
        </fieldset>
        <p className="muted">Click a node to see what it connects to. Drag to pan, scroll or use the buttons to zoom.</p>
        <p className="muted" role="status">
          {visible.nodes.length} nodes, {visible.links.length} links
        </p>
      </aside>

      <section className="canvas" aria-label="Knowledge graph">
        {visible.nodes.length === 0 ? (
          <p className="empty">Nothing to show with these filters.</p>
        ) : (
          <GraphCanvas data={visible} fill selected={selected} onSelect={setSelected} />
        )}
      </section>

      <aside className="detail" aria-live="polite" aria-label="Selection">
        {node ? (
          <div className="stack">
            <p className="eyebrow">{node.type}</p>
            <h2>{node.label}</h2>
            {node.type === 'Source' && <Link href={sourceHref(user, node.id)}>Open this save</Link>}
            <div className="stack" aria-label="Explanation" aria-busy={!exp || exp.state === 'loading'}>
              <p className="eyebrow">Explanation</p>
              {exp?.state === 'done' ? (
                <p>{exp.text}</p>
              ) : exp?.state === 'error' ? (
                <>
                  <p className="status error">{exp.message}</p>
                  <button type="button" onClick={() => setRetry((n) => n + 1)}>
                    Retry
                  </button>
                </>
              ) : (
                <div className="skeleton" aria-hidden="true">
                  <div className="skeleton-line" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line" />
                </div>
              )}
            </div>
            <p className="muted">
              {around.length} {around.length === 1 ? 'connection' : 'connections'}
            </p>
            <ul className="plain">
              {around.map((n) => (
                <li key={n.id} className="neighbor">
                  <button type="button" onClick={() => setSelected(n.id)}>
                    <span className="eyebrow">{n.type}</span>
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="muted">Select a node to read it here.</p>
        )}
      </aside>
    </div>
  );
}
