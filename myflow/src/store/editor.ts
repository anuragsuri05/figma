import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import type {
  DocumentData, Page, SceneNode, ToolId, NodeType, StyleDef, Variable, VariableCollection, VariableType, CommentThread, Paint,
} from '../model/types';
import { createNode, createPage, uid, solid, defaultLayout } from '../model/defaults';
import {
  absPos, absRect, ancestors, cloneSubtree, getPageOf, insertNode, isAncestor, removeNode, reparent, sortByTreeOrder,
  topLevelSelection, unionRects, visualAbsRect, descendants, type Rect,
} from '../model/tree';
import { changedComponents, instancesOf, runLayout, syncInstance, resizeNode } from '../model/layout';
import { clearTextCache } from '../model/text';
import { shapeToPoints } from '../render/geometry';

export type Recipe = (doc: Draft<DocumentData>) => void;

export interface Prefs {
  theme: 'light' | 'dark' | 'system';
  snapToGeometry: boolean;
  snapToObjects: boolean;
  snapToPixel: boolean;
  nudgeSmall: number;
  nudgeBig: number;
  keepToolSelected: boolean;
  highlightOnHover: boolean;
  renameDuplicated: boolean;
  showDimensions: boolean;
  invertZoom: boolean;
  numberKeysOpacity: boolean;
  userName: string;
}

export interface ViewState {
  rulers: boolean;
  pixelGrid: boolean;
  layoutGrids: boolean;
  outlines: boolean;
  multiplayerCursors: boolean;
  comments: boolean;
  showUI: boolean;
  leftPanel: boolean;
  rightPanel: boolean;
  pixelPreview: boolean;
  dotGrid: boolean;
  maskOutlines: boolean;
  frameOutlines: boolean;
}

export type ModalId = 'quickActions' | 'shortcuts' | 'variables' | 'versions' | 'share' | 'find' | 'preferences' | 'rename' | 'styles' | 'libraries' | 'plugins' | 'about' | null;

export interface ContextMenuState { x: number; y: number; kind: 'canvas' | 'selection' | 'page' | 'layer' }

export interface ClipboardData { marker: 'myflow/nodes'; doc: DocumentData; roots: string[]; }

interface EditorState {
  fileId: string | null;
  doc: DocumentData | null;
  pageId: string;
  selection: string[];
  hoverId: string | null;
  tool: ToolId;
  zoom: number;
  panX: number;
  panY: number;
  mode: 'design' | 'dev';
  rightTab: 'design' | 'prototype';
  leftTab: 'file' | 'assets';
  editingTextId: string | null;
  editingVectorId: string | null;
  past: DocumentData[];
  future: DocumentData[];
  txBase: DocumentData | null;
  view: ViewState;
  prefs: Prefs;
  modal: ModalId;
  contextMenu: ContextMenuState | null;
  activeCommentId: string | null;
  draftComment: { x: number; y: number } | null;
  commentsPanel: boolean;
  toastMsg: { text: string; id: number } | null;
  menuOpen: boolean;
  imageToPlace: string[];
  shapeSubtool: { shape: ToolId; region: ToolId; move: ToolId; creation: ToolId };
  clipboard: ClipboardData | null;
  measureHoverId: string | null;
  altDown: boolean;
  saveState: 'saved' | 'saving' | 'unsaved';
  viewport: { width: number; height: number };
  lastNamedVersionAt: number;
}

interface EditorActions {
  setState: (p: Partial<EditorState>) => void;
  loadDocument: (fileId: string, doc: DocumentData) => void;
  update: (recipe: Recipe, opts?: { commit?: boolean }) => void;
  begin: () => void;
  end: () => void;
  undo: () => void;
  redo: () => void;
  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  setTool: (t: ToolId) => void;
  toast: (text: string) => void;
  setView: (p: Partial<ViewState>) => void;
  setPrefs: (p: Partial<Prefs>) => void;
}

export type Store = EditorState & EditorActions;

export const defaultPrefs: Prefs = {
  theme: 'dark', snapToGeometry: true, snapToObjects: true, snapToPixel: true, nudgeSmall: 1, nudgeBig: 10,
  keepToolSelected: false, highlightOnHover: true, renameDuplicated: true, showDimensions: true, invertZoom: false,
  numberKeysOpacity: true, userName: 'You',
};

const defaultView: ViewState = {
  rulers: false, pixelGrid: true, layoutGrids: true, outlines: false, multiplayerCursors: true, comments: true,
  showUI: true, leftPanel: true, rightPanel: true, pixelPreview: false, dotGrid: true, maskOutlines: false, frameOutlines: false,
};

function finalize(prev: DocumentData | null, next: DocumentData): DocumentData {
  let cur = produce(next, (d) => {
    if (!prev) {
      runLayout(d as DocumentData);
      for (const n of Object.values(d.nodes)) if (n.type === 'INSTANCE') syncInstance(d as DocumentData, n.id);
    }
    runLayout(d as DocumentData);
  });
  let base = prev ?? cur;
  for (let i = 0; i < 4; i++) {
    const changed = changedComponents(base, cur);
    if (!changed.size) break;
    const synced = produce(cur, (d) => {
      for (const id of instancesOf(d as DocumentData, changed)) syncInstance(d as DocumentData, id);
      runLayout(d as DocumentData);
    });
    if (synced === cur) break;
    base = cur;
    cur = synced;
  }
  return cur;
}

export const useEditor = create<Store>((set, get) => ({
  fileId: null,
  doc: null,
  pageId: '',
  selection: [],
  hoverId: null,
  tool: 'MOVE',
  zoom: 1,
  panX: 0,
  panY: 0,
  mode: 'design',
  rightTab: 'design',
  leftTab: 'file',
  editingTextId: null,
  editingVectorId: null,
  past: [],
  future: [],
  txBase: null,
  view: defaultView,
  prefs: defaultPrefs,
  modal: null,
  contextMenu: null,
  activeCommentId: null,
  draftComment: null,
  commentsPanel: false,
  toastMsg: null,
  menuOpen: false,
  imageToPlace: [],
  shapeSubtool: { shape: 'RECTANGLE', region: 'FRAME', move: 'MOVE', creation: 'PEN' },
  clipboard: null,
  measureHoverId: null,
  altDown: false,
  saveState: 'saved',
  viewport: { width: 1200, height: 800 },
  lastNamedVersionAt: 0,

  setState: (p) => set(p as Partial<Store>),
  loadDocument: (fileId, doc) => {
    clearTextCache();
    const fixed = finalize(null, doc);
    set({
      fileId, doc: fixed, pageId: fixed.pages[0].id, selection: [], past: [], future: [], txBase: null,
      editingTextId: null, editingVectorId: null, tool: 'MOVE', mode: 'design', rightTab: 'design', activeCommentId: null, draftComment: null,
    });
  },
  update: (recipe, opts = {}) => {
    const { doc, txBase } = get();
    if (!doc) return;
    const raw = produce(doc, recipe);
    if (raw === doc) return;
    const next = finalize(doc, raw);
    const commit = opts.commit !== false && !txBase;
    set((s) => ({
      doc: next,
      past: commit ? [...s.past.slice(-199), doc] : s.past,
      future: commit ? [] : s.future,
      saveState: 'unsaved',
    }));
    // drop selection of removed nodes
    const sel = get().selection.filter((id) => next.nodes[id]);
    if (sel.length !== get().selection.length) set({ selection: sel });
  },
  begin: () => { const { doc } = get(); set({ txBase: doc }); },
  end: () => {
    const { txBase, doc } = get();
    if (txBase && doc && txBase !== doc) set((s) => ({ past: [...s.past.slice(-199), txBase], future: [], txBase: null }));
    else set({ txBase: null });
  },
  undo: () => {
    const { past, doc, future } = get();
    if (!past.length || !doc) return;
    const prev = past[past.length - 1];
    set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future], saveState: 'unsaved', editingTextId: null });
    const s = get();
    set({ selection: s.selection.filter((id) => prev.nodes[id]) });
    if (!prev.pages.find((p) => p.id === s.pageId)) set({ pageId: prev.pages[0].id });
  },
  redo: () => {
    const { past, doc, future } = get();
    if (!future.length || !doc) return;
    const next = future[0];
    set({ doc: next, past: [...past, doc], future: future.slice(1), saveState: 'unsaved', editingTextId: null });
    const s = get();
    set({ selection: s.selection.filter((id) => next.nodes[id]) });
    if (!next.pages.find((p) => p.id === s.pageId)) set({ pageId: next.pages[0].id });
  },
  select: (ids) => set({ selection: [...new Set(ids)], editingTextId: null }),
  toggleSelect: (id) => {
    const sel = get().selection;
    set({ selection: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id] });
  },
  setTool: (t) => set({ tool: t, editingTextId: null, draftComment: t === 'COMMENT' ? get().draftComment : null }),
  toast: (text) => {
    const id = Date.now();
    set({ toastMsg: { text, id } });
    setTimeout(() => { if (get().toastMsg?.id === id) set({ toastMsg: null }); }, 2400);
  },
  setView: (p) => set((s) => ({ view: { ...s.view, ...p } })),
  setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),
}));

