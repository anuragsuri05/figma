import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, S, setProps, moveLayer, goToPage, addPage, renamePage, movePage, createInstance, screenToWorld, zoomToSelection, toggleLock } from '../store/editor';
import { I, type IconName } from './icons';
import { IconButton, Menu, type MenuItem } from './ui';
import { mainMenuItems, pageContextItems, selectionContextItems } from './menus';
import type { DocumentData, SceneNode } from '../model/types';
import { ancestors, sortByTreeOrder } from '../model/tree';
import { nodeToSvgString } from '../render/export';
import { applyStyle } from '../store/editor';
import { Swatch } from './ui';

export function nodeIcon(n: SceneNode): IconName {
  switch (n.type) {
    case 'FRAME': return n.layout.mode === 'HORIZONTAL' ? 'autoLayoutH' : n.layout.mode === 'VERTICAL' ? 'autoLayoutV' : n.layout.mode === 'WRAP' ? 'wrap' : 'frame';
    case 'GROUP': return n.children.some((c) => c) && n.name ? 'group' : 'group';
    case 'SECTION': return 'section';
    case 'RECTANGLE': return n.fills.some((f) => f.type === 'IMAGE') ? 'image' : 'rect';
    case 'ELLIPSE': return 'ellipse';
    case 'POLYGON': return 'polygon';
    case 'STAR': return 'star';
    case 'LINE': return n.endCap === 'ARROW' ? 'arrow' : 'line';
    case 'VECTOR': return 'vector';
    case 'TEXT': return 'text';
    case 'COMPONENT': return 'componentFill';
    case 'COMPONENT_SET': return 'component';
    case 'INSTANCE': return 'instance';
    case 'BOOLEAN_OPERATION': return n.booleanOp === 'SUBTRACT' ? 'boolSubtract' : n.booleanOp === 'INTERSECT' ? 'boolIntersect' : n.booleanOp === 'EXCLUDE' ? 'boolExclude' : 'boolUnion';
    case 'SLICE': return 'slice';
  }
}

export function LeftPanel({ fileName, onRenameFile }: { fileName: string; onRenameFile: (n: string) => void }) {
  const leftTab = useEditor((s) => s.leftTab);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const saveState = useEditor((s) => s.saveState);
  return (
    <div className={'panel left' + (collapsed ? ' collapsed' : '')} data-testid="left-panel">
      <div className="left-header">
        <div className="row" style={{ gap: 2 }}>
          <button className={'logo-btn' + (menu ? ' open' : '')} data-menu-anchor data-testid="main-menu-btn" data-tip="Main menu"
            onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenu(menu ? null : { x: r.left, y: r.bottom + 4 }); }}>
            <I name="logo" size={18} /><I name="chevronDown" size={12} />
          </button>
          <span className="spacer" />
          <IconButton icon="panel" tip={collapsed ? 'Expand UI' : 'Minimize UI'} onClick={() => setCollapsed(!collapsed)} testId="minimize-ui" />
        </div>
        {editingName ? (
          <input className="input" autoFocus defaultValue={fileName} data-testid="file-name-input"
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => { onRenameFile(e.currentTarget.value.trim() || fileName); setEditingName(false); }}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingName(false); }} />
        ) : (
          <div className="file-title" data-testid="file-name" onDoubleClick={() => setEditingName(true)} onClick={() => setEditingName(true)} title="Rename">{fileName}</div>
        )}
        <div className="file-sub">Drafts · <span data-testid="save-state">{saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Unsaved changes'}</span></div>
      </div>
      {!collapsed && (
        <>
          <div className="tabs">
            <button className={'tab' + (leftTab === 'file' ? ' on' : '')} onClick={() => S().setState({ leftTab: 'file' })} data-testid="tab-file">File</button>
            <button className={'tab' + (leftTab === 'assets' ? ' on' : '')} onClick={() => S().setState({ leftTab: 'assets' })} data-testid="tab-assets">Assets</button>
          </div>
          {leftTab === 'file' ? <FileTab /> : <AssetsTab />}
        </>
      )}
      {menu ? <Menu items={mainMenuItems()} x={menu.x} y={menu.y} onClose={() => setMenu(null)} testId="main-menu" search /> : null}
    </div>
  );
}

