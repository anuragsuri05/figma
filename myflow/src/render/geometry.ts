import type { SceneNode, VectorPoint } from '../model/types';

export function polygonPoints(n: Pick<SceneNode, 'width' | 'height' | 'pointCount' | 'innerRadius' | 'type'>): VectorPoint[] {
  const count = Math.max(3, n.pointCount ?? 3);
  const cx = n.width / 2, cy = n.height / 2;
  const pts: VectorPoint[] = [];
  if (n.type === 'STAR') {
    const ratio = n.innerRadius ?? 0.38;
    for (let i = 0; i < count * 2; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / count;
      const r = i % 2 === 0 ? 1 : ratio;
      pts.push({ x: cx + Math.cos(a) * cx * r, y: cy + Math.sin(a) * cy * r });
    }
  } else {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
      pts.push({ x: cx + Math.cos(a) * cx, y: cy + Math.sin(a) * cy });
    }
  }
  return pts;
}

export function cornerRadii(n: SceneNode): [number, number, number, number] {
  const max = Math.min(n.width, n.height) / 2;
  const c = n.corners ?? [n.cornerRadius, n.cornerRadius, n.cornerRadius, n.cornerRadius];
  return c.map((r) => Math.max(0, Math.min(max, r || 0))) as [number, number, number, number];
}

export function rectPath(w: number, h: number, r: [number, number, number, number], smoothing = 0): string {
  const [tl, tr, br, bl] = r;
  if (!tl && !tr && !br && !bl) return `M0 0H${w}V${h}H0Z`;
  const k = 0.5523 + smoothing * 0.25; // smoothing approximation
  const c = (rad: number) => rad * (1 - k);
  return [
    `M${tl} 0`,
    `H${w - tr}`,
    tr ? `C${w - c(tr)} 0 ${w} ${c(tr)} ${w} ${tr}` : '',
    `V${h - br}`,
    br ? `C${w} ${h - c(br)} ${w - c(br)} ${h} ${w - br} ${h}` : '',
    `H${bl}`,
    bl ? `C${c(bl)} ${h} 0 ${h - c(bl)} 0 ${h - bl}` : '',
    `V${tl}`,
    tl ? `C0 ${c(tl)} ${c(tl)} 0 ${tl} 0` : '',
    'Z',
  ].join(' ');
}

export function ellipsePath(n: SceneNode): string {
  const rx = n.width / 2, ry = n.height / 2;
  const sweep = n.arcSweep ?? 360;
  const inner = n.arcInner ?? 0;
  if (sweep >= 360 && inner <= 0) {
    return `M${rx} 0 A${rx} ${ry} 0 1 1 ${rx} ${n.height} A${rx} ${ry} 0 1 1 ${rx} 0Z`;
  }
  const start = ((n.arcStart ?? 0) * Math.PI) / 180;
  const end = start + (Math.min(sweep, 359.99) * Math.PI) / 180;
  const pt = (a: number, f: number) => `${rx + Math.cos(a) * rx * f} ${ry + Math.sin(a) * ry * f}`;
  const large = sweep > 180 ? 1 : 0;
  if (sweep >= 360) {
    // donut
    const irx = rx * inner, iry = ry * inner;
    return `M${rx} 0 A${rx} ${ry} 0 1 1 ${rx} ${n.height} A${rx} ${ry} 0 1 1 ${rx} 0Z M${rx} ${ry - iry} A${irx} ${iry} 0 1 0 ${rx} ${ry + iry} A${irx} ${iry} 0 1 0 ${rx} ${ry - iry}Z`;
  }
  if (inner > 0) {
    return `M${pt(start, 1)} A${rx} ${ry} 0 ${large} 1 ${pt(end, 1)} L${pt(end, inner)} A${rx * inner} ${ry * inner} 0 ${large} 0 ${pt(start, inner)}Z`;
  }
  return `M${rx} ${ry} L${pt(start, 1)} A${rx} ${ry} 0 ${large} 1 ${pt(end, 1)}Z`;
}

