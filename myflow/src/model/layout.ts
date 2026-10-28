import type { DocumentData, SceneNode, VariableCollection } from './types';
import { layoutText } from './text';
import { descendants, rotatedBounds, unionRects } from './tree';
import { uid } from './defaults';

/* ---------------------------------------------------------------- variables */

export function effectiveModeId(doc: DocumentData, nodeId: string | null, col: VariableCollection): string {
  let n: SceneNode | undefined = nodeId ? doc.nodes[nodeId] : undefined;
  while (n) {
    const m = n.variableModes?.[col.id];
    if (m && col.modes.some((x) => x.id === m)) return m;
    n = n.parentId ? doc.nodes[n.parentId] : undefined;
  }
  return col.modes[0]?.id;
}

export function resolveVariable(doc: DocumentData, varId: string, nodeId: string | null, depth = 0): string | number | boolean | undefined {
  if (depth > 10) return undefined;
  const v = doc.variables.find((x) => x.id === varId);
  if (!v) return undefined;
  const col = doc.collections.find((c) => c.id === v.collectionId);
  if (!col) return undefined;
  const mode = effectiveModeId(doc, nodeId, col);
  let val = v.values[mode];
  if (val === undefined) val = v.values[col.modes[0]?.id];
  if (val && typeof val === 'object' && 'alias' in val) return resolveVariable(doc, val.alias, nodeId, depth + 1);
  return val as string | number | boolean | undefined;
}

function applyBindings(doc: DocumentData, n: SceneNode) {
  for (const list of [n.fills, n.strokes]) {
    for (const p of list) {
      if (p.variableId) {
        const v = resolveVariable(doc, p.variableId, n.id);
        if (typeof v === 'string' && p.color !== v) p.color = v;
      }
    }
  }
  const b = n.boundVars;
  if (!b) return;
  const num = (id?: string) => {
    if (!id) return undefined;
    const v = resolveVariable(doc, id, n.id);
    return typeof v === 'number' ? v : typeof v === 'string' && !isNaN(+v) ? +v : undefined;
  };
  const cr = num(b.cornerRadius); if (cr !== undefined && n.cornerRadius !== cr) n.cornerRadius = cr;
  const gap = num(b.gap); if (gap !== undefined && n.layout.gap !== gap) n.layout.gap = gap;
  const pad = num(b.padding);
  if (pad !== undefined) {
    if (n.layout.paddingTop !== pad) n.layout.paddingTop = pad;
    if (n.layout.paddingRight !== pad) n.layout.paddingRight = pad;
    if (n.layout.paddingBottom !== pad) n.layout.paddingBottom = pad;
    if (n.layout.paddingLeft !== pad) n.layout.paddingLeft = pad;
  }
  const w = num(b.width); if (w !== undefined && n.width !== w) n.width = w;
  const h = num(b.height); if (h !== undefined && n.height !== h) n.height = h;
  const op = num(b.opacity); if (op !== undefined) { const o = op > 1 ? op / 100 : op; if (n.opacity !== o) n.opacity = o; }
  if (b.characters && n.text) {
    const v = resolveVariable(doc, b.characters, n.id);
    if (v !== undefined && n.text.characters !== String(v)) n.text.characters = String(v);
  }
  if (b.visible) {
    const v = resolveVariable(doc, b.visible, n.id);
    if (typeof v === 'boolean' && n.visible !== v) n.visible = v;
  }
}

/* ---------------------------------------------------------------- resize helpers */

function scalePoints(n: SceneNode, sx: number, sy: number) {
  if (!n.points) return;
  for (const p of n.points) {
    p.x *= sx; p.y *= sy;
    if (p.inX !== undefined) { p.inX *= sx; p.inY = (p.inY ?? 0) * sy; }
    if (p.outX !== undefined) { p.outX *= sx; p.outY = (p.outY ?? 0) * sy; }
  }
}

function clampSize(n: SceneNode, w: number, h: number) {
  if (n.minW != null) w = Math.max(n.minW, w);
  if (n.maxW != null) w = Math.min(n.maxW, w);
  if (n.minH != null) h = Math.max(n.minH, h);
  if (n.maxH != null) h = Math.min(n.maxH, h);
  return [w, h] as const;
}

