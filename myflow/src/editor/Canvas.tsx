import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  useEditor, S, currentDoc, currentPage, screenToWorld, worldToScreen, zoomAt, clampZoom, containerAt, setProps, addNode,
  duplicateSelection, newNodeOfType, selectionBounds,
} from '../store/editor';
import { RenderCtx, SvgNode, type RenderOptions } from '../render/NodeRenderer';
import type { DocumentData, NodeType, Reaction, SceneNode, VectorPoint } from '../model/types';
import { absPos, absRect, isAncestor, reparent, topLevelSelection, unionRects, visualAbsRect, type Rect, descendants } from '../model/tree';
import { createNode, solid, uid, reaction as newReaction } from '../model/defaults';
import { resizeNode } from '../model/layout';
import { normalizePoints, smoothPoints, pointsPath, nodePath } from '../render/geometry';
import {
  pickTarget, marqueeScope, marqueeSelect, computeSnap, autoLayoutIndex, autoLayoutIndicator, isAutoLayoutParent, rotatePoint, isTransparent, chainOf, isFrameLike,
} from './canvasLogic';
import { placeImageAt } from '../commands';
import { layoutText, resolveLineHeight, fontString } from '../model/text';
import { resolveVariable } from '../model/layout';

export const canvasKeys = { space: false };

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type Drag =
  | { kind: 'pan'; sx: number; sy: number; panX: number; panY: number }
  | { kind: 'marquee'; start: { x: number; y: number }; scope: string | null; base: string[]; additive: boolean }
  | { kind: 'pending-move'; sx: number; sy: number; start: { x: number; y: number }; alt: boolean; hitId: string | null }
  | { kind: 'move'; start: { x: number; y: number }; ids: string[]; orig: Map<string, { x: number; y: number }>; bounds: Rect; autoIds: Set<string> }
  | { kind: 'resize'; handle: Handle; start: { x: number; y: number }; base: Rect; rotation: number; ids: string[]; orig: Map<string, Rect>; baseDoc: DocumentData; scaleTool: boolean }
  | { kind: 'rotate'; center: { x: number; y: number }; startAngle: number; ids: string[]; orig: Map<string, { rot: number; cx: number; cy: number; x: number; y: number; w: number; h: number }> }
  | { kind: 'create'; tool: string; start: { x: number; y: number }; nodeId: string | null; parentId: string | null }
  | { kind: 'text'; start: { x: number; y: number }; sx: number; sy: number }
  | { kind: 'pencil'; points: { x: number; y: number }[] }
  | { kind: 'pen-handle'; index: number }
  | { kind: 'noodle'; fromId: string }
  | { kind: 'vpoint'; nodeId: string; index: number; part: 'p' | 'in' | 'out'; origAbs: { x: number; y: number } }
  | { kind: 'radius'; nodeId: string; corner: number }
  | { kind: 'guide'; guideId: string; axis: 'X' | 'Y' }
  | { kind: 'image-place'; start: { x: number; y: number } }
  | { kind: 'text-edit'; id: string };

interface UiState {
  marquee?: Rect | null;
  guides?: { x1: number; y1: number; x2: number; y2: number }[];
  insertLine?: { x1: number; y1: number; x2: number; y2: number } | null;
  ghost?: Rect | null;
  noodle?: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  cursor?: { x: number; y: number } | null;
  dropTarget?: string | null;
}

const penState: { nodeId: string | null; points: VectorPoint[]; parentId: string | null } = { nodeId: null, points: [], parentId: null };

function writePen(closed = false) {
  if (!penState.nodeId) return;
  const id = penState.nodeId;
  const norm = normalizePoints(penState.points);
  S().update((d) => {
    const n = d.nodes[id];
    if (!n) return;
    const pa = n.parentId && d.nodes[n.parentId] ? absPos(d as DocumentData, n.parentId) : { x: 0, y: 0 };
    n.x = norm.x - pa.x; n.y = norm.y - pa.y; n.width = Math.max(norm.width, 0.01); n.height = Math.max(norm.height, 0.01);
    n.points = norm.points;
    n.closed = closed;
  }, { commit: false });
}

export function finishPen() {
  if (!penState.nodeId) return;
  const id = penState.nodeId;
  if (penState.points.length < 2) {
    S().update((d) => {
      const n = d.nodes[id];
      if (n?.parentId && d.nodes[n.parentId]) d.nodes[n.parentId].children = d.nodes[n.parentId].children.filter((c) => c !== id);
      const page = d.pages.find((p) => p.id === S().pageId)!; page.children = page.children.filter((c) => c !== id);
      delete d.nodes[id];
    }, { commit: false });
    S().end();
    S().select([]);
  } else {
    S().end();
    S().select([id]);
  }
  penState.nodeId = null;
  penState.points = [];
  if (!S().prefs.keepToolSelected) S().setTool('MOVE');
}

export function penActive() { return !!penState.nodeId; }

/* ----------------------------------------------------------------- page renderer */

function useNodeHook(id: string) { return useEditor((s) => s.doc?.nodes[id]); }
function useNodesHook(ids: string[]) { return useEditor(useShallow((s) => ids.map((id) => s.doc?.nodes[id]))); }

const EMPTY_IDS: string[] = [];
const PageNodes = React.memo(function PageNodes() {
  const children = useEditor((s) => s.doc?.pages.find((p) => p.id === s.pageId)?.children ?? EMPTY_IDS);
  return <>{children.map((id) => <SvgNode key={id} id={id} />)}</>;
});

/* ----------------------------------------------------------------- canvas */