export function pointsPath(points: VectorPoint[], closed: boolean): string {
  if (!points.length) return '';
  let d = `M${points[0].x} ${points[0].y}`;
  const seg = (a: VectorPoint, b: VectorPoint) => {
    if (a.outX !== undefined || b.inX !== undefined) {
      const c1x = a.x + (a.outX ?? 0), c1y = a.y + (a.outY ?? 0);
      const c2x = b.x + (b.inX ?? 0), c2y = b.y + (b.inY ?? 0);
      return ` C${c1x} ${c1y} ${c2x} ${c2y} ${b.x} ${b.y}`;
    }
    return ` L${b.x} ${b.y}`;
  };
  for (let i = 1; i < points.length; i++) d += seg(points[i - 1], points[i]);
  if (closed && points.length > 2) d += seg(points[points.length - 1], points[0]) + ' Z';
  return d;
}

export function nodePath(n: SceneNode): string {
  switch (n.type) {
    case 'ELLIPSE': return ellipsePath(n);
    case 'POLYGON':
    case 'STAR': return pointsPath(polygonPoints(n), true);
    case 'LINE':
    case 'VECTOR': return pointsPath(n.points ?? [], !!n.closed);
    default: return rectPath(n.width, n.height, cornerRadii(n), n.cornerSmoothing);
  }
}

export function shapeToPoints(n: SceneNode): VectorPoint[] {
  if (n.type === 'POLYGON' || n.type === 'STAR') return polygonPoints(n);
  if (n.type === 'ELLIPSE') {
    const rx = n.width / 2, ry = n.height / 2, k = 0.5523;
    return [
      { x: rx, y: 0, inX: -rx * k, inY: 0, outX: rx * k, outY: 0 },
      { x: n.width, y: ry, inX: 0, inY: -ry * k, outX: 0, outY: ry * k },
      { x: rx, y: n.height, inX: rx * k, inY: 0, outX: -rx * k, outY: 0 },
      { x: 0, y: ry, inX: 0, inY: ry * k, outX: 0, outY: -ry * k },
    ];
  }
  return [{ x: 0, y: 0 }, { x: n.width, y: 0 }, { x: n.width, y: n.height }, { x: 0, y: n.height }];
}

/** Normalize points so bbox starts at 0,0. Returns offset and size. */
export function normalizePoints(points: VectorPoint[]) {
  const xs: number[] = [], ys: number[] = [];
  for (const p of points) {
    xs.push(p.x); ys.push(p.y);
    if (p.inX !== undefined) { xs.push(p.x + p.inX); ys.push(p.y + (p.inY ?? 0)); }
    if (p.outX !== undefined) { xs.push(p.x + p.outX); ys.push(p.y + (p.outY ?? 0)); }
  }
  const minX = Math.min(...points.map((p) => p.x)), minY = Math.min(...points.map((p) => p.y));
  const maxX = Math.max(...points.map((p) => p.x)), maxY = Math.max(...points.map((p) => p.y));
  const pts = points.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY }));
  return { points: pts, x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function simplifyStroke(points: { x: number; y: number }[], tolerance = 1.5) {
  if (points.length < 3) return points;
  const sqTol = tolerance * tolerance;
  const out = [points[0]];
  let prev = points[0];
  for (const p of points.slice(1)) {
    const dx = p.x - prev.x, dy = p.y - prev.y;
    if (dx * dx + dy * dy > sqTol) { out.push(p); prev = p; }
  }
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

/** Catmull-Rom → cubic handles for smooth pencil strokes */
export function smoothPoints(raw: { x: number; y: number }[]): VectorPoint[] {
  const pts = simplifyStroke(raw, 3);
  return pts.map((p, i) => {
    const p0 = pts[i - 1] ?? p, p2 = pts[i + 1] ?? p;
    const tx = (p2.x - p0.x) / 6, ty = (p2.y - p0.y) / 6;
    if (i === 0 || i === pts.length - 1) return { x: p.x, y: p.y };
    return { x: p.x, y: p.y, inX: -tx, inY: -ty, outX: tx, outY: ty };
  });
}
