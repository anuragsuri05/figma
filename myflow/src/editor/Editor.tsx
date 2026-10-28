import React, { useEffect, useRef, useState } from 'react';
import {
  useEditor, S, currentDoc, selectedNodes, nudge, setOpacityKey, copySelection, pasteClipboard, type ClipboardData, zoomToFit,
  screenToWorld, createInstance, containerAt, deleteSelection, addNode, defaultPrefs, relayoutText,
} from '../store/editor';
import { loadDoc, saveDoc, updateMeta, addVersion, duplicateFile, getPrefs, setPrefs } from '../store/persist';
import { Canvas, finishPen, penActive } from './Canvas';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';
import { Toolbar } from './Toolbar';
import { Modals } from './Modals';
import { Menu, TooltipLayer } from './ui';
import { selectionContextItems, canvasContextItems } from './menus';
import { CommentLayer, CommentsPanel } from './Comments';
import { AIPanel, AIModals, useAgent } from './AIPanel';
import { commandForKey, eventKey, runCommand, placeImageAt, readAsDataUrl } from '../commands';
import { thumbnailFor } from '../render/export';
import { uid, createNode } from '../model/defaults';
import { ancestors, topLevelSelection } from '../model/tree';
import { isTransparent } from './canvasLogic';
import type { DocumentData } from '../model/types';

function isTyping() {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === 'INPUT') return !['checkbox', 'radio', 'range', 'button', 'color', 'file'].includes((el as HTMLInputElement).type);
  return el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

