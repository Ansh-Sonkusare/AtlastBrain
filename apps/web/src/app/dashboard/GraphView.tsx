'use client';

import dynamic from 'next/dynamic';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Neighborhood } from '../../server/types';
import { neighborhood } from './client-api';
import { buildForceData, LEGEND, type ForceData, type ForceNode } from './graph-model';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => <GraphLoading />,
});

export function GraphLoading() {
  return (
    <div className="skeleton graph-loading" role="status">
      <span className="visually-hidden">Loading graph…</span>
    </div>
  );
}

function useSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    setSize({ width: el.clientWidth, height: el.clientHeight });
    observer.current = new ResizeObserver(([entry]) =>
      entry && setSize({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) }),
    );
    observer.current.observe(el);
  }, []);
  return { ref, ...size };
}

export function GraphLegend() {
  return (
    <ul className="legend">
      {LEGEND.map((e) => (
        <li key={e.label}>
          <span className="dot" style={{ background: e.color }} />
          {e.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * The force canvas, sized to its container: a fixed `height`, or `fill` to take the parent's height.
 * It zooms to fit once the layout settles. `preview` freezes pan, zoom and drag.
 */
export function GraphCanvas({
  data,
  height,
  fill = false,
  selected,
  onSelect,
  preview = false,
}: {
  data: ForceData;
  height?: number;
  fill?: boolean;
  selected?: string | null;
  onSelect?: (id: string) => void;
  preview?: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const size = useSize();
  const h = fill ? size.height : (height ?? 420);
  const fg = useRef<ForceGraphMethods | undefined>(undefined);
  const fitted = useRef(false);
  useEffect(() => {
    fitted.current = false;
  }, [data]);
  const zoomBy = (k: number) => fg.current?.zoom(fg.current.zoom() * k, 250);
  return (
    <div ref={size.ref} className={`graph-box${fill ? ' fill' : ''}`} style={fill ? undefined : { height: h }}>
      {size.width > 0 && h > 0 && (
        <ForceGraph2D
          ref={fg}
          width={size.width}
          height={h}
          cooldownTicks={120}
          onEngineStop={() => {
            if (fitted.current) return;
            fitted.current = true;
            fg.current?.zoomToFit(400, 40);
          }}
          graphData={data}
          backgroundColor="rgba(0,0,0,0)"
          nodeColor={(n) => (n as ForceNode).color}
          nodeLabel=""
          linkColor={(l) => (l as { color: string }).color}
          enableZoomInteraction={!preview}
          enablePanInteraction={!preview}
          enableNodeDrag={!preview}
          onNodeHover={(n) => setHover(n ? (n as ForceNode).id : null)}
          onNodeClick={(n) => onSelect?.((n as ForceNode).id)}
          nodeCanvasObjectMode={() => 'after'}
          nodeCanvasObject={(n, ctx, scale) => {
            const node = n as ForceNode & { x: number; y: number };
            if (!node.alwaysLabel && node.id !== hover && node.id !== selected) return;
            ctx.font = `${12 / scale}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = getComputedStyle(ctx.canvas).color;
            ctx.fillText(node.label, node.x, node.y + 6);
          }}
        />
      )}
      {!preview && size.width > 0 && (
        <div className="zoom-controls">
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.5)}>
            +
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.5)}>
            −
          </button>
          <button type="button" aria-label="Fit graph to screen" onClick={() => fg.current?.zoomToFit(400, 40)}>
            Fit
          </button>
        </div>
      )}
    </div>
  );
}

export function GraphView({ user, sourceId, height = 420 }: { user: string; sourceId: string; height?: number }) {
  const [hood, setHood] = useState<Neighborhood | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  if (!data) return <GraphLoading />;

  return (
    <div>
      <GraphLegend />
      <GraphCanvas data={data} height={height} />
    </div>
  );
}
