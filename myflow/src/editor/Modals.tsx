import React, { useEffect, useMemo, useState } from 'react';
import {
  useEditor, S, batchRename, addCollection, addVariable, updateVariable, setVariableValue, deleteVariable, addMode, renameMode, deleteMode,
  deleteCollection, updateStyle, deleteStyle, setProps, currentDoc, goToPage, zoomToSelection, createInstance,
} from '../store/editor';
import { commands, displayKeys, runCommand } from '../commands';
import { Modal, IconButton, NumField, Select, Swatch, Menu, type MenuItem } from './ui';
import { I } from './icons';
import { SolidEditor } from './ColorPicker';
import { addVersion, listVersions, saveVersions } from '../store/persist';
import type { VariableType, VersionEntry } from '../model/types';
import { uid, solid, FONT_FAMILIES } from '../model/defaults';
import { getPageOf } from '../model/tree';
import { PLUGINS, runPlugin } from '../plugins';
import { normalizeHex } from '../model/color';

export function Modals() {
  const modal = useEditor((s) => s.modal);
  const close = () => S().setState({ modal: null });
  switch (modal) {
    case 'quickActions': return <QuickActions onClose={close} />;
    case 'shortcuts': return <Shortcuts onClose={close} />;
    case 'variables': return <Variables onClose={close} />;
    case 'versions': return <Versions onClose={close} />;
    case 'share': return <Share onClose={close} />;
    case 'find': return <FindReplace onClose={close} />;
    case 'preferences': return <Preferences onClose={close} />;
    case 'rename': return <BatchRename onClose={close} />;
    case 'styles': return <Styles onClose={close} />;
    case 'libraries': return <Libraries onClose={close} />;
    case 'plugins': return <Plugins onClose={close} />;
    case 'about': return <About onClose={close} />;
    default: return null;
  }
}

/* ---------------------------------------------------------------- quick actions */

