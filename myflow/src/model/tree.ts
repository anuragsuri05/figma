import type { DocumentData, Page, SceneNode } from './types';
import { uid } from './defaults';

export interface Rect { x: number; y: number; width: number; height: number; }

export function getPageOf(doc: DocumentData, nodeId: string): Page | undefined {
  let n = doc.nodes[nodeId];
  while (n && n.parentId) n = doc.nodes[n.parentId];
  if (!n) return undefined;
  return doc.pages.find((p) => p.children.includes(n.id));
}

export function siblingsOf(doc: DocumentData, node: SceneNode, page: Page): string[] {
  return node.parentId ? doc.nodes[node.parentId].children : page.children;
}

export function ancestors(doc: DocumentData, id: string): SceneNode[] {
  const out: SceneNode[] = [];
  let n = doc.nodes[id];
  while (n && n.parentId) {
    n = doc.nodes[n.parentId];
    if (n) out.push(n);
  }
  return out; // nearest first
}

export function isAncestor(doc: DocumentData, maybeAncestor: string, id: string): boolean {
  let n = doc.nodes[id];
  while (n && n.parentId) {
    if (n.parentId === maybeAncestor) return true;
    n = doc.nodes[n.parentId];
  }
  return false;
}

export function absPos(doc: DocumentData, id: string): { x: number; y: number } {
  let x = 0, y = 0;
  let n: SceneNode | undefined = doc.nodes[id];
  while (n) {
    x += n.x; y += n.y;
    n = n.parentId ? doc.nodes[n.parentId] : undefined;
  }
  return { x, y };
}

export function absRect(doc: DocumentData, id: string): Rect {
  const n = doc.nodes[id];
  const p = absPos(doc, id);
  return { x: p.x, y: p.y, width: n.width, height: n.height };
}

/** Axis-aligned bounds of a rotated rect */
export function rotatedBounds(r: Rect, rotation: number): Rect {
  if (!rotation) return r;
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const w = r.width * cos + r.height * sin;
  const h = r.width * sin + r.height * cos;
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
}

export function visualAbsRect(doc: DocumentData, id: string): Rect {
  return rotatedBounds(absRect(doc, id), doc.nodes[id].rotation);
}