/** Re-measure text after web fonts finish loading (no history entry). */
export function relayoutText() {
  const s = useEditor.getState();
  if (!s.doc) return;
  clearTextCache();
  const next = produce(s.doc, (d) => { runLayout(d as DocumentData); });
  if (next !== s.doc) useEditor.setState({ doc: next });
}

/* ============================================================== helpers */

export const S = () => useEditor.getState();
export const currentDoc = () => S().doc!;
export const currentPage = (): Page => {
  const s = S();
  return s.doc!.pages.find((p) => p.id === s.pageId) ?? s.doc!.pages[0];
};
export const selectedNodes = (): SceneNode[] => {
  const s = S();
  return s.selection.map((id) => s.doc!.nodes[id]).filter(Boolean);
};

const pageDraft = (d: Draft<DocumentData>) => d.pages.find((p) => p.id === S().pageId)! as Page;

const OVERRIDE_IGNORE = new Set(['x', 'y', 'children', 'parentId', 'overrides', 'locked', 'sourceId', 'mainComponentId']);

function markOverride(n: SceneNode, keys: string[]) {
  if (!(n.sourceId || n.type === 'INSTANCE')) return;
  const ks = keys.filter((k) => !OVERRIDE_IGNORE.has(k) || (n.type !== 'INSTANCE' && (k === 'x' || k === 'y')));
  if (!ks.length) return;
  const set = new Set(n.overrides ?? []);
  ks.forEach((k) => set.add(k));
  n.overrides = [...set];
}

/** Patch properties on nodes (with instance override tracking) */
export function setProps(ids: string[], patch: Partial<SceneNode> | ((n: Draft<SceneNode>, d: Draft<DocumentData>) => void), opts?: { commit?: boolean }) {
  S().update((d) => {
    for (const id of ids) {
      const n = d.nodes[id];
      if (!n) continue;
      if (typeof patch === 'function') {
        const before = JSON.parse(JSON.stringify(n)) as Record<string, unknown>;
        patch(n, d);
        const oldChars = (before.text as SceneNode['text'])?.characters;
        if (n.text && oldChars !== undefined && n.text.characters !== oldChars && !n.sourceId) {
          const oldName = textLayerName(oldChars);
          if (n.name === oldName || n.name === 'Text' || n.name === oldChars.slice(0, 40)) n.name = textLayerName(n.text.characters);
        }
        const changed = Object.keys(n).filter((k) => JSON.stringify((n as unknown as Record<string, unknown>)[k]) !== JSON.stringify(before[k]));
        if (changed.length) markOverride(n as SceneNode, changed);
      } else {
        const keys = Object.keys(patch);
        if (('width' in patch || 'height' in patch)) {
          resizeNode(d as DocumentData, id, patch.width ?? n.width, patch.height ?? n.height);
          const rest = { ...patch };
          delete rest.width; delete rest.height;
          Object.assign(n, rest);
        } else Object.assign(n, patch);
        markOverride(n as SceneNode, keys);
      }
    }
  }, opts);
}

export function textLayerName(chars: string) {
  return (chars.split('\n').find((l) => l.trim()) ?? '').trim().slice(0, 40) || 'Text';
}

/* ============================================================== viewport */

export function screenToWorld(sx: number, sy: number) {
  const { zoom, panX, panY } = S();
  return { x: (sx - panX) / zoom, y: (sy - panY) / zoom };
}

export function worldToScreen(x: number, y: number) {
  const { zoom, panX, panY } = S();
  return { x: x * zoom + panX, y: y * zoom + panY };
}

export function clampZoom(z: number) { return Math.min(256, Math.max(0.02, z)); }

export function zoomAt(z: number, sx?: number, sy?: number) {
  const s = S();
  const cx = sx ?? s.viewport.width / 2, cy = sy ?? s.viewport.height / 2;
  const w = screenToWorld(cx, cy);
  const nz = clampZoom(z);
  s.setState({ zoom: nz, panX: cx - w.x * nz, panY: cy - w.y * nz });
}

export function zoomToRect(r: Rect | null, maxZoom = 1, padding = 80) {
  const s = S();
  if (!r) { s.setState({ zoom: 1, panX: s.viewport.width / 2, panY: s.viewport.height / 2 }); return; }
  // visible area = viewport minus floating panels and toolbar
  const ui = s.view.showUI;
  const left = ui && s.view.leftPanel ? 257 : 0;
  const right = ui ? 257 : 0;
  const bottom = ui ? 72 : 0;
  const areaW = s.viewport.width - left - right, areaH = s.viewport.height - bottom;
  const pad = Math.min(padding, areaW / 6, areaH / 6);
  const vw = Math.max(100, areaW - pad * 2), vh = Math.max(100, areaH - pad * 2);
  const z = clampZoom(Math.min(maxZoom, vw / Math.max(1, r.width), vh / Math.max(1, r.height)));
  s.setState({
    zoom: z,
    panX: left + areaW / 2 - (r.x + r.width / 2) * z,
    panY: areaH / 2 - (r.y + r.height / 2) * z,
  });
}

export function pageBounds(): Rect | null {
  const doc = currentDoc();
  const page = currentPage();
  return unionRects(page.children.filter((id) => doc.nodes[id]).map((id) => visualAbsRect(doc, id)));
}

export function zoomToFit() { zoomToRect(pageBounds(), 1); }
export function zoomToSelection() {
  const doc = currentDoc();
  const sel = S().selection;
  if (!sel.length) return zoomToFit();
  zoomToRect(unionRects(sel.map((id) => visualAbsRect(doc, id))), 256);
}

export function selectionBounds(ids = S().selection): Rect | null {
  const doc = S().doc;
  if (!doc) return null;
  return unionRects(ids.filter((id) => doc.nodes[id]).map((id) => visualAbsRect(doc, id)));
}

/* ============================================================== node creation */

export function addNode(node: SceneNode, parentId: string | null, index?: number) {
  S().update((d) => { insertNode(d as DocumentData, node, parentId, pageDraft(d), index); });
  return node.id;
}

/** Find frame-like container under a world point (top-most), excluding ids */
export function containerAt(x: number, y: number, exclude: Set<string> = new Set()): string | null {
  const doc = currentDoc();
  const page = currentPage();
  let found: string | null = null;
  const walk = (ids: string[]) => {
    for (const id of ids) {
      const n = doc.nodes[id];
      if (!n || !n.visible || exclude.has(id)) continue;
      if (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'SECTION' || n.type === 'COMPONENT_SET') {
        const r = absRect(doc, id);
        if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height && !n.rotation) {
          found = id;
          walk(n.children);
        }
      } else if (n.type === 'INSTANCE' || n.type === 'GROUP') {
        // don't drop into instances; groups are transparent for containers
        if (n.type === 'GROUP') walk(n.children);
      }
    }
  };
  walk(page.children);
  return found;
}

export function nextName(base: string): string {
  return base;
}

/* ============================================================== selection ops */