function FileTab() {
  return (
    <div className="panel-scroll" style={{ display: 'flex', flexDirection: 'column' }}>
      <Pages />
      <Layers />
    </div>
  );
}

function Pages() {
  const pages = useEditor((s) => s.doc!.pages);
  const pageId = useEditor((s) => s.pageId);
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null);
  return (
    <div className="section" style={{ paddingBottom: 6 }} data-testid="pages-section">
      <div className="section-head">
        <span className="title" onClick={() => setOpen(!open)} style={{ cursor: 'default' }}>Pages</span>
        <IconButton icon="plus" tip="Add new page" onClick={() => { const id = addPage(); setRenaming(id); }} testId="add-page" />
        <IconButton icon={open ? 'chevronDown' : 'chevronRight'} tip={open ? 'Collapse' : 'Expand'} onClick={() => setOpen(!open)} />
      </div>
      {open && pages.map((p, i) => (
        <div key={p.id}
          className={'page-item' + (p.id === pageId ? ' on' : '') + (/^-{3,}$/.test(p.name) ? ' divider-item' : '')}
          data-testid={`page-${p.name}`}
          draggable
          onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); setDrag({ id: p.id, over: i }); }}
          onDragOver={(e) => { e.preventDefault(); if (drag) setDrag({ ...drag, over: i }); }}
          onDrop={(e) => { e.preventDefault(); if (drag) movePage(drag.id, i); setDrag(null); }}
          onDragEnd={() => setDrag(null)}
          style={drag && drag.over === i && drag.id !== p.id ? { boxShadow: 'inset 0 2px 0 var(--accent)' } : undefined}
          onClick={() => { if (p.id !== pageId) goToPage(p.id); }}
          onDoubleClick={() => setRenaming(p.id)}
          onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, id: p.id }); }}>
          {renaming === p.id ? (
            <input className="input" autoFocus defaultValue={p.name} data-testid="page-rename-input"
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => { renamePage(p.id, e.currentTarget.value.trim() || p.name); setRenaming(null); }}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(null); }} />
          ) : /^-{3,}$/.test(p.name) ? null : <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>}
        </div>
      ))}
      {menu ? <Menu items={pageContextItems(menu.id, () => setRenaming(menu.id))} x={menu.x} y={menu.y} onClose={() => setMenu(null)} testId="page-menu" /> : null}
    </div>
  );
}

interface Row { id: string; depth: number; }

