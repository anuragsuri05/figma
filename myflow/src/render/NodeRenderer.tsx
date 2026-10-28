import React, { createContext, memo, useContext } from 'react';
import type { Effect, Paint, SceneNode } from '../model/types';
import { nodePath, cornerRadii, rectPath } from './geometry';
import { layoutText, resolveLineHeight, applyCase } from '../model/text';
import { hexToRgb } from '../model/color';

export interface RenderOptions {
  prefix: string;
  interactive: boolean;
  outlines?: boolean;
  hideIds?: Set<string>;
  showGrids?: boolean;
  zoom?: number;
  exportMode?: boolean;
}

export type NodeGetter = (id: string) => SceneNode | undefined;
export type NodesGetter = (ids: string[]) => (SceneNode | undefined)[];

export const RenderCtx = createContext<{ useNode: NodeGetter; useNodes: NodesGetter; opts: RenderOptions }>({
  useNode: () => undefined,
  useNodes: () => [],
  opts: { prefix: 'r', interactive: false },
});

const conicCache = new Map<string, string>();

function conicDataUrl(p: Paint, diamond: boolean): string {
  const key = JSON.stringify([p.stops, p.angle, diamond]);
  const hit = conicCache.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return '';
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const stops = p.stops ?? [];
  if (!diamond && 'createConicGradient' in ctx) {
    const g = ctx.createConicGradient(((p.angle ?? 0) - 90) * (Math.PI / 180), size / 2, size / 2);
    stops.forEach((s) => g.addColorStop(Math.max(0, Math.min(1, s.offset)), s.color));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  } else {
    const img = ctx.createImageData(size, size);
    const sorted = [...stops].sort((a, b) => a.offset - b.offset).map((s) => ({ o: s.offset, c: hexToRgb(s.color) }));
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const t = Math.min(1, (Math.abs(x - size / 2) + Math.abs(y - size / 2)) / (size / 2));
      let a = sorted[0], b = sorted[sorted.length - 1];
      for (let i = 0; i < sorted.length - 1; i++) if (t >= sorted[i].o && t <= sorted[i + 1].o) { a = sorted[i]; b = sorted[i + 1]; break; }
      const f = b.o === a.o ? 0 : Math.max(0, Math.min(1, (t - a.o) / (b.o - a.o)));
      const i4 = (y * size + x) * 4;
      img.data[i4] = a.c.r + (b.c.r - a.c.r) * f;
      img.data[i4 + 1] = a.c.g + (b.c.g - a.c.g) * f;
      img.data[i4 + 2] = a.c.b + (b.c.b - a.c.b) * f;
      img.data[i4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  const url = c.toDataURL();
  conicCache.set(key, url);
  return url;
}

function PaintDef({ id, p, n }: { id: string; p: Paint; n: SceneNode }) {
  if (p.type === 'GRADIENT_LINEAR') {
    const a = ((p.angle ?? 90) * Math.PI) / 180;
    const dx = Math.sin(a) / 2, dy = -Math.cos(a) / 2;
    return (
      <linearGradient id={id} x1={0.5 - dx} y1={0.5 - dy} x2={0.5 + dx} y2={0.5 + dy}>
        {(p.stops ?? []).map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} />)}
      </linearGradient>
    );
  }
  if (p.type === 'GRADIENT_RADIAL') {
    return (
      <radialGradient id={id} cx={0.5} cy={0.5} r={0.5}>
        {(p.stops ?? []).map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} />)}
      </radialGradient>
    );
  }
  if (p.type === 'GRADIENT_ANGULAR' || p.type === 'GRADIENT_DIAMOND') {
    return (
      <pattern id={id} patternUnits="userSpaceOnUse" width={n.width} height={n.height}>
        <image href={conicDataUrl(p, p.type === 'GRADIENT_DIAMOND')} width={n.width} height={n.height} preserveAspectRatio="none" />
      </pattern>
    );
  }
  if (p.type === 'IMAGE') {
    const mode = p.scaleMode ?? 'FILL';
    if (mode === 'TILE') {
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width={Math.max(8, Math.min(n.width, n.height) / 2)} height={Math.max(8, Math.min(n.width, n.height) / 2)}>
          <image href={p.imageSrc} width={Math.max(8, Math.min(n.width, n.height) / 2)} height={Math.max(8, Math.min(n.width, n.height) / 2)} preserveAspectRatio="xMidYMid slice" />
        </pattern>
      );
    }
    return (
      <pattern id={id} patternUnits="userSpaceOnUse" width={n.width} height={n.height}>
        <image href={p.imageSrc} width={n.width} height={n.height} preserveAspectRatio={mode === 'FIT' ? 'xMidYMid meet' : mode === 'CROP' ? 'none' : 'xMidYMid slice'} />
      </pattern>
    );
  }
  return null;
}