export function deleteSelection() {
  const s = S();
  const doc = s.doc!;
  const ids = topLevelSelection(doc, s.selection).filter((id) => !doc.nodes[id]?.locked);
  if (!ids.length) return;
  s.update((d) => {
    for (const id of ids) {
      const n = d.nodes[id];
      if (!n) continue;
      // nodes inside instances can only be hidden
      if (n.sourceId && ancestors(d as DocumentData, id).some((a) => a.type === 'INSTANCE')) { n.visible = false; markOverride(n as SceneNode, ['visible']); continue; }
      removeNode(d as DocumentData, id);
    }
  });
  s.select([]);
}

export function selectAll() {
  const s = S();
  const doc = s.doc!;
  const page = currentPage();
  const first = s.selection[0] ? doc.nodes[s.selection[0]] : null;
  const siblings = first?.parentId ? doc.nodes[first.parentId].children : page.children;
  s.select(siblings.filter((id) => doc.nodes[id]?.visible && !doc.nodes[id]?.locked));
}

export function selectInverse() {
  const s = S();
  const doc = s.doc!;
  const page = currentPage();
  const first = s.selection[0] ? doc.nodes[s.selection[0]] : null;
  const siblings = first?.parentId ? doc.nodes[first.parentId].children : page.children;
  s.select(siblings.filter((id) => !s.selection.includes(id)));
}

export function selectMatching(kind: 'fill' | 'stroke' | 'effect' | 'font' | 'instance' | 'type') {
  const s = S();
  const doc = s.doc!;
  const first = selectedNodes()[0];
  if (!first) return;
  const page = currentPage();
  const all = [...page.children, ...page.children.flatMap((id) => descendants(doc, id))];
  const key = (n: SceneNode) => {
    switch (kind) {
      case 'fill': return JSON.stringify(n.fills.map((f) => [f.type, f.color, f.opacity]));
      case 'stroke': return JSON.stringify(n.strokes.map((f) => [f.type, f.color]) ) + n.strokeWeight;
      case 'effect': return JSON.stringify(n.effects.map((e) => [e.type, e.x, e.y, e.blur]));
      case 'font': return n.text ? n.text.fontFamily + n.text.fontWeight + n.text.fontSize : '__';
      case 'instance': return n.mainComponentId ?? '__' + n.id;
      case 'type': return n.type;
    }
  };
  const k = key(first);
  s.select(all.filter((id) => doc.nodes[id] && key(doc.nodes[id]) === k));
}

export function duplicateSelection(offset = { x: 0, y: 0 }) {
  const s = S();
  const doc = s.doc!;
  const ids = sortByTreeOrder(doc, currentPage(), topLevelSelection(doc, s.selection));
  if (!ids.length) return;
  const newIds: string[] = [];
  s.update((d) => {
    const page = pageDraft(d);
    for (const id of ids) {
      const n = d.nodes[id];
      const nid = cloneSubtree(d as DocumentData, id);
      const c = d.nodes[nid];
      const parentList = n.parentId ? d.nodes[n.parentId].children : page.children;
      const idx = parentList.indexOf(id);
      parentList.splice(idx + 1, 0, nid);
      c.x += offset.x; c.y += offset.y;
      // top-level frames: place to the right
      if (!n.parentId && (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'SECTION') && offset.x === 0 && offset.y === 0 && ids.length === 1) {
        c.x = n.x + n.width + 40;
      }
      if (c.type === 'COMPONENT') { makeInstanceOf(d as DocumentData, nid, id); }
      newIds.push(nid);
    }
  });
  s.select(newIds);
}

export function copySelection(cut = false) {
  const s = S();
  const doc = s.doc!;
  const ids = sortByTreeOrder(doc, currentPage(), topLevelSelection(doc, s.selection));
  if (!ids.length) return;
  const clip: DocumentData = { ...doc, nodes: {}, pages: [], comments: [] };
  const roots: string[] = [];
  for (const id of ids) {
    const all = [id, ...descendants(doc, id)];
    for (const a of all) clip.nodes[a] = JSON.parse(JSON.stringify(doc.nodes[a]));
    const abs = absPos(doc, id);
    clip.nodes[id].x = abs.x; clip.nodes[id].y = abs.y;
    clip.nodes[id].parentId = null;
    roots.push(id);
  }
  const data: ClipboardData = { marker: 'myflow/nodes', doc: clip, roots };
  s.setState({ clipboard: data });
  try { navigator.clipboard?.writeText(JSON.stringify(data)).catch(() => {}); } catch { /* ignore */ }
  if (cut) deleteSelection();
}

export function pasteClipboard(data: ClipboardData | null = S().clipboard, mode: 'normal' | 'over' | 'replace' = 'normal') {
  if (!data) return;
  const s = S();
  const doc = s.doc!;
  const sel = selectedNodes();
  let targetParent: string | null = null;
  let targetIndex: number | undefined;
  if (mode === 'replace' && sel.length) {
    const t = sel[0];
    targetParent = t.parentId;
    const list = t.parentId ? doc.nodes[t.parentId].children : currentPage().children;
    targetIndex = list.indexOf(t.id);
  } else if (sel.length === 1 && (sel[0].type === 'FRAME' || sel[0].type === 'COMPONENT' || sel[0].type === 'SECTION') && !data.roots.includes(sel[0].id) && mode === 'normal') {
    targetParent = sel[0].id;
  } else if (sel.length === 1 && sel[0].parentId) {
    targetParent = sel[0].parentId;
  }
  const replaceRect = mode === 'replace' && sel.length ? absRect(doc, sel[0].id) : null;
  const overRect = mode === 'over' && sel.length ? selectionBounds() : null;
  const newIds: string[] = [];
  s.update((d) => {
    const page = pageDraft(d);
    const rootsRect = unionRects(data.roots.map((r) => ({ x: data.doc.nodes[r].x, y: data.doc.nodes[r].y, width: data.doc.nodes[r].width, height: data.doc.nodes[r].height })))!;
    let dx = 0, dy = 0;
    if (replaceRect) { dx = replaceRect.x + replaceRect.width / 2 - (rootsRect.x + rootsRect.width / 2); dy = replaceRect.y + replaceRect.height / 2 - (rootsRect.y + rootsRect.height / 2); }
    else if (overRect) { dx = overRect.x - rootsRect.x; dy = overRect.y - rootsRect.y; }
    else if (targetParent) {
      const pr = absRect(d as DocumentData, targetParent);
      const inside = rootsRect.x >= pr.x && rootsRect.y >= pr.y && rootsRect.x + rootsRect.width <= pr.x + pr.width && rootsRect.y + rootsRect.height <= pr.y + pr.height;
      if (!inside) { dx = pr.x + (pr.width - rootsRect.width) / 2 - rootsRect.x; dy = pr.y + (pr.height - rootsRect.height) / 2 - rootsRect.y; }
    } else {
      // if not visible in viewport, paste at viewport center
      const vp = { ...screenToWorld(0, 0) };
      const vp2 = screenToWorld(s.viewport.width, s.viewport.height);
      const visible = rootsRect.x < vp2.x && rootsRect.x + rootsRect.width > vp.x && rootsRect.y < vp2.y && rootsRect.y + rootsRect.height > vp.y;
      if (!visible) {
        dx = (vp.x + vp2.x) / 2 - (rootsRect.x + rootsRect.width / 2);
        dy = (vp.y + vp2.y) / 2 - (rootsRect.y + rootsRect.height / 2);
      }
    }
    const parentAbs = targetParent ? absPos(d as DocumentData, targetParent) : { x: 0, y: 0 };
    let idx = targetIndex;
    for (const r of data.roots) {
      const nid = cloneSubtree(d as DocumentData, r, { srcDoc: data.doc });
      const c = d.nodes[nid];
      c.x = c.x + dx - parentAbs.x;
      c.y = c.y + dy - parentAbs.y;
      c.parentId = targetParent;
      if (c.mainComponentId && !d.nodes[c.mainComponentId]) { /* keep as orphan instance */ }
      if (c.type === 'COMPONENT' && d.nodes[r]) { makeInstanceOf(d as DocumentData, nid, r); }
      const list = targetParent ? d.nodes[targetParent].children : page.children;
      if (idx != null) list.splice(++idx, 0, nid); else list.push(nid);
      newIds.push(nid);
    }
    if (mode === 'replace') for (const n of sel) removeNode(d as DocumentData, n.id);
  });
  s.select(newIds);
}

