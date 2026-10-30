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
  endId,
  fitView,
  gravity,
  LABEL_COLOR,
  linkDistance,
  NEW_LINK_COLOR,
  NEW_RING_COLOR,
  neighborsOf,
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
    const halo = ctx.createRadialGradient(x, y, r, x, y, r + 22 * u);
    halo.addColorStop(0, PROJECT_HALO_COLOR);
    halo.addColorStop(1, 'rgba(237, 232, 223, 0)');
    circle(r + 22 * u);
    ctx.fillStyle = halo;
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
const PAPER = '#090807';

/** Links recede until a node is in focus: new-claim links are the loudest, so they are quietest at rest. */
function linkPaint(l: ForceLink, focus: string | null) {
  const touches = focus !== null && (endId(l.source) === focus || endId(l.target) === focus);
  const fresh = l.color === NEW_LINK_COLOR;
  if (touches) return { color: fresh ? NEW_LINK_COLOR : '#9E978B', width: fresh ? 1.6 : 1.2 };
  if (focus) return { color: `${l.color}18`, width: 0.6 };
  return { color: fresh ? `${l.color}40` : l.color, width: fresh ? 0.7 : l.width };
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  onSelect?: (id: string | null) => void;
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
  const focus = preview ? null : (hover ?? selected ?? null);
  const inFocus = useMemo(
    () => (focus ? new Set([focus, ...neighborsOf(data, focus).map((n) => n.id)]) : null),
    [data, focus],
  );
  useEffect(() => {
    const n = data.nodes.find((x) => x.id === selected) as Placed | undefined;
    if (n?.x !== undefined) fg.current?.centerAt(n.x, n.y, 500);
  }, [data, selected]);
  const zoomBy = (k: number) => fg.current?.zoom(fg.current.zoom() * k, 250);
  const fit = (ms = 400) => {
    const view = fitView(data.nodes, size.width, h, Math.min(60, h / 6));
    if (!view || !fg.current) return;
    fitScale.current = view.k;
    fg.current.centerAt(view.x, view.y, ms);
    fg.current.zoom(view.k, ms);
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
            // Keep the settling layout framed, so it never flies off the canvas before the final fit.
            if (!fitted.current) fit(0);
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
          linkColor={(l) => linkPaint(l as ForceLink, focus).color}
          linkWidth={(l) => linkPaint(l as ForceLink, focus).width}
          linkCurvature={preview ? 0 : 0.12}
          linkDirectionalParticles={preview || reducedMotion() ? 0 : 2}
          linkDirectionalParticleWidth={(l) => {
            const link = l as ForceLink;
            return focus && (endId(link.source) === focus || endId(link.target) === focus) ? 2.5 : 0;
          }}
          linkDirectionalParticleSpeed={0.006}
          linkDirectionalParticleColor={() => NEW_LINK_COLOR}
          autoPauseRedraw={preview}
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
          onBackgroundClick={onSelect ? () => onSelect(null) : undefined}
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
            // The first frame paints before the layout places anything.
            if (!Number.isFinite(node.x)) return;
            const on = node.id === selected;
            const u = unitsPerPixel(scale, fitScale.current) * (preview ? PREVIEW_NODE_SCALE : 1);
            ctx.globalAlpha = inFocus && !inFocus.has(node.id) ? 0.14 : 1;
            drawNode(node, ctx, scale, u, on);
            ctx.globalAlpha = 1;
          }}
          onRenderFramePost={(ctx, scale) => {
            if (preview) return;
            // Drawn after every node and link, so nothing crosses a label.
            ctx.lineJoin = 'round';
            for (const n of data.nodes) {
              const node = n as Placed;
              if (node.x === undefined) continue;
              const on = node.id === selected;
              const hovered = node.id === hover;
              const concept = node.type === 'Concept';
              const project = node.type === 'Project';
              if (!concept && !project && !node.alwaysLabel && !hovered && !on) continue;
              const r = node.radius * unitsPerPixel(scale, fitScale.current);
              const label = canvasLabel(node.label);
              ctx.font = labelFont(node, scale);
              ctx.globalAlpha = inFocus && !inFocus.has(node.id) ? 0.2 : 1;
              ctx.textAlign = concept ? 'left' : 'center';
              ctx.textBaseline = concept ? 'middle' : 'top';
              const x = concept ? node.x + r + CONCEPT_LABEL_GAP / scale : node.x;
              const y = concept ? node.y : node.y + r + (project ? 10 : 6) / scale;
              ctx.strokeStyle = PAPER;
              ctx.lineWidth = 4 / scale;
              ctx.strokeText(label, x, y);
              ctx.fillStyle = concept ? (on || hovered ? SELECTED_COLOR : CONCEPT_LABEL) : project ? SELECTED_COLOR : LABEL_COLOR;
              ctx.fillText(label, x, y);
            }
            ctx.globalAlpha = 1;
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
          <button type="button" aria-label="Fit graph to screen" onClick={() => fit()}>
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
