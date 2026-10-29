import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createApi } from '@/lib/api';
import type { Neighborhood } from '@/lib/api-types';
import { loadSettings } from '@/lib/settings';
import { buildForceData, LEGEND, type ForceNode } from './graph-model';

const ForceGraph2D = lazy(() => import('react-force-graph-2d'));

const HEIGHT = 320;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => entry && setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

export function GraphView({ sourceId }: { sourceId: string }) {
  const [hood, setHood] = useState<Neighborhood | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const { ref, width } = useWidth();

  useEffect(() => {
    if (!sourceId) return;
    let live = true;
    setHood(null);
    setError(null);
    loadSettings()
      .then((s) => createApi(s).graph(sourceId))
      .then((r) => live && setHood(r))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [sourceId]);

  const data = useMemo(() => (hood ? buildForceData(hood, sourceId) : null), [hood, sourceId]);

  if (!sourceId) return <p className="muted">Save a page to see its graph.</p>;
  if (error) return <p className="status error">{error}</p>;
  if (!data) return <p className="status">loading…</p>;

  return (
    <section>
      <ul className="legend">
        {LEGEND.map((e) => (
          <li key={e.label}>
            <span className="dot" style={{ background: e.color }} />
            {e.label}
          </li>
        ))}
      </ul>
      <div ref={ref} className="graph-box">
        {width > 0 && (
          <Suspense fallback={<p className="status">loading…</p>}>
            <ForceGraph2D
              width={width}
              height={HEIGHT}
              graphData={data}
              nodeColor={(n) => (n as ForceNode).color}
              nodeLabel=""
              linkColor={(l) => (l as { color: string }).color}
              onNodeHover={(n) => setHover(n ? (n as ForceNode).id : null)}
              nodeCanvasObjectMode={() => 'after'}
              nodeCanvasObject={(n, ctx, scale) => {
                const node = n as ForceNode & { x: number; y: number };
                if (!node.alwaysLabel && node.id !== hover) return;
                const size = 12 / scale;
                ctx.font = `${size}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = '#222';
                ctx.fillText(node.label, node.x, node.y + 6);
              }}
            />
          </Suspense>
        )}
      </div>
    </section>
  );
}
