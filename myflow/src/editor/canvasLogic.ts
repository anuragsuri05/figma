import type { DocumentData, SceneNode } from '../model/types';
import { absRect, ancestors, visualAbsRect, rectsIntersect, rectContains, type Rect } from '../model/tree';
import { S, currentPage } from '../store/editor';

export const isFrameLike = (n: SceneNode) => n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'COMPONENT_SET';

/** container acts like canvas (children selected directly) */
export function isTransparent(doc: DocumentData, n: SceneNode): boolean {
  if (n.type === 'SECTION') return true;
  if (isFrameLike(n)) {
    const p = n.parentId ? doc.nodes[n.parentId] : null;
    if (!p || p.type === 'SECTION') return true;
    if (p.type === 'COMPONENT_SET') return true;
  }
  return false;
}

export function chainOf(doc: DocumentData, id: string): SceneNode[] {
  const chain = [doc.nodes[id], ...ancestors(doc, id)].filter(Boolean);
  return chain.reverse(); // root first
}

/** Resolve which node a click on `hitId` should select (Figma rules). Returns null for "empty". */
export function pickTarget(doc: DocumentData, hitId: string | null, opts: { deep?: boolean; selection: string[]; forHover?: boolean }): string | null {
  if (!hitId || !doc.nodes[hitId]) return null;
  const chain = chainOf(doc, hitId);
  if (opts.deep) {
    const hit = doc.nodes[hitId];
    return hit.locked ? null : hitId;
  }
  const parents = new Set(opts.selection.map((id) => doc.nodes[id]?.parentId).filter(Boolean) as string[]);
  const selSet = new Set(opts.selection);
  // already inside a context: select sibling-level items
  for (let i = 0; i < chain.length; i++) {
    if (parents.has(chain[i].id) && !isTransparent(doc, chain[i])) {
      const t = chain[i + 1] ?? chain[i];
      return t.locked ? null : t.id;
    }
    if (selSet.has(chain[i].id) && !(isTransparent(doc, chain[i]) && i < chain.length - 1)) {
      // clicking a descendant of a selected node keeps selecting that node
      return chain[i].id;
    }
  }
  let i = 0;
  while (i < chain.length - 1 && isTransparent(doc, chain[i])) i++;
  const t = chain[i];
  // clicking the empty area of a transparent container with children = empty canvas
  if (i === chain.length - 1 && isTransparent(doc, t) && t.children.length && t.id === hitId) {
    return null;
  }
  if (t.locked || chain.slice(0, i).some((c) => c.locked)) return null;
  return t.id;
}

/** the container whose children a marquee started at the given hit should select */
export function marqueeScope(doc: DocumentData, hitId: string | null): string | null {
  if (!hitId) return null;
  const chain = chainOf(doc, hitId);
  let scope: string | null = null;
  for (const c of chain) {
    if (isTransparent(doc, c) && c.children.length) scope = c.id; else break;
  }
  return scope;
}

export function marqueeSelect(doc: DocumentData, scope: string | null, r: Rect): string[] {
  const page = currentPage();
  const ids = scope ? doc.nodes[scope].children : page.children;
  const out: string[] = [];
  for (const id of ids) {
    const n = doc.nodes[id];
    if (!n || !n.visible || n.locked) continue;
    const nr = visualAbsRect(doc, id);
    const top = !scope;
    if (top && (isFrameLike(n) || n.type === 'SECTION')) {
      if (rectContains(r, nr)) out.push(id);
      else if (rectsIntersect(r, nr) && n.children.length && !rectContains(nr, r)) {
        // partially covering a frame: select its children instead
      }
    } else if (rectsIntersect(r, nr)) out.push(id);
  }
  if (!out.length && !scope) {
    // marquee inside a frame region started on page: select children of frames that intersect
    for (const id of ids) {
      const n = doc.nodes[id];
      if (!n || !isFrameLike(n) && n.type !== 'SECTION') continue;
      if (!rectsIntersect(r, visualAbsRect(doc, id))) continue;
      for (const c of n.children) {
        const cn = doc.nodes[c];
        if (cn?.visible && !cn.locked && rectsIntersect(r, visualAbsRect(doc, c))) out.push(c);
      }
    }
  }
  return out;
}

export interface SnapResult { dx: number; dy: number; guides: { x1: number; y1: number; x2: number; y2: number }[] }