/** Resize a node applying constraints/scaling to descendants. */
export function resizeNode(doc: DocumentData, id: string, newW: number, newH: number) {
  const n = doc.nodes[id];
  if (!n) return;
  [newW, newH] = clampSize(n, newW, newH);
  newW = Math.max(n.type === 'LINE' ? 0 : 0.01, newW);
  newH = Math.max(n.type === 'LINE' ? 0 : 0.01, newH);
  const oW = n.width, oH = n.height;
  if (oW === newW && oH === newH) return;
  const sx = oW ? newW / oW : 1;
  const sy = oH ? newH / oH : 1;
  n.width = newW; n.height = newH;
  scalePoints(n, sx, sy);
  if (n.type === 'GROUP' || n.type === 'BOOLEAN_OPERATION') {
    for (const cid of n.children) {
      const c = doc.nodes[cid];
      c.x *= sx; c.y *= sy;
      resizeNode(doc, cid, c.width * sx, c.height * sy);
      if (c.text && c.text.autoResize === 'WIDTH_AND_HEIGHT') c.text.autoResize = 'NONE';
    }
    return;
  }
  if ((n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'SECTION' || n.type === 'COMPONENT_SET') && (n.layout.mode === 'NONE' || n.type === 'SECTION')) {
    for (const cid of n.children) applyConstraint(doc, cid, oW, oH, newW, newH);
  } else if (n.layout.mode !== 'NONE') {
    for (const cid of n.children) if (doc.nodes[cid].absolutePosition) applyConstraint(doc, cid, oW, oH, newW, newH);
  }
}

export function applyConstraint(doc: DocumentData, cid: string, oW: number, oH: number, nW: number, nH: number) {
  const c = doc.nodes[cid];
  if (!c) return;
  const dw = nW - oW, dh = nH - oH;
  let w = c.width, h = c.height;
  switch (c.constraintH) {
    case 'RIGHT': c.x += dw; break;
    case 'LEFT_RIGHT': w = Math.max(0.01, c.width + dw); break;
    case 'CENTER': c.x += dw / 2; break;
    case 'SCALE': { const s = oW ? nW / oW : 1; c.x *= s; w = c.width * s; break; }
  }
  switch (c.constraintV) {
    case 'BOTTOM': c.y += dh; break;
    case 'TOP_BOTTOM': h = Math.max(0.01, c.height + dh); break;
    case 'CENTER': c.y += dh / 2; break;
    case 'SCALE': { const s = oH ? nH / oH : 1; c.y *= s; h = c.height * s; break; }
  }
  if (w !== c.width || h !== c.height) {
    if (c.text && w !== c.width && c.text.autoResize === 'WIDTH_AND_HEIGHT') c.text.autoResize = 'HEIGHT';
    resizeNode(doc, cid, w, h);
  }
}

/* ---------------------------------------------------------------- self layout */

function layoutTextNode(n: SceneNode) {
  const t = n.text!;
  if (n.sizingH === 'FILL' && t.autoResize === 'WIDTH_AND_HEIGHT') t.autoResize = 'HEIGHT';
  if (t.autoResize === 'WIDTH_AND_HEIGHT') {
    const l = layoutText(t, null);
    const w = Math.max(1, l.width), h = Math.max(1, l.height);
    if (n.width !== w) n.width = w;
    if (n.height !== h) n.height = h;
  } else if (t.autoResize === 'HEIGHT') {
    const l = layoutText(t, n.width);
    const h = Math.max(1, l.height);
    if (n.height !== h) n.height = h;
  }
}

function fitGroup(doc: DocumentData, n: SceneNode) {
  const kids = n.children.map((c) => doc.nodes[c]).filter(Boolean);
  if (!kids.length) return;
  const rect = unionRects(kids.map((k) => rotatedBounds({ x: k.x, y: k.y, width: k.width, height: k.height }, k.rotation)))!;
  const eps = 1e-6;
  if (Math.abs(rect.x) > eps || Math.abs(rect.y) > eps) {
    n.x += rect.x; n.y += rect.y;
    for (const k of kids) { k.x -= rect.x; k.y -= rect.y; }
  }
  if (Math.abs(n.width - rect.width) > eps) n.width = rect.width;
  if (Math.abs(n.height - rect.height) > eps) n.height = rect.height;
}

