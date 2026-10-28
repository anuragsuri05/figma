import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { produce } from 'immer';
import type { DocumentData, Reaction, SceneNode, Easing } from '../model/types';
import { loadDoc } from '../store/persist';
import { S } from '../store/editor';
import { StaticRenderRoot, SvgNode } from '../render/NodeRenderer';
import { runLayout, syncInstance } from '../model/layout';
import { absPos, descendants, unionRects } from '../model/tree';
import { I } from '../editor/icons';

export const DEVICE_SIZES: Record<string, { w: number; h: number }> = {
  IPHONE_16: { w: 393, h: 852 }, IPHONE_16_PRO: { w: 402, h: 874 }, ANDROID: { w: 412, h: 917 }, IPAD: { w: 834, h: 1194 },
  MACBOOK: { w: 1280, h: 832 }, DESKTOP: { w: 1440, h: 1024 },
};

function viewportOf(frame: SceneNode, device: string) {
  const dev = DEVICE_SIZES[device];
  const scrolls = frame.overflow !== 'NONE';
  return { w: dev && scrolls ? Math.min(frame.width, dev.w) : frame.width, h: dev && scrolls ? Math.min(frame.height, dev.h) : frame.height };
}

const EASE: Record<Easing, string> = {
  LINEAR: 'linear', EASE_IN: 'cubic-bezier(0.42,0,1,1)', EASE_OUT: 'cubic-bezier(0,0,0.58,1)', EASE_IN_OUT: 'cubic-bezier(0.42,0,0.58,1)',
  EASE_IN_BACK: 'cubic-bezier(0.3,-0.05,0.7,-0.5)', EASE_OUT_BACK: 'cubic-bezier(0.45,1.45,0.8,1)', GENTLE: 'cubic-bezier(0.3,1.25,0.6,1)',
  QUICK: 'cubic-bezier(0.2,1.15,0.4,1)', BOUNCY: 'cubic-bezier(0.25,1.6,0.5,0.9)', SLOW: 'cubic-bezier(0.35,1.1,0.6,1)',
};

interface Overlay { nodeId: string; reaction: Reaction }
interface Transition { from: string; to: string; reaction: Reaction; back?: boolean }

function namePath(doc: DocumentData, root: string, id: string) {
  const parts: string[] = [];
  let n: SceneNode | undefined = doc.nodes[id];
  while (n && n.id !== root) { parts.unshift(n.name); n = n.parentId ? doc.nodes[n.parentId] : undefined; }
  return parts.join('/');
}