export function unionRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.width); y2 = Math.max(y2, r.y + r.height);
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function rectsIntersect(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function rectContains(a: Rect, b: Rect) {
  return b.x >= a.x && b.y >= a.y && b.x + b.width <= a.x + a.width && b.y + b.height <= a.y + a.height;
}

export function descendants(doc: DocumentData, id: string): string[] {
  const out: string[] = [];
  const walk = (nid: string) => {
    const n = doc.nodes[nid];
    if (!n) return;
    for (const c of n.children) { out.push(c); walk(c); }
  };
  walk(id);
  return out;
}

export function removeNode(doc: DocumentData, id: string) {
  const n = doc.nodes[id];
  if (!n) return;
  for (const c of [...n.children]) removeNode(doc, c);
  if (n.parentId) {
    const p = doc.nodes[n.parentId];
    if (p) p.children = p.children.filter((c) => c !== id);
  } else {
    for (const page of doc.pages) page.children = page.children.filter((c) => c !== id);
  }
  for (const page of doc.pages) page.flowStarts = page.flowStarts.filter((f) => f.nodeId !== id);
  delete doc.nodes[id];
}

export function insertNode(doc: DocumentData, node: SceneNode, parentId: string | null, page: Page, index?: number) {
  doc.nodes[node.id] = node;
  node.parentId = parentId;
  const list = parentId ? doc.nodes[parentId].children : page.children;
  if (index == null || index < 0 || index > list.length) list.push(node.id);
  else list.splice(index, 0, node.id);
}

/** Move node to a new parent keeping its absolute position. */
export function reparent(doc: DocumentData, id: string, newParentId: string | null, page: Page, index?: number) {
  const n = doc.nodes[id];
  const abs = absPos(doc, id);
  // remove from old
  if (n.parentId) {
    const op = doc.nodes[n.parentId];
    op.children = op.children.filter((c) => c !== id);
  } else {
    for (const pg of doc.pages) pg.children = pg.children.filter((c) => c !== id);
  }
  const parentAbs = newParentId ? absPos(doc, newParentId) : { x: 0, y: 0 };
  n.x = abs.x - parentAbs.x;
  n.y = abs.y - parentAbs.y;
  n.parentId = newParentId;
  const list = newParentId ? doc.nodes[newParentId].children : page.children;
  if (index == null || index < 0 || index > list.length) list.push(id);
  else list.splice(index, 0, id);
}

/** Deep clone subtree into doc (new ids). Returns new root id. Does NOT attach root to a parent list. */
export function cloneSubtree(doc: DocumentData, id: string, opts: { keepSource?: boolean; idMap?: Map<string, string>; srcDoc?: DocumentData } = {}): string {
  const src = opts.srcDoc ?? doc;
  const idMap = opts.idMap ?? new Map<string, string>();
  const copy = (nid: string, parentId: string | null): string => {
    const n = src.nodes[nid];
    const clone: SceneNode = JSON.parse(JSON.stringify(n));
    clone.id = uid('n');
    idMap.set(nid, clone.id);
    clone.parentId = parentId;
    clone.children = n.children.map((c) => copy(c, clone.id));
    doc.nodes[clone.id] = clone;
    return clone.id;
  };
  const rootId = copy(id, src.nodes[id].parentId);
  // remap prototype destinations within cloned set
  for (const [, newId] of idMap) {
    const n = doc.nodes[newId];
    n.reactions = n.reactions.map((r) => ({ ...r, id: uid('r'), destinationId: r.destinationId && idMap.has(r.destinationId) ? idMap.get(r.destinationId)! : r.destinationId }));
  }
  return rootId;
}

export function topLevelSelection(doc: DocumentData, ids: string[]): string[] {
  const set = new Set(ids);
  return ids.filter((id) => doc.nodes[id] && !ancestors(doc, id).some((a) => set.has(a.id)));
}

export function sortByTreeOrder(doc: DocumentData, page: Page, ids: string[]): string[] {
  const order = new Map<string, number>();
  let i = 0;
  const walk = (list: string[]) => {
    for (const id of list) {
      order.set(id, i++);
      const n = doc.nodes[id];
      if (n) walk(n.children);
    }
  };
  walk(page.children);
  return [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

export function isContainerType(t: SceneNode['type']) {
  return t === 'FRAME' || t === 'COMPONENT' || t === 'INSTANCE' || t === 'SECTION' || t === 'COMPONENT_SET';
}

export function canHaveChildrenDropped(n: SceneNode) {
  return n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'SECTION';
}

export function findMainComponentRoot(doc: DocumentData, id: string): SceneNode | undefined {
  let n: SceneNode | undefined = doc.nodes[id];
  while (n) {
    if (n.type === 'COMPONENT') return n;
    n = n.parentId ? doc.nodes[n.parentId] : undefined;
  }
  return undefined;
}

export function findInstanceRoot(doc: DocumentData, id: string): SceneNode | undefined {
  let n: SceneNode | undefined = doc.nodes[id];
  let found: SceneNode | undefined;
  while (n) {
    if (n.type === 'INSTANCE') found = n;
    n = n.parentId ? doc.nodes[n.parentId] : undefined;
  }
  return found;
}

/** nearest instance ancestor (or self) */
export function nearestInstance(doc: DocumentData, id: string): SceneNode | undefined {
  let n: SceneNode | undefined = doc.nodes[id];
  while (n) {
    if (n.type === 'INSTANCE') return n;
    n = n.parentId ? doc.nodes[n.parentId] : undefined;
  }
  return undefined;
}

export function allNodesInPage(doc: DocumentData, page: Page): string[] {
  const out: string[] = [];
  for (const id of page.children) { out.push(id); out.push(...descendants(doc, id)); }
  return out;
}