export function Canvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [ui, setUi] = useState<UiState>({});
  const zoom = useEditor((s) => s.zoom);
  const panX = useEditor((s) => s.panX);
  const panY = useEditor((s) => s.panY);
  const tool = useEditor((s) => s.tool);
  const outlines = useEditor((s) => s.view.outlines);
  const showGrids = useEditor((s) => s.view.layoutGrids);
  const editingTextId = useEditor((s) => s.editingTextId);
  const pageBg = useEditor((s) => s.doc?.pages.find((p) => p.id === s.pageId)?.background ?? '#F5F5F5');
  const pixelPreview = useEditor((s) => s.view.pixelPreview);
  const dotGrid = useEditor((s) => s.view.dotGrid);
  const [spaceDown, setSpaceDown] = useState(false);

  // viewport size
  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => S().setState({ viewport: { width: el.clientWidth, height: el.clientHeight } }));
    ro.observe(el);
    S().setState({ viewport: { width: el.clientWidth, height: el.clientHeight } });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping()) { canvasKeys.space = true; setSpaceDown(true); }
      if (e.key === 'Alt') S().setState({ altDown: true });
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === 'Space') { canvasKeys.space = false; setSpaceDown(false); }
      if (e.key === 'Alt') S().setState({ altDown: false });
    };
    const blur = () => { canvasKeys.space = false; setSpaceDown(false); S().setState({ altDown: false }); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); };
  }, []);

  // wheel zoom/pan (non-passive)
  useEffect(() => {
    const el = wrapRef.current!;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.panel, .toolbar, .comment-pop, .popover')) return;
      e.preventDefault();
      const s = S();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * (e.ctrlKey && !e.metaKey ? 0.01 : 0.003));
        zoomAt(s.zoom * factor, e.clientX - rect.left, e.clientY - rect.top);
      } else {
        const inv = s.prefs.invertZoom ? -1 : 1;
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        s.setState({ panX: s.panX - dx * inv, panY: s.panY - dy * inv });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const ctx = useMemo(() => ({
    useNode: useNodeHook,
    useNodes: useNodesHook,
    opts: { prefix: 'c', interactive: true, outlines, showGrids, zoom, hideIds: editingTextId ? new Set([editingTextId]) : undefined } as RenderOptions,
  }), [outlines, showGrids, zoom, editingTextId]);

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const worldPoint = (e: { clientX: number; clientY: number }) => { const p = localPoint(e); return screenToWorld(p.x, p.y); };

  const hitIdFrom = (target: EventTarget | null): string | null => {
    const el = (target as Element | null)?.closest?.('[data-id]');
    if (!el || !el.closest('.scene')) return null;
    return el.getAttribute('data-id');
  };

  const snapPx = (v: number) => (S().prefs.snapToPixel ? Math.round(v) : v);
  /** hit test by screen point (works while pointer capture is active) */
  const hitAt = (e: { clientX: number; clientY: number }): string | null => {
    for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
      if (el.closest('.panel, .toolbar')) return null;
      const h = hitIdFrom(el);
      if (h) return h;
    }
    return null;
  };

  /* --------------------------------------------------------- pointer down */
  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.panel, .toolbar, .comment-pop, .comment-pin, .text-editor, .frame-label, .section-label, .ruler, .popover, .menu')) return;
    const s = S();
    if (!s.doc) return;
    if (s.contextMenu) s.setState({ contextMenu: null });
    (document.activeElement as HTMLElement | null)?.blur?.();
    wrapRef.current?.focus();
    const lp = localPoint(e);
    const wp = screenToWorld(lp.x, lp.y);
    if (e.button === 2) return; // context menu handles
    // pan
    if (e.button === 1 || canvasKeys.space || s.tool === 'HAND') {
      dragRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, panX: s.panX, panY: s.panY };
      capture(e);
      return;
    }
    const handle = target.closest('[data-handle]')?.getAttribute('data-handle');
    const guideEl = target.closest('[data-guide]');
    if (guideEl) {
      dragRef.current = { kind: 'guide', guideId: guideEl.getAttribute('data-guide')!, axis: guideEl.getAttribute('data-axis') as 'X' | 'Y' };
      s.begin();
      capture(e);
      return;
    }
    const readOnly = s.mode === 'dev';
    // vector editing
    if (s.editingVectorId) {
      const vp = target.closest('[data-vpoint]')?.getAttribute('data-vpoint');
      if (vp) {
        const [idx, part] = vp.split(':');
        const n = s.doc.nodes[s.editingVectorId];
        const ap = absPos(s.doc, n.id);
        const p = n.points![+idx];
        const origAbs = part === 'p' ? { x: ap.x + p.x, y: ap.y + p.y } : part === 'in' ? { x: ap.x + p.x + (p.inX ?? 0), y: ap.y + p.y + (p.inY ?? 0) } : { x: ap.x + p.x + (p.outX ?? 0), y: ap.y + p.y + (p.outY ?? 0) };
        dragRef.current = { kind: 'vpoint', nodeId: n.id, index: +idx, part: part as 'p', origAbs };
        s.begin();
        capture(e);
        return;
      }
      const hit = hitIdFrom(target);
      if (hit !== s.editingVectorId) s.setState({ editingVectorId: null });
      else return;
    }
    if (handle && !readOnly && (s.tool === 'MOVE' || s.tool === 'SCALE')) {
      if (handle === 'noodle') {
        const id = s.selection[0];
        dragRef.current = { kind: 'noodle', fromId: id };
        capture(e);
        return;
      }
      if (handle.startsWith('radius')) {
        dragRef.current = { kind: 'radius', nodeId: s.selection[0], corner: +handle.split(':')[1] };
        s.begin();
        capture(e);
        return;
      }
      if (handle === 'rot') { startRotate(wp); capture(e); return; }
      startResize(handle as Handle, wp, e.altKey);
      capture(e);
      return;
    }
    // commenting
    if (s.tool === 'COMMENT') {
      const hit = hitIdFrom(target);
      s.setState({ draftComment: { x: wp.x, y: wp.y }, activeCommentId: null, hoverId: null, selection: hit ? s.selection : s.selection });
      return;
    }
    if (readOnly) {
      const hit = hitIdFrom(target);
      const t = pickTarget(s.doc, hit, { deep: e.metaKey || e.ctrlKey, selection: s.selection });
      s.select(t ? [t] : []);
      return;
    }
    // drawing tools
    switch (s.tool) {
      case 'FRAME': case 'SECTION': case 'SLICE': case 'RECTANGLE': case 'ELLIPSE': case 'LINE': case 'ARROW': case 'POLYGON': case 'STAR': {
        let parentId = containerAt(wp.x, wp.y);
        if (s.tool === 'SECTION' && parentId && s.doc.nodes[parentId].type !== 'SECTION') parentId = null;
        if (parentId && s.doc.nodes[parentId].type === 'COMPONENT_SET') parentId = null;
        dragRef.current = { kind: 'create', tool: s.tool, start: { x: snapPx(wp.x), y: snapPx(wp.y) }, nodeId: null, parentId };
        s.begin();
        capture(e);
        return;
      }
      case 'TEXT': {
        const hit = hitIdFrom(target);
        if (hit && s.doc.nodes[hit]?.type === 'TEXT') {
          e.preventDefault();
          s.select([hit]);
          dragRef.current = { kind: 'text-edit', id: hit };
          capture(e);
          return;
        }
        dragRef.current = { kind: 'text', start: wp, sx: e.clientX, sy: e.clientY };
        capture(e);
        return;
      }
      case 'IMAGE': {
        if (!s.imageToPlace.length) { s.setTool('MOVE'); break; }
        dragRef.current = { kind: 'image-place', start: wp };
        capture(e);
        return;
      }
      case 'PENCIL': {
        dragRef.current = { kind: 'pencil', points: [wp] };
        capture(e);
        return;
      }
      case 'PEN': {
        const z = s.zoom;
        if (!penState.nodeId) {
          const parentId = containerAt(wp.x, wp.y);
          const pa = parentId ? absPos(s.doc, parentId) : { x: 0, y: 0 };
          const n = createNode('VECTOR', { name: 'Vector', x: wp.x - pa.x, y: wp.y - pa.y, width: 0.01, height: 0.01, points: [{ x: 0, y: 0 }], closed: false, strokes: [solid('#000000')], fills: [] });
          s.begin();
          s.update((d) => {
            d.nodes[n.id] = n;
            n.parentId = parentId;
            if (parentId) d.nodes[parentId].children.push(n.id);
            else d.pages.find((p) => p.id === s.pageId)!.children.push(n.id);
          }, { commit: false });
          penState.parentId = parentId;
          penState.nodeId = n.id;
          penState.points = [{ x: snapPx(wp.x), y: snapPx(wp.y) }];
          s.select([n.id]);
        } else {
          const first = penState.points[0];
          if (penState.points.length >= 2 && Math.hypot((first.x - wp.x) * z, (first.y - wp.y) * z) < 8) {
            writePen(true);
            finishPen();
            return;
          }
          let p = { x: snapPx(wp.x), y: snapPx(wp.y) };
          if (e.shiftKey) {
            const last = penState.points[penState.points.length - 1];
            const ang = Math.round(Math.atan2(p.y - last.y, p.x - last.x) / (Math.PI / 4)) * (Math.PI / 4);
            const len = Math.hypot(p.x - last.x, p.y - last.y);
            p = { x: last.x + Math.cos(ang) * len, y: last.y + Math.sin(ang) * len };
          }
          penState.points.push(p);
          writePen(false);
        }
        dragRef.current = { kind: 'pen-handle', index: penState.points.length - 1 };
        capture(e);
        return;
      }
      default: break;
    }
    // MOVE / SCALE tool
    const hit = hitIdFrom(target);
    const deep = e.metaKey || e.ctrlKey;
    let t = pickTarget(s.doc, hit, { deep, selection: s.selection });
    const selB = selectionBounds();
    const insideSel = selB && wp.x >= selB.x && wp.x <= selB.x + selB.width && wp.y >= selB.y && wp.y <= selB.y + selB.height;
    const tInsideSelection = !!t && (s.selection.includes(t) || s.selection.some((sid) => isAncestor(s.doc!, sid, t!)));
    const selectionAncestorOfT = !!t && s.selection.some((sid) => isAncestor(s.doc!, t!, sid));
    if ((!t || (!tInsideSelection && !selectionAncestorOfT)) && insideSel && s.selection.length && !e.shiftKey) {
      dragRef.current = { kind: 'pending-move', sx: e.clientX, sy: e.clientY, start: wp, alt: e.altKey, hitId: null };
      capture(e);
      return;
    }
    if (t) {
      if (e.shiftKey) { s.toggleSelect(t); if (!S().selection.includes(t)) return; }
      else if (!s.selection.includes(t)) s.select([t]);
      s.setState({ editingTextId: null });
      dragRef.current = { kind: 'pending-move', sx: e.clientX, sy: e.clientY, start: wp, alt: e.altKey, hitId: t };
      capture(e);
      return;
    }
    // marquee
    if (!e.shiftKey) s.select([]);
    dragRef.current = { kind: 'marquee', start: wp, scope: marqueeScope(s.doc, hit), base: e.shiftKey ? s.selection : [], additive: e.shiftKey };
    capture(e);
  };

  const capture = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const startResize = (handle: Handle, wp: { x: number; y: number }, _alt: boolean) => {
    const s = S();
    const doc = s.doc!;
    const ids = topLevelSelection(doc, s.selection).filter((id) => !doc.nodes[id].locked);
    if (!ids.length) return;
    const single = ids.length === 1 ? doc.nodes[ids[0]] : null;
    const rotation = single?.rotation ?? 0;
    const base = single ? absRect(doc, single.id) : selectionBounds(ids)!;
    const orig = new Map(ids.map((id) => [id, rotation ? absRect(doc, id) : visualAbsRect(doc, id)]));
    for (const id of ids) orig.set(id, absRect(doc, id));
    dragRef.current = { kind: 'resize', handle, start: wp, base, rotation, ids, orig, baseDoc: doc, scaleTool: s.tool === 'SCALE' };
    s.begin();
  };

  const startRotate = (wp: { x: number; y: number }) => {
    const s = S();
    const doc = s.doc!;
    const ids = topLevelSelection(doc, s.selection).filter((id) => !doc.nodes[id].locked);
    if (!ids.length) return;
    const b = ids.length === 1 ? absRect(doc, ids[0]) : selectionBounds(ids)!;
    const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const orig = new Map(ids.map((id) => {
      const n = doc.nodes[id];
      const r = absRect(doc, id);
      return [id, { rot: n.rotation, cx: r.x + r.width / 2, cy: r.y + r.height / 2, x: n.x, y: n.y, w: n.width, h: n.height }];
    }));
    dragRef.current = { kind: 'rotate', center, startAngle: Math.atan2(wp.y - center.y, wp.x - center.x), ids, orig };
    s.begin();
  };

  /* --------------------------------------------------------- pointer move */
  const onPointerMove = (e: React.PointerEvent) => {
    const s = S();
    if (!s.doc) return;
    const lp = localPoint(e);
    const wp = screenToWorld(lp.x, lp.y);
    const d = dragRef.current;
    if (!d) {
      // hover
      if (s.tool === 'PEN' && penState.nodeId) setUi((u) => ({ ...u, cursor: wp }));
      const target = e.target as HTMLElement;
      if (target.closest('.panel, .toolbar')) { if (s.hoverId) s.setState({ hoverId: null }); return; }
      const hit = hitIdFrom(target);
      const t = s.tool === 'MOVE' || s.tool === 'SCALE' || s.mode === 'dev' ? pickTarget(s.doc, hit, { deep: e.metaKey || e.ctrlKey, selection: s.selection, forHover: true }) : null;
      if (t !== s.hoverId) s.setState({ hoverId: t });
      return;
    }
    switch (d.kind) {
      case 'pan': s.setState({ panX: d.panX + (e.clientX - d.sx), panY: d.panY + (e.clientY - d.sy) }); break;
      case 'marquee': {
        const r = { x: Math.min(d.start.x, wp.x), y: Math.min(d.start.y, wp.y), width: Math.abs(wp.x - d.start.x), height: Math.abs(wp.y - d.start.y) };
        setUi((u) => ({ ...u, marquee: r }));
        const picked = marqueeSelect(s.doc, d.scope, r);
        const next = d.additive ? [...new Set([...d.base, ...picked])] : picked;
        if (next.join() !== s.selection.join()) s.setState({ selection: next });
        break;
      }
      case 'pending-move': {
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) break;
        s.begin();
        if (d.alt) duplicateSelection();
        const doc = S().doc!;
        const ids = topLevelSelection(doc, S().selection).filter((id) => !doc.nodes[id].locked);
        if (!ids.length) { dragRef.current = null; S().end(); break; }
        const orig = new Map(ids.map((id) => [id, { x: doc.nodes[id].x, y: doc.nodes[id].y }]));
        const autoIds = new Set(ids.filter((id) => isAutoLayoutParent(doc, doc.nodes[id].parentId) && !doc.nodes[id].absolutePosition));
        dragRef.current = { kind: 'move', start: d.start, ids, orig, bounds: selectionBounds(ids)!, autoIds };
        onPointerMove(e);
        break;
      }
      case 'move': {
        const doc = s.doc;
        let dx = wp.x - d.start.x, dy = wp.y - d.start.y;
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        let moved = { ...d.bounds, x: d.bounds.x + dx, y: d.bounds.y + dy };
        let guides: UiState['guides'] = [];
        const excl = new Set<string>(d.ids);
        for (const id of d.ids) for (const c of descendants(doc, id)) excl.add(c);
        const freeIds = d.ids.filter((id) => !d.autoIds.has(id));
        if (s.prefs.snapToObjects && !(e.ctrlKey || e.metaKey) && freeIds.length) {
          const parentId = doc.nodes[freeIds[0]].parentId;
          const snap = computeSnap(doc, moved, excl, parentId, 5 / s.zoom);
          dx += snap.dx; dy += snap.dy; guides = snap.guides;
          moved = { ...d.bounds, x: d.bounds.x + dx, y: d.bounds.y + dy };
        }
        if (s.prefs.snapToPixel && !guides.length) { const rx = Math.round(moved.x) - moved.x, ry = Math.round(moved.y) - moved.y; dx += rx; dy += ry; }
        if (freeIds.length) {
          s.update((dd) => {
            for (const id of freeIds) {
              const n = dd.nodes[id];
              const o = d.orig.get(id)!;
              n.x = o.x + dx; n.y = o.y + dy;
              if (n.sourceId) n.overrides = [...new Set([...(n.overrides ?? []), 'x', 'y'])];
            }
          }, { commit: false });
        }
        // drop target feedback
        const cont = containerAt(wp.x, wp.y, excl);
        let insertLine: UiState['insertLine'] = null;
        if (cont && isAutoLayoutParent(doc, cont)) {
          const idx = autoLayoutIndex(doc, cont, wp.x, wp.y, excl);
          insertLine = autoLayoutIndicator(doc, cont, idx, excl);
        }
        setUi((u) => ({ ...u, guides, insertLine, ghost: d.autoIds.size ? moved : null, dropTarget: cont }));
        break;
      }
      case 'resize': doResize(d, wp, e.shiftKey, e.altKey); break;
      case 'rotate': {
        let ang = ((Math.atan2(wp.y - d.center.y, wp.x - d.center.x) - d.startAngle) * 180) / Math.PI;
        if (e.shiftKey) ang = Math.round(ang / 15) * 15;
        s.update((dd) => {
          for (const id of d.ids) {
            const o = d.orig.get(id)!;
            const n = dd.nodes[id];
            let r = o.rot + ang;
            r = ((r + 180) % 360 + 360) % 360 - 180;
            n.rotation = Math.round(r * 100) / 100;
            if (d.ids.length > 1) {
              const p = rotatePoint(o.cx - d.center.x, o.cy - d.center.y, ang);
              n.x = o.x + (d.center.x + p.x - o.cx);
              n.y = o.y + (d.center.y + p.y - o.cy);
            }
          }
        }, { commit: false });
        break;
      }
      case 'create': doCreate(d, wp, e.shiftKey, e.altKey); break;
      case 'pencil': {
        d.points.push(wp);
        setUi((u) => ({ ...u, cursor: wp }));
        break;
      }
      case 'pen-handle': {
        const p = penState.points[d.index];
        const ox = wp.x - p.x, oy = wp.y - p.y;
        if (Math.hypot(ox, oy) * s.zoom > 3) {
          penState.points[d.index] = { ...p, outX: ox, outY: oy, inX: -ox, inY: -oy };
          writePen(false);
        }
        break;
      }
      case 'noodle': {
        const from = s.doc.nodes[d.fromId];
        if (!from) break;
        const r = absRect(s.doc, d.fromId);
        setUi((u) => ({ ...u, noodle: { from: { x: r.x + r.width, y: r.y + r.height / 2 }, to: wp } }));
        const hit = hitAt(e);
        const top = hit ? chainOf(s.doc, hit).find((c) => isFrameLike(c) || c.type === 'SECTION') : null;
        if ((top?.id ?? null) !== s.hoverId) s.setState({ hoverId: top?.id ?? null });
        break;
      }
      case 'vpoint': {
        const n = s.doc.nodes[d.nodeId];
        const ap = absPos(s.doc, n.id);
        s.update((dd) => {
          const nn = dd.nodes[d.nodeId];
          const pts = nn.points!.map((p) => ({ ...p, x: p.x + ap.x, y: p.y + ap.y }));
          const p = pts[d.index];
          if (d.part === 'p') { p.x = snapPx(wp.x); p.y = snapPx(wp.y); }
          else if (d.part === 'in') { p.inX = wp.x - p.x; p.inY = wp.y - p.y; if (!e.altKey) { p.outX = -p.inX; p.outY = -p.inY; } }
          else { p.outX = wp.x - p.x; p.outY = wp.y - p.y; if (!e.altKey) { p.inX = -p.outX; p.inY = -p.outY; } }
          const norm = normalizePoints(pts);
          const parentAbs = nn.parentId ? absPos(dd as DocumentData, nn.parentId) : { x: 0, y: 0 };
          nn.points = norm.points; nn.x = norm.x - parentAbs.x; nn.y = norm.y - parentAbs.y;
          nn.width = Math.max(0.01, norm.width); nn.height = Math.max(0.01, norm.height);
        }, { commit: false });
        break;
      }
      case 'radius': {
        const r = absRect(s.doc, d.nodeId);
        const corners = [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y }, { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height }];
        const c = corners[d.corner];
        const dist = Math.max(Math.abs(wp.x - c.x), Math.abs(wp.y - c.y));
        const v = Math.max(0, Math.min(Math.min(r.width, r.height) / 2, Math.round(dist)));
        if (e.altKey) setProps([d.nodeId], (n) => { const cs = n.corners ? [...n.corners] as [number, number, number, number] : [n.cornerRadius, n.cornerRadius, n.cornerRadius, n.cornerRadius] as [number, number, number, number]; cs[d.corner] = v; n.corners = cs; }, { commit: false });
        else setProps([d.nodeId], { cornerRadius: v, corners: null }, { commit: false });
        break;
      }
      case 'guide': {
        s.update((dd) => {
          const pg = dd.pages.find((p) => p.id === s.pageId)!;
          const g = pg.guides.find((x) => x.id === d.guideId);
          if (g) g.offset = Math.round(d.axis === 'X' ? wp.x : wp.y);
        }, { commit: false });
        setUi((u) => ({ ...u, cursor: lp }));
        break;
      }
      case 'text': case 'image-place': {
        const start = d.start;
        setUi((u) => ({ ...u, marquee: { x: Math.min(start.x, wp.x), y: Math.min(start.y, wp.y), width: Math.abs(wp.x - start.x), height: Math.abs(wp.y - start.y) } }));
        break;
      }
    }
  };

  const doResize = (d: Extract<Drag, { kind: 'resize' }>, wp: { x: number; y: number }, shift: boolean, alt: boolean) => {
    const s = S();
    const rot = d.rotation;
    const ld = rotatePoint(wp.x - d.start.x, wp.y - d.start.y, -rot);
    let l = -d.base.width / 2, r = d.base.width / 2, t = -d.base.height / 2, b = d.base.height / 2;
    const h = d.handle;
    if (h.includes('w')) { l += ld.x; if (alt) r -= ld.x; }
    if (h.includes('e')) { r += ld.x; if (alt) l -= ld.x; }
    if (h.includes('n')) { t += ld.y; if (alt) b -= ld.y; }
    if (h.includes('s')) { b += ld.y; if (alt) t -= ld.y; }
    // snapping of moving edges (unrotated only)
    let guides: UiState['guides'] = [];
    if (!rot && s.prefs.snapToObjects) {
      const cx0 = d.base.x + d.base.width / 2, cy0 = d.base.y + d.base.height / 2;
      const excl = new Set(d.ids);
      const parentId = d.ids.length === 1 ? s.doc!.nodes[d.ids[0]].parentId : null;
      const probe = (edgeVal: number, axis: 'x' | 'y') => {
        const mv = axis === 'x' ? { x: edgeVal, y: cy0 + t, width: 0, height: b - t } : { x: cx0 + l, y: edgeVal, width: r - l, height: 0 };
        const sn = computeSnap(s.doc!, mv, excl, parentId, 5 / s.zoom);
        return sn;
      };
      if (h.includes('e')) { const sn = probe(cx0 + r, 'x'); r += sn.dx; guides = guides.concat(sn.guides.filter((g) => g.x1 === g.x2)); }
      if (h.includes('w')) { const sn = probe(cx0 + l, 'x'); l += sn.dx; guides = guides.concat(sn.guides.filter((g) => g.x1 === g.x2)); }
      if (h.includes('s')) { const sn = probe(cy0 + b, 'y'); b += sn.dy; guides = guides.concat(sn.guides.filter((g) => g.y1 === g.y2)); }
      if (h.includes('n')) { const sn = probe(cy0 + t, 'y'); t += sn.dy; guides = guides.concat(sn.guides.filter((g) => g.y1 === g.y2)); }
    }
    let w = r - l, hh = b - t;
    let flipX = false, flipY = false;
    if (w < 0) { flipX = true; [l, r] = [r, l]; w = -w; }
    if (hh < 0) { flipY = true; [t, b] = [b, t]; hh = -hh; }
    if (shift && d.base.width && d.base.height) {
      const ar = d.base.width / d.base.height;
      const corner = h.length === 2;
      if (corner) {
        if (w / ar > hh) { const nh = w / ar; if (h.includes('n')) t = b - nh; else b = t + nh; hh = nh; }
        else { const nw = hh * ar; if (h.includes('w')) l = r - nw; else r = l + nw; w = nw; }
      } else if (h === 'e' || h === 'w') { const nh = w / ar; const c = (t + b) / 2; t = c - nh / 2; b = c + nh / 2; hh = nh; }
      else { const nw = hh * ar; const c = (l + r) / 2; l = c - nw / 2; r = c + nw / 2; w = nw; }
    }
    if (!rot && s.prefs.snapToPixel) {
      const cx0 = d.base.x + d.base.width / 2, cy0 = d.base.y + d.base.height / 2;
      l = Math.round(cx0 + l) - cx0; r = Math.round(cx0 + r) - cx0; t = Math.round(cy0 + t) - cy0; b = Math.round(cy0 + b) - cy0;
      w = r - l; hh = b - t;
    }
    w = Math.max(w, 0.01); hh = Math.max(hh, 0.01);
    const lc = rotatePoint((l + r) / 2, (t + b) / 2, rot);
    const ncx = d.base.x + d.base.width / 2 + lc.x, ncy = d.base.y + d.base.height / 2 + lc.y;
    const nb = { x: ncx - w / 2, y: ncy - hh / 2, width: w, height: hh };
    const sx = d.base.width ? w / d.base.width : 1, sy = d.base.height ? hh / d.base.height : 1;
    s.update((dd) => {
      // restore from base for scale tool so we don't compound
      for (const id of d.ids) {
        const n = dd.nodes[id];
        const o = d.orig.get(id)!;
        const parentAbs = n.parentId ? absPos(dd as DocumentData, n.parentId) : { x: 0, y: 0 };
        let tx: number, ty: number, tw: number, th: number;
        if (d.ids.length === 1) { tx = nb.x; ty = nb.y; tw = nb.width; th = nb.height; }
        else { tx = nb.x + (o.x - d.base.x) * sx; ty = nb.y + (o.y - d.base.y) * sy; tw = o.width * sx; th = o.height * sy; }
        if (d.scaleTool) {
          // rebuild subtree from base doc then scale everything
          const baseNode = d.baseDoc.nodes[id];
          const k = (Math.abs(sx) + Math.abs(sy)) / 2;
          const scaleOne = (nid: string, isRoot: boolean) => {
            const b0 = d.baseDoc.nodes[nid];
            const t0 = dd.nodes[nid];
            if (!b0 || !t0) return;
            if (!isRoot) { t0.x = b0.x * sx; t0.y = b0.y * sy; }
            t0.width = b0.width * sx; t0.height = b0.height * sy;
            t0.strokeWeight = b0.strokeWeight * k;
            t0.cornerRadius = b0.cornerRadius * k;
            if (b0.points) t0.points = b0.points.map((p) => ({ ...p, x: p.x * sx, y: p.y * sy, inX: p.inX !== undefined ? p.inX * sx : undefined, inY: p.inY !== undefined ? p.inY * sy : undefined, outX: p.outX !== undefined ? p.outX * sx : undefined, outY: p.outY !== undefined ? p.outY * sy : undefined }));
            if (b0.text && t0.text) { t0.text.fontSize = Math.max(1, Math.round(b0.text.fontSize * k * 100) / 100); if (typeof b0.text.lineHeight === 'number') t0.text.lineHeight = b0.text.lineHeight * k; }
            t0.effects = b0.effects.map((e) => ({ ...e, x: e.x * k, y: e.y * k, blur: e.blur * k, spread: e.spread * k }));
            t0.layout = { ...b0.layout, gap: b0.layout.gap * k, paddingTop: b0.layout.paddingTop * k, paddingBottom: b0.layout.paddingBottom * k, paddingLeft: b0.layout.paddingLeft * k, paddingRight: b0.layout.paddingRight * k };
            for (const c of b0.children) scaleOne(c, false);
          };
          scaleOne(baseNode.id, true);
          n.x = tx - parentAbs.x; n.y = ty - parentAbs.y;
        } else {
          if (n.text && n.text.autoResize !== 'NONE' && n.text.autoResize !== 'TRUNCATE') {
            const changesH = h.includes('n') || h.includes('s') || d.ids.length > 1;
            n.text.autoResize = changesH ? 'NONE' : 'HEIGHT';
          }
          if (n.sizingH === 'HUG' && (h.includes('e') || h.includes('w'))) n.sizingH = 'FIXED';
          if (n.sizingV === 'HUG' && (h.includes('n') || h.includes('s'))) n.sizingV = 'FIXED';
          if (n.sizingH === 'FILL' && (h.includes('e') || h.includes('w'))) n.sizingH = 'FIXED';
          if (n.sizingV === 'FILL' && (h.includes('n') || h.includes('s'))) n.sizingV = 'FIXED';
          resizeNode(dd as DocumentData, id, tw, th);
          n.x = tx - parentAbs.x; n.y = ty - parentAbs.y;
          if (d.ids.length === 1 && (flipX || flipY)) {
            const bn = d.baseDoc.nodes[id];
            n.flipX = flipX ? !bn.flipX : bn.flipX;
            n.flipY = flipY ? !bn.flipY : bn.flipY;
          }
        }
        if (n.sourceId || n.type === 'INSTANCE') n.overrides = [...new Set([...(n.overrides ?? []), 'width', 'height'])];
      }
    }, { commit: false });
    setUi((u) => ({ ...u, guides }));
  };

  const doCreate = (d: Extract<Drag, { kind: 'create' }>, wp: { x: number; y: number }, shift: boolean, alt: boolean) => {
    const s = S();
    let x2 = wp.x, y2 = wp.y;
    if (s.prefs.snapToPixel) { x2 = Math.round(x2); y2 = Math.round(y2); }
    const isLine = d.tool === 'LINE' || d.tool === 'ARROW';
    if (isLine) {
      let dx = x2 - d.start.x, dy = y2 - d.start.y;
      if (shift) {
        const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(dx, dy);
        dx = Math.cos(ang) * len; dy = Math.sin(ang) * len;
      }
      const pts = [{ x: d.start.x, y: d.start.y }, { x: d.start.x + dx, y: d.start.y + dy }];
      const norm = normalizePoints(pts);
      const pa = d.parentId ? absPos(s.doc!, d.parentId) : { x: 0, y: 0 };
      if (!d.nodeId) {
        if (Math.hypot(dx, dy) * s.zoom < 2) return;
        const n = createNode('LINE', { name: d.tool === 'ARROW' ? 'Arrow' : 'Line', endCap: d.tool === 'ARROW' ? 'ARROW' : 'NONE', strokes: [solid('#000000')] });
        d.nodeId = n.id;
        addNode(n, d.parentId);
        s.select([n.id]);
      }
      setProps([d.nodeId], (n) => { n.points = norm.points; n.x = norm.x - pa.x; n.y = norm.y - pa.y; n.width = norm.width; n.height = norm.height; }, { commit: false });
      return;
    }
    let w = x2 - d.start.x, h = y2 - d.start.y;
    if (shift) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
    let x = w < 0 ? d.start.x + w : d.start.x;
    let y = h < 0 ? d.start.y + h : d.start.y;
    w = Math.abs(w); h = Math.abs(h);
    if (alt) { x = d.start.x - w; y = d.start.y - h; w *= 2; h *= 2; }
    if (!d.nodeId) {
      if (w * s.zoom < 2 && h * s.zoom < 2) return;
      const type: NodeType = d.tool === 'FRAME' ? 'FRAME' : d.tool === 'SECTION' ? 'SECTION' : d.tool === 'SLICE' ? 'SLICE' : d.tool === 'ELLIPSE' ? 'ELLIPSE' : d.tool === 'POLYGON' ? 'POLYGON' : d.tool === 'STAR' ? 'STAR' : 'RECTANGLE';
      const n = newNodeOfType(type, { x, y, width: Math.max(w, 1), height: Math.max(h, 1) }, d.parentId);
      if (type === 'FRAME') n.name = `Frame ${Object.values(s.doc!.nodes).filter((x) => x.type === 'FRAME').length + 1}`;
      if (type === 'SECTION') n.name = `Section ${Object.values(s.doc!.nodes).filter((x) => x.type === 'SECTION').length + 1}`;
      d.nodeId = n.id;
      addNode(n, d.parentId);
      s.select([n.id]);
    }
    const pa = d.parentId ? absPos(s.doc!, d.parentId) : { x: 0, y: 0 };
    const id = d.nodeId;
    S().update((dd) => { const n = dd.nodes[id]; resizeNode(dd as DocumentData, id, Math.max(w, 1), Math.max(h, 1)); n.x = x - pa.x; n.y = y - pa.y; }, { commit: false });
    setUi((u) => ({ ...u, cursor: wp }));
  };

  /* --------------------------------------------------------- pointer up */
  const onPointerUp = (e: React.PointerEvent) => {
    const s = S();
    const d = dragRef.current;
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!d || !s.doc) { setUi({}); return; }
    const wp = worldPoint(e);
    switch (d.kind) {
      case 'pending-move': {
        // simple click without drag on selection area
        if (!d.hitId && !e.shiftKey) {
          const hit = hitAt(e);
          const t = pickTarget(s.doc, hit, { deep: e.metaKey || e.ctrlKey, selection: [] });
          s.select(t ? [t] : []);
        } else if (d.hitId && !e.shiftKey && s.selection.length > 1) {
          s.select([d.hitId]);
        }
        break;
      }
      case 'move': finishMove(d, wp); break;
      case 'resize': case 'rotate': case 'radius': case 'vpoint': s.end(); break;
      case 'text-edit': {
        s.setState({ editingTextId: d.id, tool: s.prefs.keepToolSelected ? s.tool : 'MOVE' });
        break;
      }
      case 'guide': {
        const lp = localPoint(e);
        const del = s.view.rulers && (d.axis === 'X' ? lp.y < 20 : lp.x < 20);
        if (del) s.update((dd) => { const pg = dd.pages.find((p) => p.id === s.pageId)!; pg.guides = pg.guides.filter((g) => g.id !== d.guideId); }, { commit: false });
        s.end();
        break;
      }
      case 'create': {
        if (!d.nodeId) {
          // click without drag: default size
          if (d.tool !== 'LINE' && d.tool !== 'ARROW') {
            const size = 100;
            const type: NodeType = d.tool === 'FRAME' ? 'FRAME' : d.tool === 'SECTION' ? 'SECTION' : d.tool === 'SLICE' ? 'SLICE' : d.tool === 'ELLIPSE' ? 'ELLIPSE' : d.tool === 'POLYGON' ? 'POLYGON' : d.tool === 'STAR' ? 'STAR' : 'RECTANGLE';
            const n = newNodeOfType(type, { x: d.start.x - (type === 'SECTION' ? 0 : 0), y: d.start.y, width: type === 'SECTION' ? 400 : size, height: type === 'SECTION' ? 300 : size }, d.parentId);
            if (type === 'FRAME') n.name = `Frame ${Object.values(s.doc.nodes).filter((x) => x.type === 'FRAME').length + 1}`;
            addNode(n, d.parentId);
            s.select([n.id]);
          }
        } else if (d.tool === 'FRAME' || d.tool === 'SECTION') {
          // wrap fully contained siblings
          const id = d.nodeId;
          const doc = S().doc!;
          const fr = absRect(doc, id);
          const siblings = (d.parentId ? doc.nodes[d.parentId].children : currentPage().children).filter((c) => c !== id);
          const inside = siblings.filter((c) => { const r = visualAbsRect(doc, c); return r.x >= fr.x && r.y >= fr.y && r.x + r.width <= fr.x + fr.width && r.y + r.height <= fr.y + fr.height; });
          if (inside.length) S().update((dd) => { const pg = dd.pages.find((p) => p.id === S().pageId)!; for (const c of inside) reparent(dd as DocumentData, c, id, pg); }, { commit: false });
        }
        s.end();
        if (!s.prefs.keepToolSelected) s.setTool('MOVE');
        break;
      }
      case 'text': {
        const dragged = Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4;
        const parentId = containerAt(d.start.x, d.start.y);
        const n = createNode('TEXT', { name: 'Text' });
        const lh = resolveLineHeight(n.text!);
        if (dragged) {
          const x = Math.min(d.start.x, wp.x), y = Math.min(d.start.y, wp.y);
          const w = Math.abs(wp.x - d.start.x);
          Object.assign(n, { x, y, width: Math.max(10, w), height: lh });
          n.text!.autoResize = 'HEIGHT';
        } else {
          Object.assign(n, { x: d.start.x, y: d.start.y - lh / 2, width: 1, height: lh });
        }
        if (parentId) { const pa = absPos(s.doc, parentId); n.x -= pa.x; n.y -= pa.y; }
        n.x = Math.round(n.x); n.y = Math.round(n.y);
        addNode(n, parentId);
        s.select([n.id]);
        s.setState({ editingTextId: n.id });
        if (!s.prefs.keepToolSelected) s.setState({ tool: 'MOVE' });
        break;
      }
      case 'image-place': {
        const src = s.imageToPlace[0];
        const rest = s.imageToPlace.slice(1);
        const parentId = containerAt(d.start.x, d.start.y);
        const dragged = Math.abs(wp.x - d.start.x) > 4;
        void placeImageAt(src, dragged ? (d.start.x + wp.x) / 2 : d.start.x, dragged ? (d.start.y + wp.y) / 2 : d.start.y, parentId).then((id) => {
          if (dragged && id) setProps([id], (n) => { n.width = Math.abs(wp.x - d.start.x); n.height = Math.abs(wp.y - d.start.y); n.x = Math.min(wp.x, d.start.x) - (parentId ? absPos(S().doc!, parentId).x : 0); n.y = Math.min(wp.y, d.start.y) - (parentId ? absPos(S().doc!, parentId).y : 0); });
        });
        s.setState({ imageToPlace: rest, tool: rest.length ? 'IMAGE' : 'MOVE' });
        break;
      }
      case 'pencil': {
        if (d.points.length > 1) {
          const pts = smoothPoints(d.points);
          const norm = normalizePoints(pts);
          const parentId = containerAt(d.points[0].x, d.points[0].y);
          const pa = parentId ? absPos(s.doc, parentId) : { x: 0, y: 0 };
          const n = createNode('VECTOR', { name: 'Vector', x: norm.x - pa.x, y: norm.y - pa.y, width: Math.max(norm.width, 0.01), height: Math.max(norm.height, 0.01), points: norm.points, closed: false, strokes: [solid('#000000')], strokeWeight: 2, strokeCap: 'ROUND', fills: [] });
          addNode(n, parentId);
          s.select([n.id]);
        }
        break;
      }
      case 'noodle': {
        const hit = hitAt(e);
        const top = hit ? chainOf(s.doc, hit).find((c) => (isFrameLike(c) || c.type === 'SECTION') && (!c.parentId || s.doc!.nodes[c.parentId]?.type === 'SECTION')) : null;
        if (top && top.id !== d.fromId) {
          const r: Reaction = newReaction(top.id);
          setProps([d.fromId], (n) => { n.reactions = [...n.reactions, r]; });
          const page = currentPage();
          const fromTop = chainOf(s.doc, d.fromId)[0];
          if (!page.flowStarts.length && fromTop) S().update((dd) => { const pg = dd.pages.find((p) => p.id === s.pageId)!; pg.flowStarts.push({ id: uid('fl'), nodeId: fromTop.type === 'SECTION' ? d.fromId : fromTop.id, name: 'Flow 1' }); });
        }
        s.setState({ hoverId: null });
        break;
      }
      default: break;
    }
    setUi({});
  };

  const finishMove = (d: Extract<Drag, { kind: 'move' }>, wp: { x: number; y: number }) => {
    const s = S();
    const doc = s.doc!;
    const excl = new Set<string>(d.ids);
    for (const id of d.ids) for (const c of descendants(doc, id)) excl.add(c);
    const target = containerAt(wp.x, wp.y, excl);
    s.update((dd) => {
      const pg = dd.pages.find((p) => p.id === s.pageId)!;
      for (const id of d.ids) {
        const n = dd.nodes[id];
        if (!n) continue;
        const parentIsInstance = n.parentId && (dd.nodes[n.parentId]?.type === 'INSTANCE' || n.sourceId);
        if (parentIsInstance) continue; // can't reparent instance children
        if (isAutoLayoutParent(dd as DocumentData, target)) {
          const idx = autoLayoutIndex(dd as DocumentData, target!, wp.x, wp.y, excl);
          if (n.parentId === target) {
            const list = dd.nodes[target!].children;
            const cur = list.indexOf(id);
            list.splice(cur, 1);
            const ni = idx > cur ? idx - 1 : idx;
            list.splice(Math.max(0, Math.min(list.length, ni)), 0, id);
          } else {
            reparent(dd as DocumentData, id, target, pg, idx);
          }
        } else if (target !== n.parentId) {
          if (target && isAncestor(dd as DocumentData, id, target)) continue;
          if (d.autoIds.has(id)) {
            // dragged out of auto layout: place at drop position
            const o = d.bounds;
            const r = absRect(dd as DocumentData, id);
            reparent(dd as DocumentData, id, target, pg);
            const pa = target ? absPos(dd as DocumentData, target) : { x: 0, y: 0 };
            n.x = r.x + (wp.x - d.start.x) - pa.x + (o.x - o.x);
            n.y = r.y + (wp.y - d.start.y) - pa.y;
          } else reparent(dd as DocumentData, id, target, pg);
        }
      }
    }, { commit: false });
    s.end();
  };

  /* --------------------------------------------------------- double click */
  const onDoubleClick = (e: React.MouseEvent) => {
    const s = S();
    if (!s.doc || s.mode === 'dev') return;
    const target = e.target as HTMLElement;
    if (target.closest('.panel, .toolbar, .frame-label, .comment-pop')) return;
    if (penState.nodeId) { finishPen(); return; }
    let hit = hitIdFrom(target);
    if (!hit) {
      for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
        const h = hitIdFrom(el);
        if (h) { hit = h; break; }
      }
    }
    if (!hit && s.selection.length === 1) {
      const wp = worldPoint(e);
      const r = absRect(s.doc, s.selection[0]);
      if (target.closest('[data-handle]') || (wp.x >= r.x && wp.x <= r.x + r.width && wp.y >= r.y && wp.y <= r.y + r.height)) hit = s.selection[0];
    }
    if (!hit) return;
    const chain = chainOf(s.doc, hit);
    const selIdx = chain.findIndex((c) => s.selection.includes(c.id));
    const cur = selIdx >= 0 ? chain[selIdx] : null;
    if (cur && cur.id === hit) {
      if (cur.type === 'TEXT') { s.setState({ editingTextId: cur.id }); return; }
      if (cur.type === 'VECTOR' || cur.type === 'LINE') { s.setState({ editingVectorId: cur.id }); return; }
      if (cur.type === 'RECTANGLE' || cur.type === 'ELLIPSE' || cur.type === 'POLYGON' || cur.type === 'STAR') {
        s.toast('Flatten (⌘E) to edit vector points');
        return;
      }
    }
    if (selIdx >= 0 && selIdx < chain.length - 1) {
      const next = chain[selIdx + 1];
      s.select([next.id]);
      if (next.id === hit && next.type === 'TEXT') s.setState({ editingTextId: next.id });
      return;
    }
    const t = pickTarget(s.doc, hit, { selection: s.selection });
    if (t) {
      const n = s.doc.nodes[t];
      s.select([t]);
      if (n.type === 'TEXT') s.setState({ editingTextId: t });
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const s = S();
    if (!s.doc) return;
    const target = e.target as HTMLElement;
    if (target.closest('.panel, .toolbar')) return;
    const hit = hitIdFrom(target);
    const t = pickTarget(s.doc, hit, { selection: s.selection });
    if (t && !s.selection.includes(t)) s.select([t]);
    s.setState({ contextMenu: { x: e.clientX, y: e.clientY, kind: t || s.selection.length ? 'selection' : 'canvas' } });
  };

  const cursor = (() => {
    if (spaceDown || tool === 'HAND') return dragRef.current?.kind === 'pan' ? 'grabbing' : 'grab';
    if (tool === 'TEXT') return 'text';
    if (tool === 'COMMENT') return 'crosshair';
    if (tool !== 'MOVE' && tool !== 'SCALE') return 'crosshair';
    return 'default';
  })();

  return (
    <div
      ref={wrapRef}
      className="canvas-wrap"
      tabIndex={-1}
      data-testid="canvas"
      data-dotgrid={dotGrid ? 'on' : 'off'}
      style={{ cursor, backgroundColor: pageBg.toUpperCase() === '#F5F5F5' ? 'var(--canvas)' : pageBg, ...(dotGrid ? dotGridStyle(zoom, panX, panY) : {}) }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => { if (!dragRef.current && S().hoverId) S().setState({ hoverId: null }); }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <svg className="scene" width="100%" height="100%" style={{ imageRendering: pixelPreview ? 'pixelated' : undefined, overflow: 'visible' }} data-testid="scene">
        <g transform={`translate(${panX} ${panY}) scale(${zoom})`}>
          <RenderCtx.Provider value={ctx}>
            <PageNodes />
          </RenderCtx.Provider>
        </g>
      </svg>
      <Overlay ui={ui} />
      <HtmlOverlay />
      <TextEditorOverlay />
    </div>
  );
}