function Layers() {
  const doc = useEditor((s) => s.doc!);
  const pageId = useEditor((s) => s.pageId);
  const selection = useEditor((s) => s.selection);
  const page = doc.pages.find((p) => p.id === pageId)!;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [drop, setDropState] = useState<{ id: string; pos: 'before' | 'after' | 'inside' } | null>(null);
  const dropRef = useRef<{ id: string; pos: 'before' | 'after' | 'inside' } | null>(null);
  const setDrop = (v: { id: string; pos: 'before' | 'after' | 'inside' } | null) => { dropRef.current = v; setDropState(v); };
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const anchorRef = useRef<string | null>(null);
  const dragRef = useRef<{ ids: string[]; startY: number; active: boolean } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // auto-expand ancestors of selection
  useEffect(() => {
    const need = new Set(expanded);
    let changed = false;
    for (const id of selection) for (const a of ancestors(doc, id)) if (!need.has(a.id)) { need.add(a.id); changed = true; }
    if (changed) setExpanded(need);
    if (selection.length === 1) {
      requestAnimationFrame(() => listRef.current?.querySelector(`[data-layer="${selection[0]}"]`)?.scrollIntoView({ block: 'nearest' }));
    }
  }, [selection.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const collapse = () => setExpanded(new Set());
    window.addEventListener('myflow:collapse-layers', collapse);
    return () => window.removeEventListener('myflow:collapse-layers', collapse);
  }, []);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    const q = query.trim().toLowerCase();
    const walk = (ids: string[], depth: number) => {
      for (const id of [...ids].reverse()) {
        const n = doc.nodes[id];
        if (!n) continue;
        if (q) {
          if (n.name.toLowerCase().includes(q)) out.push({ id, depth: 0 });
          walk(n.children, 0);
          continue;
        }
        out.push({ id, depth });
        if (expanded.has(id) && n.children.length) walk(n.children, depth + 1);
      }
    };
    walk(page.children, 0);
    return out;
  }, [doc, page, expanded, query]);

  const selSet = new Set(selection);
  const ancestorOfSel = new Set<string>();
  for (const id of selection) for (const a of ancestors(doc, id)) ancestorOfSel.add(a.id);

  const onRowDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input')) return;
    const s = S();
    if (e.shiftKey && anchorRef.current) {
      const ids = rows.map((r) => r.id);
      const a = ids.indexOf(anchorRef.current), b = ids.indexOf(id);
      const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
      s.select(range);
    } else if (e.metaKey || e.ctrlKey) {
      s.toggleSelect(id);
      anchorRef.current = id;
    } else {
      if (!selSet.has(id)) s.select([id]);
      anchorRef.current = id;
    }
    s.setState({ editingTextId: null, editingVectorId: null });
    dragRef.current = { ids: S().selection.includes(id) ? S().selection : [id], startY: e.clientY, active: false };
    const move = (ev: PointerEvent) => {
      const d = dragRef.current!;
      if (!d.active && Math.abs(ev.clientY - d.startY) > 4) d.active = true;
      if (!d.active) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-layer]') as HTMLElement | null;
      if (!el) { setDrop(null); return; }
      const tid = el.dataset.layer!;
      if (d.ids.includes(tid)) { setDrop(null); return; }
      const r = el.getBoundingClientRect();
      const rel = (ev.clientY - r.top) / r.height;
      const tn = S().doc!.nodes[tid];
      const canInside = tn && ['FRAME', 'GROUP', 'COMPONENT', 'SECTION', 'BOOLEAN_OPERATION', 'COMPONENT_SET'].includes(tn.type);
      setDrop({ id: tid, pos: canInside && rel > 0.25 && rel < 0.75 ? 'inside' : rel < 0.5 ? 'before' : 'after' });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const d = dragRef.current;
      dragRef.current = null;
      const cur = dropRef.current;
      setDrop(null);
      if (d?.active && cur) {
        const dd = S().doc!;
        const ordered = sortByTreeOrder(dd, page, d.ids);
        S().begin();
        for (const mid of ordered) {
          const doc2 = S().doc!;
          const tt = doc2.nodes[cur.id];
          if (cur.pos === 'inside') moveLayer(mid, tt.id, tt.children.length);
          else {
            const list = tt.parentId ? doc2.nodes[tt.parentId].children : doc2.pages.find((p) => p.id === S().pageId)!.children;
            const idx = list.indexOf(tt.id);
            moveLayer(mid, tt.parentId, cur.pos === 'before' ? idx + 1 : idx);
          }
        }
        S().end();
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} data-testid="layers-section">
      <div className="section-head">
        {searching ? (
          <input className="input" autoFocus placeholder="Find…" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="layer-search"
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { setQuery(''); setSearching(false); } }} />
        ) : <span className="title">Layers</span>}
        <IconButton icon={searching ? 'close' : 'search'} tip={searching ? 'Close search' : 'Search layers'} onClick={() => { setSearching(!searching); setQuery(''); }} testId="layer-search-btn" />
      </div>
      <div ref={listRef} style={{ paddingBottom: 12 }} onContextMenu={(e) => { e.preventDefault(); if (S().selection.length) setMenu({ x: e.clientX, y: e.clientY }); }}>
        {rows.length === 0 ? <div className="empty">{query ? 'No matching layers' : 'Use the toolbar to add layers'}</div> : null}
        {rows.map((r) => {
          const n = doc.nodes[r.id];
          const isComp = n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'COMPONENT_SET';
          const isSel = selSet.has(r.id);
          const hasKids = n.children.length > 0;
          const isExp = expanded.has(r.id);
          const inSelected = !isSel && ancestors(doc, r.id).some((a) => selSet.has(a.id));
          return (
            <div key={r.id}
              data-layer={r.id}
              data-testid={`layer-${n.name}`}
              className={'layer' + (isSel ? ' sel' : '') + (inSelected ? ' sel-child' : '') + (isComp ? ' comp' : '') + (!n.visible ? ' hidden-layer' : '') + (r.depth === 0 ? ' top' : '') + (drop?.id === r.id && drop.pos === 'inside' ? ' drop-inside' : '')}
              style={{ paddingLeft: 4 + r.depth * 16 }}
              onPointerDown={(e) => onRowDown(e, r.id)}
              onMouseEnter={() => S().setState({ hoverId: r.id })}
              onMouseLeave={() => S().setState({ hoverId: null })}
              onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest('button')) setRenaming(r.id); }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (!selSet.has(r.id)) S().select([r.id]); setMenu({ x: e.clientX, y: e.clientY }); }}
            >
              {drop?.id === r.id && drop.pos !== 'inside' ? <div className={'drop-line ' + drop.pos} /> : null}
              <span className="twisty" onPointerDown={(e) => { e.stopPropagation(); }} onClick={(e) => {
                e.stopPropagation();
                const ne = new Set(expanded);
                if (isExp) ne.delete(r.id); else ne.add(r.id);
                setExpanded(ne);
              }} data-testid={hasKids ? `twisty-${n.name}` : undefined}>
                {hasKids ? <I name={isExp ? 'chevronDown' : 'chevronRight'} size={12} /> : null}
              </span>
              <span className="layer-icon"><I name={nodeIcon(n)} size={16} /></span>
              {renaming === r.id ? (
                <input className="input grow" autoFocus defaultValue={n.name} data-testid="layer-rename-input"
                  onPointerDown={(e) => e.stopPropagation()}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={(e) => { const v = e.currentTarget.value.trim(); if (v && v !== n.name) setProps([r.id], { name: v }); setRenaming(null); }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setRenaming(null);
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const v = (e.target as HTMLInputElement).value.trim();
                      if (v) setProps([r.id], { name: v });
                      const i = rows.findIndex((x) => x.id === r.id);
                      const next = rows[i + (e.shiftKey ? -1 : 1)];
                      setRenaming(next?.id ?? null);
                    }
                  }} />
              ) : <span className="name">{n.name}</span>}
              <span className={'acts' + (n.locked || !n.visible ? ' pinned' : '')}>
                <IconButton icon={n.locked ? 'lock' : 'unlock'} tip={n.locked ? 'Unlock' : 'Lock'} testId={`lock-${n.name}`} onClick={(e) => { e.stopPropagation(); setProps([r.id], { locked: !n.locked }); }} style={{ opacity: n.locked ? 1 : undefined }} />
                <IconButton icon={n.visible ? 'eye' : 'eyeOff'} tip={n.visible ? 'Hide' : 'Show'} testId={`visibility-${n.name}`} onClick={(e) => { e.stopPropagation(); setProps([r.id], { visible: !n.visible }); }} />
              </span>
            </div>
          );
        })}
      </div>
      {menu ? <Menu items={selectionContextItems()} x={menu.x} y={menu.y} onClose={() => setMenu(null)} testId="layer-menu" /> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- assets */

const thumbCache = new WeakMap<object, string>();
function componentThumb(doc: DocumentData, id: string) {
  const n = doc.nodes[id];
  const hit = thumbCache.get(n);
  if (hit) return hit;
  try {
    const scale = Math.min(1, 120 / Math.max(n.width, n.height));
    const { svg } = nodeToSvgString(doc, id, { scale });
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    thumbCache.set(n, url);
    return url;
  } catch { return ''; }
}

function AssetsTab() {
  const doc = useEditor((s) => s.doc!);
  const [q, setQ] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const comps = Object.values(doc.nodes).filter((n) => n.type === 'COMPONENT' && n.name.toLowerCase().includes(q.toLowerCase()) && !n.name.startsWith('.') && !n.name.startsWith('_'));
  const byPage = new Map<string, SceneNode[]>();
  for (const c of comps) {
    const pg = doc.pages.find((p) => { let top: SceneNode | undefined = c; while (top?.parentId) top = doc.nodes[top.parentId]; return p.children.includes(top!.id); });
    const key = pg?.name ?? 'Other';
    byPage.set(key, [...(byPage.get(key) ?? []), c]);
  }
  const insert = (id: string, clientX?: number, clientY?: number) => {
    const s = S();
    const main = doc.nodes[id];
    let p = screenToWorld(s.viewport.width / 2, s.viewport.height / 2);
    if (clientX !== undefined && clientY !== undefined) p = screenToWorld(clientX, clientY);
    createInstance(id, Math.round(p.x - main.width / 2), Math.round(p.y - main.height / 2));
  };
  const setLabel = (n: SceneNode) => {
    const parent = n.parentId ? doc.nodes[n.parentId] : null;
    return parent?.type === 'COMPONENT_SET' ? `${parent.name} / ${n.name}` : n.name;
  };
  const colorStyles = doc.styles.filter((s) => s.type === 'FILL' && s.name.toLowerCase().includes(q.toLowerCase()));
  const textStyles = doc.styles.filter((s) => s.type === 'TEXT' && s.name.toLowerCase().includes(q.toLowerCase()));
  const effectStyles = doc.styles.filter((s) => s.type === 'EFFECT' && s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="panel-scroll" data-testid="assets-tab">
      <div className="row" style={{ padding: '8px 12px' }}>
        <input className="input" placeholder="Search assets" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} data-testid="assets-search" />
        <IconButton icon={view === 'grid' ? 'menu' : 'tidy'} tip={view === 'grid' ? 'List view' : 'Grid view'} onClick={() => setView(view === 'grid' ? 'list' : 'grid')} />
        <IconButton icon="book" tip="Libraries" onClick={() => S().setState({ modal: 'libraries' })} testId="open-libraries" />
      </div>
      <div className="section-head"><span className="title">Local components</span></div>
      {comps.length === 0 ? <div className="empty">No components yet.<br />Select layers and press {navigator.platform.includes('Mac') ? '⌥⌘K' : 'Ctrl+Alt+K'} to create one.</div> : null}
      {[...byPage.entries()].map(([pg, list]) => (
        <div key={pg} style={{ marginBottom: 8 }}>
          <div className="faint" style={{ padding: '4px 16px' }}>{pg}</div>
          {view === 'grid' ? (
            <div className="asset-grid">
              {list.map((c) => (
                <div key={c.id} className="asset-card" draggable data-testid={`asset-${c.name}`}
                  title={c.componentDescription || setLabel(c)}
                  onClick={() => insert(c.id)}
                  onDragStart={(e) => { e.dataTransfer.setData('application/x-myflow-component', c.id); }}>
                  <div className="pv"><img src={componentThumb(doc, c.id)} alt="" /></div>
                  <div className="nm">{setLabel(c)}</div>
                </div>
              ))}
            </div>
          ) : list.map((c) => (
            <div key={c.id} className="qa-item" style={{ margin: '0 8px' }} draggable onClick={() => insert(c.id)} onDragStart={(e) => e.dataTransfer.setData('application/x-myflow-component', c.id)}>
              <I name="componentFill" size={16} style={{ color: 'var(--component)' }} /> {setLabel(c)}
            </div>
          ))}
        </div>
      ))}
      {colorStyles.length + textStyles.length + effectStyles.length > 0 && <div className="section-head"><span className="title">Local styles</span></div>}
      {colorStyles.map((st) => (
        <div key={st.id} className="qa-item" style={{ margin: '0 8px' }} onClick={() => applyStyle(st.id)} data-testid={`asset-style-${st.name}`}>
          <Swatch paint={st.fills?.[0]} /> {st.name}
        </div>
      ))}
      {textStyles.map((st) => (
        <div key={st.id} className="qa-item" style={{ margin: '0 8px' }} onClick={() => applyStyle(st.id)}>
          <span style={{ fontWeight: 700, width: 14 }}>Ag</span> {st.name} <span className="faint">{st.text?.fontSize}/{st.text?.fontWeight}</span>
        </div>
      ))}
      {effectStyles.map((st) => (
        <div key={st.id} className="qa-item" style={{ margin: '0 8px' }} onClick={() => applyStyle(st.id)}>
          <I name="effect" size={14} /> {st.name}
        </div>
      ))}
    </div>
  );
}

export type { MenuItem };