export function Present({ fileId, startNode, pageId }: { fileId: string; startNode?: string; pageId?: string }) {
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [transition, setTransition] = useState<Transition | null>(null);
  const [fit, setFit] = useState<'fit' | 'actual' | 'width'>('fit');
  const [hints, setHints] = useState(false);
  const [flowId, setFlowId] = useState<string>('');
  const [flash, setFlash] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 800, h: 600 });
  const baseDoc = useRef<DocumentData | null>(null);
  const pressRevert = useRef<(() => void) | null>(null);

  useEffect(() => {
    const fromStore = S().fileId === fileId ? S().doc : null;
    const go = (d: DocumentData) => {
      const laid = produce(d, (x) => { runLayout(x as DocumentData); });
      baseDoc.current = laid;
      setDoc(laid);
      const page = laid.pages.find((p) => p.id === pageId) ?? laid.pages[0];
      const start = startNode && laid.nodes[startNode] ? startNode : page.flowStarts[0]?.nodeId ?? page.children.find((id) => ['FRAME', 'COMPONENT', 'INSTANCE'].includes(laid.nodes[id]?.type));
      setCurrent(start ?? null);
      setFlowId(page.flowStarts.find((f) => f.nodeId === start)?.id ?? '');
      document.title = `${laid.name} – Prototype`;
    };
    if (fromStore) go(fromStore);
    else loadDoc(fileId).then((d) => d && go(d));
  }, [fileId, startNode, pageId]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setStage({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [doc]);

  const page = doc?.pages.find((p) => p.children.includes(current ?? '') || p.children.some((c) => doc.nodes[c]?.children.includes(current ?? ''))) ?? doc?.pages[0];

  const navigate = useCallback((to: string, r: Reaction, opts: { back?: boolean } = {}) => {
    if (!doc || !current || !doc.nodes[to]) return;
    setOverlays([]);
    if (!opts.back) setHistory((h) => [...h, current]);
    if (r.animation === 'INSTANT') { setCurrent(to); setTransition(null); return; }
    setTransition({ from: current, to, reaction: r, back: opts.back });
    setCurrent(to);
  }, [doc, current]);

  const runReaction = useCallback((r: Reaction, sourceId: string) => {
    if (!doc) return;
    switch (r.action) {
      case 'NAVIGATE': if (r.destinationId) navigate(r.destinationId, r); break;
      case 'BACK': {
        if (overlays.length) { setOverlays((o) => o.slice(0, -1)); break; }
        const prev = history[history.length - 1];
        if (prev) { setHistory((h) => h.slice(0, -1)); navigate(prev, r, { back: true }); }
        break;
      }
      case 'OPEN_OVERLAY': if (r.destinationId) setOverlays((o) => [...o, { nodeId: r.destinationId!, reaction: r }]); break;
      case 'SWAP_OVERLAY': if (r.destinationId) setOverlays((o) => [...o.slice(0, -1), { nodeId: r.destinationId!, reaction: r }]); break;
      case 'CLOSE_OVERLAY': setOverlays((o) => o.slice(0, -1)); break;
      case 'OPEN_URL': if (r.url) window.open(r.url, '_blank', 'noopener'); break;
      case 'SCROLL_TO': {
        const el = stageRef.current?.querySelector(`[data-id="${r.destinationId}"]`);
        el?.scrollIntoView({ behavior: r.animation === 'INSTANT' ? 'auto' : 'smooth', block: 'start' });
        break;
      }
      case 'CHANGE_TO': {
        if (!r.destinationId) break;
        // find nearest instance of a component set containing destination
        let n: SceneNode | undefined = doc.nodes[sourceId];
        while (n && n.type !== 'INSTANCE') n = n.parentId ? doc.nodes[n.parentId] : undefined;
        if (!n) break;
        const instId = n.id;
        const before = doc;
        const next = produce(doc, (d) => {
          d.nodes[instId].mainComponentId = r.destinationId!;
          d.nodes[instId].overrides = (d.nodes[instId].overrides ?? []).filter((k) => k !== 'width' && k !== 'height');
          syncInstance(d as DocumentData, instId);
          runLayout(d as DocumentData);
        });
        setDoc(next);
        if (r.animation === 'SMART_ANIMATE' || r.animation === 'DISSOLVE') smartAnimateInstance(stageRef.current, before, next, instId, r);
        break;
      }
      case 'SET_VARIABLE': {
        if (!r.variableId) break;
        const next = produce(doc, (d) => {
          const v = d.variables.find((x) => x.id === r.variableId);
          if (!v) return;
          let val: string | number | boolean = r.variableValue ?? '';
          if (v.type === 'NUMBER') {
            const cur = Number(Object.values(v.values)[0]) || 0;
            const m = String(val).match(/^([+-])\s*(\d+(\.\d+)?)$/);
            val = m ? cur + (m[1] === '+' ? +m[2] : -m[2]) : Number(val) || 0;
          } else if (v.type === 'BOOLEAN') val = val === 'toggle' ? !Object.values(v.values)[0] : val === 'true';
          for (const k of Object.keys(v.values)) v.values[k] = val;
          runLayout(d as DocumentData);
        });
        setDoc(next);
        break;
      }
    }
  }, [doc, history, navigate, overlays.length]);

  const findReaction = (target: EventTarget | null, triggers: Reaction['trigger'][]): { r: Reaction; id: string } | null => {
    if (!doc) return null;
    let el = (target as Element | null)?.closest?.('[data-id]');
    while (el) {
      const id = el.getAttribute('data-id')!;
      const n = doc.nodes[id];
      const main = n?.type === 'INSTANCE' && n.mainComponentId ? doc.nodes[n.mainComponentId] : undefined;
      const all = [...(n?.reactions ?? []), ...(main?.reactions ?? [])];
      const r = all.find((x) => triggers.includes(x.trigger));
      if (r) return { r, id };
      el = el.parentElement?.closest('[data-id]') ?? null;
    }
    return null;
  };

  // after-delay & key triggers
  useEffect(() => {
    if (!doc || !current) return;
    const ids = [current, ...descendants(doc, current)];
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const id of ids) for (const r of doc.nodes[id].reactions) if (r.trigger === 'AFTER_DELAY') timers.push(setTimeout(() => runReaction(r, id), r.delay ?? 800));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') { restart(); return; }
      if (e.key === 'Escape') { if (overlays.length) setOverlays((o) => o.slice(0, -1)); else exit(); return; }
      for (const id of ids) for (const r of doc.nodes[id].reactions) if (r.trigger === 'KEY' && r.key && r.key.toLowerCase() === e.key.toLowerCase()) { runReaction(r, id); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') step(e.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => { timers.forEach(clearTimeout); window.removeEventListener('keydown', onKey); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const frames = useMemo(() => {
    if (!doc || !page) return [] as string[];
    const overlayOnly = new Set<string>();
    const navTargets = new Set<string>(page.flowStarts.map((f) => f.nodeId));
    for (const n of Object.values(doc.nodes)) for (const r of n.reactions) {
      if (!r.destinationId) continue;
      if (r.action === 'OPEN_OVERLAY' || r.action === 'SWAP_OVERLAY') overlayOnly.add(r.destinationId); else navTargets.add(r.destinationId);
    }
    return page.children.flatMap((id) => (doc.nodes[id]?.type === 'SECTION' ? doc.nodes[id].children : [id]))
      .filter((id) => ['FRAME', 'INSTANCE'].includes(doc.nodes[id]?.type) && doc.nodes[id].visible && !(overlayOnly.has(id) && !navTargets.has(id)))
      .sort((a, b) => doc.nodes[a].y - doc.nodes[b].y || doc.nodes[a].x - doc.nodes[b].x);
  }, [doc, page]);

  const step = (dir: number) => {
    if (!current || !frames.length) return;
    const i = frames.indexOf(current);
    const next = frames[(i + dir + frames.length) % frames.length];
    if (next) { setHistory((h) => [...h, current]); setCurrent(next); setTransition(null); setOverlays([]); }
  };
  const restart = () => {
    if (!baseDoc.current) return;
    setDoc(baseDoc.current);
    const pg = page;
    const start = (startNode && baseDoc.current.nodes[startNode] ? startNode : pg?.flowStarts[0]?.nodeId) ?? frames[0];
    setCurrent(start ?? null); setHistory([]); setOverlays([]); setTransition(null);
  };
  const exit = () => { window.location.hash = `#/file/${fileId}`; };

  if (!doc) return <div className="present" data-testid="present"><div className="empty">Loading prototype…</div></div>;
  if (!current || !doc.nodes[current]) {
    return (
      <div className="present" data-testid="present">
        <div className="present-top"><button className="icon-btn" onClick={exit} data-tip="Close"><I name="close" size={16} /></button></div>
        <div className="empty" style={{ color: '#ccc' }}>No frames to present on this page.</div>
      </div>
    );
  }

  const frame = doc.nodes[current];
  const device = page?.prototypeDevice ?? 'NONE';
  const vp = viewportOf(frame, device);
  const scale = fit === 'actual' ? 1 : fit === 'width' ? Math.min(1.5, (stage.w - 40) / vp.w) : Math.min(1, (stage.w - 40) / vp.w, (stage.h - 40) / vp.h);
  const bezel = device !== 'NONE' && device !== 'PRESENTATION';

  const handlers = {
    onClick: (e: React.MouseEvent) => {
      const found = findReaction(e.target, ['ON_CLICK', 'ON_DRAG']);
      if (found) runReaction(found.r, found.id);
      else setFlash((f) => f + 1);
    },
    onPointerDown: (e: React.PointerEvent) => {
      const found = findReaction(e.target, ['ON_PRESS']);
      if (found && doc) {
        const snapshot = doc;
        runReaction(found.r, found.id);
        pressRevert.current = () => setDoc(snapshot);
      }
    },
    onPointerUp: () => { pressRevert.current?.(); pressRevert.current = null; },
    onPointerOver: (e: React.PointerEvent) => {
      const found = findReaction(e.target, ['ON_HOVER', 'MOUSE_ENTER']);
      const related = findReaction(e.relatedTarget, ['ON_HOVER', 'MOUSE_ENTER']);
      if (found && (!related || related.id !== found.id)) {
        const snapshot = doc;
        runReaction(found.r, found.id);
        if (found.r.trigger === 'ON_HOVER') {
          const el = (e.target as Element).closest(`[data-id="${found.id}"]`) ?? (e.target as Element);
          const leave = (ev: Event) => {
            const pe = ev as PointerEvent;
            if (pe.relatedTarget && (pe.relatedTarget as Element).closest?.(`[data-id]`) && (el as Element).contains(pe.relatedTarget as Node)) return;
            setDoc(snapshot);
            el.removeEventListener('pointerleave', leave);
          };
          el.addEventListener('pointerleave', leave);
        }
      }
    },
    onPointerOut: (e: React.PointerEvent) => {
      const found = findReaction(e.target, ['MOUSE_LEAVE']);
      const related = findReaction(e.relatedTarget, ['MOUSE_LEAVE']);
      if (found && (!related || related.id !== found.id)) runReaction(found.r, found.id);
    },
  };

  return (
    <div className="present" data-testid="present">
      <div className="present-top">
        <button className="icon-btn" onClick={exit} data-tip="Close presentation" data-testid="present-close"><I name="close" size={16} /></button>
        <span style={{ fontWeight: 600 }}>{doc.name}</span>
        <span style={{ color: '#aaa' }}>/</span>
        <span data-testid="present-frame-name">{frame.name}</span>
        <span className="spacer" />
        {page && page.flowStarts.length ? (
          <select className="present-select" data-testid="present-flow" value={flowId || page.flowStarts.find((f) => f.nodeId === current)?.id || ''} onChange={(e) => { const fl = page.flowStarts.find((f) => f.id === e.target.value); if (fl) { setFlowId(fl.id); setCurrent(fl.nodeId); setHistory([]); setOverlays([]); setTransition(null); } }}>
            <option value="">Flows</option>
            {page.flowStarts.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        ) : null}
        <button className="icon-btn" onClick={() => step(-1)} data-tip="Previous frame" data-testid="present-prev"><I name="chevronRight" size={16} style={{ transform: 'rotate(180deg)' }} /></button>
        <span style={{ color: '#aaa', minWidth: 40, textAlign: 'center' }}>{frames.indexOf(current) + 1} / {frames.length}</span>
        <button className="icon-btn" onClick={() => step(1)} data-tip="Next frame" data-testid="present-next"><I name="chevronRight" size={16} /></button>
        <button className="icon-btn" onClick={restart} data-tip="Restart (R)" data-testid="present-restart"><I name="history" size={16} /></button>
        <select className="present-select" value={fit} onChange={(e) => setFit(e.target.value as 'fit')} data-testid="present-fit">
          <option value="fit">Fit</option><option value="width">Fit width</option><option value="actual">Actual size</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ccc' }}><input type="checkbox" data-testid="present-hotspots" checked={hints} onChange={(e) => setHints(e.target.checked)} /> Hotspot hints</label>
      </div>
      <div className="present-stage" ref={stageRef} style={{ background: page?.prototypeBackground ?? '#1E1E1E', overflow: fit === 'actual' || fit === 'width' ? 'auto' : 'hidden' }}>
        <div style={{ padding: bezel ? 14 : 0, borderRadius: bezel ? 48 * scale + 14 : 0, background: bezel ? '#111' : 'transparent', boxShadow: bezel ? '0 0 0 2px #333' : undefined }}>
          <Screen key={current} doc={doc} frameId={current} scale={scale} device={device} transition={transition?.to === current ? transition : null} prevDoc={doc} handlers={handlers} hints={hints} flash={flash} roundCorners={bezel ? 40 * scale : 0} />
        </div>
        {overlays.map((o, i) => (
          <OverlayView key={o.nodeId + i} doc={doc} overlay={o} scale={scale} stage={stage} handlers={handlers} onClose={() => setOverlays((x) => x.slice(0, i))} hints={hints} flash={flash} />
        ))}
      </div>
    </div>
  );
}

function contentBounds(doc: DocumentData, frameId: string) {
  const f = doc.nodes[frameId];
  const kids = f.children.map((c) => doc.nodes[c]).filter((k) => k && k.visible);
  const b = unionRects([{ x: 0, y: 0, width: f.width, height: f.height }, ...kids.map((k) => ({ x: k.x, y: k.y, width: k.width, height: k.height }))])!;
  return b;
}

function Screen({ doc, frameId, scale, transition, handlers, hints, flash, roundCorners, device = 'NONE' }: {
  doc: DocumentData; frameId: string; scale: number; device?: string; transition: Transition | null; prevDoc: DocumentData;
  handlers: Record<string, (e: never) => void>; hints: boolean; flash: number; roundCorners: number;
}) {
  const frame = doc.nodes[frameId];
  const ref = useRef<HTMLDivElement>(null);
  const scrolls = frame.overflow !== 'NONE';
  const b = scrolls ? contentBounds(doc, frameId) : { x: 0, y: 0, width: frame.width, height: frame.height };
  const fixedIds = new Set(frame.children.filter((c) => doc.nodes[c]?.scrollBehavior === 'FIXED'));
  const vp = viewportOf(frame, device);
  const nodes = useMemo(() => {
    const out = { ...doc.nodes, [frameId]: { ...frame, x: -b.x, y: -b.y, rotation: 0, clipContent: !scrolls } };
    return out;
  }, [doc, frameId, scrolls, b.x, b.y, frame]);
  const fixedNodes = useMemo(() => ({ ...doc.nodes, [frameId]: { ...frame, x: 0, y: 0, fills: [], strokes: [], effects: [], rotation: 0, children: frame.children.filter((c) => fixedIds.has(c)) } }), [doc, frameId, frame]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!transition || !ref.current) return;
    const r = transition.reaction;
    const dur = r.duration;
    const easing = EASE[r.easing] ?? 'ease-out';
    const el = ref.current;
    const dir = r.direction ?? 'LEFT';
    const w = frame.width * scale, h = frame.height * scale;
    const off = dir === 'LEFT' ? [w, 0] : dir === 'RIGHT' ? [-w, 0] : dir === 'TOP' ? [0, h] : [0, -h];
    if (transition.back) { off[0] = -off[0]; off[1] = -off[1]; }
    if (r.animation === 'DISSOLVE') el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur, easing });
    else if (r.animation === 'MOVE_IN' || r.animation === 'PUSH' || r.animation === 'SLIDE_IN') el.animate([{ transform: `translate(${off[0]}px, ${off[1]}px)`, opacity: r.animation === 'SLIDE_IN' ? 0.6 : 1 }, { transform: 'none', opacity: 1 }], { duration: dur, easing });
    else if (r.animation === 'MOVE_OUT' || r.animation === 'SLIDE_OUT') el.animate([{ transform: `scale(0.96)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: dur, easing });
    else if (r.animation === 'SMART_ANIMATE') {
      // match layers by name path between source and destination frames
      const from = transition.from;
      const map = new Map<string, { x: number; y: number; opacity: number; w: number; h: number; chars?: string }>();
      for (const id of descendants(doc, from)) {
        const p = absPos(doc, id), f0 = absPos(doc, from);
        map.set(namePath(doc, from, id), { x: p.x - f0.x, y: p.y - f0.y, opacity: doc.nodes[id].opacity, w: doc.nodes[id].width, h: doc.nodes[id].height, chars: doc.nodes[id].text?.characters });
      }
      const f1 = absPos(doc, frameId);
      el.querySelectorAll('[data-id]').forEach((g) => {
        const id = g.getAttribute('data-id')!;
        if (id === frameId || !doc.nodes[id]) return;
        // only animate top-most matched
        const parentG = g.parentElement?.closest('[data-id]');
        const old = map.get(namePath(doc, frameId, id));
        const p = absPos(doc, id);
        if (!old) { (g as SVGElement).animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur, easing }); return; }
        if (old.chars !== undefined && old.chars !== doc.nodes[id].text?.characters) (g as SVGElement).animate([{ opacity: 0 }, { opacity: doc.nodes[id].opacity }], { duration: dur, easing });
        const parentId = parentG?.getAttribute('data-id');
        const parentOld = parentId && parentId !== frameId ? map.get(namePath(doc, frameId, parentId)) : null;
        const parentNew = parentId && parentId !== frameId ? absPos(doc, parentId) : f1;
        const ox = old.x - (parentOld ? parentOld.x : 0), oy = old.y - (parentOld ? parentOld.y : 0);
        const nx = p.x - parentNew.x, ny = p.y - parentNew.y;
        const dx = ox - nx, dy = oy - ny;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || old.opacity !== doc.nodes[id].opacity) {
          (g as SVGElement).animate([{ translate: `${dx}px ${dy}px`, opacity: old.opacity } as Keyframe, { translate: '0px 0px', opacity: doc.nodes[id].opacity } as Keyframe], { duration: dur, easing });
        }
      });
    }
  }, [transition]); // eslint-disable-line react-hooks/exhaustive-deps

  const hotspots = (hints || flash) ? [frameId, ...descendants(doc, frameId)].filter((id) => doc.nodes[id]?.reactions.length && id !== frameId) : [];
  const f0 = absPos(doc, frameId);
  return (
    <div className="present-screen" ref={ref} data-testid="present-screen" data-frame={frame.name}
      style={{ width: vp.w * scale, height: vp.h * scale, overflowX: frame.overflow === 'HORIZONTAL' || frame.overflow === 'BOTH' ? 'auto' : 'hidden', overflowY: frame.overflow === 'VERTICAL' || frame.overflow === 'BOTH' ? 'auto' : 'hidden', borderRadius: roundCorners }}
      {...(handlers as Record<string, never>)}>
      <svg width={b.width * scale} height={b.height * scale} style={{ display: 'block', cursor: 'default' }}>
        <g transform={`scale(${scale})`}>
          <StaticRenderRoot nodes={nodes} opts={{ prefix: 'p' + frameId.slice(-5), interactive: true, hideIds: fixedIds.size ? fixedIds : undefined }}>
            <SvgNode id={frameId} />
          </StaticRenderRoot>
        </g>
      </svg>
      {fixedIds.size ? (
        <svg width={vp.w * scale} height={vp.h * scale} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          <g transform={`scale(${scale})`} style={{ pointerEvents: 'auto' }}>
            <StaticRenderRoot nodes={fixedNodes} opts={{ prefix: 'pf' + frameId.slice(-5), interactive: true }}>
              <SvgNode id={frameId} />
            </StaticRenderRoot>
          </g>
        </svg>
      ) : null}
      {hotspots.map((id) => {
        const p = absPos(doc, id);
        const n = doc.nodes[id];
        return <div key={id + flash} className="hotspot-flash" style={{ left: (p.x - f0.x - b.x) * scale, top: (p.y - f0.y - b.y) * scale, width: n.width * scale, height: n.height * scale, animation: hints ? 'none' : undefined, opacity: hints ? 0.8 : undefined }} />;
      })}
    </div>
  );
}

function OverlayView({ doc, overlay, scale, stage, handlers, onClose, hints, flash }: { doc: DocumentData; overlay: Overlay; scale: number; stage: { w: number; h: number }; handlers: Record<string, (e: never) => void>; onClose: () => void; hints: boolean; flash: number }) {
  const n = doc.nodes[overlay.nodeId];
  if (!n) return null;
  const r = overlay.reaction;
  const w = n.width * scale, h = n.height * scale;
  const pos = r.overlayPosition ?? 'CENTER';
  let left = (stage.w - w) / 2, top = (stage.h - h) / 2;
  if (pos.startsWith('TOP')) top = 20;
  if (pos.startsWith('BOTTOM')) top = stage.h - h - 20;
  if (pos.endsWith('LEFT')) left = 20;
  if (pos.endsWith('RIGHT')) left = stage.w - w - 20;
  return (
    <div style={{ position: 'absolute', inset: 0, background: r.overlayBackground ? 'rgba(0,0,0,0.5)' : 'transparent' }} data-testid="present-overlay"
      onClick={(e) => { if (e.target === e.currentTarget && r.closeOnOutside) onClose(); }}>
      <div style={{ position: 'absolute', left, top }}>
        <Screen doc={doc} frameId={overlay.nodeId} scale={scale} transition={r.animation !== 'INSTANT' ? { from: overlay.nodeId, to: overlay.nodeId, reaction: { ...r, animation: r.animation === 'SMART_ANIMATE' ? 'DISSOLVE' : r.animation } } : null} prevDoc={doc} handlers={handlers} hints={hints} flash={flash} roundCorners={(n.corners ? Math.max(...n.corners) : n.cornerRadius) * scale} />
      </div>
    </div>
  );
}

function smartAnimateInstance(stage: HTMLElement | null, before: DocumentData, after: DocumentData, instId: string, r: Reaction) {
  if (!stage) return;
  const beforeMap = new Map<string, { x: number; y: number; opacity: number }>();
  for (const id of descendants(before, instId)) {
    const n = before.nodes[id];
    beforeMap.set(namePath(before, instId, id), { x: n.x, y: n.y, opacity: n.opacity });
  }
  requestAnimationFrame(() => {
    for (const id of descendants(after, instId)) {
      const n = after.nodes[id];
      const old = beforeMap.get(namePath(after, instId, id));
      const g = stage.querySelector(`[data-id="${id}"]`) as SVGElement | null;
      if (!g) continue;
      const easing = EASE[r.easing] ?? 'ease-out';
      if (!old) { g.animate([{ opacity: 0 }, { opacity: n.opacity }], { duration: r.duration, easing }); continue; }
      const dx = old.x - n.x, dy = old.y - n.y;
      if (dx || dy || old.opacity !== n.opacity) g.animate([{ translate: `${dx}px ${dy}px`, opacity: old.opacity } as Keyframe, { translate: '0px 0px', opacity: n.opacity } as Keyframe], { duration: r.duration, easing });
    }
  });
}