export function groupSelection(type: 'GROUP' | 'BOOLEAN_OPERATION' = 'GROUP', op?: SceneNode['booleanOp'], mask = false) {
  const s = S();
  const doc = s.doc!;
  const page = currentPage();
  const ids = sortByTreeOrder(doc, page, topLevelSelection(doc, s.selection));
  if (!ids.length) return;
  const first = doc.nodes[ids[ids.length - 1]];
  const parentId = first.parentId;
  const g = createNode(type, { name: type === 'GROUP' ? (mask ? 'Group' : 'Group') : (op ? op.charAt(0) + op.slice(1).toLowerCase() : 'Union'), booleanOp: op });
  if (type === 'BOOLEAN_OPERATION') g.fills = doc.nodes[ids[0]].fills.length ? JSON.parse(JSON.stringify(doc.nodes[ids[0]].fills)) : [solid('#D9D9D9')];
  s.update((d) => {
    const pg = pageDraft(d);
    const list = parentId ? d.nodes[parentId].children : pg.children;
    const topIndex = Math.max(...ids.filter((id) => list.includes(id)).map((id) => list.indexOf(id)));
    const rect = unionRects(ids.map((id) => absRect(d as DocumentData, id)))!;
    const pAbs = parentId ? absPos(d as DocumentData, parentId) : { x: 0, y: 0 };
    g.x = rect.x - pAbs.x; g.y = rect.y - pAbs.y; g.width = rect.width; g.height = rect.height;
    insertNode(d as DocumentData, g, parentId, pg, topIndex + 1);
    for (const id of ids) reparent(d as DocumentData, id, g.id, pg);
    if (mask) { const m = d.nodes[ids[0]]; m.isMask = true; g.name = m.name; }
  });
  s.select([g.id]);
}

export function ungroupSelection() {
  const s = S();
  const doc = s.doc!;
  const groups = s.selection.map((id) => doc.nodes[id]).filter((n) => n && (n.type === 'GROUP' || n.type === 'BOOLEAN_OPERATION' || ((n.type === 'FRAME' || n.type === 'SECTION') && n.children.length)));
  if (!groups.length) return;
  const newSel: string[] = [];
  s.update((d) => {
    const pg = pageDraft(d);
    for (const g of groups) {
      const gd = d.nodes[g.id];
      const list = gd.parentId ? d.nodes[gd.parentId].children : pg.children;
      let idx = list.indexOf(g.id);
      for (const cid of [...gd.children]) {
        reparent(d as DocumentData, cid, gd.parentId, pg, idx++);
        const c = d.nodes[cid];
        c.isMask = false;
        if (gd.opacity !== 1) c.opacity *= gd.opacity;
        if (gd.rotation) c.rotation = (c.rotation + gd.rotation) % 360;
        newSel.push(cid);
      }
      gd.children = [];
      removeNode(d as DocumentData, g.id);
    }
  });
  s.select(newSel);
}

export function frameSelection(autoLayout = false) {
  const s = S();
  const doc = s.doc!;
  const page = currentPage();
  const ids = sortByTreeOrder(doc, page, topLevelSelection(doc, s.selection));
  if (!ids.length) return;
  const parentId = doc.nodes[ids[0]].parentId;
  const f = createNode('FRAME', { name: `Frame ${Object.values(doc.nodes).filter((x) => x.type === 'FRAME').length + 1}`, fills: autoLayout ? [] : [solid('#FFFFFF')], clipContent: !autoLayout });
  s.update((d) => {
    const pg = pageDraft(d);
    const list = parentId ? d.nodes[parentId].children : pg.children;
    const topIndex = Math.max(0, ...ids.filter((id) => list.includes(id)).map((id) => list.indexOf(id)));
    const rect = unionRects(ids.map((id) => absRect(d as DocumentData, id)))!;
    const pAbs = parentId ? absPos(d as DocumentData, parentId) : { x: 0, y: 0 };
    f.x = rect.x - pAbs.x; f.y = rect.y - pAbs.y; f.width = rect.width; f.height = rect.height;
    insertNode(d as DocumentData, f, parentId, pg, topIndex + 1);
    const ordered = autoLayout ? [...ids].sort((a, b) => absRect(d as DocumentData, a).y - absRect(d as DocumentData, b).y || absRect(d as DocumentData, a).x - absRect(d as DocumentData, b).x) : ids;
    for (const id of ordered) reparent(d as DocumentData, id, f.id, pg);
    if (autoLayout) configureAutoLayout(d as DocumentData, f.id);
  });
  s.select([f.id]);
}

function configureAutoLayout(d: DocumentData, id: string) {
  const f = d.nodes[id];
  const kids = f.children.map((c) => d.nodes[c]);
  let horizontal = false;
  if (kids.length > 1) {
    const xs = kids.map((k) => k.x), ys = kids.map((k) => k.y);
    horizontal = Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys);
  }
  kids.sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
  f.children = kids.map((k) => k.id);
  let gap = 10;
  if (kids.length > 1) {
    const gaps: number[] = [];
    for (let i = 1; i < kids.length; i++) gaps.push(horizontal ? kids[i].x - (kids[i - 1].x + kids[i - 1].width) : kids[i].y - (kids[i - 1].y + kids[i - 1].height));
    gap = Math.max(0, Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length));
  }
  const minX = kids.length ? Math.min(...kids.map((k) => k.x)) : 0;
  const minY = kids.length ? Math.min(...kids.map((k) => k.y)) : 0;
  f.layout = { ...defaultLayout(), mode: horizontal ? 'HORIZONTAL' : 'VERTICAL', gap, paddingLeft: Math.max(0, Math.round(minX)), paddingTop: Math.max(0, Math.round(minY)), paddingRight: Math.max(0, Math.round(minX)), paddingBottom: Math.max(0, Math.round(minY)) };
  f.sizingH = 'HUG'; f.sizingV = 'HUG';
}

export function addAutoLayout() {
  const s = S();
  const sel = selectedNodes();
  if (sel.length === 1 && (sel[0].type === 'FRAME' || sel[0].type === 'COMPONENT' || sel[0].type === 'INSTANCE')) {
    const f = sel[0];
    if (f.layout.mode !== 'NONE') return;
    s.update((d) => {
      const keepH = f.sizingH, keepV = f.sizingV;
      if (f.children.length) {
        configureAutoLayout(d as DocumentData, f.id);
        // screen-sized frames keep their fixed size and Fill stays Fill; smaller frames
        // (buttons, cards, rows) hug their content, as in Figma
        const isScreen = f.width >= 320 && f.height >= 480;
        d.nodes[f.id].sizingH = keepH === 'FILL' ? 'FILL' : isScreen ? keepH : 'HUG';
        d.nodes[f.id].sizingV = keepV === 'FILL' ? 'FILL' : isScreen ? keepV : 'HUG';
      }
      else { d.nodes[f.id].layout = { ...defaultLayout(), mode: 'VERTICAL', paddingTop: 10, paddingBottom: 10, paddingLeft: 10, paddingRight: 10 }; }
      markOverride(d.nodes[f.id] as SceneNode, ['layout']);
    });
    return;
  }
  if (sel.length) frameSelection(true);
}

export function removeAutoLayout() {
  setProps(S().selection.filter((id) => currentDoc().nodes[id].layout.mode !== 'NONE'), (n) => {
    n.layout.mode = 'NONE';
    n.sizingH = 'FIXED'; n.sizingV = 'FIXED';
  });
}

/* ============================================================== components */

export function createComponent() {
  const s = S();
  const doc = s.doc!;
  const sel = sortByTreeOrder(doc, currentPage(), topLevelSelection(doc, s.selection));
  if (!sel.length) return;
  if (sel.length === 1 && (doc.nodes[sel[0]].type === 'FRAME' || doc.nodes[sel[0]].type === 'GROUP')) {
    const id = sel[0];
    s.update((d) => {
      const n = d.nodes[id];
      if (n.type === 'GROUP') { n.fills = []; n.clipContent = false; }
      n.type = 'COMPONENT';
    });
    s.select([id]);
    return;
  }
  if (sel.length === 1 && doc.nodes[sel[0]].type === 'INSTANCE') return;
  // wrap
  frameSelection(false);
  const fid = S().selection[0];
  S().update((d) => {
    const n = d.nodes[fid];
    n.type = 'COMPONENT';
    n.fills = [];
    n.name = sel.length === 1 ? doc.nodes[sel[0]].name : 'Component';
  });
}

