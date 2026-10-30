'use client';

import dynamic from 'next/dynamic';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Neighborhood } from '../../server/types';
import { neighborhood } from './client-api';
import {
  boxCollide,
  buildForceData,
  canvasLabel,
  CONCEPT_FILL,
  CONCEPT_LABEL,
  fitView,
  gravity,
  LABEL_COLOR,
  linkDistance,
  NEW_RING_COLOR,
  NODE_COLORS,
  PROJECT_HALO_COLOR,
  SELECTED_COLOR,
  unitsPerPixel,
  type ForceData,
  type ForceLink,
  type ForceNode,
} from './graph-model';

type Placed = ForceNode & { x: number; y: number };

function roundSquare(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x - r, y - r, r * 2, r * 2, radius);
}

/** `u` is graph units per design pixel, so shapes keep the design's proportions at every zoom. */
function drawNode(node: Placed, ctx: CanvasRenderingContext2D, scale: number, u: number, selected: boolean) {
  const { x, y } = node;
  const r = node.radius * u;
  const circle = (rad: number) => {
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, 2 * Math.PI);
  };
  const ring = () => {
    circle(r + 3 * u);
    ctx.strokeStyle = SELECTED_COLOR;
    ctx.lineWidth = 1 / scale;
    ctx.stroke();
  };
  if (node.type === 'Source') {
    roundSquare(ctx, x, y, r, 3 * u);
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeStyle = selected ? SELECTED_COLOR : NODE_COLORS.Source;
    ctx.stroke();
  } else if (node.type === 'Concept') {
    if (selected) {
      roundSquare(ctx, x, y, r + 4 * u, 10 * u);
      ctx.fillStyle = '#090807';
      ctx.fill();
      ctx.strokeStyle = SELECTED_COLOR;
      ctx.lineWidth = 1 / scale;
      ctx.stroke();
    }
    roundSquare(ctx, x, y, r, 7 * u);
    ctx.fillStyle = selected ? SELECTED_COLOR : CONCEPT_FILL;
    ctx.fill();
  } else if (node.type === 'Project') {
    circle(r + 10 * u);
    ctx.fillStyle = PROJECT_HALO_COLOR;
    ctx.fill();
    circle(r);
    ctx.fillStyle = NODE_COLORS.Project;
    ctx.fill();
    if (selected) ring();
  } else {
    if (!node.repeat) {
      circle(r + 4 * u);
      ctx.fillStyle = NEW_RING_COLOR;
      ctx.fill();
    }
    circle(r);
    ctx.fillStyle = node.color;
    ctx.fill();
    if (selected) ring();
  }
}

const CONCEPT_LABEL_GAP = 10;

let pageFont: string | undefined;

const labelFont = (node: ForceNode, scale: number) => {
  pageFont ??= getComputedStyle(document.body).fontFamily;
  const [weight, size] = node.type === 'Project' ? [600, 14] : node.type === 'Concept' ? [400, 13] : [400, 12];
  return `${weight} ${size / scale}px ${pageFont}`;
};

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

// The preview is a thumbnail: small unlabeled nodes, about 16px for a project as in the design.
const PREVIEW_NODE_SCALE = 0.36;