const BLEND: Record<string, string> = {
  PASS_THROUGH: 'normal', NORMAL: 'normal', DARKEN: 'darken', MULTIPLY: 'multiply', COLOR_BURN: 'color-burn', LIGHTEN: 'lighten',
  SCREEN: 'screen', COLOR_DODGE: 'color-dodge', OVERLAY: 'overlay', SOFT_LIGHT: 'soft-light', HARD_LIGHT: 'hard-light',
  DIFFERENCE: 'difference', EXCLUSION: 'exclusion', HUE: 'hue', SATURATION: 'saturation', COLOR: 'color', LUMINOSITY: 'luminosity',
};
export const cssBlend = (b?: string) => BLEND[b ?? 'NORMAL'] ?? 'normal';

function paintAttr(p: Paint, defId: string) {
  if (p.type === 'SOLID') return { fill: p.color, fillOpacity: p.opacity };
  return { fill: `url(#${defId})`, fillOpacity: p.opacity };
}

function EffectFilter({ id, effects }: { id: string; effects: Effect[] }) {
  const vis = effects.filter((e) => e.visible && e.type !== 'BACKGROUND_BLUR');
  if (!vis.length) return null;
  const parts: React.ReactNode[] = [];
  const merges: string[] = [];
  vis.forEach((e, i) => {
    const { r, g, b } = hexToRgb(e.color);
    const col = `${r / 255} 0 0 0 0 0 ${g / 255} 0 0 0 0 0 ${b / 255} 0 0 0 0 0 ${e.opacity} 0`;
    if (e.type === 'DROP_SHADOW') {
      parts.push(
        <React.Fragment key={i}>
          {e.spread ? <feMorphology in="SourceAlpha" operator={e.spread > 0 ? 'dilate' : 'erode'} radius={Math.abs(e.spread)} result={`sp${i}`} /> : null}
          <feOffset in={e.spread ? `sp${i}` : 'SourceAlpha'} dx={e.x} dy={e.y} result={`of${i}`} />
          <feGaussianBlur in={`of${i}`} stdDeviation={e.blur / 2} result={`bl${i}`} />
          <feColorMatrix in={`bl${i}`} type="matrix" values={col} result={`ds${i}`} />
        </React.Fragment>,
      );
      merges.unshift(`ds${i}`);
    }
  });
  let src = 'SourceGraphic';
  const after: React.ReactNode[] = [];
  vis.forEach((e, i) => {
    const { r, g, b } = hexToRgb(e.color);
    if (e.type === 'INNER_SHADOW') {
      after.push(
        <React.Fragment key={'i' + i}>
          <feComponentTransfer in="SourceAlpha" result={`inv${i}`}><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
          <feOffset in={`inv${i}`} dx={e.x} dy={e.y} result={`io${i}`} />
          <feGaussianBlur in={`io${i}`} stdDeviation={e.blur / 2} result={`ib${i}`} />
          <feComposite in={`ib${i}`} in2="SourceAlpha" operator="in" result={`ic${i}`} />
          <feColorMatrix in={`ic${i}`} type="matrix" values={`0 0 0 0 ${r / 255} 0 0 0 0 ${g / 255} 0 0 0 0 ${b / 255} 0 0 0 ${e.opacity} 0`} result={`is${i}`} />
          <feMerge result={`im${i}`}><feMergeNode in={src} /><feMergeNode in={`is${i}`} /></feMerge>
        </React.Fragment>,
      );
      src = `im${i}`;
    }
  });
  const blur = vis.find((e) => e.type === 'LAYER_BLUR');
  return (
    <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
      {parts}
      {after}
      {blur ? <feGaussianBlur in={src} stdDeviation={blur.blur / 2} result="lb" /> : null}
      <feMerge>
        {merges.map((m) => <feMergeNode key={m} in={m} />)}
        <feMergeNode in={blur ? 'lb' : src} />
      </feMerge>
    </filter>
  );
}