export function createMultipleComponents() {
  const s = S();
  const ids = [...s.selection];
  const out: string[] = [];
  for (const id of ids) {
    s.select([id]);
    createComponent();
    out.push(...S().selection);
  }
  s.select(out);
}

/** Display name for instances: the component set name for variants, otherwise the component name. */
export function instanceName(doc: DocumentData, mainId: string) {
  const main = doc.nodes[mainId];
  const set = main?.parentId ? doc.nodes[main.parentId] : undefined;
  return set?.type === 'COMPONENT_SET' ? set.name : main?.name ?? 'Instance';
}

/** Turn a freshly cloned component subtree into a real instance of mainId (children get sourceIds). */
function makeInstanceOf(d: DocumentData, nodeId: string, mainId: string) {
  const c = d.nodes[nodeId];
  for (const k of [...c.children]) removeNode(d, k);
  c.children = [];
  c.type = 'INSTANCE';
  c.mainComponentId = mainId;
  c.overrides = [];
  c.name = instanceName(d, mainId);
  syncInstance(d, nodeId);
}

export function createInstance(mainId: string, x: number, y: number, parentId: string | null = null) {
  const doc = currentDoc();
  const main = doc.nodes[mainId];
  if (!main) return null;
  const inst = createNode('INSTANCE', { name: instanceName(doc, mainId), mainComponentId: mainId, x, y, width: main.width, height: main.height, overrides: [] });
  S().update((d) => {
    insertNode(d as DocumentData, inst, parentId, pageDraft(d));
    if (parentId) { const pa = absPos(d as DocumentData, parentId); inst.x = x - pa.x; inst.y = y - pa.y; d.nodes[inst.id].x = inst.x; d.nodes[inst.id].y = inst.y; }
    syncInstance(d as DocumentData, inst.id);
  });
  S().select([inst.id]);
  return inst.id;
}

export function detachInstance() {
  const s = S();
  const doc = s.doc!;
  const ids = s.selection.filter((id) => doc.nodes[id]?.type === 'INSTANCE');
  if (!ids.length) return;
  s.update((d) => {
    for (const id of ids) {
      const n = d.nodes[id];
      n.type = 'FRAME';
      delete n.mainComponentId;
      n.overrides = [];
      for (const c of descendants(d as DocumentData, id)) {
        const cn = d.nodes[c];
        if (cn.type === 'INSTANCE') continue;
        delete cn.sourceId; cn.overrides = [];
      }
    }
  });
}

export function resetInstance() {
  const s = S();
  const doc = s.doc!;
  const ids = s.selection.map((id) => doc.nodes[id]).filter(Boolean).map((n) => (n.type === 'INSTANCE' ? n.id : null)).filter(Boolean) as string[];
  s.update((d) => {
    for (const id of ids) {
      d.nodes[id].overrides = [];
      for (const c of descendants(d as DocumentData, id)) { d.nodes[c].overrides = []; delete d.nodes[c].sourceId; }
      // force rebuild without overrides: clear children
      for (const c of [...d.nodes[id].children]) removeNode(d as DocumentData, c);
      syncInstance(d as DocumentData, id);
    }
  });
}

export function goToMainComponent() {
  const s = S();
  const n = selectedNodes()[0];
  if (!n) return;
  const mainId = n.mainComponentId;
  if (!mainId || !s.doc!.nodes[mainId]) { s.toast('Main component not found'); return; }
  const page = getPageOf(s.doc!, mainId);
  if (page) s.setState({ pageId: page.id });
  s.select([mainId]);
  setTimeout(zoomToSelection, 0);
}

export function pushOverridesToMain() {
  const s = S();
  const n = selectedNodes()[0];
  if (!n || n.type !== 'INSTANCE' || !n.mainComponentId) return;
  const doc = s.doc!;
  s.update((d) => {
    const main = d.nodes[n.mainComponentId!];
    const ia = n as unknown as Record<string, unknown>;
    for (const k of n.overrides ?? []) (main as unknown as Record<string, unknown>)[k] = JSON.parse(JSON.stringify(ia[k]));
    for (const c of descendants(doc, n.id)) {
      const cn = doc.nodes[c];
      if (cn.sourceId && d.nodes[cn.sourceId] && cn.overrides?.length) {
        const ca = cn as unknown as Record<string, unknown>;
        for (const k of cn.overrides) (d.nodes[cn.sourceId] as unknown as Record<string, unknown>)[k] = JSON.parse(JSON.stringify(ca[k]));
      }
    }
    d.nodes[n.id].overrides = [];
    for (const c of descendants(d as DocumentData, n.id)) d.nodes[c].overrides = [];
  });
  s.toast('Changes pushed to main component');
}

export function parseVariantName(name: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of name.split(',')) {
    const [k, v] = part.split('=').map((x) => x?.trim());
    if (k && v !== undefined) out[k] = v;
  }
  return out;
}

export function variantNameFrom(props: Record<string, string>) {
  return Object.entries(props).map(([k, v]) => `${k}=${v}`).join(', ');
}

export function combineAsVariants() {
  const s = S();
  const doc = s.doc!;
  const ids = sortByTreeOrder(doc, currentPage(), s.selection).filter((id) => doc.nodes[id].type === 'COMPONENT');
  if (ids.length < 1) { s.toast('Select components to combine'); return; }
  const parentId = doc.nodes[ids[0]].parentId;
  const firstPlain = ids.map((id) => doc.nodes[id].name).find((nm) => !nm.includes('='));
  const set = createNode('COMPONENT_SET', { name: firstPlain ?? 'Component' });
  s.update((d) => {
    const pg = pageDraft(d);
    const rect = unionRects(ids.map((id) => absRect(d as DocumentData, id)))!;
    const pAbs = parentId ? absPos(d as DocumentData, parentId) : { x: 0, y: 0 };
    set.x = rect.x - pAbs.x - 20; set.y = rect.y - pAbs.y - 20; set.width = rect.width + 40; set.height = rect.height + 40;
    set.fills = [];
    const list = parentId ? d.nodes[parentId].children : pg.children;
    insertNode(d as DocumentData, set, parentId, pg, list.indexOf(ids[0]));
    ids.forEach((id, i) => {
      reparent(d as DocumentData, id, set.id, pg);
      const c = d.nodes[id];
      if (!Object.keys(parseVariantName(c.name)).length) c.name = `Property 1=${i === 0 ? 'Default' : 'Variant' + (i + 1)}`;
    });
  });
  s.select([set.id]);
}

export function addVariant() {
  const s = S();
  const n = selectedNodes()[0];
  const doc = s.doc!;
  const set = n?.type === 'COMPONENT_SET' ? n : n?.parentId && doc.nodes[n.parentId]?.type === 'COMPONENT_SET' ? doc.nodes[n.parentId] : null;
  if (!set) return;
  const last = doc.nodes[set.children[set.children.length - 1]];
  let newId = '';
  s.update((d) => {
    newId = cloneSubtree(d as DocumentData, last.id);
    const c = d.nodes[newId];
    c.y = last.y + last.height + 20;
    const props = parseVariantName(last.name);
    const k = Object.keys(props)[0] ?? 'Property 1';
    props[k] = 'Variant' + (set.children.length + 1);
    c.name = variantNameFrom(props);
    d.nodes[set.id].children.push(newId);
    const sn = d.nodes[set.id];
    sn.height = Math.max(sn.height, c.y + c.height + 20);
  });
  s.select([newId]);
}

export function componentSetProps(doc: DocumentData, setId: string) {
  const set = doc.nodes[setId];
  const props: Record<string, string[]> = {};
  for (const c of set.children) {
    const p = parseVariantName(doc.nodes[c]?.name ?? '');
    for (const [k, v] of Object.entries(p)) {
      props[k] ??= [];
      if (!props[k].includes(v)) props[k].push(v);
    }
  }
  return props;
}