/** Figma/FigJam-style dot grid that pans & zooms with the board, keeping dots 14–56px apart on screen. */
export function dotGridStyle(zoom: number, panX: number, panY: number): React.CSSProperties {
  let step = 24 * zoom;
  while (step < 14) step *= 2;
  while (step > 56) step /= 2;
  const r = zoom >= 2 ? 1.5 : 1.1;
  const ox = (((panX - step / 2) % step) + step) % step;
  const oy = (((panY - step / 2) % step) + step) % step;
  return {
    backgroundImage: `radial-gradient(circle, var(--dot) ${r}px, transparent ${r + 0.6}px)`,
    backgroundSize: `${step}px ${step}px`,
    backgroundPosition: `${ox}px ${oy}px`,
  };
}

function isTyping() {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === 'INPUT') return !['checkbox', 'radio', 'range', 'button', 'color', 'file'].includes((el as HTMLInputElement).type);
  return el.tagName === 'TEXTAREA' || el.isContentEditable;
}

/* ----------------------------------------------------------------- overlay (screen-space SVG) */

const ACCENT = '#0D99FF';
const COMP = '#9747FF';

function nodeOutlinePath(doc: DocumentData, id: string, zoom: number, panX: number, panY: number) {
  const n = doc.nodes[id];
  if (!n) return '';
  const p = absPos(doc, id);
  const corners = [[0, 0], [n.width, 0], [n.width, n.height], [0, n.height]].map(([x, y]) => {
    const c = rotatePoint(x - n.width / 2, y - n.height / 2, n.rotation);
    return { x: (p.x + n.width / 2 + c.x) * zoom + panX, y: (p.y + n.height / 2 + c.y) * zoom + panY };
  });
  return 'M' + corners.map((c) => `${c.x} ${c.y}`).join(' L') + 'Z';
}