function Marker({ id, kind, color, w }: { id: string; kind: string; color: string; w: number }) {
  const s = Math.max(1, w);
  if (kind === 'ARROW') return (
    <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth={Math.max(4, 6 * s / s) } markerHeight={6} orient="auto-start-reverse" markerUnits="strokeWidth">
      <path d="M1 1L9 5L1 9" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </marker>
  );
  if (kind === 'TRIANGLE') return (
    <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth={5} markerHeight={5} orient="auto-start-reverse" markerUnits="strokeWidth">
      <path d="M0 0L10 5L0 10Z" fill={color} />
    </marker>
  );
  if (kind === 'CIRCLE') return (
    <marker id={id} viewBox="0 0 10 10" refX="5" refY="5" markerWidth={4} markerHeight={4} orient="auto" markerUnits="strokeWidth">
      <circle cx="5" cy="5" r="4" fill={color} />
    </marker>
  );
  return null;
}

function TextBody({ n, fillRef }: { n: SceneNode; fillRef: { fill: string; fillOpacity: number } | null }) {
  const t = n.text!;
  const wrap = t.autoResize === 'WIDTH_AND_HEIGHT' ? null : n.width;
  const l = layoutText(t, wrap);
  const lh = resolveLineHeight(t);
  let lines = l.lines;
  if (t.autoResize === 'TRUNCATE') {
    const maxLines = Math.max(1, Math.floor(n.height / lh));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = { ...last, text: last.text.replace(/.{0,2}$/, '') + '…' };
    }
  }
  const totalH = l.height;
  let y0 = 0;
  if (t.verticalAlign === 'CENTER') y0 = (n.height - totalH) / 2;
  else if (t.verticalAlign === 'BOTTOM') y0 = n.height - totalH;
  const anchor = t.textAlign === 'CENTER' ? 'middle' : t.textAlign === 'RIGHT' ? 'end' : 'start';
  const boxW = wrap == null ? l.width : n.width;
  const ax = t.textAlign === 'CENTER' ? boxW / 2 : t.textAlign === 'RIGHT' ? boxW : 0;
  const deco = t.decoration === 'UNDERLINE' ? 'underline' : t.decoration === 'STRIKETHROUGH' ? 'line-through' : undefined;
  const baselineOffset = (lh - t.fontSize) / 2 + t.fontSize * 0.8;
  return (
    <text
      fontFamily={`"${t.fontFamily}", Inter, sans-serif`}
      fontSize={t.fontSize}
      fontWeight={t.fontWeight}
      fontStyle={t.italic ? 'italic' : undefined}
      letterSpacing={`${(t.letterSpacing / 100) * t.fontSize}px`}
      textDecoration={deco}
      textAnchor={anchor}
      fill={fillRef?.fill ?? 'transparent'}
      fillOpacity={fillRef?.fillOpacity}
      style={{ whiteSpace: 'pre', userSelect: 'none' }}
    >
      {lines.map((line, i) => {
        const y = y0 + i * lh + line.para * t.paragraphSpacing + baselineOffset;
        const bullet = line.bullet;
        if (bullet && t.textAlign === 'LEFT') {
          const indent = t.fontSize * 1.4;
          return (
            <React.Fragment key={i}>
              {bullet.trim() ? <tspan x={0} y={y}>{bullet.trim()}</tspan> : null}
              <tspan x={indent} y={y}>{line.text || ' '}</tspan>
            </React.Fragment>
          );
        }
        return <tspan key={i} x={ax} y={y}>{(bullet && bullet.trim() ? bullet : '') + (line.text || ' ')}</tspan>;
      })}
    </text>
  );
}

export function transformFor(n: SceneNode) {
  const parts = [`translate(${n.x} ${n.y})`];
  if (n.rotation) parts.push(`rotate(${n.rotation} ${n.width / 2} ${n.height / 2})`);
  if (n.flipX || n.flipY) parts.push(`translate(${n.flipX ? n.width : 0} ${n.flipY ? n.height : 0}) scale(${n.flipX ? -1 : 1} ${n.flipY ? -1 : 1})`);
  return parts.join(' ');
}