export function setInstanceVariant(instId: string, key: string, value: string) {
  const s = S();
  const doc = s.doc!;
  const inst = doc.nodes[instId];
  const main = inst.mainComponentId ? doc.nodes[inst.mainComponentId] : undefined;
  if (!main || !main.parentId) return;
  const set = doc.nodes[main.parentId];
  if (set.type !== 'COMPONENT_SET') return;
  const want = { ...parseVariantName(main.name), [key]: value };
  let match = set.children.find((c) => {
    const p = parseVariantName(doc.nodes[c].name);
    return Object.entries(want).every(([k, v]) => p[k] === v);
  });
  if (!match) match = set.children.find((c) => parseVariantName(doc.nodes[c].name)[key] === value);
  if (!match) return;
  s.update((d) => {
    const n = d.nodes[instId];
    n.mainComponentId = match;
    n.overrides = (n.overrides ?? []).filter((k) => k !== 'width' && k !== 'height');
    syncInstance(d as DocumentData, instId);
  });
}

/* ============================================================== arrange */

export function reorder(kind: 'forward' | 'backward' | 'front' | 'back') {
  const s = S();
  const doc = s.doc!;
  const ids = topLevelSelection(doc, s.selection);
  s.update((d) => {
    const pg = pageDraft(d);
    for (const id of ids) {
      const n = d.nodes[id];
      const list = n.parentId ? d.nodes[n.parentId].children : pg.children;
      const i = list.indexOf(id);
      list.splice(i, 1);
      // list order: index 0 = bottom
      if (kind === 'front') list.push(id);
      else if (kind === 'back') list.unshift(id);
      else if (kind === 'forward') list.splice(Math.min(list.length, i + 1), 0, id);
      else list.splice(Math.max(0, i - 1), 0, id);
    }
  });
}

export function align(kind: 'left' | 'right' | 'top' | 'bottom' | 'hcenter' | 'vcenter') {
  const s = S();
  const doc = s.doc!;
  const ids = topLevelSelection(doc, s.selection);
  if (!ids.length) return;
  let target: Rect;
  if (ids.length === 1) {
    const n = doc.nodes[ids[0]];
    if (!n.parentId) return;
    target = absRect(doc, n.parentId);
  } else target = unionRects(ids.map((id) => visualAbsRect(doc, id)))!;
  s.update((d) => {
    for (const id of ids) {
      const r = visualAbsRect(d as DocumentData, id);
      const n = d.nodes[id];
      if (kind === 'left') n.x += target.x - r.x;
      if (kind === 'right') n.x += target.x + target.width - (r.x + r.width);
      if (kind === 'hcenter') n.x += target.x + target.width / 2 - (r.x + r.width / 2);
      if (kind === 'top') n.y += target.y - r.y;
      if (kind === 'bottom') n.y += target.y + target.height - (r.y + r.height);
      if (kind === 'vcenter') n.y += target.y + target.height / 2 - (r.y + r.height / 2);
      n.x = Math.round(n.x * 100) / 100; n.y = Math.round(n.y * 100) / 100;
    }
  });
}

export function distribute(axis: 'h' | 'v') {
  const s = S();
  const doc = s.doc!;
  const ids = topLevelSelection(doc, s.selection);
  if (ids.length < 3) return;
  const rects = ids.map((id) => ({ id, r: visualAbsRect(doc, id) }));
  rects.sort((a, b) => (axis === 'h' ? a.r.x - b.r.x : a.r.y - b.r.y));
  const total = rects.reduce((sum, x) => sum + (axis === 'h' ? x.r.width : x.r.height), 0);
  const first = rects[0].r, last = rects[rects.length - 1].r;
  const span = axis === 'h' ? last.x + last.width - first.x : last.y + last.height - first.y;
  const gap = (span - total) / (rects.length - 1);
  s.update((d) => {
    let pos = axis === 'h' ? first.x : first.y;
    for (const { id, r } of rects) {
      const n = d.nodes[id];
      if (axis === 'h') { n.x += pos - r.x; pos += r.width + gap; } else { n.y += pos - r.y; pos += r.height + gap; }
    }
  });
}

export function tidyUp() {
  const s = S();
  const doc = s.doc!;
  const ids = topLevelSelection(doc, s.selection);
  if (ids.length < 2) return;
  const rects = ids.map((id) => ({ id, r: visualAbsRect(doc, id) }));
  const b = unionRects(rects.map((x) => x.r))!;
  const horizontal = b.width >= b.height;
  rects.sort((a, c) => (horizontal ? a.r.x - c.r.x : a.r.y - c.r.y));
  const gap = 20;
  s.update((d) => {
    let pos = horizontal ? b.x : b.y;
    for (const { id, r } of rects) {
      const n = d.nodes[id];
      if (horizontal) { n.x += pos - r.x; n.y += b.y - r.y; pos += r.width + gap; } else { n.y += pos - r.y; n.x += b.x - r.x; pos += r.height + gap; }
    }
  });
}

export function flip(axis: 'x' | 'y') {
  setProps(S().selection, (n) => {
    if (axis === 'x') n.flipX = !n.flipX; else n.flipY = !n.flipY;
  });
}

export function rotateSelection(deg: number) {
  setProps(S().selection, (n) => { n.rotation = (((n.rotation + deg) % 360) + 540) % 360 - 180; });
}

export function toggleLock() {
  const sel = selectedNodes();
  if (!sel.length) return;
  const lock = !sel.every((n) => n.locked);
  setProps(sel.map((n) => n.id), { locked: lock });
  if (lock) S().select([]);
}

export function toggleVisible() {
  const sel = selectedNodes();
  if (!sel.length) return;
  const vis = !sel.every((n) => n.visible);
  setProps(sel.map((n) => n.id), { visible: vis });
}

export function unlockAll() {
  const doc = currentDoc();
  const ids = Object.values(doc.nodes).filter((n) => n.locked).map((n) => n.id);
  setProps(ids, { locked: false });
}

export function showAllHidden() {
  const doc = currentDoc();
  const ids = Object.values(doc.nodes).filter((n) => !n.visible).map((n) => n.id);
  setProps(ids, { visible: true });
}

export function nudge(dx: number, dy: number) {
  const s = S();
  const ids = topLevelSelection(s.doc!, s.selection).filter((id) => !s.doc!.nodes[id].locked);
  if (!ids.length) return;
  s.update((d) => {
    for (const id of ids) {
      const n = d.nodes[id];
      const p = n.parentId ? d.nodes[n.parentId] : null;
      if (p && p.layout.mode !== 'NONE' && !n.absolutePosition && (p.type === 'FRAME' || p.type === 'COMPONENT' || p.type === 'INSTANCE')) {
        // reorder within auto layout
        const list = p.children;
        const i = list.indexOf(id);
        const dir = (p.layout.mode === 'VERTICAL' ? dy : dx) > 0 ? 1 : -1;
        if ((p.layout.mode === 'VERTICAL' ? dy : dx) === 0) continue;
        const j = Math.max(0, Math.min(list.length - 1, i + dir));
        list.splice(i, 1); list.splice(j, 0, id);
      } else { n.x += dx; n.y += dy; markOverride(n as SceneNode, ['x', 'y']); }
    }
  });
}

/* ============================================================== shapes ops */

export function flattenSelection() {
  const s = S();
  const doc = s.doc!;
  const ids = s.selection.filter((id) => ['RECTANGLE', 'ELLIPSE', 'POLYGON', 'STAR', 'LINE', 'VECTOR', 'BOOLEAN_OPERATION'].includes(doc.nodes[id]?.type));
  if (!ids.length) return;
  s.update((d) => {
    for (const id of ids) {
      const n = d.nodes[id];
      if (n.type === 'BOOLEAN_OPERATION') {
        // flatten: keep as is but mark name
        continue;
      }
      if (n.type !== 'VECTOR' && n.type !== 'LINE') {
        n.points = shapeToPoints(n as SceneNode);
        n.closed = true;
      }
      n.type = 'VECTOR';
      n.name = 'Vector';
    }
  });
}

