'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { GraphNode } from '../../server/types';
import { explain } from './client-api';
import { GraphCanvas } from './GraphView';
import { filterForceData, neighborsOf, type ForceData, type NodeGroup } from './graph-model';
import { dashboardHref, sourceHref } from './view-model';

const TOGGLES: { group: NodeGroup; label: string; style: React.CSSProperties }[] = [
  { group: 'New', label: 'New claims', style: { background: '#C9974E' } },
  { group: 'Known', label: 'Known', style: { background: '#5F5A52' } },
  { group: 'Source', label: 'Sources', style: { borderRadius: 2, border: '1.5px solid #9E978B' } },
  { group: 'Concept', label: 'Concepts', style: { borderRadius: 3, background: '#4F4A43' } },
  { group: 'Project', label: 'Projects', style: { background: '#EDE8DF' } },
];

const clip = (n: { type: GraphNode['type']; label: string }) => ({ type: n.type, label: n.label.slice(0, 300) });

type Explained = { state: 'loading' } | { state: 'done'; text: string } | { state: 'error'; message: string };

export function GraphExplorer({ data }: { data: ForceData }) {
  const [hidden, setHidden] = useState<Set<NodeGroup>>(new Set(['Known']));
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
    explain(clip(node), around.slice(0, 30).map(clip))
      .then((r) => live && setExplained((e) => ({ ...e, [id]: { state: 'done', text: r.explanation } })))
      .catch((err: unknown) =>
        live && setExplained((e) => ({ ...e, [id]: { state: 'error', message: err instanceof Error ? err.message : 'Could not explain this node.' } })),
      );
    return () => {
      live = false;
    };
    // ponytail: refetches only on node, neighbor set, or Retry; `explained`/`around` objects are intentionally not deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, aroundKey, retry]);
  const exp = node ? explained[node.id] : undefined;

  const toggle = (t: NodeGroup) =>
    setHidden((h) => {
      const next = new Set(h);
      if (!next.delete(t)) next.add(t);
      return next;
    });

  return (
    <div className="explorer">
      <section className="canvas" aria-label="Knowledge graph">
        {visible.nodes.length === 0 ? (
          <p className="empty" style={{ margin: '96px 20px 0' }}>
            {data.nodes.length === 0 ? (
              <>
                Your graph is empty. Save a page from the extension or <Link href="/paste">paste one</Link>, and its ideas will show here.
              </>
            ) : (
              'Nothing to show with these filters.'
            )}
          </p>
        ) : (
          <GraphCanvas data={visible} fill selected={selected} onSelect={setSelected} />
        )}
        <div className="toolbar fade">
          <div className="glass" role="group" aria-label="Show">
            {TOGGLES.map((t) => (
              <button key={t.group} type="button" aria-pressed={!hidden.has(t.group)} onClick={() => toggle(t.group)}>
                <span className="swatch" style={t.style} aria-hidden="true" />
                {t.label}
              </button>
            ))}
          </div>
          <div className="glass">
            <label className="visually-hidden" htmlFor="graph-q">
              Search the graph
            </label>
            <input id="graph-q" type="search" value={query} placeholder="Search the graph" onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <p className="graph-stats fade" role="status">
          {visible.nodes.length} nodes · {visible.links.length} links
        </p>
      </section>

      <aside className="detail" aria-live="polite" aria-label="Selection">
        {node ? (
          <div className="stack stagger" style={{ gap: 18 }}>
            <p className="kind">
              <span className="swatch" style={{ background: node.color, borderRadius: node.type === 'Concept' ? 2 : undefined }} aria-hidden="true" />
              {node.type}
            </p>
            <h2>{node.label}</h2>
            {node.type === 'Source' && (
              <Link className="button" href={sourceHref(node.id)}>
                Open this save
              </Link>
            )}
            <div className="stack" aria-label="Explanation" aria-busy={!exp || exp.state === 'loading'}>
              {exp?.state === 'done' ? (
                <p className="explain">{exp.text}</p>
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
            <Link className="button" href={dashboardHref('/ask')}>
              Ask about {node.label.length > 28 ? 'this' : node.label}
            </Link>
          </div>
        ) : (
          <div className="stack">
            <p className="kind">Nothing selected</p>
            <p className="muted">Click a node to see what it connects to. Drag to pan, scroll or use the buttons to zoom.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