function ChildrenWithMasks({ ids, uidBase }: { ids: string[]; uidBase: string }) {
  const { useNodes } = useContext(RenderCtx);
  // mask applies to all siblings above it
  const out: React.ReactNode[] = [];
  let i = 0;
  const list = useNodes(ids);
  const nodes = ids.map((id, k) => ({ id, n: list[k] }));
  while (i < nodes.length) {
    const cur = nodes[i];
    if (cur.n?.isMask && cur.n.visible) {
      const rest = nodes.slice(i + 1).map((x) => x.id);
      const mid = `${uidBase}-m-${cur.id}`;
      out.push(
        <React.Fragment key={cur.id}>
          <defs>
            <mask id={mid} style={{ maskType: 'alpha' } as React.CSSProperties} maskUnits="userSpaceOnUse" x={-1e5} y={-1e5} width={2e5} height={2e5}>
              <SvgNode id={cur.id} asMask />
            </mask>
          </defs>
          <g mask={`url(#${mid})`}>{rest.map((r) => <SvgNode key={r} id={r} />)}</g>
        </React.Fragment>,
      );
      return <>{out}</>;
    }
    out.push(<SvgNode key={cur.id} id={cur.id} />);
    i++;
  }
  return <>{out}</>;
}

function GridOverlay({ n }: { n: SceneNode }) {
  const out: React.ReactNode[] = [];
  n.layoutGrids.filter((g) => g.visible).forEach((g) => {
    const col = g.color;
    if (g.pattern === 'GRID') {
      const lines: React.ReactNode[] = [];
      for (let x = g.size; x < n.width; x += g.size) lines.push(<line key={'x' + x} x1={x} y1={0} x2={x} y2={n.height} stroke={col} strokeOpacity={g.opacity * 2} strokeWidth={1} vectorEffect="non-scaling-stroke" />);
      for (let y = g.size; y < n.height; y += g.size) lines.push(<line key={'y' + y} x1={0} y1={y} x2={n.width} y2={y} stroke={col} strokeOpacity={g.opacity * 2} strokeWidth={1} vectorEffect="non-scaling-stroke" />);
      out.push(<g key={g.id}>{lines}</g>);
    } else {
      const horiz = g.pattern === 'COLUMNS';
      const total = horiz ? n.width : n.height;
      const count = Math.max(1, g.count);
      const size = (total - g.margin * 2 - g.gutter * (count - 1)) / count;
      const rects: React.ReactNode[] = [];
      for (let i = 0; i < count; i++) {
        const p = g.margin + i * (size + g.gutter);
        rects.push(horiz
          ? <rect key={i} x={p} y={0} width={Math.max(0, size)} height={n.height} fill={col} fillOpacity={g.opacity} />
          : <rect key={i} x={0} y={p} width={n.width} height={Math.max(0, size)} fill={col} fillOpacity={g.opacity} />);
      }
      out.push(<g key={g.id}>{rects}</g>);
    }
  });
  return <g pointerEvents="none" data-grid="1">{out}</g>;
}

function BooleanBody({ n, uidBase }: { n: SceneNode; uidBase: string }) {
  const { useNodes } = useContext(RenderCtx);
  const kids = useNodes(n.children).filter((k): k is SceneNode => !!k && k.visible);
  const op = n.booleanOp ?? 'UNION';
  const shape = (k: SceneNode, color: string, extra: React.SVGProps<SVGPathElement> = {}) => (
    <path key={k.id} d={nodePath(k)} transform={transformFor(k)} fill={color} {...extra} />
  );
  const mid = `${uidBase}-bool`;
  let maskBody: React.ReactNode;
  let clip: React.ReactNode = null;
  if (op === 'UNION') maskBody = kids.map((k) => shape(k, 'white'));
  else if (op === 'SUBTRACT') maskBody = kids.map((k, i) => shape(k, i === 0 ? 'white' : 'black'));
  else if (op === 'INTERSECT') {
    maskBody = kids.slice(0, 1).map((k) => shape(k, 'white'));
    clip = kids.slice(1).map((k) => (
      <clipPath key={k.id} id={`${mid}-c-${k.id}`}><path d={nodePath(k)} transform={transformFor(k)} /></clipPath>
    ));
  } else maskBody = <g style={{ isolation: 'isolate' }}>{kids.map((k) => shape(k, 'white', { style: { mixBlendMode: 'difference' } }))}</g>;
  const fills = n.fills.filter((f) => f.visible);
  let body: React.ReactNode = (
    <g mask={`url(#${mid})`}>
      {fills.map((f, i) => <rect key={f.id} x={0} y={0} width={n.width} height={n.height} {...paintAttr(f, `${uidBase}-bf${i}`)} style={{ mixBlendMode: cssBlend(f.blendMode) as React.CSSProperties['mixBlendMode'] }} />)}
    </g>
  );
  if (op === 'INTERSECT') for (const k of kids.slice(1)) body = <g clipPath={`url(#${mid}-c-${k.id})`}>{body}</g>;
  return (
    <>
      <defs>
        {fills.map((f, i) => <PaintDef key={f.id} id={`${uidBase}-bf${i}`} p={f} n={n} />)}
        <mask id={mid} maskUnits="userSpaceOnUse" x={-1e5} y={-1e5} width={2e5} height={2e5}>
          <rect x={-1e5} y={-1e5} width={2e5} height={2e5} fill="black" />
          {maskBody}
        </mask>
        {clip}
      </defs>
      {body}
      {/* hit areas for children */}
      <g opacity={0}>{n.children.map((id) => <SvgNode key={id} id={id} />)}</g>
    </>
  );
}