function autoLayoutFrame(doc: DocumentData, n: SceneNode) {
  const L = n.layout;
  const kids = n.children.map((c) => doc.nodes[c]).filter((c) => c && c.visible && !c.absolutePosition);
  const horiz = L.mode === 'HORIZONTAL' || L.mode === 'WRAP';
  const mainSize = (c: SceneNode) => (horiz ? c.width : c.height);
  const crossSize = (c: SceneNode) => (horiz ? c.height : c.width);
  const padMainStart = horiz ? L.paddingLeft : L.paddingTop;
  const padMainEnd = horiz ? L.paddingRight : L.paddingBottom;
  const padCrossStart = horiz ? L.paddingTop : L.paddingLeft;
  const padCrossEnd = horiz ? L.paddingBottom : L.paddingRight;
  const mainSizing = horiz ? n.sizingH : n.sizingV;
  const crossSizing = horiz ? n.sizingV : n.sizingH;
  const setMain = (c: SceneNode, v: number) => { if (horiz) resizeKid(c, v, c.height); else resizeKid(c, c.width, v); };
  const setCross = (c: SceneNode, v: number) => { if (horiz) resizeKid(c, c.width, v); else resizeKid(c, v, c.height); };
  const resizeKid = (c: SceneNode, w: number, h: number) => {
    if (c.width === w && c.height === h) return;
    resizeNode(doc, c.id, w, h);
    layoutSelf(doc, c);
  };
  const childMainFill = (c: SceneNode) => (horiz ? c.sizingH : c.sizingV) === 'FILL';
  const childCrossFill = (c: SceneNode) => (horiz ? c.sizingV : c.sizingH) === 'FILL';

  if (L.mode === 'WRAP') {
    const innerW = n.width - L.paddingLeft - L.paddingRight;
    const rows: SceneNode[][] = [];
    let row: SceneNode[] = [];
    let x = 0;
    for (const c of kids) {
      if (row.length && x + c.width > innerW + 0.01) { rows.push(row); row = []; x = 0; }
      row.push(c);
      x += c.width + L.gap;
    }
    if (row.length) rows.push(row);
    let y = L.paddingTop;
    let maxRowW = 0;
    for (const r of rows) {
      const rowH = Math.max(...r.map((c) => c.height));
      const total = r.reduce((s, c) => s + c.width, 0) + L.gap * (r.length - 1);
      maxRowW = Math.max(maxRowW, total);
      let cx = L.paddingLeft;
      let gap = L.gap;
      if (L.alignMain === 'CENTER') cx += (innerW - total) / 2;
      else if (L.alignMain === 'MAX') cx += innerW - total;
      else if (L.alignMain === 'SPACE_BETWEEN' && r.length > 1) gap = (innerW - (total - L.gap * (r.length - 1))) / (r.length - 1);
      for (const c of r) {
        let cy = y;
        if (L.alignCross === 'CENTER') cy += (rowH - c.height) / 2;
        else if (L.alignCross === 'MAX') cy += rowH - c.height;
        if (c.x !== cx) c.x = cx;
        if (c.y !== cy) c.y = cy;
        cx += c.width + gap;
      }
      y += rowH + L.counterGap;
    }
    const contentH = rows.length ? y - L.counterGap - L.paddingTop : 0;
    if (n.sizingV === 'HUG') { const h = contentH + L.paddingTop + L.paddingBottom; if (n.height !== h) n.height = h; }
    if (n.sizingH === 'HUG') { const w = maxRowW + L.paddingLeft + L.paddingRight; if (n.width !== w) n.width = w; }
    return;
  }

  // hug cross first (needs child sizes), fill cross children
  const fixedKids = kids.filter((c) => !childMainFill(c) || mainSizing === 'HUG');
  const fillKids = mainSizing === 'HUG' ? [] : kids.filter(childMainFill);
  const gapsTotal = L.alignMain === 'SPACE_BETWEEN' ? 0 : L.gap * Math.max(0, kids.length - 1);

  if (mainSizing === 'HUG') {
    const total = kids.reduce((s, c) => s + mainSize(c), 0) + L.gap * Math.max(0, kids.length - 1) + padMainStart + padMainEnd;
    const v = Math.max(0.01, kids.length ? total : padMainStart + padMainEnd || n.width);
    if (horiz) { if (n.width !== v) n.width = v; } else if (n.height !== v) n.height = v;
  }
  const innerMain = (horiz ? n.width : n.height) - padMainStart - padMainEnd;
  if (fillKids.length) {
    const used = fixedKids.reduce((s, c) => s + mainSize(c), 0) + gapsTotal;
    const each = Math.max(0.01, (innerMain - used) / fillKids.length);
    for (const c of fillKids) setMain(c, each);
  }
  if (crossSizing === 'HUG') {
    const maxCross = Math.max(0, ...kids.filter((c) => !childCrossFill(c)).map(crossSize));
    const v = Math.max(0.01, maxCross + padCrossStart + padCrossEnd);
    if (horiz) { if (n.height !== v) n.height = v; } else if (n.width !== v) n.width = v;
  }
  const innerCross = (horiz ? n.height : n.width) - padCrossStart - padCrossEnd;
  for (const c of kids) if (childCrossFill(c)) setCross(c, Math.max(0.01, innerCross));

  const total = kids.reduce((s, c) => s + mainSize(c), 0);
  let gap = L.gap;
  let pos = padMainStart;
  if (L.alignMain === 'SPACE_BETWEEN') gap = kids.length > 1 ? (innerMain - total) / (kids.length - 1) : 0;
  else if (L.alignMain === 'CENTER') pos += (innerMain - total - L.gap * Math.max(0, kids.length - 1)) / 2;
  else if (L.alignMain === 'MAX') pos += innerMain - total - L.gap * Math.max(0, kids.length - 1);
  if (L.alignMain === 'SPACE_BETWEEN' && kids.length === 1) pos = padMainStart + (innerMain - total) / 2;
  for (const c of kids) {
    let cross = padCrossStart;
    if (L.alignCross === 'CENTER') cross += (innerCross - crossSize(c)) / 2;
    else if (L.alignCross === 'MAX') cross += innerCross - crossSize(c);
    const nx = horiz ? pos : cross;
    const ny = horiz ? cross : pos;
    if (c.x !== nx) c.x = nx;
    if (c.y !== ny) c.y = ny;
    if (c.rotation) c.rotation = 0;
    pos += mainSize(c) + gap;
  }
}