function Overlay({ ui }: { ui: UiState }) {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const hoverId = useEditor((s) => s.hoverId);
  const zoom = useEditor((s) => s.zoom);
  const panX = useEditor((s) => s.panX);
  const panY = useEditor((s) => s.panY);
  const rightTab = useEditor((s) => s.rightTab);
  const mode = useEditor((s) => s.mode);
  const editingTextId = useEditor((s) => s.editingTextId);
  const editingVectorId = useEditor((s) => s.editingVectorId);
  const view = useEditor((s) => s.view);
  const tool = useEditor((s) => s.tool);
  const altDown = useEditor((s) => s.altDown);
  const pageId = useEditor((s) => s.pageId);
  const vw = useEditor((s) => s.viewport);
  if (!doc) return null;
  const page = doc.pages.find((p) => p.id === pageId)!;
  const T = (x: number, y: number) => ({ x: x * zoom + panX, y: y * zoom + panY });
  const sel = selection.filter((id) => doc.nodes[id]);
  const prototype = rightTab === 'prototype' && mode === 'design';
  const items: React.ReactNode[] = [];

  // pixel grid
  if (view.pixelGrid && zoom >= 8) {
    const step = zoom;
    const ox = ((panX % step) + step) % step, oy = ((panY % step) + step) % step;
    items.push(
      <g key="pg" opacity={0.25}>
        <defs>
          <pattern id="pxgrid" x={ox} y={oy} width={step} height={step} patternUnits="userSpaceOnUse">
            <path d={`M${step} 0V${step}H0`} fill="none" stroke="#999" strokeWidth={0.5} />
          </pattern>
        </defs>
        <rect width={vw.width} height={vw.height} fill="url(#pxgrid)" />
      </g>,
    );
  }

  // guides
  for (const g of page.guides) {
    const p = T(g.offset, g.offset);
    items.push(g.axis === 'X'
      ? <line key={g.id} data-guide={g.id} data-axis="X" x1={p.x} y1={0} x2={p.x} y2={vw.height} stroke="#F24822" strokeWidth={1} style={{ pointerEvents: 'stroke', cursor: 'ew-resize' }} />
      : <line key={g.id} data-guide={g.id} data-axis="Y" x1={0} y1={p.y} x2={vw.width} y2={p.y} stroke="#F24822" strokeWidth={1} style={{ pointerEvents: 'stroke', cursor: 'ns-resize' }} />);
  }

  // frame outlines (view option)
  if (view.frameOutlines) {
    for (const n of Object.values(doc.nodes)) {
      if (n.type !== 'FRAME') continue;
      items.push(<path key={'fo' + n.id} d={nodeOutlinePath(doc, n.id, zoom, panX, panY)} fill="none" stroke="#999" strokeWidth={0.5} />);
    }
  }

  // hover
  if (hoverId && doc.nodes[hoverId] && !sel.includes(hoverId)) {
    const n = doc.nodes[hoverId];
    const isComp = n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'COMPONENT_SET';
    items.push(<path key="hover" d={nodeOutlinePath(doc, hoverId, zoom, panX, panY)} fill="none" stroke={isComp ? COMP : ACCENT} strokeWidth={prototype ? 2 : 1} data-testid="hover-outline" />);
  }

  // selection outlines
  for (const id of sel) {
    const n = doc.nodes[id];
    const isComp = n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'COMPONENT_SET' || !!n.sourceId;
    if (id === editingTextId) continue;
    items.push(<path key={'s' + id} d={nodeOutlinePath(doc, id, zoom, panX, panY)} fill="none" stroke={isComp ? COMP : ACCENT} strokeWidth={1} />);
  }

  // measurement (alt hover)
  if (altDown && sel.length && hoverId && !sel.includes(hoverId) && !editingTextId) {
    const a = selectionBounds(sel)!;
    const b = visualAbsRect(doc, hoverId);
    const lines: { x1: number; y1: number; x2: number; y2: number; v: number }[] = [];
    const inside = a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
    const cy = a.y + a.height / 2, cx = a.x + a.width / 2;
    if (inside) {
      lines.push({ x1: b.x, y1: cy, x2: a.x, y2: cy, v: a.x - b.x });
      lines.push({ x1: a.x + a.width, y1: cy, x2: b.x + b.width, y2: cy, v: b.x + b.width - a.x - a.width });
      lines.push({ x1: cx, y1: b.y, x2: cx, y2: a.y, v: a.y - b.y });
      lines.push({ x1: cx, y1: a.y + a.height, x2: cx, y2: b.y + b.height, v: b.y + b.height - a.y - a.height });
    } else {
      if (b.x > a.x + a.width) lines.push({ x1: a.x + a.width, y1: cy, x2: b.x, y2: cy, v: b.x - a.x - a.width });
      if (b.x + b.width < a.x) lines.push({ x1: b.x + b.width, y1: cy, x2: a.x, y2: cy, v: a.x - b.x - b.width });
      if (b.y > a.y + a.height) lines.push({ x1: cx, y1: a.y + a.height, x2: cx, y2: b.y, v: b.y - a.y - a.height });
      if (b.y + b.height < a.y) lines.push({ x1: cx, y1: b.y + b.height, x2: cx, y2: a.y, v: a.y - b.y - b.height });
    }
    items.push(<path key="mb" d={nodeOutlinePath(doc, hoverId, zoom, panX, panY)} fill="none" stroke="#F24822" strokeWidth={1} />);
    lines.forEach((l, i) => {
      const p1 = T(l.x1, l.y1), p2 = T(l.x2, l.y2);
      items.push(<line key={'ml' + i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#F24822" strokeWidth={1} />);
      items.push(<foreignObject key={'mt' + i} x={(p1.x + p2.x) / 2 - 30} y={(p1.y + p2.y) / 2 - 9} width={60} height={18}><div className="measure-badge" style={{ position: 'static', transform: 'none', display: 'inline-block' }} data-testid="measure-badge">{Math.round(l.v * 100) / 100}</div></foreignObject>);
    });
  }

  // selection bounds & handles
  const showHandles = sel.length > 0 && !editingTextId && !editingVectorId && mode === 'design' && !prototype && (tool === 'MOVE' || tool === 'SCALE');
  if (sel.length) {
    const single = sel.length === 1 ? doc.nodes[sel[0]] : null;
    const rot = single?.rotation ?? 0;
    const r = single ? absRect(doc, single.id) : selectionBounds(sel)!;
    const isComp = !!single && (single.type === 'COMPONENT' || single.type === 'INSTANCE' || single.type === 'COMPONENT_SET' || !!single.sourceId);
    const color = isComp ? COMP : ACCENT;
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const corner = (lx: number, ly: number) => { const p = rotatePoint(lx, ly, rot); return T(cx + p.x, cy + p.y); };
    const pts = { nw: corner(-r.width / 2, -r.height / 2), ne: corner(r.width / 2, -r.height / 2), se: corner(r.width / 2, r.height / 2), sw: corner(-r.width / 2, r.height / 2) };
    const isLine = single && (single.type === 'LINE');
    if (sel.length > 1 || (single && single.type !== 'TEXT')) {
      items.push(<path key="bounds" d={`M${pts.nw.x} ${pts.nw.y}L${pts.ne.x} ${pts.ne.y}L${pts.se.x} ${pts.se.y}L${pts.sw.x} ${pts.sw.y}Z`} fill="none" stroke={color} strokeWidth={1} data-testid="selection-bounds" />);
    }
    if (showHandles && !isLine) {
      const cursorFor = (h: string) => ({ n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' } as Record<string, string>)[h];
      const edges: [Handle, { x: number; y: number }, { x: number; y: number }][] = [['n', pts.nw, pts.ne], ['e', pts.ne, pts.se], ['s', pts.se, pts.sw], ['w', pts.sw, pts.nw]];
      const edgeW = Math.max(2, Math.min(8, Math.abs(r.width * zoom) / 4, Math.abs(r.height * zoom) / 4));
      for (const [h, a, b] of edges) items.push(<line key={'e' + h} data-handle={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={edgeW} style={{ pointerEvents: 'stroke', cursor: cursorFor(h) }} />);
      // rotation zones
      const sc = T(cx, cy);
      for (const h of ['nw', 'ne', 'se', 'sw'] as const) {
        const dx = pts[h].x - sc.x, dy = pts[h].y - sc.y;
        const len = Math.hypot(dx, dy) || 1;
        items.push(<circle key={'r' + h} data-handle="rot" cx={pts[h].x + (dx / len) * 12} cy={pts[h].y + (dy / len) * 12} r={9} fill="transparent" style={{ pointerEvents: 'all', cursor: 'alias' }} />);
      }
      const small = Math.abs(r.width * zoom) < 24 || Math.abs(r.height * zoom) < 24;
      for (const h of ['nw', 'ne', 'se', 'sw'] as const) {
        items.push(<rect key={'h' + h} data-handle={h} data-testid={`handle-${h}`} x={pts[h].x - 4} y={pts[h].y - 4} width={8} height={8} rx={1} fill="#fff" stroke={color} strokeWidth={1} style={{ pointerEvents: 'all', cursor: cursorFor(h) }} transform={rot ? `rotate(${rot} ${pts[h].x} ${pts[h].y})` : undefined} />);
      }
      if (!small) {
        // corner radius handles
        if (single && (single.type === 'RECTANGLE' || single.type === 'FRAME' || single.type === 'COMPONENT') && !rot && r.width * zoom > 60 && r.height * zoom > 60) {
          const inset = Math.max(single.cornerRadius * zoom, 12);
          const pos = [{ x: pts.nw.x + inset, y: pts.nw.y + inset }, { x: pts.ne.x - inset, y: pts.ne.y + inset }, { x: pts.se.x - inset, y: pts.se.y - inset }, { x: pts.sw.x + inset, y: pts.sw.y - inset }];
          pos.forEach((p, i) => items.push(<circle key={'cr' + i} data-handle={`radius:${i}`} data-testid={`radius-${i}`} cx={p.x} cy={p.y} r={4} fill="#fff" stroke={color} strokeWidth={1} style={{ pointerEvents: 'all', cursor: 'default' }} />));
        }
      }
    }
    if (showHandles && isLine && single?.points?.length === 2) {
      const ap = absPos(doc, single.id);
      // treat line endpoints as vector points (enter edit on drag)
      single.points.forEach((p, i) => {
        const s2 = T(ap.x + p.x, ap.y + p.y);
        items.push(<rect key={'lp' + i} x={s2.x - 4} y={s2.y - 4} width={8} height={8} rx={1} fill="#fff" stroke={color} />);
      });
    }
  }

  // vector edit mode
  if (editingVectorId && doc.nodes[editingVectorId]) {
    const n = doc.nodes[editingVectorId];
    const ap = absPos(doc, n.id);
    const pts = n.points ?? [];
    const path = pointsPath(pts.map((p) => ({ ...p, x: (ap.x + p.x) * zoom + panX, y: (ap.y + p.y) * zoom + panY, inX: p.inX !== undefined ? p.inX * zoom : undefined, inY: p.inY !== undefined ? p.inY * zoom : undefined, outX: p.outX !== undefined ? p.outX * zoom : undefined, outY: p.outY !== undefined ? p.outY * zoom : undefined })), !!n.closed);
    items.push(<path key="vpath" d={path} fill="none" stroke={ACCENT} strokeWidth={1} />);
    pts.forEach((p, i) => {
      const s2 = T(ap.x + p.x, ap.y + p.y);
      if (p.inX !== undefined) { const h = T(ap.x + p.x + p.inX, ap.y + p.y + (p.inY ?? 0)); items.push(<g key={'vi' + i}><line x1={s2.x} y1={s2.y} x2={h.x} y2={h.y} stroke={ACCENT} /><circle data-vpoint={`${i}:in`} cx={h.x} cy={h.y} r={3.5} fill="#fff" stroke={ACCENT} style={{ pointerEvents: 'all' }} /></g>); }
      if (p.outX !== undefined) { const h = T(ap.x + p.x + p.outX, ap.y + p.y + (p.outY ?? 0)); items.push(<g key={'vo' + i}><line x1={s2.x} y1={s2.y} x2={h.x} y2={h.y} stroke={ACCENT} /><circle data-vpoint={`${i}:out`} cx={h.x} cy={h.y} r={3.5} fill="#fff" stroke={ACCENT} style={{ pointerEvents: 'all' }} /></g>); }
      items.push(<circle key={'vp' + i} data-vpoint={`${i}:p`} data-testid={`vpoint-${i}`} cx={s2.x} cy={s2.y} r={4} fill="#fff" stroke={ACCENT} strokeWidth={1.5} style={{ pointerEvents: 'all', cursor: 'move' }} />);
    });
  }

  // pen preview
  if (penState.nodeId && ui.cursor && penState.points.length) {
    const last = penState.points[penState.points.length - 1];
    const a = T(last.x, last.y), b = T(ui.cursor.x, ui.cursor.y);
    items.push(<line key="penprev" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ACCENT} strokeWidth={1} />);
    penState.points.forEach((p, i) => { const s2 = T(p.x, p.y); items.push(<circle key={'pp' + i} cx={s2.x} cy={s2.y} r={3.5} fill={i === 0 ? ACCENT : '#fff'} stroke={ACCENT} />); });
  }

  // prototype connections
  if (prototype) {
    for (const n of Object.values(doc.nodes)) {
      if (!n.reactions.length) continue;
      const pageOfNode = chainOf(doc, n.id)[0];
      if (!page.children.includes(pageOfNode?.id)) continue;
      const isSel = sel.includes(n.id);
      for (const r of n.reactions) {
        if (!r.destinationId || !doc.nodes[r.destinationId]) continue;
        const a = absRect(doc, n.id), b = absRect(doc, r.destinationId);
        const p1 = T(a.x + a.width, a.y + a.height / 2);
        const right = b.x > a.x + a.width;
        const p2 = T(right ? b.x : b.x + b.width, b.y + Math.min(40, b.height / 2));
        const dx = Math.max(40, Math.abs(p2.x - p1.x) / 2);
        const c2x = right ? p2.x - dx : p2.x + dx;
        items.push(
          <g key={'nd' + r.id} opacity={sel.length && !isSel ? 0.35 : 1}>
            <path d={`M${p1.x} ${p1.y} C${p1.x + dx} ${p1.y} ${c2x} ${p2.y} ${p2.x} ${p2.y}`} fill="none" stroke={ACCENT} strokeWidth={2} data-testid="noodle" />
            <circle cx={p1.x} cy={p1.y} r={4} fill={ACCENT} />
            <path d={right ? `M${p2.x - 8} ${p2.y - 5}L${p2.x} ${p2.y}L${p2.x - 8} ${p2.y + 5}` : `M${p2.x + 8} ${p2.y - 5}L${p2.x} ${p2.y}L${p2.x + 8} ${p2.y + 5}`} fill="none" stroke={ACCENT} strokeWidth={2} />
          </g>,
        );
      }
    }
    if (sel.length === 1) {
      const a = absRect(doc, sel[0]);
      const p = T(a.x + a.width, a.y + a.height / 2);
      items.push(
        <g key="nh" data-handle="noodle" data-testid="noodle-handle" style={{ pointerEvents: 'all', cursor: 'crosshair' }}>
          <circle cx={p.x} cy={p.y} r={9} fill="#fff" stroke={ACCENT} strokeWidth={2} />
          <path d={`M${p.x - 4} ${p.y}H${p.x + 4}M${p.x} ${p.y - 4}V${p.y + 4}`} stroke={ACCENT} strokeWidth={2} />
        </g>,
      );
    }
    if (ui.noodle) {
      const a = T(ui.noodle.from.x, ui.noodle.from.y), b = T(ui.noodle.to.x, ui.noodle.to.y);
      items.push(<path key="noodleprev" d={`M${a.x} ${a.y} C${a.x + 60} ${a.y} ${b.x - 60} ${b.y} ${b.x} ${b.y}`} fill="none" stroke={ACCENT} strokeWidth={2} />);
    }
  }

  // drag feedback
  if (ui.marquee) {
    const a = T(ui.marquee.x, ui.marquee.y);
    items.push(<rect key="mq" x={a.x} y={a.y} width={ui.marquee.width * zoom} height={ui.marquee.height * zoom} fill="rgba(13,153,255,0.08)" stroke={ACCENT} strokeWidth={1} data-testid="marquee" />);
  }
  for (const [i, g] of (ui.guides ?? []).entries()) {
    const a = T(g.x1, g.y1), b = T(g.x2, g.y2);
    items.push(<line key={'g' + i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#F24822" strokeWidth={1} />);
  }
  if (ui.insertLine) {
    const a = T(ui.insertLine.x1, ui.insertLine.y1), b = T(ui.insertLine.x2, ui.insertLine.y2);
    items.push(<line key="ins" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ACCENT} strokeWidth={2} data-testid="insert-line" />);
  }
  if (ui.ghost) {
    const a = T(ui.ghost.x, ui.ghost.y);
    items.push(<rect key="ghost" x={a.x} y={a.y} width={ui.ghost.width * zoom} height={ui.ghost.height * zoom} fill="rgba(13,153,255,0.12)" stroke={ACCENT} strokeDasharray="4 3" />);
  }
  if (ui.dropTarget && doc.nodes[ui.dropTarget]) {
    items.push(<path key="dt" d={nodeOutlinePath(doc, ui.dropTarget, zoom, panX, panY)} fill="none" stroke={ACCENT} strokeWidth={1} strokeDasharray="0" opacity={0.5} />);
  }

  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} data-testid="overlay">
      {items}
    </svg>
  );
}

/* ----------------------------------------------------------------- HTML overlay: labels, badges, rulers */

function HtmlOverlay() {
  const doc = useEditor((s) => s.doc);
  const pageId = useEditor((s) => s.pageId);
  const selection = useEditor((s) => s.selection);
  const zoom = useEditor((s) => s.zoom);
  const panX = useEditor((s) => s.panX);
  const panY = useEditor((s) => s.panY);
  const editingTextId = useEditor((s) => s.editingTextId);
  const mode = useEditor((s) => s.mode);
  const rightTab = useEditor((s) => s.rightTab);
  const rulers = useEditor((s) => s.view.rulers);
  const showDims = useEditor((s) => s.prefs.showDimensions);
  const [renaming, setRenaming] = useState<string | null>(null);
  if (!doc) return null;
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) return null;
  const T = (x: number, y: number) => ({ x: x * zoom + panX, y: y * zoom + panY });

  const labels: React.ReactNode[] = [];
  const addLabel = (id: string) => {
    const n = doc.nodes[id];
    if (!n || !n.visible) return;
    const r = absRect(doc, id);
    const p = T(r.x, r.y);
    const isSel = selection.includes(id);
    const isComp = n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'COMPONENT_SET';
    if (n.type === 'SECTION') {
      labels.push(
        <div key={id} className={'section-label' + (isSel ? ' sel' : '')} style={{ left: p.x, top: p.y + 4, transform: 'translateX(4px)', maxWidth: Math.max(40, r.width * zoom - 8) }}
          data-testid={`section-label-${n.name}`}
          onPointerDown={(e) => labelDown(e, id)} onDoubleClick={() => setRenaming(id)}>
          {renaming === id ? <RenameInline id={id} done={() => setRenaming(null)} /> : n.name}
        </div>,
      );
      for (const c of n.children) { const cn = doc.nodes[c]; if (cn && (isFrameLike(cn))) addLabel(c); }
      return;
    }
    const flow = rightTab === 'prototype' && page.flowStarts.find((f) => f.nodeId === id);
    labels.push(
      <div key={id} className={'frame-label' + (isSel ? ' sel' : '') + (isComp ? ' comp' : '')}
        style={{ left: p.x, top: p.y - 20, maxWidth: Math.max(30, r.width * zoom), height: 20, lineHeight: '16px' }}
        data-testid={`frame-label-${n.name}`}
        onPointerDown={(e) => labelDown(e, id)} onDoubleClick={() => setRenaming(id)}>
        {flow ? <span style={{ background: ACCENT, color: '#fff', borderRadius: 4, padding: '1px 5px', marginRight: 4 }}>▶ {flow.name}</span> : null}
        {isComp ? (n.type === 'INSTANCE' ? '◇ ' : '❖ ') : ''}
        {renaming === id ? <RenameInline id={id} done={() => setRenaming(null)} /> : n.name}
      </div>,
    );
    if (n.type === 'COMPONENT_SET') for (const c of n.children) addLabel(c);
  };
  for (const id of page.children) {
    const n = doc.nodes[id];
    if (n && (isFrameLike(n) || n.type === 'SECTION')) addLabel(id);
  }

  // size badge
  let badge: React.ReactNode = null;
  const sel = selection.filter((id) => doc.nodes[id]);
  if (sel.length && !editingTextId && showDims && !(rightTab === 'prototype' && mode === 'design')) {
    const b = selectionBounds(sel)!;
    const p = T(b.x + b.width / 2, b.y + b.height);
    const single = sel.length === 1 ? doc.nodes[sel[0]] : null;
    const sizing = (s: string, v: number) => (s === 'HUG' ? 'Hug' : s === 'FILL' ? 'Fill' : fmt2(v));
    const text = single ? `${sizing(single.sizingH, single.width)} × ${sizing(single.sizingV, single.height)}` : `${fmt2(b.width)} × ${fmt2(b.height)}`;
    const isComp = !!single && (single.type === 'COMPONENT' || single.type === 'INSTANCE' || !!single.sourceId);
    badge = <div className={'size-badge' + (isComp ? ' comp' : '')} style={{ left: p.x, top: p.y + 8 }} data-testid="size-badge">{text}</div>;
  }

  function labelDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    const s = S();
    if (e.button !== 0) return;
    if (e.shiftKey) s.toggleSelect(id); else if (!s.selection.includes(id)) s.select([id]);
    if (s.mode === 'dev') return;
    // drag to move
    const start = screenToWorld(e.clientX - (e.currentTarget.closest('.canvas-wrap') as HTMLElement).getBoundingClientRect().left, e.clientY - (e.currentTarget.closest('.canvas-wrap') as HTMLElement).getBoundingClientRect().top);
    const ids = topLevelSelection(s.doc!, S().selection);
    const orig = new Map(ids.map((i) => [i, { x: s.doc!.nodes[i].x, y: s.doc!.nodes[i].y }]));
    let began = false;
    const sx = e.clientX, sy = e.clientY;
    const move = (ev: PointerEvent) => {
      if (!began) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return; began = true; S().begin(); }
      const dx = (ev.clientX - sx) / S().zoom, dy = (ev.clientY - sy) / S().zoom;
      S().update((d) => { for (const i of ids) { const n = d.nodes[i]; const o = orig.get(i)!; n.x = Math.round(o.x + dx); n.y = Math.round(o.y + dy); } }, { commit: false });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (began) S().end(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    void start;
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} className="html-overlay">
      <div style={{ pointerEvents: 'auto' }}>{labels}</div>
      {badge}
      {rulers ? <Rulers /> : null}
    </div>
  );
}

function fmt2(v: number) { return String(Math.round(v * 100) / 100); }

function RenameInline({ id, done }: { id: string; done: () => void }) {
  const n = useEditor((s) => s.doc?.nodes[id]);
  const [v, setV] = useState(n?.name ?? '');
  return (
    <input autoFocus value={v} className="input" style={{ height: 18, width: 160, pointerEvents: 'auto' }}
      onChange={(e) => setV(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => { if (v.trim()) setProps([id], { name: v.trim() }); done(); }}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') done(); }} />
  );
}

function Rulers() {
  const zoom = useEditor((s) => s.zoom);
  const panX = useEditor((s) => s.panX);
  const panY = useEditor((s) => s.panY);
  const vw = useEditor((s) => s.viewport);
  const selection = useEditor((s) => s.selection);
  useEditor((s) => s.doc);
  const selB = selection.length ? selectionBounds(selection) : null;
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  const step = steps.find((st) => st * zoom >= 60) ?? 5000;
  const ticks = (len: number, pan: number) => {
    const out: number[] = [];
    const start = Math.floor(-pan / zoom / step) * step;
    for (let v = start; v * zoom + pan < len; v += step) out.push(v);
    return out;
  };
  const addGuide = (axis: 'X' | 'Y') => (e: React.PointerEvent) => {
    e.stopPropagation();
    const s = S();
    const id = uid('gd');
    s.begin();
    s.update((d) => { d.pages.find((p) => p.id === s.pageId)!.guides.push({ id, axis, offset: -99999 }); }, { commit: false });
    const wrap = (e.currentTarget as HTMLElement).closest('.canvas-wrap') as HTMLElement;
    const move = (ev: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      const w = screenToWorld(ev.clientX - r.left, ev.clientY - r.top);
      S().update((d) => { const g = d.pages.find((p) => p.id === s.pageId)!.guides.find((x) => x.id === id); if (g) g.offset = Math.round(axis === 'X' ? w.x : w.y); }, { commit: false });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      const r = wrap.getBoundingClientRect();
      if ((axis === 'X' ? ev.clientX - r.left : ev.clientY - r.top) < 20) S().update((d) => { const pg = d.pages.find((p) => p.id === s.pageId)!; pg.guides = pg.guides.filter((g) => g.id !== id); }, { commit: false });
      S().end();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div style={{ pointerEvents: 'auto' }}>
      <div className="ruler h" data-testid="ruler-h" onPointerDown={addGuide('Y')} style={{ cursor: 'ns-resize' }}>
        {selB ? <div style={{ position: 'absolute', left: selB.x * zoom + panX, width: selB.width * zoom, top: 0, bottom: 0, background: 'rgba(13,153,255,0.15)' }} /> : null}
        {ticks(vw.width, panX).map((v) => (
          <div key={v} style={{ position: 'absolute', left: v * zoom + panX, top: 0, height: 20, borderLeft: '1px solid var(--border-2)', paddingLeft: 3, fontSize: 9, color: 'var(--text-3)' }}>{v}</div>
        ))}
      </div>
      <div className="ruler v" data-testid="ruler-v" onPointerDown={addGuide('X')} style={{ cursor: 'ew-resize' }}>
        {selB ? <div style={{ position: 'absolute', top: selB.y * zoom + panY, height: selB.height * zoom, left: 0, right: 0, background: 'rgba(13,153,255,0.15)' }} /> : null}
        {ticks(vw.height, panY).map((v) => (
          <div key={v} style={{ position: 'absolute', top: v * zoom + panY, left: 0, width: 20, borderTop: '1px solid var(--border-2)', fontSize: 9, color: 'var(--text-3)', writingMode: 'vertical-rl', paddingTop: 3 }}>{v}</div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- text editing */

function TextEditorOverlay() {
  const id = useEditor((s) => s.editingTextId);
  const node = useEditor((s) => (s.editingTextId ? s.doc?.nodes[s.editingTextId] : undefined));
  const zoom = useEditor((s) => s.zoom);
  const panX = useEditor((s) => s.panX);
  const panY = useEditor((s) => s.panY);
  const ref = useRef<HTMLTextAreaElement>(null);
  const started = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    started.current = id;
    S().begin();
    const el = ref.current;
    if (el) { el.focus(); el.select(); }
    return () => {
      const s = S();
      const n = s.doc?.nodes[started.current!];
      if (n && n.text && !n.text.characters.trim() && !n.sourceId) {
        s.update((d) => {
          const nn = d.nodes[n.id];
          if (nn.parentId) d.nodes[nn.parentId].children = d.nodes[nn.parentId].children.filter((c) => c !== n.id);
          else for (const p of d.pages) p.children = p.children.filter((c) => c !== n.id);
          delete d.nodes[n.id];
        }, { commit: false });
        s.select([]);
      }
      s.end();
      started.current = null;
    };
  }, [id]);

  const finish = useCallback(() => { S().setState({ editingTextId: null }); }, []);
  if (!id || !node || !node.text) return null;
  const doc = S().doc!;
  const t = node.text;
  const ap = absPos(doc, id);
  const p = worldToScreen(ap.x, ap.y);
  const lh = resolveLineHeight(t);
  const color = node.fills.find((f) => f.visible && f.type === 'SOLID')?.color ?? '#000';
  const autoW = t.autoResize === 'WIDTH_AND_HEIGHT';
  const l = layoutText(t, autoW ? null : node.width);
  return (
    <textarea
      ref={ref}
      className="text-editor"
      data-testid="text-editor"
      spellCheck={false}
      value={t.characters}
      onChange={(e) => {
        const v = e.target.value;
        setProps([id], (n) => { if (n.text) n.text.characters = v; }, { commit: false });
      }}
      onBlur={finish}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); finish(); }
        const mod = e.metaKey || e.ctrlKey;
        if (mod && e.code === 'KeyB') { e.preventDefault(); setProps([id], (n) => { n.text!.fontWeight = n.text!.fontWeight >= 700 ? 400 : 700; }, { commit: false }); }
        if (mod && e.code === 'KeyI') { e.preventDefault(); setProps([id], (n) => { n.text!.italic = !n.text!.italic; }, { commit: false }); }
        if (mod && e.code === 'KeyU') { e.preventDefault(); setProps([id], (n) => { n.text!.decoration = n.text!.decoration === 'UNDERLINE' ? 'NONE' : 'UNDERLINE'; }, { commit: false }); }
      }}
      style={{
        left: p.x,
        top: p.y,
        width: (autoW ? Math.max(l.width + t.fontSize, 4) : node.width) * zoom,
        height: Math.max(node.height, lh) * zoom + 2,
        font: fontString({ ...t, fontSize: t.fontSize * zoom }),
        lineHeight: `${lh * zoom}px`,
        letterSpacing: `${(t.letterSpacing / 100) * t.fontSize * zoom}px`,
        color,
        textAlign: t.textAlign === 'JUSTIFIED' ? 'justify' : (t.textAlign.toLowerCase() as 'left'),
        whiteSpace: autoW ? 'pre' : 'pre-wrap',
        textTransform: t.textCase === 'UPPER' ? 'uppercase' : t.textCase === 'LOWER' ? 'lowercase' : t.textCase === 'TITLE' ? 'capitalize' : 'none',
        textDecoration: t.decoration === 'UNDERLINE' ? 'underline' : t.decoration === 'STRIKETHROUGH' ? 'line-through' : 'none',
        transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
      }}
    />
  );
}

export { isTransparent, nodePath, resolveVariable, unionRects };