export function outlineStroke() {
  const s = S();
  const doc = s.doc!;
  const ids = s.selection.filter((id) => doc.nodes[id]?.strokes.length);
  if (!ids.length) return;
  s.update((d) => {
    for (const id of ids) {
      const n = d.nodes[id];
      const w = n.strokeWeight;
      if (n.type === 'LINE' && n.points && n.points.length === 2) {
        const [a, b] = n.points;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const ox = (Math.sin(ang) * w) / 2, oy = (-Math.cos(ang) * w) / 2;
        n.points = [{ x: a.x + ox, y: a.y + oy }, { x: b.x + ox, y: b.y + oy }, { x: b.x - ox, y: b.y - oy }, { x: a.x - ox, y: a.y - oy }];
        n.closed = true;
        n.type = 'VECTOR';
      }
      n.fills = n.strokes.map((p) => ({ ...p, id: uid('p') }));
      if (n.type !== 'VECTOR') {
        n.strokeAlign = 'INSIDE';
      } else n.strokes = [];
      n.name = n.name + ' (outlined)';
    }
  });
}

export function swapFillStroke() {
  setProps(S().selection, (n) => {
    const f = n.fills; n.fills = n.strokes; n.strokes = f;
    if (n.strokes.length && !n.strokeWeight) n.strokeWeight = 1;
  });
}

export function removeFill() { setProps(S().selection, { fills: [] }); }
export function removeStroke() { setProps(S().selection, { strokes: [] }); }

export function useAsMask() {
  const sel = selectedNodes();
  if (!sel.length) return;
  if (sel.length === 1 && sel[0].isMask) { setProps([sel[0].id], { isMask: false }); return; }
  groupSelection('GROUP', undefined, true);
}

export function setOpacityKey(v: number) {
  setProps(S().selection, { opacity: v });
}

/* ============================================================== pages */

export function addPage(name?: string) {
  const s = S();
  const p = createPage(name ?? `Page ${s.doc!.pages.length + 1}`);
  s.update((d) => { d.pages.push(p); });
  s.setState({ pageId: p.id, selection: [] });
  return p.id;
}

export function deletePage(id: string) {
  const s = S();
  if (s.doc!.pages.length <= 1) { s.toast("Can't delete the only page"); return; }
  s.update((d) => {
    const page = d.pages.find((p) => p.id === id)!;
    for (const c of [...page.children]) removeNode(d as DocumentData, c);
    d.pages = d.pages.filter((p) => p.id !== id);
  });
  if (s.pageId === id) s.setState({ pageId: S().doc!.pages[0].id, selection: [] });
}

export function duplicatePage(id: string) {
  const s = S();
  const np = createPage();
  s.update((d) => {
    const src = d.pages.find((p) => p.id === id)!;
    np.name = src.name + ' copy';
    np.background = src.background;
    const idx = d.pages.indexOf(src);
    d.pages.splice(idx + 1, 0, np);
    const newPage = d.pages[idx + 1];
    for (const c of src.children) {
      const nid = cloneSubtree(d as DocumentData, c);
      newPage.children.push(nid);
    }
  });
  s.setState({ pageId: np.id, selection: [] });
}

export function renamePage(id: string, name: string) {
  S().update((d) => { const p = d.pages.find((x) => x.id === id); if (p) p.name = name; });
}

export function movePage(id: string, toIndex: number) {
  S().update((d) => {
    const i = d.pages.findIndex((p) => p.id === id);
    const [p] = d.pages.splice(i, 1);
    d.pages.splice(Math.max(0, Math.min(d.pages.length, toIndex)), 0, p);
  });
}

export function goToPage(id: string) {
  S().setState({ pageId: id, selection: [], editingTextId: null });
  setTimeout(zoomToFit, 0);
}

/* ============================================================== layers panel move */

export function moveLayer(id: string, targetParent: string | null, index: number) {
  const s = S();
  const doc = s.doc!;
  if (id === targetParent || (targetParent && isAncestor(doc, id, targetParent))) return;
  s.update((d) => {
    const pg = pageDraft(d);
    const n = d.nodes[id];
    const oldList = n.parentId ? d.nodes[n.parentId].children : pg.children;
    const oldIndex = oldList.indexOf(id);
    let idx = index;
    if (n.parentId === targetParent && oldIndex < index) idx--;
    reparent(d as DocumentData, id, targetParent, pg, idx);
  });
}

/* ============================================================== styles */

export function createStyle(type: StyleDef['type'], fromNodeId?: string, name?: string): string {
  const s = S();
  const n = fromNodeId ? s.doc!.nodes[fromNodeId] : undefined;
  const id = uid('s');
  const count = s.doc!.styles.filter((x) => x.type === type).length + 1;
  const style: StyleDef = {
    id, type, name: name ?? `${type === 'FILL' ? 'Color' : type === 'TEXT' ? 'Text' : type === 'EFFECT' ? 'Effect' : 'Grid'} style ${count}`,
    fills: type === 'FILL' ? JSON.parse(JSON.stringify(n?.fills?.length ? n.fills : [solid('#0D99FF')])) : undefined,
    text: type === 'TEXT' && n?.text ? typographyOf(n.text) : type === 'TEXT' ? { fontFamily: 'Inter', fontSize: 16, fontWeight: 400 } : undefined,
    effects: type === 'EFFECT' ? JSON.parse(JSON.stringify(n?.effects ?? [])) : undefined,
    grids: type === 'GRID' ? JSON.parse(JSON.stringify(n?.layoutGrids ?? [])) : undefined,
  };
  s.update((d) => {
    d.styles.push(style);
    if (n) {
      const nd = d.nodes[n.id];
      if (type === 'FILL') { nd.fillStyleId = id; }
      if (type === 'TEXT') nd.textStyleId = id;
      if (type === 'EFFECT') nd.effectStyleId = id;
      if (type === 'GRID') nd.gridStyleId = id;
    }
  });
  return id;
}

const TYPO_KEYS = ['fontFamily', 'fontWeight', 'italic', 'fontSize', 'lineHeight', 'letterSpacing', 'paragraphSpacing', 'decoration', 'textCase'] as const;
export function typographyOf(t: Partial<import('../model/types').TextProps>) {
  const out: Record<string, unknown> = {};
  for (const k of TYPO_KEYS) if (t[k] !== undefined) out[k] = t[k];
  return out as Partial<import('../model/types').TextProps>;
}

export function applyStyle(styleId: string, ids = S().selection, target: 'fill' | 'stroke' = 'fill') {
  const s = S();
  const st = s.doc!.styles.find((x) => x.id === styleId);
  if (!st) return;
  setProps(ids, (n) => {
    if (st.type === 'FILL' && st.fills) {
      const fills = JSON.parse(JSON.stringify(st.fills)) as Paint[];
      fills.forEach((f) => { f.id = uid('p'); f.styleId = styleId; });
      if (target === 'fill') { n.fills = fills; n.fillStyleId = styleId; } else { n.strokes = fills; n.strokeStyleId = styleId; }
    }
    if (st.type === 'TEXT' && n.text && st.text) { Object.assign(n.text, typographyOf(st.text)); n.textStyleId = styleId; }
    if (st.type === 'EFFECT' && st.effects) { n.effects = JSON.parse(JSON.stringify(st.effects)); n.effectStyleId = styleId; }
    if (st.type === 'GRID' && st.grids) { n.layoutGrids = JSON.parse(JSON.stringify(st.grids)); n.gridStyleId = styleId; }
  });
}

export function updateStyle(styleId: string, patch: Partial<StyleDef>) {
  S().update((d) => {
    const st = d.styles.find((x) => x.id === styleId);
    if (!st) return;
    Object.assign(st, patch);
    // propagate
    for (const n of Object.values(d.nodes)) {
      if (n.fillStyleId === styleId && st.fills) n.fills = JSON.parse(JSON.stringify(st.fills)).map((f: Paint) => ({ ...f, id: uid('p'), styleId }));
      if (n.strokeStyleId === styleId && st.fills) n.strokes = JSON.parse(JSON.stringify(st.fills)).map((f: Paint) => ({ ...f, id: uid('p'), styleId }));
      if (n.textStyleId === styleId && st.text && n.text) Object.assign(n.text, typographyOf(st.text));
      if (n.effectStyleId === styleId && st.effects) n.effects = JSON.parse(JSON.stringify(st.effects));
      if (n.gridStyleId === styleId && st.grids) n.layoutGrids = JSON.parse(JSON.stringify(st.grids));
    }
  });
}

