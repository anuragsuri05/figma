import React, { useEffect, useState } from 'react';
import type { FileMeta, DocumentData } from '../model/types';
import { listFiles, createFile, updateMeta, duplicateFile, deleteFileForever } from '../store/persist';
import { I } from '../editor/icons';
import { Menu, type MenuItem, TooltipLayer, IconButton } from '../editor/ui';
import { TEMPLATES } from './templates';
import { useEditor, S } from '../store/editor';
import { ThemeToggle } from '../editor/ThemeToggle';

type View = 'recents' | 'drafts' | 'starred' | 'trash' | 'community';

function ago(t: number) {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'Edited just now';
  if (s < 3600) return `Edited ${Math.floor(s / 60)} minutes ago`;
  if (s < 86400) return `Edited ${Math.floor(s / 3600)} hours ago`;
  return `Edited ${Math.floor(s / 86400)} days ago`;
}

export async function newFile(name = 'Untitled', doc?: DocumentData) {
  const meta = await createFile(name, 'Drafts', doc);
  window.location.hash = `#/file/${meta.id}`;
  return meta;
}

export function Home() {
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [view, setView] = useState<View>('recents');
  const [q, setQ] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState<'opened' | 'modified' | 'name'>('opened');
  const [menu, setMenu] = useState<{ x: number; y: number; file?: FileMeta; kind: 'file' | 'create' | 'sort' } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const theme = useEditor((s) => s.prefs.theme);
  const refresh = () => listFiles().then(setFiles);
  useEffect(() => { refresh(); document.title = 'My Flow'; }, []);

  const visible = files
    .filter((f) => (view === 'trash' ? f.trashed : !f.trashed))
    .filter((f) => (view === 'starred' ? f.starred : true))
    .filter((f) => f.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'modified' ? b.updatedAt - a.updatedAt : b.lastOpenedAt - a.lastOpenedAt));

  const importFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.myflow,.json,image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      if (f.type.startsWith('image/')) {
        const url = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(f); });
        const meta = await createFile(f.name.replace(/\.[^.]+$/, ''));
        window.location.hash = `#/file/${meta.id}?place=${encodeURIComponent('1')}`;
        sessionStorage.setItem('myflow:place', url);
        return;
      }
      try {
        const json = JSON.parse(await f.text());
        const doc: DocumentData = json.doc ?? json;
        if (!doc.pages || !doc.nodes) throw new Error('bad');
        await newFile(doc.name || f.name.replace(/\.[^.]+$/, ''), doc);
      } catch { alert('This file could not be imported.'); }
    };
    input.click();
  };

  const fileMenu = (f: FileMeta): MenuItem[] => f.trashed ? [
    { label: 'Restore', onClick: async () => { await updateMeta(f.id, { trashed: false }); refresh(); }, testId: 'file-restore' },
    { label: 'Delete forever', onClick: async () => { await deleteFileForever(f.id); refresh(); }, testId: 'file-delete-forever' },
  ] : [
    { label: 'Open', onClick: () => { window.location.hash = `#/file/${f.id}`; } },
    { label: 'Open in new tab', onClick: () => window.open(`${location.pathname}#/file/${f.id}`, '_blank') },
    { separator: true },
    { label: 'Copy link', onClick: () => { navigator.clipboard?.writeText(`${location.origin}${location.pathname}#/file/${f.id}`).catch(() => {}); } },
    { label: f.starred ? 'Remove from starred' : 'Add to starred', onClick: async () => { await updateMeta(f.id, { starred: !f.starred }); refresh(); }, testId: 'file-star' },
    { separator: true },
    { label: 'Rename', onClick: () => setRenaming(f.id), testId: 'file-rename' },
    { label: 'Duplicate', onClick: async () => { await duplicateFile(f.id); refresh(); }, testId: 'file-duplicate' },
    { label: 'Move to trash', onClick: async () => { await updateMeta(f.id, { trashed: true }); refresh(); }, testId: 'file-trash' },
  ];

  const nav = (id: View, label: string, icon: Parameters<typeof I>[0]['name']) => (
    <button className={'home-nav' + (view === id ? ' on' : '')} onClick={() => setView(id)} data-testid={`nav-${id}`}><I name={icon} size={18} />{label}</button>
  );

  return (
    <div className="home" data-testid="home">
      <div className="home-side">
        <div className="row" style={{ padding: '4px 10px 12px', gap: 10 }}>
          <I name="logo" size={22} />
          <b style={{ fontSize: 14 }}>My Flow</b>
          <span className="spacer" />
          <ThemeToggle testId="home-theme" />
        </div>
        <input className="input" placeholder="Search files" value={q} onChange={(e) => setQ(e.target.value)} style={{ height: 32, marginBottom: 8 }} data-testid="home-search" />
        {nav('recents', 'Recents', 'clock')}
        {nav('drafts', 'Drafts', 'file')}
        {nav('starred', 'Starred', 'starIcon')}
        {nav('community', 'Templates', 'assets')}
        {nav('trash', 'Trash', 'trash')}
        <span className="spacer" />
        <div className="faint" style={{ padding: 10, lineHeight: 1.5 }}>No account needed. Files are saved in this browser.</div>
      </div>
      <div className="home-main">
        <div className="home-top">
          <b style={{ fontSize: 16 }} data-testid="home-title">{view === 'recents' ? 'Recents' : view === 'drafts' ? 'Drafts' : view === 'starred' ? 'Starred' : view === 'trash' ? 'Trash' : 'Templates'}</b>
          <span className="spacer" />
          <button className="btn" onClick={importFile} data-testid="import-file"><I name="export" size={16} style={{ transform: 'rotate(180deg)' }} /> Import</button>
          <button className="btn primary" data-menu-anchor onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenu({ x: r.right - 220, y: r.bottom + 4, kind: 'create' }); }} data-testid="create-btn"><I name="plus" size={16} /> Create</button>
        </div>
        <div className="home-content">
          {view !== 'trash' ? (
            <div className="create-tiles">
              <button className="create-tile" onClick={() => newFile()} data-testid="new-design-file">
                <span className="ic" style={{ background: '#0D99FF' }}><I name="frame" size={20} /></span>
                <span><b>New design file</b><span>Design and prototype</span></span>
              </button>
              {TEMPLATES.map((t) => (
                <button key={t.id} className="create-tile" onClick={() => newFile(t.name, t.make())} data-testid={`template-${t.id}`}>
                  <span className="ic" style={{ background: t.color }}><I name="assets" size={20} /></span>
                  <span><b>{t.name}</b><span>{t.description}</span></span>
                </button>
              ))}
            </div>
          ) : null}
          {view === 'community' ? <div className="muted">Templates above create a fully editable copy in your drafts.</div> : (
            <>
              <div className="row" style={{ marginBottom: 12 }}>
                <span className="muted grow">{visible.length} file{visible.length === 1 ? '' : 's'}</span>
                <button className="btn small" data-menu-anchor onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenu({ x: r.left, y: r.bottom + 4, kind: 'sort' }); }}>Sort: {sort === 'opened' ? 'Last viewed' : sort === 'modified' ? 'Last modified' : 'Alphabetical'}</button>
                <IconButton icon="tidy" tip="Grid view" active={layout === 'grid'} onClick={() => setLayout('grid')} />
                <IconButton icon="menu" tip="List view" active={layout === 'list'} onClick={() => setLayout('list')} testId="list-view" />
                {view === 'trash' && visible.length ? <button className="btn small danger" onClick={async () => { for (const f of visible) await deleteFileForever(f.id); refresh(); }}>Empty trash</button> : null}
              </div>
              {visible.length === 0 ? <div className="empty" data-testid="empty-files">{view === 'trash' ? 'Trash is empty' : 'No files yet — create one above.'}</div> : null}
              {layout === 'grid' ? (
                <div className="file-grid">
                  {visible.map((f) => (
                    <div key={f.id} className="file-card" data-testid={`file-${f.name}`}
                      onDoubleClick={() => !f.trashed && (window.location.hash = `#/file/${f.id}`)}
                      onClick={(e) => { if (!f.trashed && !(e.target as HTMLElement).closest('button, input')) window.location.hash = `#/file/${f.id}`; }}
                      onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, file: f, kind: 'file' }); }}>
                      <div className="thumb">{f.thumbnail ? <img src={f.thumbnail} alt="" /> : <I name="frame" size={40} style={{ color: 'var(--text-3)' }} />}</div>
                      <div className="meta">
                        <span className="ft"><I name="frame" size={14} style={{ color: '#fff' }} /></span>
                        <div className="grow" style={{ minWidth: 0 }}>
                          {renaming === f.id ? (
                            <input className="input" autoFocus defaultValue={f.name} data-testid="file-rename-input"
                              onBlur={async (e) => { await updateMeta(f.id, { name: e.target.value || f.name }); setRenaming(null); refresh(); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(null); }} />
                          ) : <div className="n">{f.name}</div>}
                          <div className="d">{ago(f.updatedAt)}</div>
                        </div>
                        <IconButton icon="more" tip="More" testId={`file-more-${f.name}`} onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenu({ x: r.left, y: r.bottom, file: f, kind: 'file' }); }} />
                      </div>
                      {f.starred ? <span className="star" style={{ color: '#FFCD29' }}><I name="starFill" size={18} /></span> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <div className="list-row faint" style={{ height: 32 }}><span>Name</span><span>Last modified</span><span>Created</span><span /></div>
                  {visible.map((f) => (
                    <div key={f.id} className="list-row" data-testid={`file-row-${f.name}`} onClick={() => !f.trashed && (window.location.hash = `#/file/${f.id}`)} onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, file: f, kind: 'file' }); }}>
                      <span className="row"><I name="frame" size={16} /> {f.name}</span>
                      <span className="muted">{new Date(f.updatedAt).toLocaleString()}</span>
                      <span className="muted">{new Date(f.createdAt).toLocaleDateString()}</span>
                      <IconButton icon="more" tip="More" onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenu({ x: r.left, y: r.bottom, file: f, kind: 'file' }); }} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {menu?.kind === 'file' && menu.file ? <Menu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={fileMenu(menu.file)} testId="file-menu" /> : null}
      {menu?.kind === 'create' ? <Menu x={menu.x} y={menu.y} onClose={() => setMenu(null)} testId="create-menu" items={[
        { label: 'Design file', onClick: () => newFile(), testId: 'create-design' },
        ...TEMPLATES.map((t) => ({ label: `${t.name} (template)`, onClick: () => { void newFile(t.name, t.make()); } })),
        { separator: true },
        { label: 'Import file…', onClick: importFile },
      ]} /> : null}
      {menu?.kind === 'sort' ? <Menu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={[
        { label: 'Last viewed', checked: sort === 'opened', onClick: () => setSort('opened') },
        { label: 'Last modified', checked: sort === 'modified', onClick: () => setSort('modified') },
        { label: 'Alphabetical', checked: sort === 'name', onClick: () => setSort('name') },
      ]} /> : null}
      <TooltipLayer />
    </div>
  );
}