export function useTheme() {
  const theme = useEditor((s) => s.prefs.theme);
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      try { localStorage.setItem('myflow:theme', theme); } catch { /* ignore */ }
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export function usePrefsPersistence() {
  const prefs = useEditor((s) => s.prefs);
  const loaded = useRef(false);
  useEffect(() => {
    getPrefs(defaultPrefs).then((p) => { S().setPrefs(p); loaded.current = true; });
  }, []);
  useEffect(() => { if (loaded.current) void setPrefs(prefs); }, [prefs]);
}

export function Editor({ fileId }: { fileId: string }) {
  const doc = useEditor((s) => s.doc);
  const loadedId = useEditor((s) => s.fileId);
  const showUI = useEditor((s) => s.view.showUI);
  const ctxMenu = useEditor((s) => s.contextMenu);
  const toast = useEditor((s) => s.toastMsg);
  const commentsPanel = useEditor((s) => s.commentsPanel);
  const tool = useEditor((s) => s.tool);
  const aiOpen = useAgent((s) => s.open);
  const [missing, setMissing] = useState(false);

  // load
  useEffect(() => {
    let alive = true;
    loadDoc(fileId).then((d) => {
      if (!alive) return;
      if (!d) { setMissing(true); return; }
      S().loadDocument(fileId, d);
      void updateMeta(fileId, { lastOpenedAt: Date.now() });
      document.title = `${d.name} – My Flow`;
      requestAnimationFrame(() => zoomToFit());
      const pending = sessionStorage.getItem('myflow:place');
      if (pending) { sessionStorage.removeItem('myflow:place'); void placeImageAt(pending, 0, 0).then(() => requestAnimationFrame(() => zoomToFit())); }
      document.fonts?.ready.then(() => { if (S().fileId === fileId) relayoutText(); });
      document.fonts?.addEventListener?.('loadingdone', () => { if (S().fileId === fileId) relayoutText(); });
    });
    return () => { alive = false; };
  }, [fileId]);

  // autosave
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastVersion = Date.now();
    let lastSaved: DocumentData | null = null;
    const unsub = useEditor.subscribe((s, prev) => {
      if (!s.doc || s.doc === prev.doc || s.fileId !== fileId) return;
      if (!lastSaved) { lastSaved = prev.doc; }
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const d = S().doc;
        if (!d || S().fileId !== fileId) return;
        S().setState({ saveState: 'saving' });
        let thumb: string | undefined;
        try { thumb = await thumbnailFor(d); if (thumb && thumb.length > 400000) thumb = undefined; } catch { /* ignore */ }
        await saveDoc(d, thumb);
        document.title = `${d.name} – My Flow`;
        if (Date.now() - lastVersion > 5 * 60 * 1000) {
          lastVersion = Date.now();
          await addVersion(fileId, { id: uid('v'), name: 'Autosave', createdAt: Date.now(), auto: true, doc: d });
        }
        if (S().doc === d) S().setState({ saveState: 'saved' });
      }, 400);
    });
    const beforeUnload = (e: BeforeUnloadEvent) => { if (S().saveState !== 'saved') { e.preventDefault(); } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { unsub(); if (timer) clearTimeout(timer); window.removeEventListener('beforeunload', beforeUnload); };
  }, [fileId]);

  // file-level events
  useEffect(() => {
    const dup = async () => { const m = await duplicateFile(fileId); if (m) { S().toast('File duplicated'); window.location.hash = `#/file/${m.id}`; } };
    const ren = () => { const name = prompt('Rename file', currentDoc().name); if (name) renameFile(fileId, name); };
    const del = async () => { if (confirm('Move this file to trash?')) { await updateMeta(fileId, { trashed: true }); window.location.hash = '#/'; } };
    window.addEventListener('myflow:duplicate-file', dup);
    window.addEventListener('myflow:rename-file', ren);
    window.addEventListener('myflow:delete-file', del);
    return () => { window.removeEventListener('myflow:duplicate-file', dup); window.removeEventListener('myflow:rename-file', ren); window.removeEventListener('myflow:delete-file', del); };
  }, [fileId]);

  // keyboard
  useEffect(() => {
    let lastDigit: { d: string; t: number } | null = null;
    const onKey = (e: KeyboardEvent) => {
      const s = S();
      if (!s.doc) return;
      if (isTyping()) return;
      if (s.modal) return;
      const combo = eventKey(e);
      // escape
      if (e.key === 'Escape') {
        e.preventDefault();
        if (s.contextMenu) { s.setState({ contextMenu: null }); return; }
        if (penActive()) { finishPen(); return; }
        if (s.editingVectorId) { s.setState({ editingVectorId: null }); return; }
        if (s.draftComment || s.activeCommentId) { s.setState({ draftComment: null, activeCommentId: null }); return; }
        if (s.tool !== 'MOVE') { s.setTool('MOVE'); s.setState({ imageToPlace: [] }); return; }
        const sel = selectedNodes();
        if (sel.length) {
          const p = sel[0].parentId ? s.doc.nodes[sel[0].parentId] : null;
          if (p) s.select([p.id]); else s.select([]);
        }
        return;
      }
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (penActive()) { finishPen(); return; }
        if (s.editingVectorId) { s.setState({ editingVectorId: null }); return; }
        const sel = selectedNodes();
        if (e.shiftKey) {
          const parents = sel.map((n) => n.parentId).filter(Boolean) as string[];
          if (parents.length) s.select([...new Set(parents)]);
          return;
        }
        if (sel.length === 1 && sel[0].type === 'TEXT') { s.setState({ editingTextId: sel[0].id }); return; }
        if (sel.length === 1 && (sel[0].type === 'VECTOR' || sel[0].type === 'LINE')) { s.setState({ editingVectorId: sel[0].id }); return; }
        const kids = sel.flatMap((n) => n.children);
        if (kids.length) s.select(kids);
        return;
      }
      if (combo === '\\') { const sel = selectedNodes(); const parents = sel.map((n) => n.parentId).filter(Boolean) as string[]; if (parents.length) s.select([...new Set(parents)]); e.preventDefault(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        const sel = selectedNodes();
        if (!sel.length) return;
        const n = sel[0];
        const list = n.parentId ? s.doc.nodes[n.parentId].children : s.doc.pages.find((p) => p.id === s.pageId)!.children;
        const i = list.indexOf(n.id);
        const next = list[(i + (e.shiftKey ? 1 : -1) + list.length) % list.length];
        s.select([next]);
        return;
      }
      if (e.key.startsWith('Arrow') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!s.selection.length || s.mode === 'dev') return;
        e.preventDefault();
        const step = e.shiftKey ? s.prefs.nudgeBig : s.prefs.nudgeSmall;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        nudge(dx, dy);
        return;
      }
      if (/^[0-9]$/.test(combo) && s.selection.length && s.prefs.numberKeysOpacity && s.mode === 'design') {
        e.preventDefault();
        const now = Date.now();
        let v: number;
        if (lastDigit && now - lastDigit.t < 600 && lastDigit.d !== '0') v = parseInt(lastDigit.d + combo, 10) / 100;
        else v = combo === '0' ? 1 : parseInt(combo, 10) / 10;
        lastDigit = { d: combo, t: now };
        setOpacityKey(v);
        return;
      }
      if ((combo === 'backspace' || combo === 'delete') && s.editingVectorId) {
        e.preventDefault();
        return;
      }
      // clipboard handled by native events where possible
      if (combo === 'mod+c' || combo === 'mod+x') { if (s.selection.length) copySelection(combo === 'mod+x'); return; }
      if (combo === 'mod+v') {
        pasteState.handled = false;
        setTimeout(() => { if (!pasteState.handled) pasteClipboard(); }, 120);
        return;
      }
      if (s.mode === 'dev' && !['view.', 'help.', 'tool.move', 'tool.hand', 'tool.comment', 'edit.copy', 'edit.selectAll', 'file.'].some((p) => (commandForKey(combo)?.id ?? '').startsWith(p))) {
        const c = commandForKey(combo);
        if (c && (c.category === 'Tools' || c.category === 'Object' || c.category === 'Text' || c.category === 'Arrange' || c.id.startsWith('edit.'))) { if (c.id !== 'edit.copy') { e.preventDefault(); return; } }
      }
      const cmd = commandForKey(combo);
      if (cmd) {
        e.preventDefault();
        if (penActive() && cmd.category === 'Tools') finishPen();
        runCommand(cmd.id);
      }
    };
    const onPaste = async (e: ClipboardEvent) => {
      if (isTyping() || S().modal) return;
      pasteState.handled = true;
      const cd = e.clipboardData;
      if (!cd) { pasteClipboard(); return; }
      e.preventDefault();
      const files = [...cd.files].filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        const s = S();
        const c = screenToWorld(s.viewport.width / 2, s.viewport.height / 2);
        for (const f of files) await placeImageAt(await readAsDataUrl(f), c.x, c.y);
        return;
      }
      const text = cd.getData('text/plain');
      if (text) {
        try {
          const data = JSON.parse(text) as ClipboardData;
          if (data?.marker === 'myflow/nodes') { pasteClipboard(data); return; }
        } catch { /* not json */ }
        if (text.trim().startsWith('<svg')) {
          const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text.trim());
          const s = S();
          const c = screenToWorld(s.viewport.width / 2, s.viewport.height / 2);
          await placeImageAt(url, c.x, c.y);
          return;
        }
        if (S().clipboard && JSON.stringify(S().clipboard) === text) { pasteClipboard(); return; }
        // plain text → text layer
        const s = S();
        const c = screenToWorld(s.viewport.width / 2, s.viewport.height / 2);
        const n = createNode('TEXT', { x: Math.round(c.x), y: Math.round(c.y), name: text.slice(0, 40) });
        n.text!.characters = text;
        if (text.length > 60) { n.text!.autoResize = 'HEIGHT'; n.width = 320; }
        addNode(n, null);
        s.select([n.id]);
        return;
      }
      pasteClipboard();
    };
    const onCopy = (e: ClipboardEvent) => {
      if (isTyping() || S().modal || !S().selection.length) return;
      copySelection(false);
      const data = S().clipboard;
      if (data && e.clipboardData) { e.clipboardData.setData('text/plain', JSON.stringify(data)); e.preventDefault(); }
    };
    const onCut = (e: ClipboardEvent) => {
      if (isTyping() || S().modal || !S().selection.length) return;
      copySelection(false);
      const data = S().clipboard;
      if (data && e.clipboardData) { e.clipboardData.setData('text/plain', JSON.stringify(data)); e.preventDefault(); }
      deleteSelection();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('paste', onPaste);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
    };
  }, []);

  // drag & drop
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const s = S();
    if (!s.doc) return;
    const w = screenToWorld(e.clientX, e.clientY);
    const comp = e.dataTransfer.getData('application/x-myflow-component');
    if (comp && s.doc.nodes[comp]) {
      const main = s.doc.nodes[comp];
      const parent = containerAt(w.x, w.y);
      createInstance(comp, Math.round(w.x - main.width / 2), Math.round(w.y - main.height / 2), parent);
      return;
    }
    const files = [...e.dataTransfer.files];
    let i = 0;
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        const parent = containerAt(w.x, w.y);
        await placeImageAt(await readAsDataUrl(f), w.x + i * 20, w.y + i * 20, parent);
        i++;
      }
    }
  };

  if (missing) {
    return (
      <div className="empty" style={{ paddingTop: 120 }}>
        <h2>File not found</h2>
        <p>This file doesn't exist in this browser. <a href="#/">Back to files</a></p>
      </div>
    );
  }
  if (!doc || loadedId !== fileId) return <div className="empty" style={{ paddingTop: 120 }} data-testid="loading">Loading…</div>;

  return (
    <div className="editor" onDragOver={onDragOver} onDrop={onDrop} data-testid="editor">
      <Canvas />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 24 }} className="comment-layer">
        <CommentLayer />
      </div>
      {showUI ? (
        <>
          <LeftPanel fileName={doc.name} onRenameFile={(n) => renameFile(fileId, n)} />
          {commentsPanel || tool === 'COMMENT' ? <CommentsPanel /> : aiOpen ? <AIPanel /> : <RightPanel />}
          <Toolbar />
        </>
      ) : null}
      <Modals />
      <AIModals />
      {ctxMenu ? (
        <Menu x={ctxMenu.x} y={ctxMenu.y} onClose={() => S().setState({ contextMenu: null })} testId="context-menu"
          items={ctxMenu.kind === 'selection' && S().selection.length ? selectionContextItems() : canvasContextItems()} />
      ) : null}
      {toast ? <div className="toast" data-testid="toast">{toast.text}</div> : null}
      <TooltipLayer />
      <span style={{ display: 'none' }}>{String(!!ancestors && !!topLevelSelection)}</span>
    </div>
  );
}

const pasteState = { handled: false };

export function renameFile(fileId: string, name: string) {
  S().update((d) => { d.name = name; });
  void updateMeta(fileId, { name });
  document.title = `${name} – My Flow`;
}