export function deleteStyle(styleId: string) {
  S().update((d) => {
    d.styles = d.styles.filter((x) => x.id !== styleId);
    for (const n of Object.values(d.nodes)) {
      if (n.fillStyleId === styleId) delete n.fillStyleId;
      if (n.strokeStyleId === styleId) delete n.strokeStyleId;
      if (n.textStyleId === styleId) delete n.textStyleId;
      if (n.effectStyleId === styleId) delete n.effectStyleId;
      if (n.gridStyleId === styleId) delete n.gridStyleId;
    }
  });
}

export function detachStyle(kind: 'fill' | 'stroke' | 'text' | 'effect' | 'grid') {
  setProps(S().selection, (n) => {
    if (kind === 'fill') { delete n.fillStyleId; n.fills.forEach((f) => delete f.styleId); }
    if (kind === 'stroke') { delete n.strokeStyleId; n.strokes.forEach((f) => delete f.styleId); }
    if (kind === 'text') delete n.textStyleId;
    if (kind === 'effect') delete n.effectStyleId;
    if (kind === 'grid') delete n.gridStyleId;
  });
}

/* ============================================================== variables */

export function addCollection(name = 'Collection'): string {
  const c: VariableCollection = { id: uid('vc'), name, modes: [{ id: uid('m'), name: 'Mode 1' }] };
  S().update((d) => { d.collections.push(c); });
  return c.id;
}

export function addVariable(collectionId: string, type: VariableType, name?: string): string {
  const s = S();
  const col = s.doc!.collections.find((c) => c.id === collectionId)!;
  const count = s.doc!.variables.filter((v) => v.collectionId === collectionId).length + 1;
  const def = type === 'COLOR' ? '#FFFFFF' : type === 'NUMBER' ? 0 : type === 'STRING' ? 'Text' : true;
  const v: Variable = {
    id: uid('v'), collectionId, type,
    name: name ?? `${type === 'COLOR' ? 'color' : type === 'NUMBER' ? 'number' : type === 'STRING' ? 'string' : 'boolean'}-${count}`,
    values: Object.fromEntries(col.modes.map((m) => [m.id, def])),
  };
  s.update((d) => { d.variables.push(v); });
  return v.id;
}

export function updateVariable(id: string, patch: Partial<Variable>) {
  S().update((d) => { const v = d.variables.find((x) => x.id === id); if (v) Object.assign(v, patch); });
}

export function setVariableValue(id: string, modeId: string, value: Variable['values'][string]) {
  S().update((d) => { const v = d.variables.find((x) => x.id === id); if (v) v.values[modeId] = value; });
}

export function deleteVariable(id: string) {
  S().update((d) => {
    d.variables = d.variables.filter((v) => v.id !== id);
    for (const n of Object.values(d.nodes)) {
      n.fills.forEach((f) => { if (f.variableId === id) delete f.variableId; });
      n.strokes.forEach((f) => { if (f.variableId === id) delete f.variableId; });
      if (n.boundVars) for (const k of Object.keys(n.boundVars) as (keyof NonNullable<SceneNode['boundVars']>)[]) if (n.boundVars[k] === id) delete n.boundVars[k];
    }
  });
}

export function addMode(collectionId: string) {
  S().update((d) => {
    const c = d.collections.find((x) => x.id === collectionId)!;
    const m = { id: uid('m'), name: `Mode ${c.modes.length + 1}` };
    const base = c.modes[0]?.id;
    c.modes.push(m);
    for (const v of d.variables) if (v.collectionId === collectionId) v.values[m.id] = JSON.parse(JSON.stringify(v.values[base] ?? null));
  });
}

export function renameMode(collectionId: string, modeId: string, name: string) {
  S().update((d) => { const m = d.collections.find((x) => x.id === collectionId)?.modes.find((x) => x.id === modeId); if (m) m.name = name; });
}

export function deleteMode(collectionId: string, modeId: string) {
  S().update((d) => {
    const c = d.collections.find((x) => x.id === collectionId)!;
    if (c.modes.length <= 1) return;
    c.modes = c.modes.filter((m) => m.id !== modeId);
    for (const v of d.variables) if (v.collectionId === collectionId) delete v.values[modeId];
  });
}

export function deleteCollection(id: string) {
  const vars = S().doc!.variables.filter((v) => v.collectionId === id).map((v) => v.id);
  vars.forEach(deleteVariable);
  S().update((d) => { d.collections = d.collections.filter((c) => c.id !== id); });
}

/* ============================================================== comments */

export function addComment(x: number, y: number, text: string, nodeId?: string) {
  const s = S();
  const t: CommentThread = {
    id: uid('c'), pageId: s.pageId, x, y, nodeId, resolved: false, createdAt: Date.now(),
    replies: [{ id: uid('cr'), author: s.prefs.userName, text, createdAt: Date.now() }],
  };
  s.update((d) => { d.comments.push(t); });
  s.setState({ activeCommentId: t.id, draftComment: null });
  return t.id;
}

export function replyComment(id: string, text: string) {
  const s = S();
  s.update((d) => { d.comments.find((c) => c.id === id)?.replies.push({ id: uid('cr'), author: s.prefs.userName, text, createdAt: Date.now() }); });
}

export function resolveComment(id: string, resolved = true) {
  S().update((d) => { const c = d.comments.find((x) => x.id === id); if (c) c.resolved = resolved; });
}

export function deleteComment(id: string) {
  S().update((d) => { d.comments = d.comments.filter((c) => c.id !== id); });
  S().setState({ activeCommentId: null });
}

/* ============================================================== misc */

export function newNodeOfType(type: NodeType, rect: Rect, parentId: string | null, extra: Partial<SceneNode> = {}) {
  const pa = parentId ? absPos(currentDoc(), parentId) : { x: 0, y: 0 };
  const n = createNode(type, { x: rect.x - pa.x, y: rect.y - pa.y, width: rect.width, height: rect.height, ...extra });
  return n;
}

export function batchRename(ids: string[], find: string, replace: string, renameTo: string) {
  const doc = currentDoc();
  const ordered = sortByTreeOrder(doc, currentPage(), ids);
  S().update((d) => {
    ordered.forEach((id, i) => {
      const n = d.nodes[id];
      if (renameTo) n.name = renameTo.replace(/\$&/g, n.name).replace(/\$n+/gi, (m) => String(i + 1).padStart(m.length - 1, '0')).replace(/\$N+/g, (m) => String(ordered.length - i).padStart(m.length - 1, '0'));
      else if (find) n.name = n.name.split(find).join(replace);
    });
  });
}

export function ensureFlowStart(nodeId: string) {
  S().update((d) => {
    const pg = pageDraft(d);
    if (!pg.flowStarts.some((f) => f.nodeId === nodeId)) pg.flowStarts.push({ id: uid('fl'), nodeId, name: `Flow ${pg.flowStarts.length + 1}` });
  });
}

export function removeFlowStart(nodeId: string) {
  S().update((d) => { const pg = pageDraft(d); pg.flowStarts = pg.flowStarts.filter((f) => f.nodeId !== nodeId); });
}

export function topFrameOf(doc: DocumentData, id: string): SceneNode | undefined {
  let n: SceneNode | undefined = doc.nodes[id];
  let top: SceneNode | undefined;
  while (n) {
    if (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE') top = n;
    n = n.parentId ? doc.nodes[n.parentId] : undefined;
    if (n?.type === 'SECTION') break;
  }
  return top;
}

/** Rename a variant property key across every variant in a component set. */
export function renameVariantProperty(setId: string, oldKey: string, newKey: string) {
  const key = newKey.trim();
  if (!key || key === oldKey) return;
  S().update((d) => {
    for (const c of d.nodes[setId].children) {
      const n = d.nodes[c];
      const props = parseVariantName(n.name);
      if (!(oldKey in props)) continue;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(props)) next[k === oldKey ? key : k] = v;
      n.name = variantNameFrom(next);
    }
  });
}