export function layoutSelf(doc: DocumentData, n: SceneNode) {
  if (n.type === 'TEXT' && n.text) layoutTextNode(n);
  else if ((n.type === 'GROUP' || n.type === 'BOOLEAN_OPERATION')) fitGroup(doc, n);
  else if (n.layout.mode !== 'NONE' && (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE')) autoLayoutFrame(doc, n);
}

function layoutRec(doc: DocumentData, id: string, emptyGroups: string[]) {
  const n = doc.nodes[id];
  if (!n) return;
  applyBindings(doc, n);
  for (const c of n.children) layoutRec(doc, c, emptyGroups);
  if ((n.type === 'GROUP' || n.type === 'BOOLEAN_OPERATION') && n.children.length === 0) { emptyGroups.push(id); return; }
  if (n.layout.mode === 'NONE' || !(n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE')) {
    if (n.type !== 'TEXT' && (n.sizingH === 'HUG')) n.sizingH = 'FIXED';
    if (n.type !== 'TEXT' && (n.sizingV === 'HUG')) n.sizingV = 'FIXED';
  }
  const parent = n.parentId ? doc.nodes[n.parentId] : undefined;
  const inAuto = parent && parent.layout.mode !== 'NONE' && (parent.type === 'FRAME' || parent.type === 'COMPONENT' || parent.type === 'INSTANCE') && !n.absolutePosition;
  if (!inAuto) {
    if (n.sizingH === 'FILL') n.sizingH = 'FIXED';
    if (n.sizingV === 'FILL') n.sizingV = 'FIXED';
  }
  layoutSelf(doc, n);
}

export function runLayout(doc: DocumentData) {
  const empty: string[] = [];
  for (const page of doc.pages) for (const id of page.children) layoutRec(doc, id, empty);
  for (const id of empty) {
    const n = doc.nodes[id];
    if (!n) continue;
    if (n.parentId) { const p = doc.nodes[n.parentId]; if (p) p.children = p.children.filter((c) => c !== id); }
    else for (const pg of doc.pages) pg.children = pg.children.filter((c) => c !== id);
    delete doc.nodes[id];
  }
}

/* ---------------------------------------------------------------- instances */

const NON_INHERITED = new Set(['id', 'name', 'type', 'x', 'y', 'parentId', 'children', 'mainComponentId', 'overrides', 'sourceId',
  'constraintH', 'constraintV', 'sizingH', 'sizingV', 'absolutePosition', 'exports', 'reactions', 'devStatus', 'variableModes', 'componentDescription', 'variantProps', 'annotations', 'locked', 'rotation', 'flipX', 'flipY']);

function namePath(doc: DocumentData, rootId: string, id: string): string {
  const parts: string[] = [];
  let n: SceneNode | undefined = doc.nodes[id];
  while (n && n.id !== rootId) { parts.unshift(n.name); n = n.parentId ? doc.nodes[n.parentId] : undefined; }
  return parts.join('/');
}

export function syncInstance(doc: DocumentData, instId: string) {
  const inst = doc.nodes[instId];
  if (!inst || inst.type !== 'INSTANCE' || !inst.mainComponentId) return;
  const main = doc.nodes[inst.mainComponentId];
  if (!main || main.type !== 'COMPONENT') return;
  const overrides = new Set(inst.overrides ?? []);
  // copy root props
  const mainAny = main as unknown as Record<string, unknown>;
  const instAny = inst as unknown as Record<string, unknown>;
  for (const key of Object.keys(mainAny)) {
    if (NON_INHERITED.has(key) || overrides.has(key)) continue;
    if (key === 'width' || key === 'height') continue;
    const v = mainAny[key];
    const cur = instAny[key];
    if (JSON.stringify(cur) !== JSON.stringify(v)) instAny[key] = v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }
  const sizeOverridden = overrides.has('width') || overrides.has('height');
  const oldDesc = descendants(doc, instId);
  const bySource = new Map<string, SceneNode>();
  const byPath = new Map<string, SceneNode>();
  for (const d of oldDesc) {
    const dn = doc.nodes[d];
    if (dn.sourceId) bySource.set(dn.sourceId, dn);
    byPath.set(namePath(doc, instId, d), dn);
  }
  const used = new Set<string>();
  const build = (mcId: string, parentId: string): string => {
    const mc = doc.nodes[mcId];
    const path = namePath(doc, main.id, mcId);
    const old = bySource.get(mcId) ?? byPath.get(path);
    const id = old && !used.has(old.id) ? old.id : uid('n');
    used.add(id);
    const node: SceneNode = JSON.parse(JSON.stringify(mc));
    node.id = id;
    node.parentId = parentId;
    node.sourceId = mcId;
    if (old && old.overrides?.length) {
      const oAny = old as unknown as Record<string, unknown>;
      const nAny = node as unknown as Record<string, unknown>;
      for (const k of old.overrides) nAny[k] = JSON.parse(JSON.stringify(oAny[k] ?? null)) ?? undefined;
      node.overrides = [...old.overrides];
    } else node.overrides = [];
    if (old) node.locked = old.locked;
    node.children = mc.children.map((c) => build(c, id));
    doc.nodes[id] = node;
    return id;
  };
  const newKids = main.children.map((c) => build(c, instId));
  for (const d of oldDesc) if (!used.has(d)) delete doc.nodes[d];
  inst.children = newKids;
  if (!sizeOverridden) {
    inst.width = main.width; inst.height = main.height;
  } else if (inst.layout.mode === 'NONE') {
    for (const c of inst.children) applyConstraint(doc, c, main.width, main.height, inst.width, inst.height);
  }
}

export function instancesOf(doc: DocumentData, mainIds: Set<string>): string[] {
  return Object.values(doc.nodes).filter((n) => n.type === 'INSTANCE' && n.mainComponentId && mainIds.has(n.mainComponentId)).map((n) => n.id);
}

/** Main component ids whose subtree changed between two docs */
export function changedComponents(prev: DocumentData, next: DocumentData): Set<string> {
  const out = new Set<string>();
  for (const n of Object.values(next.nodes)) {
    if (n.type !== 'COMPONENT') continue;
    const stack = [n.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (prev.nodes[id] !== next.nodes[id]) { out.add(n.id); break; }
      const nn = next.nodes[id];
      if (nn) stack.push(...nn.children);
    }
  }
  return out;
}