export function computeSnap(doc: DocumentData, moving: Rect, exclude: Set<string>, parentId: string | null, threshold: number): SnapResult {
  const page = currentPage();
  const siblings = (parentId ? doc.nodes[parentId]?.children : page.children) ?? [];
  const targets: Rect[] = [];
  for (const id of siblings) {
    if (exclude.has(id)) continue;
    const n = doc.nodes[id];
    if (!n?.visible) continue;
    targets.push(visualAbsRect(doc, id));
  }
  if (parentId && doc.nodes[parentId]) targets.push(absRect(doc, parentId));
  // also top-level frames children for a top-level move
  const xs = (r: Rect) => [r.x, r.x + r.width / 2, r.x + r.width];
  const ys = (r: Rect) => [r.y, r.y + r.height / 2, r.y + r.height];
  let bestX: { d: number; v: number; t: Rect } | null = null;
  let bestY: { d: number; v: number; t: Rect } | null = null;
  for (const t of targets) {
    for (const mx of xs(moving)) for (const tx of xs(t)) {
      const d = tx - mx;
      if (Math.abs(d) <= threshold && (!bestX || Math.abs(d) < Math.abs(bestX.d))) bestX = { d, v: tx, t };
    }
    for (const my of ys(moving)) for (const ty of ys(t)) {
      const d = ty - my;
      if (Math.abs(d) <= threshold && (!bestY || Math.abs(d) < Math.abs(bestY.d))) bestY = { d, v: ty, t };
    }
  }
  const guides: SnapResult['guides'] = [];
  const m2 = { ...moving, x: moving.x + (bestX?.d ?? 0), y: moving.y + (bestY?.d ?? 0) };
  if (bestX) {
    const t = bestX.t;
    guides.push({ x1: bestX.v, y1: Math.min(t.y, m2.y), x2: bestX.v, y2: Math.max(t.y + t.height, m2.y + m2.height) });
  }
  if (bestY) {
    const t = bestY.t;
    guides.push({ x1: Math.min(t.x, m2.x), y1: bestY.v, x2: Math.max(t.x + t.width, m2.x + m2.width), y2: bestY.v });
  }
  return { dx: bestX?.d ?? 0, dy: bestY?.d ?? 0, guides };
}

export function autoLayoutIndex(doc: DocumentData, parentId: string, wx: number, wy: number, exclude: Set<string>): number {
  const p = doc.nodes[parentId];
  const kids = p.children.filter((c) => !exclude.has(c) && doc.nodes[c]?.visible && !doc.nodes[c].absolutePosition);
  const horiz = p.layout.mode === 'HORIZONTAL' || p.layout.mode === 'WRAP';
  let idx = kids.length;
  for (let i = 0; i < kids.length; i++) {
    const r = absRect(doc, kids[i]);
    if (p.layout.mode === 'WRAP') {
      if (wy < r.y + r.height && (wy < r.y || wx < r.x + r.width / 2)) { idx = i; break; }
    } else if (horiz ? wx < r.x + r.width / 2 : wy < r.y + r.height / 2) { idx = i; break; }
  }
  // convert index among filtered kids into index in full children list
  if (idx >= kids.length) return p.children.length;
  return p.children.indexOf(kids[idx]);
}

export function autoLayoutIndicator(doc: DocumentData, parentId: string, index: number, exclude: Set<string>): { x1: number; y1: number; x2: number; y2: number } | null {
  const p = doc.nodes[parentId];
  const pr = absRect(doc, parentId);
  const kids = p.children.filter((c) => !exclude.has(c) && doc.nodes[c]?.visible && !doc.nodes[c].absolutePosition);
  const horiz = p.layout.mode !== 'VERTICAL';
  const target = p.children[index];
  const ki = target ? kids.indexOf(target) : kids.length;
  if (!kids.length) return horiz ? { x1: pr.x + p.layout.paddingLeft, y1: pr.y + 4, x2: pr.x + p.layout.paddingLeft, y2: pr.y + pr.height - 4 } : { x1: pr.x + 4, y1: pr.y + p.layout.paddingTop, x2: pr.x + pr.width - 4, y2: pr.y + p.layout.paddingTop };
  if (ki <= 0 || ki === -1) {
    const r = absRect(doc, kids[0]);
    return horiz ? { x1: r.x - p.layout.gap / 2, y1: r.y, x2: r.x - p.layout.gap / 2, y2: r.y + r.height } : { x1: r.x, y1: r.y - p.layout.gap / 2, x2: r.x + r.width, y2: r.y - p.layout.gap / 2 };
  }
  const r = absRect(doc, kids[ki - 1]);
  return horiz ? { x1: r.x + r.width + p.layout.gap / 2, y1: r.y, x2: r.x + r.width + p.layout.gap / 2, y2: r.y + r.height } : { x1: r.x, y1: r.y + r.height + p.layout.gap / 2, x2: r.x + r.width, y2: r.y + r.height + p.layout.gap / 2 };
}

export function isAutoLayoutParent(doc: DocumentData, id: string | null): boolean {
  if (!id) return false;
  const p = doc.nodes[id];
  return !!p && p.layout.mode !== 'NONE' && (p.type === 'FRAME' || p.type === 'COMPONENT' || p.type === 'INSTANCE');
}

export function rotatePoint(x: number, y: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) };
}

export function readOnly() { return S().mode === 'dev'; }