export const SvgNode = memo(function SvgNode({ id, asMask }: { id: string; asMask?: boolean }) {
  const { useNode, opts } = useContext(RenderCtx);
  const n = useNode(id);
  if (!n || !n.visible) return null;
  if (opts.hideIds?.has(id)) return null;
  if (n.type === 'SLICE') {
    return opts.interactive && !opts.exportMode
      ? <g data-id={n.id} transform={transformFor(n)}><rect width={n.width} height={n.height} fill="transparent" stroke="#999" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" pointerEvents="all" /></g>
      : null;
  }
  const uidBase = `${opts.prefix}-${n.id}`;
  const d = nodePath(n);
  const isText = n.type === 'TEXT';
  const isContainer = n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'SECTION' || n.type === 'COMPONENT_SET';
  const isLineLike = n.type === 'LINE' || (n.type === 'VECTOR' && !n.closed);
  const visFills = n.fills.filter((f) => f.visible);
  const visStrokes = n.strokes.filter((s) => s.visible);
  const hasEffects = n.effects.some((e) => e.visible && e.type !== 'BACKGROUND_BLUR');
  const filterId = `${uidBase}-fx`;
  const clipId = `${uidBase}-clip`;
  const strokeClip = `${uidBase}-sclip`;
  const strokeMask = `${uidBase}-smask`;
  const outlines = opts.outlines;
  const sw = n.strokeWeight;
  const markerStart = n.startCap && n.startCap !== 'NONE' ? `${uidBase}-ms` : null;
  const markerEnd = n.endCap && n.endCap !== 'NONE' ? `${uidBase}-me` : null;
  const strokeColor = visStrokes[0]?.type === 'SOLID' ? visStrokes[0].color : '#000';
  const dash = n.strokeDash.length ? n.strokeDash.join(' ') : undefined;
  const cap = n.strokeCap === 'ROUND' ? 'round' : n.strokeCap === 'SQUARE' ? 'square' : 'butt';

  const style: React.CSSProperties = {};
  if (n.blendMode && n.blendMode !== 'PASS_THROUGH' && n.blendMode !== 'NORMAL') style.mixBlendMode = cssBlend(n.blendMode) as React.CSSProperties['mixBlendMode'];
  const bgBlur = n.effects.find((e) => e.visible && e.type === 'BACKGROUND_BLUR');

  if (outlines && !asMask) {
    return (
      <g data-id={opts.interactive ? n.id : undefined} transform={transformFor(n)}>
        {n.type === 'GROUP' ? null : isText
          ? <rect width={n.width} height={n.height} fill="none" stroke="#000" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="all" fillOpacity={0} />
          : <path d={d} fill="transparent" stroke="#000" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="all" />}
        {n.children.map((c) => <SvgNode key={c} id={c} />)}
      </g>
    );
  }

  const fillLayers = visFills.map((f, i) => {
    const pid = `${uidBase}-f${i}`;
    const blend = f.blendMode && f.blendMode !== 'NORMAL' ? { mixBlendMode: cssBlend(f.blendMode) as React.CSSProperties['mixBlendMode'] } : undefined;
    return <path key={f.id} d={d} {...paintAttr(f, pid)} style={blend} fillRule={n.type === 'VECTOR' ? 'evenodd' : undefined} />;
  });

  const strokeLayers = visStrokes.map((s, i) => {
    const pid = `${uidBase}-s${i}`;
    const paint = s.type === 'SOLID' ? s.color : `url(#${pid})`;
    const align = isLineLike || isText ? 'CENTER' : n.strokeAlign;
    const w = align === 'CENTER' ? sw : sw * 2;
    const common = {
      d, fill: 'none', stroke: paint, strokeOpacity: s.opacity, strokeWidth: w, strokeDasharray: dash, strokeLinecap: cap as 'butt',
      strokeLinejoin: 'round' as const,
    };
    if (align === 'INSIDE') return <path key={s.id} {...common} clipPath={`url(#${strokeClip})`} />;
    if (align === 'OUTSIDE') return <path key={s.id} {...common} mask={`url(#${strokeMask})`} />;
    return <path key={s.id} {...common} markerStart={markerStart ? `url(#${markerStart})` : undefined} markerEnd={markerEnd ? `url(#${markerEnd})` : undefined} />;
  });

  const defs = (
    <defs>
      {visFills.map((f, i) => f.type !== 'SOLID' ? <PaintDef key={f.id} id={`${uidBase}-f${i}`} p={f} n={n} /> : null)}
      {visStrokes.map((f, i) => f.type !== 'SOLID' ? <PaintDef key={f.id} id={`${uidBase}-s${i}`} p={f} n={n} /> : null)}
      {hasEffects ? <EffectFilter id={filterId} effects={n.effects} /> : null}
      {isContainer && n.clipContent ? <clipPath id={clipId}><path d={d} /></clipPath> : null}
      {visStrokes.length && !isLineLike && n.strokeAlign === 'INSIDE' ? <clipPath id={strokeClip}><path d={d} /></clipPath> : null}
      {visStrokes.length && !isLineLike && n.strokeAlign === 'OUTSIDE' ? (
        <mask id={strokeMask} maskUnits="userSpaceOnUse" x={-sw * 2 - 10} y={-sw * 2 - 10} width={n.width + sw * 4 + 20} height={n.height + sw * 4 + 20}>
          <rect x={-sw * 2 - 10} y={-sw * 2 - 10} width={n.width + sw * 4 + 20} height={n.height + sw * 4 + 20} fill="white" />
          <path d={d} fill="black" />
        </mask>
      ) : null}
      {markerStart ? <Marker id={markerStart} kind={n.startCap!} color={strokeColor} w={sw} /> : null}
      {markerEnd ? <Marker id={markerEnd} kind={n.endCap!} color={strokeColor} w={sw} /> : null}
    </defs>
  );

  let body: React.ReactNode;
  if (n.type === 'BOOLEAN_OPERATION') {
    body = <BooleanBody n={n} uidBase={uidBase} />;
  } else if (isText) {
    const f = visFills[0];
    const fillRef = f ? paintAttr(f, `${uidBase}-f0`) : null;
    body = (
      <>
        {opts.interactive ? <rect width={n.width} height={n.height} fill="transparent" pointerEvents="all" /> : null}
        <TextBody n={n} fillRef={fillRef} />
      </>
    );
  } else if (n.type === 'GROUP') {
    body = <ChildrenWithMasks ids={n.children} uidBase={uidBase} />;
  } else {
    const isTopContainer = isContainer;
    body = (
      <>
        {bgBlur && !opts.exportMode ? (
          <foreignObject width={n.width} height={n.height} pointerEvents="none">
            <div style={{ width: '100%', height: '100%', backdropFilter: `blur(${bgBlur.blur / 2}px)`, WebkitBackdropFilter: `blur(${bgBlur.blur / 2}px)`, borderRadius: cornerRadii(n)[0] }} />
          </foreignObject>
        ) : null}
        {isTopContainer && opts.interactive ? <path d={d} fill="transparent" pointerEvents="all" /> : null}
        {fillLayers}
        {isContainer ? (
          <g clipPath={n.clipContent ? `url(#${clipId})` : undefined}>
            <ChildrenWithMasks ids={n.children} uidBase={uidBase} />
          </g>
        ) : null}
        {isLineLike && opts.interactive ? <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(sw, 8 / (opts.zoom ?? 1))} pointerEvents="stroke" /> : null}
        {strokeLayers}
        {opts.showGrids && n.layoutGrids.length && isContainer ? <GridOverlay n={n} /> : null}
      </>
    );
  }

  return (
    <g
      data-id={opts.interactive ? n.id : undefined}
      data-type={opts.interactive ? n.type : undefined}
      transform={transformFor(n)}
      opacity={n.opacity < 1 ? n.opacity : undefined}
      filter={hasEffects ? `url(#${filterId})` : undefined}
      style={style}
    >
      {defs}
      {body}
    </g>
  );
});

export function StaticRenderRoot({ nodes, children, opts }: { nodes: Record<string, SceneNode>; children?: React.ReactNode; opts: RenderOptions }) {
  const value = { useNode: (id: string) => nodes[id], useNodes: (ids: string[]) => ids.map((id) => nodes[id]), opts };
  return <RenderCtx.Provider value={value}>{children}</RenderCtx.Provider>;
}

export { rectPath };
