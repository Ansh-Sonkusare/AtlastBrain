'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Neighborhood } from '../../server/types';
import { neighborhood } from './client-api';
import { buildForceData, LEGEND, type ForceNode } from './graph-model';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => <p className="status">Loading graph…</p>,
});

const HEIGHT = 420;

function useWidth() {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    setWidth(el.clientWidth);
    observer.current = new ResizeObserver(([entry]) => entry && setWidth(Math.floor(entry.contentRect.width)));
    observer.current.observe(el);
  }, []);
  return { ref, width };
}

export function GraphView({ user, sourceId }: { user: string; sourceId: string }) {
  const [hood, setHood] = useState<Neighborhood | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const { ref, width } = useWidth();

  useEffect(() => {
    let live = true;
    neighborhood(user, sourceId)
      .then((r) => live && setHood(r))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [user, sourceId]);

  const data = useMemo(() => (hood ? buildForceData(hood, sourceId) : null), [hood, sourceId]);

  if (error) return <p className="status error">{error}</p>;
  if (!data) return <p className="status">Loading graph…</p>;

  return (
    <div>
      <ul className="legend">
        {LEGEND.map((e) => (
          <li key={e.label}>
            <span className="dot" style={{ background: e.color }} />
            {e.label}
          </li>
        ))}
      </ul>
      <div ref={ref} className="graph-box" style={{ height: HEIGHT }}>
        {width > 0 && (
          <ForceGraph2D
            width={width}
            height={HEIGHT}
            graphData={data}
            backgroundColor="rgba(0,0,0,0)"
            nodeColor={(n) => (n as ForceNode).color}
            nodeLabel=""
            linkColor={(l) => (l as { color: string }).color}
            onNodeHover={(n) => setHover(n ? (n as ForceNode).id : null)}
            nodeCanvasObjectMode={() => 'after'}
            nodeCanvasObject={(n, ctx, scale) => {
              const node = n as ForceNode & { x: number; y: number };
              if (!node.alwaysLabel && node.id !== hover) return;
              ctx.font = `${12 / scale}px system-ui, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = getComputedStyle(ctx.canvas).color;
              ctx.fillText(node.label, node.x, node.y + 6);
            }}
          />
        )}
      </div>
    </div>
  );
}