function QuickActions({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const doc = useEditor((s) => s.doc!);
  const items = useMemo(() => {
    const ql = q.toLowerCase().trim();
    const cmds = commands.filter((c) => !c.hidden).map((c) => ({ kind: 'cmd' as const, id: c.id, label: c.label, sub: c.category, keys: c.keys?.[0], enabled: c.enabled ? c.enabled() : true }));
    const layers = ql ? Object.values(doc.nodes).filter((n) => n.name.toLowerCase().includes(ql)).slice(0, 8).map((n) => ({ kind: 'layer' as const, id: n.id, label: n.name, sub: 'Layer', keys: undefined, enabled: true })) : [];
    const comps = ql ? Object.values(doc.nodes).filter((n) => n.type === 'COMPONENT' && n.name.toLowerCase().includes(ql)).slice(0, 5).map((n) => ({ kind: 'comp' as const, id: n.id, label: n.name, sub: 'Component', keys: undefined, enabled: true })) : [];
    const plugins = PLUGINS.filter((p) => !ql || p.name.toLowerCase().includes(ql)).map((p) => ({ kind: 'plugin' as const, id: p.id, label: p.name, sub: 'Plugin', keys: undefined, enabled: true }));
    const filtered = cmds.filter((c) => !ql || c.label.toLowerCase().includes(ql) || c.sub.toLowerCase().includes(ql));
    filtered.sort((a, b) => (a.label.toLowerCase().startsWith(ql) ? -1 : 0) - (b.label.toLowerCase().startsWith(ql) ? -1 : 0));
    return [...filtered.slice(0, 40), ...layers, ...comps, ...(ql ? plugins : [])];
  }, [q, doc]);
  useEffect(() => setIdx(0), [q]);
  const run = (i: number) => {
    const it = items[i];
    if (!it) return;
    onClose();
    if (it.kind === 'cmd') setTimeout(() => runCommand(it.id), 0);
    else if (it.kind === 'layer') { const pg = getPageOf(doc, it.id); if (pg) S().setState({ pageId: pg.id }); S().select([it.id]); setTimeout(zoomToSelection, 0); }
    else if (it.kind === 'comp') { const s = S(); const main = doc.nodes[it.id]; const c = { x: (s.viewport.width / 2 - s.panX) / s.zoom, y: (s.viewport.height / 2 - s.panY) / s.zoom }; createInstance(it.id, c.x - main.width / 2, c.y - main.height / 2); }
    else void runPlugin(it.id);
  };
  return (
    <Modal title={<span className="row"><I name="actions" size={16} /> Actions</span>} onClose={onClose} testId="quick-actions">
      <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
        <input className="input" autoFocus placeholder="Search for actions, layers, components, plugins…" value={q} style={{ height: 32, fontSize: 13 }}
          onChange={(e) => setQ(e.target.value)} data-testid="quick-actions-input"
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
            if (e.key === 'Enter') run(idx);
            if (e.key === 'Escape') onClose();
          }} />
      </div>
      <div className="qa-list">
        {items.map((it, i) => (
          <div key={it.kind + it.id} className={'qa-item' + (i === idx ? ' on' : '')} onMouseEnter={() => setIdx(i)} onClick={() => run(i)} style={{ opacity: it.enabled ? 1 : 0.45 }} data-testid={`qa-${it.label}`}>
            <span className="grow">{it.label}</span>
            <span className="faint">{it.sub}</span>
            {it.keys ? <span className="kbd">{displayKeys(it.keys)}</span> : null}
          </div>
        ))}
        {items.length === 0 ? <div className="empty">No results</div> : null}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- shortcuts */

function Shortcuts({ onClose }: { onClose: () => void }) {
  const [cat, setCat] = useState('All');
  const cats = ['All', ...new Set(commands.filter((c) => c.keys?.length).map((c) => c.category))];
  const list = commands.filter((c) => c.keys?.length && (cat === 'All' || c.category === cat));
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} wide testId="shortcuts-modal">
      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {cats.map((c) => <button key={c} className={'tab' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="modal-body">
        <div className="shortcut-grid">
          {list.map((c) => (
            <div key={c.id} className="shortcut-row">
              <span>{c.label}</span>
              <span className="kbd">{c.keys!.map(displayKeys).join('  ')}</span>
            </div>
          ))}
          <div className="shortcut-row"><span>Nudge</span><span className="kbd">←↑→↓ / ⇧ for 10px</span></div>
          <div className="shortcut-row"><span>Opacity 10%–100%</span><span className="kbd">1 … 0</span></div>
          <div className="shortcut-row"><span>Select children / parent</span><span className="kbd">↩ / ⇧↩</span></div>
          <div className="shortcut-row"><span>Next / previous sibling</span><span className="kbd">⇥ / ⇧⇥</span></div>
          <div className="shortcut-row"><span>Pan</span><span className="kbd">Space + drag</span></div>
          <div className="shortcut-row"><span>Measure distance</span><span className="kbd">⌥ + hover</span></div>
          <div className="shortcut-row"><span>Duplicate while dragging</span><span className="kbd">⌥ + drag</span></div>
          <div className="shortcut-row"><span>Deep select</span><span className="kbd">⌘ + click</span></div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- variables */

function Variables({ onClose }: { onClose: () => void }) {
  const doc = useEditor((s) => s.doc!);
  const [colId, setColId] = useState<string | null>(doc.collections[0]?.id ?? null);
  const [addMenu, setAddMenu] = useState<{ x: number; y: number } | null>(null);
  const [editColor, setEditColor] = useState<{ varId: string; modeId: string } | null>(null);
  const col = doc.collections.find((c) => c.id === colId) ?? doc.collections[0];
  const vars = col ? doc.variables.filter((v) => v.collectionId === col.id) : [];
  const ensureCol = () => col?.id ?? (() => { const id = addCollection('Collection'); setColId(id); return id; })();
  const typeIcon = (t: VariableType) => (t === 'COLOR' ? '◐' : t === 'NUMBER' ? '#' : t === 'STRING' ? 'T' : '⊘');
  return (
    <Modal title="Local variables" onClose={onClose} wide testId="variables-modal">
      <div style={{ display: 'flex', minHeight: 360, maxHeight: '64vh' }}>
        <div className="var-side">
          <div className="row" style={{ marginBottom: 6 }}><span className="muted grow">Collections</span><IconButton icon="plus" tip="Create collection" onClick={() => { const id = addCollection(`Collection ${doc.collections.length + 1}`); setColId(id); }} testId="add-collection" /></div>
          {doc.collections.map((c) => (
            <div key={c.id} className={'item' + (c.id === col?.id ? ' on' : '')} onClick={() => setColId(c.id)} data-testid={`collection-${c.name}`}>
              <span className="grow">{c.name}</span>
              <span className="faint">{doc.variables.filter((v) => v.collectionId === c.id).length}</span>
            </div>
          ))}
          {doc.collections.length === 0 ? <div className="faint">No collections</div> : null}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          {col ? (
            <>
              <div className="row" style={{ marginBottom: 8 }}>
                <input className="input" style={{ width: 200, fontWeight: 600 }} defaultValue={col.name} key={col.id} onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => S().update((d) => { const c = d.collections.find((x) => x.id === col.id); if (c) c.name = e.target.value || c.name; })} data-testid="collection-name" />
                <span className="spacer" />
                <button className="btn small" onClick={() => addMode(col.id)} data-testid="add-mode">+ Mode</button>
                <button className="btn small danger" onClick={() => { deleteCollection(col.id); setColId(null); }}>Delete collection</button>
              </div>
              <table className="var-table">
                <thead>
                  <tr>
                    <th style={{ width: 200 }}>Name</th>
                    {col.modes.map((m) => (
                      <th key={m.id}>
                        <div className="row">
                          <input className="input" defaultValue={m.name} key={m.id + m.name} onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => renameMode(col.id, m.id, e.target.value || m.name)} data-testid={`mode-name-${m.name}`} />
                          {col.modes.length > 1 ? <IconButton icon="close" tip="Delete mode" onClick={() => deleteMode(col.id, m.id)} size={12} /> : null}
                        </div>
                      </th>
                    ))}
                    <th style={{ width: 32 }} />
                  </tr>
                </thead>
                <tbody>
                  {vars.map((v) => (
                    <tr key={v.id} data-testid={`var-row-${v.name}`}>
                      <td>
                        <div className="row"><span className="faint" style={{ width: 12 }}>{typeIcon(v.type)}</span>
                          <input className="input" defaultValue={v.name} key={v.id + v.name} onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => updateVariable(v.id, { name: e.target.value || v.name })} data-testid={`var-name-${v.name}`} />
                        </div>
                      </td>
                      {col.modes.map((m) => {
                        const val = v.values[m.id];
                        const isAlias = val && typeof val === 'object';
                        return (
                          <td key={m.id}>
                            {isAlias ? (
                              <div className="row"><span className="var-chip">{doc.variables.find((x) => x.id === (val as { alias: string }).alias)?.name ?? 'Missing'}</span><IconButton icon="unlink" tip="Detach alias" onClick={() => setVariableValue(v.id, m.id, v.type === 'COLOR' ? '#000000' : v.type === 'NUMBER' ? 0 : v.type === 'BOOLEAN' ? false : '')} size={12} /></div>
                            ) : v.type === 'COLOR' ? (
                              <div className="paint-chip">
                                <button onClick={() => setEditColor({ varId: v.id, modeId: m.id })} data-testid={`var-swatch-${v.name}-${m.name}`}><Swatch paint={solid(String(val))} /></button>
                                <input defaultValue={String(val).replace('#', '')} key={String(val)} data-testid={`var-value-${v.name}-${m.name}`} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} onBlur={(e) => { const h = normalizeHex(e.target.value); if (h) setVariableValue(v.id, m.id, h); }} />
                              </div>
                            ) : v.type === 'NUMBER' ? (
                              <NumField value={Number(val) || 0} onChange={(nv) => setVariableValue(v.id, m.id, nv)} testId={`var-value-${v.name}-${m.name}`} />
                            ) : v.type === 'BOOLEAN' ? (
                              <label className="checkbox"><input type="checkbox" checked={!!val} onChange={(e) => setVariableValue(v.id, m.id, e.target.checked)} /> {String(!!val)}</label>
                            ) : (
                              <input className="input" defaultValue={String(val ?? '')} key={String(val)} onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => setVariableValue(v.id, m.id, e.target.value)} data-testid={`var-value-${v.name}-${m.name}`} />
                            )}
                            {!isAlias ? (
                              <select className="select" style={{ marginTop: 4, height: 20, fontSize: 10 }} value="" onChange={(e) => { if (e.target.value) setVariableValue(v.id, m.id, { alias: e.target.value }); }} onKeyDown={(e) => e.stopPropagation()}>
                                <option value="">Alias…</option>
                                {doc.variables.filter((x) => x.type === v.type && x.id !== v.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                              </select>
                            ) : null}
                          </td>
                        );
                      })}
                      <td><IconButton icon="minus" tip="Delete variable" onClick={() => deleteVariable(v.id)} testId={`delete-var-${v.name}`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : <div className="empty">Variables store reusable values like colors, numbers, text and booleans.<br />Create a variable to get started.</div>}
          <button className="btn" style={{ marginTop: 10 }} data-testid="create-variable" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setAddMenu({ x: r.left, y: r.bottom + 4 }); }}>+ Create variable</button>
        </div>
      </div>
      {addMenu ? <Menu x={addMenu.x} y={addMenu.y} onClose={() => setAddMenu(null)} items={(['COLOR', 'NUMBER', 'STRING', 'BOOLEAN'] as VariableType[]).map((t): MenuItem => ({
        label: t.charAt(0) + t.slice(1).toLowerCase(), testId: `create-var-${t.toLowerCase()}`, onClick: () => { const cid = ensureCol(); addVariable(cid, t); },
      }))} /> : null}
      {editColor ? (() => {
        const v = doc.variables.find((x) => x.id === editColor.varId);
        if (!v) return null;
        const val = String(v.values[editColor.modeId]);
        return (
          <Modal title={`Edit ${v.name}`} onClose={() => setEditColor(null)}>
            <SolidEditor color={val.startsWith('#') ? val : '#000000'} opacity={1} onChange={(c) => setVariableValue(v.id, editColor.modeId, c)} />
          </Modal>
        );
      })() : null}
    </Modal>
  );
}

/* ---------------------------------------------------------------- version history */

function Versions({ onClose }: { onClose: () => void }) {
  const fileId = useEditor((s) => s.fileId!);
  const [list, setList] = useState<VersionEntry[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const refresh = () => listVersions(fileId).then(setList);
  useEffect(() => { refresh(); }, [fileId]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    const doc = currentDoc();
    await addVersion(fileId, { id: uid('v'), name: name.trim() || 'Untitled version', description: desc, createdAt: Date.now(), auto: false, doc });
    setName(''); setDesc('');
    S().toast('Version saved');
    refresh();
  };
  const restore = (v: VersionEntry) => {
    const s = S();
    s.update((d) => {
      d.pages = JSON.parse(JSON.stringify(v.doc.pages));
      d.nodes = JSON.parse(JSON.stringify(v.doc.nodes));
      d.styles = JSON.parse(JSON.stringify(v.doc.styles));
      d.collections = JSON.parse(JSON.stringify(v.doc.collections));
      d.variables = JSON.parse(JSON.stringify(v.doc.variables));
      d.comments = JSON.parse(JSON.stringify(v.doc.comments));
    });
    s.setState({ pageId: v.doc.pages[0].id, selection: [] });
    s.toast(`Restored “${v.name}”`);
    onClose();
  };
  return (
    <Modal title="Version history" onClose={onClose} testId="versions-modal">
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="muted">Save a named version of this file</div>
        <input className="input" placeholder="Title" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} data-testid="version-name" />
        <textarea className="input" placeholder="Describe what changed" value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.stopPropagation()} rows={2} />
        <button className="btn primary" onClick={save} data-testid="save-version">Save</button>
        <div className="divider" />
        <div className="row"><b>Current version</b><span className="faint">Now</span></div>
        {list.map((v) => (
          <div key={v.id} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }} data-testid={`version-${v.name}`}>
            <div className="grow">
              <div style={{ fontWeight: v.auto ? 400 : 600 }}>{v.name}</div>
              <div className="faint">{new Date(v.createdAt).toLocaleString()}{v.description ? ` — ${v.description}` : ''}</div>
            </div>
            <button className="btn small" onClick={() => restore(v)} data-testid={`restore-${v.name}`}>Restore</button>
            <IconButton icon="trash" tip="Delete" onClick={async () => { await saveVersions(fileId, list.filter((x) => x.id !== v.id)); refresh(); }} />
          </div>
        ))}
        {list.length === 0 ? <div className="faint">No saved versions yet. Autosaved checkpoints appear here every few minutes of editing.</div> : null}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- share */

function Share({ onClose }: { onClose: () => void }) {
  const fileId = useEditor((s) => s.fileId);
  const [access, setAccess] = useState<'view' | 'edit'>('edit');
  const [email, setEmail] = useState('');
  const [invited, setInvited] = useState<{ email: string; role: string }[]>([]);
  const link = `${location.origin}${location.pathname}#/file/${fileId}`;
  return (
    <Modal title="Share this file" onClose={onClose} testId="share-modal" footer={
      <>
        <button className="btn" onClick={() => { navigator.clipboard?.writeText(link + '/present').catch(() => {}); S().toast('Prototype link copied'); }}>Copy prototype link</button>
        <button className="btn primary" onClick={() => { navigator.clipboard?.writeText(link).catch(() => {}); S().toast('Link copied'); }} data-testid="copy-share-link">Copy link</button>
      </>
    }>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row">
          <input className="input grow" placeholder="Add emails" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.stopPropagation()} data-testid="share-email" />
          <div style={{ width: 100 }}><Select value={access} options={[{ value: 'edit', label: 'can edit' }, { value: 'view', label: 'can view' }]} onChange={setAccess} /></div>
          <button className="btn primary" disabled={!email.includes('@')} onClick={() => { setInvited([...invited, { email, role: access }]); setEmail(''); S().toast('Invite recorded (no-auth local mode)'); }} data-testid="share-invite">Invite</button>
        </div>
        <div className="row"><div className="avatar">{S().prefs.userName[0]}</div><span className="grow">{S().prefs.userName} (you)</span><span className="faint">owner</span></div>
        {invited.map((i) => <div key={i.email} className="row"><div className="avatar" style={{ background: '#14AE5C' }}>{i.email[0].toUpperCase()}</div><span className="grow">{i.email}</span><span className="faint">{i.role === 'edit' ? 'can edit' : 'can view'}</span></div>)}
        <div className="divider" />
        <div className="muted">My Flow runs without accounts. Anyone opening this link on this browser profile sees the same local file.</div>
        <input className="input" readOnly value={link} data-testid="share-link" onFocus={(e) => e.currentTarget.select()} />
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- find & replace */

function FindReplace({ onClose }: { onClose: () => void }) {
  const doc = useEditor((s) => s.doc!);
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [scope, setScope] = useState<'text' | 'layers'>('text');
  const matches = find ? Object.values(doc.nodes).filter((n) => (scope === 'text' ? n.text?.characters.toLowerCase().includes(find.toLowerCase()) : n.name.toLowerCase().includes(find.toLowerCase()))) : [];
  const replaceAll = () => {
    const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    setProps(matches.map((m) => m.id), (n) => { if (scope === 'text' && n.text) n.text.characters = n.text.characters.replace(re, replace); else n.name = n.name.replace(re, replace); });
    S().toast(`Replaced in ${matches.length} layer${matches.length === 1 ? '' : 's'}`);
  };
  return (
    <Modal title="Find and replace" onClose={onClose} testId="find-modal">
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="seg"><button className={scope === 'text' ? 'on' : ''} onClick={() => setScope('text')}>Text</button><button className={scope === 'layers' ? 'on' : ''} onClick={() => setScope('layers')}>Layer names</button></div>
        <input className="input" autoFocus placeholder="Find" value={find} onChange={(e) => setFind(e.target.value)} onKeyDown={(e) => e.stopPropagation()} data-testid="find-input" />
        <input className="input" placeholder="Replace with" value={replace} onChange={(e) => setReplace(e.target.value)} onKeyDown={(e) => e.stopPropagation()} data-testid="replace-input" />
        <div className="row"><span className="muted grow" data-testid="find-count">{matches.length} result{matches.length === 1 ? '' : 's'}</span><button className="btn" disabled={!matches.length} onClick={() => { const pg = getPageOf(doc, matches[0].id); if (pg) goToPage(pg.id); S().select(matches.filter((m) => getPageOf(doc, m.id)?.id === (pg?.id)).map((m) => m.id)); }}>Select all</button><button className="btn primary" disabled={!matches.length} onClick={replaceAll} data-testid="replace-all">Replace all</button></div>
        <div style={{ maxHeight: 220, overflow: 'auto' }}>
          {matches.slice(0, 50).map((m) => (
            <div key={m.id} className="qa-item" onClick={() => { const pg = getPageOf(doc, m.id); if (pg) S().setState({ pageId: pg.id }); S().select([m.id]); setTimeout(zoomToSelection, 0); }}>
              <I name={m.type === 'TEXT' ? 'text' : 'frame'} size={14} /> <span className="grow">{scope === 'text' ? m.text!.characters.slice(0, 60) : m.name}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- preferences */

function Preferences({ onClose }: { onClose: () => void }) {
  const prefs = useEditor((s) => s.prefs);
  const set = S().setPrefs;
  const bool = (k: keyof typeof prefs, label: string) => (
    <label className="checkbox" key={k}><input type="checkbox" checked={!!prefs[k]} onChange={(e) => set({ [k]: e.target.checked } as Partial<typeof prefs>)} data-testid={`pref-${k}`} /> {label}</label>
  );
  return (
    <Modal title="Preferences" onClose={onClose} testId="prefs-modal">
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="prop-row"><span className="muted" style={{ width: 120 }}>Your name</span><input className="input" defaultValue={prefs.userName} onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => set({ userName: e.target.value || 'You' })} data-testid="pref-name" /></div>
        <div className="prop-row"><span className="muted" style={{ width: 120 }}>Theme</span><div className="grow"><Select value={prefs.theme} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'Follow system' }]} onChange={(v) => set({ theme: v })} testId="pref-theme" /></div></div>
        <div className="prop-row"><span className="muted" style={{ width: 120 }}>Small nudge</span><div className="grow"><NumField value={prefs.nudgeSmall} min={0.1} onChange={(v) => set({ nudgeSmall: v })} /></div></div>
        <div className="prop-row"><span className="muted" style={{ width: 120 }}>Big nudge</span><div className="grow"><NumField value={prefs.nudgeBig} min={1} onChange={(v) => set({ nudgeBig: v })} testId="pref-big-nudge" /></div></div>
        {bool('snapToGeometry', 'Snap to geometry')}
        {bool('snapToObjects', 'Snap to objects')}
        {bool('snapToPixel', 'Snap to pixel grid')}
        {bool('keepToolSelected', 'Keep tool selected after use')}
        {bool('highlightOnHover', 'Highlight layers on hover')}
        {bool('renameDuplicated', 'Rename duplicated layers')}
        {bool('showDimensions', 'Show dimensions on objects')}
        {bool('invertZoom', 'Invert zoom direction')}
        {bool('numberKeysOpacity', 'Use number keys for opacity')}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- batch rename */

function BatchRename({ onClose }: { onClose: () => void }) {
  const sel = useEditor((s) => s.selection);
  const doc = useEditor((s) => s.doc!);
  const single = sel.length === 1;
  const [renameTo, setRenameTo] = useState(single ? doc.nodes[sel[0]]?.name ?? '' : '');
  const [find, setFind] = useState('');
  const [rep, setRep] = useState('');
  return (
    <Modal title={single ? 'Rename layer' : `Rename ${sel.length} layers`} onClose={onClose} testId="rename-modal" footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" data-testid="rename-apply" onClick={() => { batchRename(sel, find, rep, renameTo); onClose(); }}>Rename</button>
      </>
    }>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="muted">Rename to</span>
        <input className="input" autoFocus value={renameTo} onChange={(e) => setRenameTo(e.target.value)} placeholder="e.g. Item $n" data-testid="rename-to"
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { batchRename(sel, find, rep, renameTo); onClose(); } }} />
        <span className="faint">Use $& for current name, $n for ascending number, $N for descending number.</span>
        {!single ? (
          <>
            <span className="muted">or Find / Replace</span>
            <div className="grid2"><input className="input" placeholder="Find" value={find} onChange={(e) => setFind(e.target.value)} onKeyDown={(e) => e.stopPropagation()} /><input className="input" placeholder="Replace" value={rep} onChange={(e) => setRep(e.target.value)} onKeyDown={(e) => e.stopPropagation()} /></div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- styles */

export const stylesModalTarget: { id: string | null } = { id: null };

function Styles({ onClose }: { onClose: () => void }) {
  const doc = useEditor((s) => s.doc!);
  const [sel, setSel] = useState<string | null>(() => {
    const t = stylesModalTarget.id;
    stylesModalTarget.id = null;
    return t && doc.styles.some((x) => x.id === t) ? t : doc.styles[0]?.id ?? null;
  });
  const st = doc.styles.find((s) => s.id === sel);
  return (
    <Modal title="Local styles" onClose={onClose} wide testId="styles-modal">
      <div style={{ display: 'flex', minHeight: 320 }}>
        <div className="var-side">
          {doc.styles.length === 0 ? <div className="faint">No styles yet. Create them from the Fill, Text or Effect sections.</div> : null}
          {doc.styles.map((s) => (
            <div key={s.id} className={'item' + (s.id === sel ? ' on' : '')} onClick={() => setSel(s.id)} data-testid={`styles-item-${s.name}`}>
              {s.type === 'FILL' ? <Swatch paint={s.fills?.[0]} /> : <span className="faint">{s.type[0]}</span>} <span className="grow">{s.name}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {st ? (
            <>
              <input className="input" defaultValue={st.name} key={st.id} onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => updateStyle(st.id, { name: e.target.value || st.name })} data-testid="style-name" />
              <textarea className="input" placeholder="Description" defaultValue={st.description ?? ''} key={st.id + 'd'} onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => updateStyle(st.id, { description: e.target.value })} />
              {st.type === 'FILL' && st.fills?.[0]?.type === 'SOLID' ? (
                <SolidEditor color={st.fills[0].color} opacity={st.fills[0].opacity} onChange={(c, o) => updateStyle(st.id, { fills: [{ ...st.fills![0], color: c, opacity: o }] })} />
              ) : null}
              {st.type === 'TEXT' ? (
                <>
                  <Select value={st.text?.fontFamily ?? 'Inter'} options={FONT_FAMILIES.map((f) => ({ value: f, label: f }))} onChange={(v) => updateStyle(st.id, { text: { ...st.text, fontFamily: v } })} testId="style-font-family" />
                  <div className="grid2">
                    <NumField label="Size" value={st.text?.fontSize ?? 16} onChange={(v) => updateStyle(st.id, { text: { ...st.text, fontSize: v } })} testId="style-font-size" />
                    <NumField label="Wt" value={st.text?.fontWeight ?? 400} step={100} min={100} max={900} onChange={(v) => updateStyle(st.id, { text: { ...st.text, fontWeight: v } })} testId="style-font-weight" />
                    <NumField label="LH" title="Line height (0 = auto)" value={typeof st.text?.lineHeight === 'number' ? st.text.lineHeight : 0} min={0} onChange={(v) => updateStyle(st.id, { text: { ...st.text, lineHeight: v > 0 ? v : 'AUTO' } })} testId="style-line-height" />
                    <NumField label="LS" title="Letter spacing %" value={st.text?.letterSpacing ?? 0} suffix="%" onChange={(v) => updateStyle(st.id, { text: { ...st.text, letterSpacing: v } })} testId="style-letter-spacing" />
                  </div>
                  <label className="checkbox"><input type="checkbox" checked={!!st.text?.italic} onChange={(e) => updateStyle(st.id, { text: { ...st.text, italic: e.target.checked } })} /> Italic</label>
                </>
              ) : null}
              <div className="row"><span className="spacer" /><button className="btn danger" onClick={() => { deleteStyle(st.id); setSel(null); }} data-testid="delete-style">Delete style</button></div>
            </>
          ) : <div className="empty">Select a style to edit</div>}
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- libraries, plugins, about */

function Libraries({ onClose }: { onClose: () => void }) {
  const doc = useEditor((s) => s.doc!);
  const comps = Object.values(doc.nodes).filter((n) => n.type === 'COMPONENT').length;
  return (
    <Modal title="Libraries" onClose={onClose} testId="libraries-modal">
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row"><I name="book" size={20} /><div className="grow"><b>This file</b><div className="faint">{comps} components · {doc.styles.length} styles · {doc.variables.length} variables</div></div>
          <button className="btn primary" data-testid="publish-library" onClick={() => S().toast('Library published to this browser')}>Publish…</button></div>
        <div className="divider" />
        <div className="muted">Copy and paste components between files to reuse them — instances keep their overrides and link to the main component inside the same file.</div>
      </div>
    </Modal>
  );
}

function Plugins({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Plugins" onClose={onClose} testId="plugins-modal">
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {PLUGINS.map((p) => (
          <div key={p.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="avatar" style={{ background: '#0D99FF', borderRadius: 6 }}><I name="plugin" size={14} /></div>
            <div className="grow"><b>{p.name}</b><div className="faint">{p.description}</div></div>
            <button className="btn small" onClick={() => { onClose(); void runPlugin(p.id); }} data-testid={`run-plugin-${p.id}`}>Run</button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function About({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About My Flow" onClose={onClose} testId="about-modal">
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', textAlign: 'center' }}>
        <I name="logo" size={48} />
        <b style={{ fontSize: 16 }}>My Flow</b>
        <div className="muted">A Figma-style design, prototyping and handoff tool that runs fully in your browser — no account needed. Files are stored locally (IndexedDB).</div>
        <button className="btn" onClick={() => { onClose(); S().setState({ modal: 'shortcuts' }); }}>Keyboard shortcuts</button>
      </div>
    </Modal>
  );
}

export { getPageOf };