/**
 * The force canvas, sized to its container: a fixed `height`, or `fill` to take the parent's height.
 * It zooms to fit once the layout settles. Only `fill` zooms on wheel, so an embedded graph doesn't trap page scroll.
 * `preview` freezes pan, zoom and drag.
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
  // The zoom the layout was last fitted at: that view draws nodes at the design's pixels.
  const fitScale = useRef(1);
  const forcesSet = useRef(false);
  useEffect(() => {
    fitted.current = false;
  }, [data]);
  const zoomBy = (k: number) => fg.current?.zoom(fg.current.zoom() * k, 250);
  const fit = () => {
    const view = fitView(data.nodes, size.width, h, Math.min(60, h / 6));
    if (!view || !fg.current) return;
    fitScale.current = view.k;
    fg.current.centerAt(view.x, view.y, 400);
    fg.current.zoom(view.k, 400);
  };
  return (
    <div ref={size.ref} className={`graph-box${fill ? ' fill' : ''}`} style={fill ? undefined : { height: h }}>
      {size.width > 0 && h > 0 && (
        <ForceGraph2D
          ref={fg}
          width={size.width}
          height={h}
          cooldownTicks={200}
          onEngineTick={() => {
            // The graph loads lazily, so the first tick is the first moment its forces are sure to exist.
            if (forcesSet.current || !fg.current) return;
            forcesSet.current = true;
            fg.current.d3Force('charge')?.strength(-200).distanceMax(700);
            fg.current.d3Force('link')?.distance(linkDistance);
            fg.current.d3Force('collide', boxCollide());
            fg.current.d3Force('gravity', gravity());
          }}
          onEngineStop={() => {
            if (fitted.current || !fg.current) return;
            fitted.current = true;
            fit();
          }}
          graphData={data}
          backgroundColor="rgba(0,0,0,0)"
          nodeLabel=""
          linkColor={(l) => (l as ForceLink).color}
          linkWidth={(l) => (l as ForceLink).width}
          linkLineDash={(l) => {
            const k = fg.current?.zoom() || 1;
            return (l as ForceLink).dash?.map((d) => d / k) ?? null;
          }}
          enableZoomInteraction={fill && !preview}
          enablePanInteraction={!preview}
          enableNodeDrag={!preview}
          enablePointerInteraction={!preview}
          onNodeHover={(n) => setHover(n ? (n as ForceNode).id : null)}
          onNodeClick={onSelect ? (n) => onSelect((n as ForceNode).id) : undefined}
          nodeCanvasObjectMode={() => 'replace'}
          nodePointerAreaPaint={(n, color, ctx, scale) => {
            const node = n as Placed;
            const u = unitsPerPixel(scale, fitScale.current);
            const r = (node.radius + 2) * u;
            ctx.fillStyle = color;
            if (node.type === 'Concept') {
              ctx.font = labelFont(node, scale);
              const width = r + (CONCEPT_LABEL_GAP / scale) + ctx.measureText(canvasLabel(node.label)).width;
              const half = Math.max(r, 9 / scale);
              ctx.fillRect(node.x - r, node.y - half, r + width, half * 2);
            } else if (node.type === 'Source') {
              ctx.fillRect(node.x - r, node.y - r, r * 2, r * 2);
            } else {
              ctx.beginPath();
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
              ctx.fill();
            }
          }}
          nodeCanvasObject={(n, ctx, scale) => {
            const node = n as Placed;
            const on = node.id === selected;
            const hovered = node.id === hover;
            const u = unitsPerPixel(scale, fitScale.current) * (preview ? PREVIEW_NODE_SCALE : 1);
            drawNode(node, ctx, scale, u, on);
            if (preview) return;
            const concept = node.type === 'Concept';
            const project = node.type === 'Project';
            if (!concept && !project && !node.alwaysLabel && !hovered && !on) return;
            const r = node.radius * u;
            const label = canvasLabel(node.label);
            ctx.font = labelFont(node, scale);
            ctx.fillStyle = concept ? (on || hovered ? SELECTED_COLOR : CONCEPT_LABEL) : project ? SELECTED_COLOR : LABEL_COLOR;
            if (concept) {
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(label, node.x + r + CONCEPT_LABEL_GAP / scale, node.y);
            } else {
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillText(label, node.x, node.y + r + (project ? 10 : 6) / scale);
            }
          }}
        />
      )}
      {!preview && size.width > 0 && (
        <div className="zoom-controls">
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.5)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.5)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
          <button type="button" aria-label="Fit graph to screen" onClick={fit}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export function GraphView({ sourceId, height = 420 }: { sourceId: string; height?: number }) {
  const [hood, setHood] = useState<Neighborhood | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    neighborhood(sourceId)
      .then((r) => live && setHood(r))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [sourceId]);

  const data = useMemo(() => (hood ? buildForceData(hood, sourceId) : null), [hood, sourceId]);

  if (error) return <p className="status error">{error}</p>;
  if (!data) return <GraphLoading />;

  return (
    <div>
      <GraphCanvas data={data} height={height} preview />
    </div>
  );
}
