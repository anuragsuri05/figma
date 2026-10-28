import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  useEditor, S, setProps, align, distribute, tidyUp, flip, rotateSelection, addAutoLayout, removeAutoLayout, groupSelection, createComponent,
  detachInstance, resetInstance, goToMainComponent, componentSetProps, parseVariantName, setInstanceVariant, addVariant, useAsMask, zoomAt,
  zoomToFit, zoomToSelection, createStyle, applyStyle, detachStyle, combineAsVariants, pushOverridesToMain, currentDoc, frameSelection,
  renameVariantProperty,
} from '../store/editor';
import type { BlendMode, Effect, EffectType, LayoutGrid, Paint, SceneNode, Sizing, TextProps } from '../model/types';
import { solid, effect as newEffect, layoutGrid as newGrid, exportSetting, FRAME_PRESETS, FONT_FAMILIES, FONT_WEIGHTS, uid } from '../model/defaults';
import { NumField, Select, IconButton, Section, Swatch, Popover, Menu, type MenuItem, fmt } from './ui';
import { PaintPicker, SolidEditor } from './ColorPicker';
import { I } from './icons';
import { exportNode, downloadBlob, nodeToSvgString } from '../render/export';
import { openPresent, displayKeys, runCommand } from '../commands';
import { PrototypePanel } from './PrototypePanel';
import { DevPanel } from './DevPanel';
import { ThemeToggle } from './ThemeToggle';
import { stylesModalTarget } from './Modals';
import { normalizeHex } from '../model/color';
import { descendants } from '../model/tree';
import { resolveVariable } from '../model/layout';

export function useSelNodes(): SceneNode[] {
  return useEditor(useShallow((s) => s.selection.map((id) => s.doc?.nodes[id]).filter(Boolean) as SceneNode[]));
}

function mixed<T>(nodes: SceneNode[], fn: (n: SceneNode) => T): T | 'mixed' {
  if (!nodes.length) return 'mixed';
  const v = fn(nodes[0]);
  const key = (x: unknown) => JSON.stringify(x, (k, val) => (k === 'id' || k === 'styleId' ? undefined : val));
  const kv = key(v);
  for (const n of nodes) if (key(fn(n)) !== kv) return 'mixed';
  return v;
}

const ids = (nodes: SceneNode[]) => nodes.map((n) => n.id);

/* ================================================================= panel shell */

export function RightPanel() {
  const rightTab = useEditor((s) => s.rightTab);
  const mode = useEditor((s) => s.mode);
  const zoom = useEditor((s) => s.zoom);
  const [zoomMenu, setZoomMenu] = useState<{ x: number; y: number } | null>(null);
  const [presentMenu, setPresentMenu] = useState<{ x: number; y: number } | null>(null);
  const userName = useEditor((s) => s.prefs.userName);
  const zoomItems: MenuItem[] = [
    { label: 'Zoom in', keys: 'mod+=', onClick: () => zoomAt(S().zoom * 2) },
    { label: 'Zoom out', keys: 'mod+-', onClick: () => zoomAt(S().zoom / 2) },
    { label: 'Zoom to fit', keys: 'shift+1', onClick: zoomToFit },
    { label: 'Zoom to selection', keys: 'shift+2', onClick: zoomToSelection },
    { label: 'Zoom to 50%', onClick: () => zoomAt(0.5) },
    { label: 'Zoom to 100%', keys: 'shift+0', onClick: () => zoomAt(1), testId: 'zoom-100' },
    { label: 'Zoom to 200%', onClick: () => zoomAt(2) },
    { separator: true },
    { label: 'Dot grid', checked: S().view.dotGrid, onClick: () => runCommand('view.dotGrid'), testId: 'zoom-dot-grid' },
    { label: 'Pixel preview', checked: S().view.pixelPreview, onClick: () => runCommand('view.pixelPreview') },
    { label: 'Pixel grid', keys: "shift+'", checked: S().view.pixelGrid, onClick: () => runCommand('view.pixelGrid') },
    { label: 'Snap to pixel grid', checked: S().prefs.snapToPixel, onClick: () => runCommand('view.snapPixel') },
    { label: 'Layout grids', keys: 'ctrl+g', checked: S().view.layoutGrids, onClick: () => runCommand('view.layoutGrids') },
    { label: 'Rulers', keys: 'shift+r', checked: S().view.rulers, onClick: () => runCommand('view.rulers') },
    { label: 'Outlines', keys: 'mod+y', checked: S().view.outlines, onClick: () => runCommand('view.outlines') },
    { separator: true },
    { label: 'Multiplayer cursors', checked: S().view.multiplayerCursors, onClick: () => runCommand('view.cursors') },
    { label: 'Comments', keys: 'shift+c', checked: S().view.comments, onClick: () => runCommand('view.comments') },
  ];
  return (
    <div className="panel right" data-testid="right-panel">
      <div className="right-top">
        <div className="avatar" data-tip={`${userName} (you)`}>{userName.slice(0, 1).toUpperCase()}</div>
        <span className="spacer" />
        <ThemeToggle />
        <button className="icon-btn" style={{ width: 36 }} data-tip="Present" data-keys={displayKeys('alt+mod+enter')} data-testid="present-btn" onClick={() => openPresent()}><I name="play" size={16} /></button>
        <button className="icon-btn" style={{ width: 14, marginLeft: -6 }} data-menu-anchor onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setPresentMenu({ x: r.left - 120, y: r.bottom + 4 }); }} data-testid="present-menu"><I name="chevronDown" size={10} /></button>
        <button className="btn primary small" style={{ height: 28 }} data-testid="share-btn" onClick={() => S().setState({ modal: 'share' })}>Share</button>
      </div>
      <div className="tabs" style={{ alignItems: 'center' }}>
        {mode === 'dev' ? (
          <span className="tab on" data-testid="tab-inspect">Inspect</span>
        ) : (
          <>
            <button className={'tab' + (rightTab === 'design' ? ' on' : '')} onClick={() => S().setState({ rightTab: 'design' })} data-testid="tab-design">Design</button>
            <button className={'tab' + (rightTab === 'prototype' ? ' on' : '')} onClick={() => S().setState({ rightTab: 'prototype' })} data-testid="tab-prototype">Prototype</button>
          </>
        )}
        <span className="spacer" />
        <button className="zoom-btn" data-menu-anchor data-testid="zoom-menu" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setZoomMenu({ x: r.right - 220, y: r.bottom + 4 }); }}>
          <span data-testid="zoom-level">{Math.round(zoom * 100)}%</span><I name="chevronDown" size={10} />
        </button>
      </div>
      <div className="panel-scroll" key={mode + rightTab}>
        {mode === 'dev' ? <DevPanel /> : rightTab === 'design' ? <DesignPanel /> : <PrototypePanel />}
      </div>
      {zoomMenu ? <Menu items={zoomItems} x={zoomMenu.x} y={zoomMenu.y} onClose={() => setZoomMenu(null)} testId="zoom-dropdown" /> : null}
      {presentMenu ? <Menu x={presentMenu.x} y={presentMenu.y} onClose={() => setPresentMenu(null)} items={[
        { label: 'Present in new tab', onClick: () => { const s = S(); const url = `${location.origin}${location.pathname}#/file/${s.fileId}/present?page=${s.pageId}`; window.open(url, '_blank'); } },
        { label: 'Present here', onClick: () => openPresent() },
        { label: 'Preview (inline)', onClick: () => openPresent() },
      ]} /> : null}
    </div>
  );
}

/* ================================================================= design panel */

function DesignPanel() {
  const nodes = useSelNodes();
  if (!nodes.length) return <PageSettings />;
  const allText = nodes.every((n) => n.type === 'TEXT');
  const anyText = nodes.some((n) => n.type === 'TEXT');
  return (
    <div data-testid="design-panel">
      <SelectionHeader nodes={nodes} />
      <ComponentSection nodes={nodes} />
      <PositionSection nodes={nodes} />
      <LayoutSection nodes={nodes} />
      <AppearanceSection nodes={nodes} />
      {anyText ? <TypographySection nodes={nodes.filter((n) => n.type === 'TEXT')} /> : null}
      <PaintSection nodes={nodes} kind="fills" />
      <PaintSection nodes={nodes} kind="strokes" />
      <EffectsSection nodes={nodes} />
      {!allText && nodes.some((n) => n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE') ? <GridSection nodes={nodes} /> : null}
      <SelectionColors nodes={nodes} />
      <ExportSection nodes={nodes} />
    </div>
  );
}

/* ----------------------------------------------------------------- page settings (no selection) */

function PageSettings() {
  const doc = useEditor((s) => s.doc!);
  const page = useEditor((s) => s.doc!.pages.find((p) => p.id === s.pageId)!);
  const [picker, setPicker] = useState<DOMRect | null>(null);
  const [styleMenu, setStyleMenu] = useState<{ x: number; y: number } | null>(null);
  const styles = doc.styles;
  return (
    <div data-testid="page-settings">
      <Section title="Page">
        <div className="paint-row">
          <div className="paint-chip" data-popover-keep>
            <button onClick={(e) => setPicker((e.currentTarget as HTMLElement).getBoundingClientRect())} data-testid="page-bg-swatch"><Swatch paint={solid(page.background)} /></button>
            <input defaultValue={page.background.replace('#', '')} key={page.id + page.background} data-testid="page-bg-input" onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} onBlur={(e) => { const h = normalizeHex(e.target.value); if (h && h !== page.background) S().update((d) => { d.pages.find((p) => p.id === page.id)!.background = h; }); else e.target.value = page.background.replace('#', ''); }} />
            <span className="pct">100%</span>
          </div>
          <IconButton icon="eye" tip="Show in exports" />
        </div>
      </Section>
      <Section title="Variables" actions={<IconButton icon="variable" tip="Open variables" onClick={() => S().setState({ modal: 'variables' })} testId="open-variables" />}>
        <button className="btn" onClick={() => S().setState({ modal: 'variables' })} data-testid="open-variables-btn"><I name="variable" size={16} /> Open variables</button>
      </Section>
      <Section title="Styles" actions={<IconButton icon="plus" tip="Create style" testId="add-style" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setStyleMenu({ x: r.left - 160, y: r.bottom }); }} />}>
        {styles.length === 0 ? <div className="faint">No local styles</div> : null}
        {(['FILL', 'TEXT', 'EFFECT', 'GRID'] as const).map((t) => {
          const list = styles.filter((s) => s.type === t);
          if (!list.length) return null;
          return (
            <div key={t}>
              <div className="faint" style={{ marginBottom: 4 }}>{t === 'FILL' ? 'Color styles' : t === 'TEXT' ? 'Text styles' : t === 'EFFECT' ? 'Effect styles' : 'Grid styles'}</div>
              {list.map((s) => (
                <div key={s.id} className="row" style={{ height: 28 }} data-testid={`style-row-${s.name}`}>
                  {t === 'FILL' ? <Swatch paint={s.fills?.[0]} /> : t === 'TEXT' ? <span style={{ fontWeight: 700 }}>Ag</span> : t === 'EFFECT' ? <I name="effect" size={14} /> : <I name="grid" size={14} />}
                  <span className="grow">{s.name}</span>
                  <IconButton icon="more" tip="Edit style" testId={`edit-style-${s.name}`} onClick={() => { stylesModalTarget.id = s.id; S().setState({ modal: 'styles' }); }} />
                </div>
              ))}
            </div>
          );
        })}
      </Section>
      <Section title="Export" actions={<IconButton icon="plus" tip="Export page" onClick={() => runCommand('file.exportPdf')} />}>
        <button className="btn" onClick={() => runCommand('file.export')} data-testid="export-page">Export {page.name}</button>
      </Section>
      {picker ? <PaintPicker paint={solid(page.background)} anchor={picker} allowImage={false} onClose={() => setPicker(null)} onChange={(p) => S().update((d) => { d.pages.find((x) => x.id === page.id)!.background = p.color; }, { commit: true })} /> : null}
      {styleMenu ? <Menu x={styleMenu.x} y={styleMenu.y} onClose={() => setStyleMenu(null)} items={[
        { label: 'Color style', onClick: () => createStyle('FILL'), testId: 'new-color-style' },
        { label: 'Text style', onClick: () => createStyle('TEXT') },
        { label: 'Effect style', onClick: () => { const id = createStyle('EFFECT'); S().update((d) => { const st = d.styles.find((x) => x.id === id); if (st) st.effects = [newEffect('DROP_SHADOW')]; }); } },
        { label: 'Layout guide style', onClick: () => { const id = createStyle('GRID'); S().update((d) => { const st = d.styles.find((x) => x.id === id); if (st) st.grids = [newGrid('COLUMNS')]; }); } },
      ]} /> : null}
      <span style={{ display: 'none' }}>{doc.id}</span>
    </div>
  );
}

/* ----------------------------------------------------------------- selection header */

function SelectionHeader({ nodes }: { nodes: SceneNode[] }) {
  const [presetMenu, setPresetMenu] = useState<{ x: number; y: number } | null>(null);
  const n = nodes[0];
  const single = nodes.length === 1;
  const isFrame = single && (n.type === 'FRAME' || n.type === 'COMPONENT');
  const multi = nodes.length > 1;
  const typeLabel = single ? (n.type === 'FRAME' ? (n.layout.mode !== 'NONE' ? 'Frame' : 'Frame') : n.type === 'BOOLEAN_OPERATION' ? 'Boolean' : n.type === 'COMPONENT_SET' ? 'Component set' : n.type.charAt(0) + n.type.slice(1).toLowerCase()) : `${nodes.length} selected`;
  return (
    <div className="section" style={{ padding: '8px 0' }}>
      <div className="section-head" style={{ paddingLeft: 16 }}>
        {isFrame ? (
          <button className="row" style={{ gap: 4, fontWeight: 600 }} data-menu-anchor data-testid="frame-presets" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setPresetMenu({ x: r.left, y: r.bottom + 4 }); }}>
            {typeLabel} <I name="chevronDown" size={10} />
          </button>
        ) : <span className="title" data-testid="selection-type">{typeLabel}</span>}
        <span className="spacer" />
        {multi ? (
          <>
            <IconButton icon="boolUnion" tip="Union selection" keys="alt+shift+u" onClick={() => groupSelection('BOOLEAN_OPERATION', 'UNION')} testId="bool-union" />
            <IconButton icon="boolSubtract" tip="Subtract selection" keys="alt+shift+s" onClick={() => groupSelection('BOOLEAN_OPERATION', 'SUBTRACT')} testId="bool-subtract" />
            <IconButton icon="boolIntersect" tip="Intersect selection" keys="alt+shift+i" onClick={() => groupSelection('BOOLEAN_OPERATION', 'INTERSECT')} testId="bool-intersect" />
            <IconButton icon="boolExclude" tip="Exclude selection" keys="alt+shift+e" onClick={() => groupSelection('BOOLEAN_OPERATION', 'EXCLUDE')} testId="bool-exclude" />
          </>
        ) : null}
        <IconButton icon="mask" tip="Use as mask" keys="ctrl+mod+m" onClick={useAsMask} testId="use-mask" active={single && n.isMask} />
        {!nodes.some((x) => x.type === 'INSTANCE' || x.type === 'COMPONENT' || x.type === 'COMPONENT_SET') ? <IconButton icon="component" tip="Create component" keys="alt+mod+k" onClick={createComponent} testId="create-component" /> : null}
        {nodes.every((x) => x.type === 'COMPONENT') && nodes.length > 1 ? <IconButton icon="component" tip="Combine as variants" onClick={combineAsVariants} testId="combine-variants" /> : null}
        {single && n.type === 'BOOLEAN_OPERATION' ? (
          <Select value={n.booleanOp ?? 'UNION'} options={[{ value: 'UNION', label: 'Union' }, { value: 'SUBTRACT', label: 'Subtract' }, { value: 'INTERSECT', label: 'Intersect' }, { value: 'EXCLUDE', label: 'Exclude' }]} onChange={(v) => setProps([n.id], { booleanOp: v })} style={{ width: 90 }} />
        ) : null}
      </div>
      {presetMenu ? <Menu x={presetMenu.x} y={presetMenu.y} onClose={() => setPresetMenu(null)} testId="preset-menu" items={FRAME_PRESETS.map((g): MenuItem => ({
        label: g.group,
        submenu: g.items.map((p) => ({ label: `${p.name}  ${p.w}×${p.h}`, onClick: () => setProps(ids(nodes), { width: p.w, height: p.h }) })),
      }))} /> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- components */

function ComponentSection({ nodes }: { nodes: SceneNode[] }) {
  const doc = useEditor((s) => s.doc!);
  const [swap, setSwap] = useState<{ x: number; y: number } | null>(null);
  if (nodes.length !== 1) return null;
  const n = nodes[0];
  if (n.type === 'INSTANCE') {
    const main = n.mainComponentId ? doc.nodes[n.mainComponentId] : undefined;
    const set = main?.parentId && doc.nodes[main.parentId]?.type === 'COMPONENT_SET' ? doc.nodes[main.parentId] : null;
    const props = set ? componentSetProps(doc, set.id) : {};
    const cur = main ? parseVariantName(main.name) : {};
    const comps = Object.values(doc.nodes).filter((c) => c.type === 'COMPONENT');
    return (
      <Section title={<span className="row" style={{ color: 'var(--component)' }}><I name="instance" size={16} /> Instance</span>} testId="instance-section"
        actions={<>
          <IconButton icon="target" tip="Go to main component" onClick={goToMainComponent} testId="go-to-main" />
          <IconButton icon="more" tip="More" testId="instance-more" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setSwap({ x: r.left - 180, y: r.bottom }); }} />
        </>}>
        <button className="paint-chip" style={{ fontWeight: 500 }} data-menu-anchor data-testid="swap-instance" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setSwap({ x: r.left, y: r.bottom + 4 }); }}>
          <I name="componentFill" size={14} style={{ color: 'var(--component)' }} />
          <span className="grow" style={{ textAlign: 'left' }}>{set ? set.name : main?.name ?? 'Missing component'}</span>
          <I name="chevronDown" size={10} />
        </button>
        {Object.entries(props).map(([k, values]) => {
          const isBool = values.length === 2 && values.every((v) => ['true', 'false', 'on', 'off', 'yes', 'no'].includes(v.toLowerCase()));
          return (
            <div key={k} className="prop-row" data-testid={`variant-prop-${k}`}>
              <span className="muted" style={{ width: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</span>
              <div className="grow">
                {isBool ? (
                  <label className="checkbox"><input type="checkbox" checked={['true', 'on', 'yes'].includes((cur[k] ?? '').toLowerCase())} onChange={(e) => setInstanceVariant(n.id, k, values.find((v) => ['true', 'on', 'yes'].includes(v.toLowerCase()) === e.target.checked) ?? values[0])} /></label>
                ) : (
                  <Select value={cur[k] ?? values[0]} options={values.map((v) => ({ value: v, label: v }))} onChange={(v) => setInstanceVariant(n.id, k, v)} testId={`variant-select-${k}`} />
                )}
              </div>
            </div>
          );
        })}
        <TextOverrides n={n} />
        <div className="row">
          <button className="btn small" onClick={resetInstance} data-testid="reset-instance">Reset all changes</button>
          <button className="btn small" onClick={detachInstance} data-testid="detach-instance">Detach</button>
        </div>
        {swap ? <Menu x={swap.x} y={swap.y} onClose={() => setSwap(null)} search items={[
          { header: 'Swap instance' },
          ...comps.map((c): MenuItem => ({ label: c.parentId && doc.nodes[c.parentId]?.type === 'COMPONENT_SET' ? `${doc.nodes[c.parentId].name} / ${c.name}` : c.name, checked: c.id === n.mainComponentId, onClick: () => S().update((d) => { d.nodes[n.id].mainComponentId = c.id; d.nodes[n.id].overrides = []; }) })),
          { separator: true },
          { label: 'Go to main component', onClick: goToMainComponent },
          { label: 'Push changes to main component', onClick: pushOverridesToMain },
          { label: 'Reset all changes', onClick: resetInstance },
          { label: 'Detach instance', onClick: detachInstance },
        ]} /> : null}
      </Section>
    );
  }
  if (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') {
    const inSet = n.type === 'COMPONENT' && n.parentId && doc.nodes[n.parentId]?.type === 'COMPONENT_SET';
    const set = n.type === 'COMPONENT_SET' ? n : inSet ? doc.nodes[n.parentId!] : null;
    const props = set ? componentSetProps(doc, set.id) : {};
    return (
      <Section title={<span className="row" style={{ color: 'var(--component)' }}><I name="componentFill" size={16} /> {n.type === 'COMPONENT_SET' ? 'Component set' : 'Component'}</span>} testId="component-section"
        actions={n.type === 'COMPONENT_SET' || inSet ? <IconButton icon="plus" tip="Add variant" onClick={addVariant} testId="add-variant" /> : <IconButton icon="plus" tip="Add variant" onClick={combineAsVariants} testId="make-variants" />}>
        <textarea className="input" rows={2} placeholder="Add a description…" defaultValue={n.componentDescription ?? ''} key={n.id} data-testid="component-description"
          onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => setProps([n.id], { componentDescription: e.target.value })} />
        {set ? Object.entries(props).map(([k, values]) => (
          <div key={k} className="prop-row">
            <I name="component" size={14} />
            <input className="input grow" defaultValue={k} key={set.id + k} data-testid={`variant-key-${k}`} title="Rename property"
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              onBlur={(e) => renameVariantProperty(set.id, k, e.target.value)} />
            <span className="faint" style={{ whiteSpace: 'nowrap' }}>{values.length} values</span>
          </div>
        )) : null}
        {inSet ? (
          Object.entries(parseVariantName(n.name)).map(([k, v]) => (
            <div key={k} className="prop-row">
              <span className="muted" style={{ width: 80 }}>{k}</span>
              <input className="input" defaultValue={v} key={n.id + k} onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => {
                const p = parseVariantName(n.name); p[k] = e.target.value; setProps([n.id], { name: Object.entries(p).map(([a, b]) => `${a}=${b}`).join(', ') });
              }} />
            </div>
          ))
        ) : null}
      </Section>
    );
  }
  return null;
}

function TextOverrides({ n }: { n: SceneNode }) {
  const doc = useEditor((s) => s.doc!);
  const texts = descendants(doc, n.id).map((id) => doc.nodes[id]).filter((x) => x?.type === 'TEXT').slice(0, 6);
  if (!texts.length) return null;
  return (
    <>
      {texts.map((t) => (
        <div key={t.id} className="prop-row">
          <I name="text" size={14} />
          <input className="input" defaultValue={t.text!.characters} key={t.id + t.text!.characters} data-testid={`override-${t.name}`}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            onBlur={(e) => { if (e.target.value !== t.text!.characters) setProps([t.id], (x) => { x.text!.characters = e.target.value; }); }} />
        </div>
      ))}
    </>
  );
}

/* ----------------------------------------------------------------- position */

function PositionSection({ nodes }: { nodes: SceneNode[] }) {
  const doc = useEditor((s) => s.doc!);
  const n = nodes[0];
  const parent = n.parentId ? doc.nodes[n.parentId] : null;
  const inAuto = !!parent && parent.layout.mode !== 'NONE' && (parent.type === 'FRAME' || parent.type === 'COMPONENT' || parent.type === 'INSTANCE');
  const showConstraints = nodes.every((x) => x.parentId && ['FRAME', 'COMPONENT', 'INSTANCE', 'SECTION', 'COMPONENT_SET'].includes(doc.nodes[x.parentId].type)) && (!inAuto || nodes.every((x) => x.absolutePosition));
  return (
    <Section title="Position" testId="position-section">
      <div className="row" style={{ gap: 2 }}>
        <div className="seg">
          <button onClick={() => align('left')} data-tip="Align left" data-keys={displayKeys('alt+a')} data-testid="align-left"><I name="alignLeft" size={16} /></button>
          <button onClick={() => align('hcenter')} data-tip="Align horizontal centers" data-keys={displayKeys('alt+h')} data-testid="align-hcenter"><I name="alignHCenter" size={16} /></button>
          <button onClick={() => align('right')} data-tip="Align right" data-keys={displayKeys('alt+d')} data-testid="align-right"><I name="alignRight" size={16} /></button>
        </div>
        <div className="seg">
          <button onClick={() => align('top')} data-tip="Align top" data-keys={displayKeys('alt+w')} data-testid="align-top"><I name="alignTop" size={16} /></button>
          <button onClick={() => align('vcenter')} data-tip="Align vertical centers" data-keys={displayKeys('alt+v')} data-testid="align-vcenter"><I name="alignVCenter" size={16} /></button>
          <button onClick={() => align('bottom')} data-tip="Align bottom" data-keys={displayKeys('alt+s')} data-testid="align-bottom"><I name="alignBottom" size={16} /></button>
        </div>
        {nodes.length > 1 ? (
          <div className="seg">
            <button onClick={() => distribute('h')} data-tip="Distribute horizontal spacing" data-testid="dist-h"><I name="distH" size={16} /></button>
            <button onClick={() => distribute('v')} data-tip="Distribute vertical spacing" data-testid="dist-v"><I name="distV" size={16} /></button>
            <button onClick={tidyUp} data-tip="Tidy up" data-testid="tidy"><I name="tidy" size={16} /></button>
          </div>
        ) : null}
      </div>
      {inAuto && nodes.length === 1 ? (
        <label className="checkbox" data-testid="absolute-position">
          <input type="checkbox" checked={!!n.absolutePosition} onChange={(e) => setProps(ids(nodes), { absolutePosition: e.target.checked })} /> Ignore auto layout (absolute position)
        </label>
      ) : null}
      <div className="grid2">
        <NumField label="X" value={mixed(nodes, (x) => Math.round(x.x * 100) / 100)} onChange={(v) => setProps(ids(nodes), { x: v })} testId="prop-x" disabled={inAuto && !n.absolutePosition} />
        <NumField label="Y" value={mixed(nodes, (x) => Math.round(x.y * 100) / 100)} onChange={(v) => setProps(ids(nodes), { y: v })} testId="prop-y" disabled={inAuto && !n.absolutePosition} />
      </div>
      <div className="row">
        <div style={{ width: 'calc(50% - 4px)' }}>
          <NumField icon="angle" value={mixed(nodes, (x) => x.rotation)} suffix="°" onChange={(v) => setProps(ids(nodes), { rotation: ((v + 180) % 360 + 360) % 360 - 180 })} testId="prop-rotation" />
        </div>
        <span className="spacer" />
        <IconButton icon="rotate" tip="Rotate 90° right" onClick={() => rotateSelection(-90)} testId="rotate-90" />
        <IconButton icon="flipH" tip="Flip horizontal" keys="shift+h" onClick={() => flip('x')} testId="flip-h" />
        <IconButton icon="flipV" tip="Flip vertical" keys="shift+v" onClick={() => flip('y')} testId="flip-v" />
      </div>
      {showConstraints ? <Constraints nodes={nodes} /> : null}
    </Section>
  );
}

function Constraints({ nodes }: { nodes: SceneNode[] }) {
  const h = mixed(nodes, (x) => x.constraintH);
  const v = mixed(nodes, (x) => x.constraintV);
  const setH = (c: SceneNode['constraintH']) => setProps(ids(nodes), { constraintH: c });
  const setV = (c: SceneNode['constraintV']) => setProps(ids(nodes), { constraintV: c });
  const on = (a: boolean) => 'c' + (a ? ' on' : '');
  return (
    <div className="row" style={{ alignItems: 'flex-start' }} data-testid="constraints">
      <div className="constraint-box">
        <div className="inner"><div className={on(h === 'CENTER')} style={{ left: 11, top: 6, width: 1, height: 10, position: 'absolute' }} onClick={() => setH('CENTER')} /><div className={on(v === 'CENTER')} style={{ top: 11, left: 6, height: 1, width: 10, position: 'absolute' }} onClick={() => setV('CENTER')} /></div>
        <div className={on(h === 'LEFT' || h === 'LEFT_RIGHT')} style={{ left: 6, top: 31, width: 10, height: 2 }} onClick={() => setH(h === 'RIGHT' ? 'LEFT_RIGHT' : 'LEFT')} />
        <div className={on(h === 'RIGHT' || h === 'LEFT_RIGHT')} style={{ right: 6, top: 31, width: 10, height: 2 }} onClick={() => setH(h === 'LEFT' ? 'LEFT_RIGHT' : 'RIGHT')} />
        <div className={on(v === 'TOP' || v === 'TOP_BOTTOM')} style={{ top: 6, left: 31, width: 2, height: 10 }} onClick={() => setV(v === 'BOTTOM' ? 'TOP_BOTTOM' : 'TOP')} />
        <div className={on(v === 'BOTTOM' || v === 'TOP_BOTTOM')} style={{ bottom: 6, left: 31, width: 2, height: 10 }} onClick={() => setV(v === 'TOP' ? 'TOP_BOTTOM' : 'BOTTOM')} />
      </div>
      <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Select value={h} testId="constraint-h" options={[{ value: 'LEFT', label: 'Left' }, { value: 'RIGHT', label: 'Right' }, { value: 'LEFT_RIGHT', label: 'Left & right' }, { value: 'CENTER', label: 'Center' }, { value: 'SCALE', label: 'Scale' }]} onChange={setH} />
        <Select value={v} testId="constraint-v" options={[{ value: 'TOP', label: 'Top' }, { value: 'BOTTOM', label: 'Bottom' }, { value: 'TOP_BOTTOM', label: 'Top & bottom' }, { value: 'CENTER', label: 'Center' }, { value: 'SCALE', label: 'Scale' }]} onChange={setV} />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- layout (size + auto layout) */

function SizingSelect({ nodes, axis }: { nodes: SceneNode[]; axis: 'H' | 'V' }) {
  const doc = useEditor((s) => s.doc!);
  const key = axis === 'H' ? 'sizingH' : 'sizingV';
  const value = mixed(nodes, (n) => n[key]);
  const canHug = nodes.every((n) => (n.layout.mode !== 'NONE' && ['FRAME', 'COMPONENT', 'INSTANCE'].includes(n.type)) || n.type === 'TEXT');
  const canFill = nodes.every((n) => { const p = n.parentId ? doc.nodes[n.parentId] : null; return !!p && p.layout.mode !== 'NONE' && !n.absolutePosition; });
  if (!canHug && !canFill) return null;
  const opts: { value: Sizing; label: string }[] = [{ value: 'FIXED', label: 'Fixed' }];
  if (canHug) opts.push({ value: 'HUG', label: 'Hug' });
  if (canFill) opts.push({ value: 'FILL', label: 'Fill' });
  return (
    <Select value={value} options={opts} testId={`sizing-${axis}`} title={axis === 'H' ? 'Horizontal resizing' : 'Vertical resizing'} onChange={(v) => setProps(ids(nodes), (n) => {
      (n as SceneNode)[key] = v;
      if (n.type === 'TEXT' && n.text) {
        if (axis === 'H' && v === 'HUG') n.text.autoResize = 'WIDTH_AND_HEIGHT';
        if (axis === 'V' && v === 'HUG' && n.text.autoResize === 'NONE') n.text.autoResize = 'HEIGHT';
        if (axis === 'H' && v === 'FIXED' && n.text.autoResize === 'WIDTH_AND_HEIGHT') n.text.autoResize = 'HEIGHT';
        if (axis === 'V' && v === 'FIXED') n.text.autoResize = 'NONE';
      }
    })} />
  );
}

function LayoutSection({ nodes }: { nodes: SceneNode[] }) {
  const [lockAspect, setLockAspect] = useState(false);
  const [minMax, setMinMax] = useState(false);
  const [padMode, setPadMode] = useState<'simple' | 'individual'>('simple');
  const n = nodes[0];
  const isFrameish = nodes.every((x) => x.type === 'FRAME' || x.type === 'COMPONENT' || x.type === 'INSTANCE');
  const hasAuto = isFrameish && nodes.every((x) => x.layout.mode !== 'NONE');
  const L = n.layout;
  const setLayout = (patch: Partial<SceneNode['layout']>) => setProps(ids(nodes), (x) => { x.layout = { ...x.layout, ...patch }; });
  const setW = (v: number) => {
    S().begin();
    setProps(ids(nodes), (x) => { x.sizingH = 'FIXED'; if (x.text?.autoResize === 'WIDTH_AND_HEIGHT') x.text.autoResize = 'HEIGHT'; });
    setProps(ids(nodes), lockAspect ? { width: v, height: v * (n.height / n.width) } : { width: v });
    S().end();
  };
  const setH = (v: number) => {
    S().begin();
    setProps(ids(nodes), (x) => { x.sizingV = 'FIXED'; if (x.text && x.text.autoResize !== 'NONE' && x.text.autoResize !== 'TRUNCATE') x.text.autoResize = 'NONE'; });
    setProps(ids(nodes), lockAspect ? { width: v * (n.width / n.height), height: v } : { height: v });
    S().end();
  };
  return (
    <Section title={hasAuto ? 'Auto layout' : 'Layout'} testId="layout-section"
      actions={isFrameish ? (
        hasAuto ? <IconButton icon="minus" tip="Remove auto layout" keys="alt+shift+a" onClick={removeAutoLayout} testId="remove-auto-layout" />
          : <IconButton icon="plus" tip="Add auto layout" keys="shift+a" onClick={addAutoLayout} testId="add-auto-layout" />
      ) : !nodes.some((x) => x.type === 'SECTION') ? <IconButton icon="autoLayoutV" tip="Add auto layout (wrap in frame)" keys="shift+a" onClick={() => frameSelection(true)} testId="wrap-auto-layout" /> : null}>
      {hasAuto ? (
        <div className="row" style={{ gap: 6 }}>
          <div className="seg" data-testid="al-direction">
            <button className={L.mode === 'VERTICAL' ? 'on' : ''} data-tip="Vertical layout" onClick={() => setLayout({ mode: 'VERTICAL' })} data-testid="al-vertical"><I name="autoLayoutV" size={16} /></button>
            <button className={L.mode === 'HORIZONTAL' ? 'on' : ''} data-tip="Horizontal layout" onClick={() => setLayout({ mode: 'HORIZONTAL' })} data-testid="al-horizontal"><I name="autoLayoutH" size={16} /></button>
            <button className={L.mode === 'WRAP' ? 'on' : ''} data-tip="Wrap" onClick={() => setLayout({ mode: 'WRAP' })} data-testid="al-wrap"><I name="wrap" size={16} /></button>
          </div>
          <span className="spacer" />
          <label className="checkbox" data-tip="Clip content"><input type="checkbox" checked={n.clipContent} onChange={(e) => setProps(ids(nodes), { clipContent: e.target.checked })} data-testid="clip-content" /> Clip</label>
        </div>
      ) : null}
      <div className="grid2">
        <Bindable nodes={nodes} field="width"><NumField label="W" value={mixed(nodes, (x) => Math.round(x.width * 100) / 100)} min={0.01} onChange={setW} testId="prop-w" /></Bindable>
        <Bindable nodes={nodes} field="height"><NumField label="H" value={mixed(nodes, (x) => Math.round(x.height * 100) / 100)} min={0.01} onChange={setH} testId="prop-h" /></Bindable>
      </div>
      <div className="row" style={{ gap: 4 }}>
        <div className="grow"><SizingSelect nodes={nodes} axis="H" /></div>
        <div className="grow"><SizingSelect nodes={nodes} axis="V" /></div>
        <IconButton icon={lockAspect ? 'link' : 'unlink'} tip={lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'} active={lockAspect} onClick={() => setLockAspect(!lockAspect)} testId="lock-aspect" />
        <IconButton icon="more" tip="Min/max sizes" onClick={() => setMinMax(!minMax)} active={minMax} testId="min-max" />
      </div>
      {minMax ? (
        <div className="grid2">
          <NumField label="↤" title="Min width" value={n.minW ?? 0} onChange={(v) => setProps(ids(nodes), { minW: v || undefined })} testId="min-w" />
          <NumField label="↦" title="Max width" value={n.maxW ?? 0} onChange={(v) => setProps(ids(nodes), { maxW: v || undefined })} testId="max-w" />
          <NumField label="↥" title="Min height" value={n.minH ?? 0} onChange={(v) => setProps(ids(nodes), { minH: v || undefined })} />
          <NumField label="↧" title="Max height" value={n.maxH ?? 0} onChange={(v) => setProps(ids(nodes), { maxH: v || undefined })} />
        </div>
      ) : null}
      {hasAuto ? (
        <>
          <div className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
            <AlignmentGrid nodes={nodes} />
            <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {L.alignMain === 'SPACE_BETWEEN' ? (
                <Select value="AUTO" options={[{ value: 'AUTO', label: 'Auto' }, { value: 'FIXED', label: 'Fixed' }]} onChange={(v) => { if (v === 'FIXED') setLayout({ alignMain: 'MIN' }); }} testId="gap-mode" />
              ) : (
                <Bindable nodes={nodes} field="gap"><NumField icon={L.mode === 'VERTICAL' ? 'gapV' : 'gapH'} title="Gap between items" value={L.gap} onChange={(v) => setLayout({ gap: v })} testId="al-gap" /></Bindable>
              )}
              {L.mode === 'WRAP' ? <NumField icon="gapV" title="Row gap" value={L.counterGap} onChange={(v) => setLayout({ counterGap: v })} testId="al-row-gap" /> : null}
              <Select value={L.alignMain === 'SPACE_BETWEEN' ? 'auto' : 'packed'} options={[{ value: 'packed', label: 'Packed' }, { value: 'auto', label: 'Space between' }]} onChange={(v) => setLayout({ alignMain: v === 'auto' ? 'SPACE_BETWEEN' : 'MIN' })} testId="al-spacing-mode" />
            </div>
          </div>
          <div className="row" style={{ gap: 4 }}>
            {padMode === 'simple' ? (
              <div className="grow"><Bindable nodes={nodes} field="padding">              <div className="grid2">
                <NumField label="↔" title="Horizontal padding" value={L.paddingLeft === L.paddingRight ? L.paddingLeft : 'mixed'} onChange={(v) => setLayout({ paddingLeft: v, paddingRight: v })} testId="al-pad-h" />
                <NumField label="↕" title="Vertical padding" value={L.paddingTop === L.paddingBottom ? L.paddingTop : 'mixed'} onChange={(v) => setLayout({ paddingTop: v, paddingBottom: v })} testId="al-pad-v" />
              </div></Bindable></div>
            ) : (
              <div className="grid2 grow">
                <NumField label="L" value={L.paddingLeft} onChange={(v) => setLayout({ paddingLeft: v })} testId="al-pad-l" />
                <NumField label="T" value={L.paddingTop} onChange={(v) => setLayout({ paddingTop: v })} testId="al-pad-t" />
                <NumField label="R" value={L.paddingRight} onChange={(v) => setLayout({ paddingRight: v })} testId="al-pad-r" />
                <NumField label="B" value={L.paddingBottom} onChange={(v) => setLayout({ paddingBottom: v })} testId="al-pad-b" />
              </div>
            )}
            <IconButton icon="padding" tip="Individual padding" active={padMode === 'individual'} onClick={() => setPadMode(padMode === 'simple' ? 'individual' : 'simple')} testId="pad-individual" />
          </div>
          <label className="checkbox"><input type="checkbox" checked={!!L.reverseZ} onChange={(e) => setLayout({ reverseZ: e.target.checked })} /> Canvas stacking: first on top</label>
        </>
      ) : isFrameish ? (
        <label className="checkbox"><input type="checkbox" checked={mixed(nodes, (x) => x.clipContent) === true} onChange={(e) => setProps(ids(nodes), { clipContent: e.target.checked })} data-testid="clip-content" /> Clip content</label>
      ) : null}
    </Section>
  );
}

function AlignmentGrid({ nodes }: { nodes: SceneNode[] }) {
  const L = nodes[0].layout;
  const horiz = L.mode !== 'VERTICAL';
  const cells: { main: 'MIN' | 'CENTER' | 'MAX'; cross: 'MIN' | 'CENTER' | 'MAX' }[] = [];
  for (const r of ['MIN', 'CENTER', 'MAX'] as const) for (const c of ['MIN', 'CENTER', 'MAX'] as const) cells.push(horiz ? { main: c, cross: r } : { main: r, cross: c });
  return (
    <div className="align-grid" data-testid="al-align-grid">
      {cells.map((cell, i) => {
        const on = (L.alignMain === cell.main || (L.alignMain === 'SPACE_BETWEEN')) && L.alignCross === cell.cross && L.alignMain !== 'SPACE_BETWEEN';
        return (
          <button key={i} className={on ? 'on' : ''} data-testid={`al-align-${i}`} onClick={() => setProps(ids(nodes), (x) => { x.layout = { ...x.layout, alignMain: x.layout.alignMain === 'SPACE_BETWEEN' ? 'SPACE_BETWEEN' : cell.main, alignCross: cell.cross }; })}>
            <i />
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- appearance */

const BLEND_OPTIONS: { value: BlendMode; label: string }[] = [
  { value: 'PASS_THROUGH', label: 'Pass through' }, { value: 'NORMAL', label: 'Normal' }, { value: 'DARKEN', label: 'Darken' }, { value: 'MULTIPLY', label: 'Multiply' },
  { value: 'COLOR_BURN', label: 'Color burn' }, { value: 'LIGHTEN', label: 'Lighten' }, { value: 'SCREEN', label: 'Screen' }, { value: 'COLOR_DODGE', label: 'Color dodge' },
  { value: 'OVERLAY', label: 'Overlay' }, { value: 'SOFT_LIGHT', label: 'Soft light' }, { value: 'HARD_LIGHT', label: 'Hard light' }, { value: 'DIFFERENCE', label: 'Difference' },
  { value: 'EXCLUSION', label: 'Exclusion' }, { value: 'HUE', label: 'Hue' }, { value: 'SATURATION', label: 'Saturation' }, { value: 'COLOR', label: 'Color' }, { value: 'LUMINOSITY', label: 'Luminosity' },
];

function AppearanceSection({ nodes }: { nodes: SceneNode[] }) {
  const doc = useEditor((s) => s.doc!);
  const [corners, setCorners] = useState(false);
  const n = nodes[0];
  const hasRadius = nodes.every((x) => ['RECTANGLE', 'FRAME', 'COMPONENT', 'INSTANCE', 'SECTION', 'COMPONENT_SET', 'POLYGON', 'STAR'].includes(x.type));
  const showCorners = corners || !!n.corners;
  const vis = mixed(nodes, (x) => x.visible);
  return (
    <Section title="Appearance" testId="appearance-section"
      actions={<IconButton icon={vis === false ? 'eyeOff' : 'eye'} tip={vis === false ? 'Show' : 'Hide'} onClick={() => setProps(ids(nodes), { visible: vis === false })} testId="appearance-visibility" />}>
      <div className="grid2">
        <Bindable nodes={nodes} field="opacity"><NumField icon="opacity" value={mixed(nodes, (x) => x.opacity)} scale={100} decimals={0} min={0} max={1} suffix="%" onChange={(v) => setProps(ids(nodes), { opacity: v })} testId="prop-opacity" title="Opacity" /></Bindable>
        <Select value={mixed(nodes, (x) => x.blendMode)} options={BLEND_OPTIONS} onChange={(v) => setProps(ids(nodes), { blendMode: v })} testId="prop-blend" title="Blend mode" />
      </div>
      {hasRadius ? (
        <div className="row" style={{ gap: 4 }}>
          {showCorners ? (
            <div className="grid2 grow">
              {(['↖', '↗', '↘', '↙'] as const).map((lbl, i) => (
                <NumField key={i} label={lbl} min={0} value={(n.corners ?? [n.cornerRadius, n.cornerRadius, n.cornerRadius, n.cornerRadius])[i]} testId={`corner-${i}`}
                  onChange={(v) => setProps(ids(nodes), (x) => { const c = (x.corners ?? [x.cornerRadius, x.cornerRadius, x.cornerRadius, x.cornerRadius]).slice() as [number, number, number, number]; c[i] = v; x.corners = c; })} />
              ))}
            </div>
          ) : (
            <div className="grow"><Bindable nodes={nodes} field="cornerRadius"><NumField icon="corner" min={0} value={mixed(nodes, (x) => x.cornerRadius)} onChange={(v) => setProps(ids(nodes), { cornerRadius: v, corners: null })} testId="prop-radius" title="Corner radius" /></Bindable></div>
          )}
          <IconButton icon="corners" tip="Independent corners" active={showCorners} onClick={() => { if (showCorners) { setCorners(false); setProps(ids(nodes), { corners: null }); } else setCorners(true); }} testId="independent-corners" />
        </div>
      ) : null}
      {hasRadius && (n.cornerRadius > 0 || n.corners) ? (
        <div className="row"><span className="muted" style={{ width: 90 }}>Corner smoothing</span><div className="grow"><NumField value={n.cornerSmoothing} scale={100} decimals={0} min={0} max={1} suffix="%" onChange={(v) => setProps(ids(nodes), { cornerSmoothing: v })} testId="corner-smoothing" /></div></div>
      ) : null}
      {nodes.every((x) => x.type === 'ELLIPSE') ? (
        <div className="grid3" data-testid="arc-controls">
          <NumField label="S" title="Start" value={n.arcStart ?? 0} suffix="°" onChange={(v) => setProps(ids(nodes), { arcStart: v })} testId="arc-start" />
          <NumField label="◔" title="Sweep" value={((n.arcSweep ?? 360) / 360)} scale={100} decimals={0} min={0} max={1} suffix="%" onChange={(v) => setProps(ids(nodes), { arcSweep: v * 360 })} testId="arc-sweep" />
          <NumField label="R" title="Ratio" value={n.arcInner ?? 0} scale={100} decimals={0} min={0} max={0.99} suffix="%" onChange={(v) => setProps(ids(nodes), { arcInner: v })} testId="arc-ratio" />
        </div>
      ) : null}
      {nodes.every((x) => x.type === 'POLYGON' || x.type === 'STAR') ? (
        <div className="grid2">
          <NumField label="#" title="Count" value={n.pointCount ?? 3} min={3} max={60} decimals={0} onChange={(v) => setProps(ids(nodes), { pointCount: Math.round(v) })} testId="point-count" />
          {n.type === 'STAR' ? <NumField label="R" title="Ratio" value={n.innerRadius ?? 0.38} scale={100} decimals={0} min={0.01} max={1} suffix="%" onChange={(v) => setProps(ids(nodes), { innerRadius: v })} testId="star-ratio" /> : null}
        </div>
      ) : null}
      {doc.collections.length && nodes.length === 1 && ['FRAME', 'COMPONENT', 'INSTANCE', 'SECTION', 'GROUP'].includes(n.type) ? (
        doc.collections.filter((c) => c.modes.length > 1).map((c) => (
          <div key={c.id} className="prop-row" data-testid={`mode-switch-${c.name}`}>
            <I name="variable" size={14} />
            <span className="muted" style={{ width: 80 }}>{c.name}</span>
            <div className="grow">
              <Select value={n.variableModes?.[c.id] ?? 'AUTO'} options={[{ value: 'AUTO', label: `Auto (${c.modes[0].name})` }, ...c.modes.map((m) => ({ value: m.id, label: m.name }))]}
                onChange={(v) => setProps([n.id], (x) => { const vm = { ...(x.variableModes ?? {}) }; if (v === 'AUTO') delete vm[c.id]; else vm[c.id] = v; x.variableModes = vm; })} testId={`mode-select-${c.name}`} />
            </div>
          </div>
        ))
      ) : null}
    </Section>
  );
}

/* ----------------------------------------------------------------- typography */

function TypographySection({ nodes }: { nodes: SceneNode[] }) {
  const doc = useEditor((s) => s.doc!);
  const [details, setDetails] = useState<DOMRect | null>(null);
  const [styleMenu, setStyleMenu] = useState<{ x: number; y: number } | null>(null);
  if (!nodes.length) return null;
  const t = (fn: (x: TextProps) => unknown) => mixed(nodes, (n) => fn(n.text!));
  const set = (patch: Partial<TextProps>) => setProps(ids(nodes), (n) => { if (n.text) Object.assign(n.text, patch); delete n.textStyleId; });
  const styleId = mixed(nodes, (n) => n.textStyleId ?? null);
  const style = typeof styleId === 'string' ? doc.styles.find((s) => s.id === styleId) : null;
  const textStyles = doc.styles.filter((s) => s.type === 'TEXT');
  const lh = t((x) => x.lineHeight);
  return (
    <Section title="Typography" testId="typography-section"
      actions={<>
        <IconButton icon="styles" tip="Text styles" testId="text-styles-btn" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setStyleMenu({ x: r.left - 200, y: r.bottom }); }} />
      </>}>
      {style ? (
        <div className="row">
          <div className="var-chip"><span style={{ fontWeight: 700 }}>Ag</span> {style.name}</div>
          <IconButton icon="unlink" tip="Detach style" onClick={() => detachStyle('text')} testId="detach-text-style" />
        </div>
      ) : (
        <>
          <Select value={t((x) => x.fontFamily) as string} options={FONT_FAMILIES.map((f) => ({ value: f, label: f }))} onChange={(v) => set({ fontFamily: v })} testId="font-family" />
          <div className="grid2">
            <Select value={t((x) => x.fontWeight + (x.italic ? 0.5 : 0)) as number} testId="font-weight"
              options={FONT_WEIGHTS.flatMap((w) => [{ value: w.value, label: w.label }, { value: w.value + 0.5, label: w.label + ' Italic' }])}
              onChange={(v) => set({ fontWeight: Math.floor(v), italic: v % 1 !== 0 })} />
            <NumField label={<span style={{ fontSize: 10 }}>Aa</span>} value={t((x) => x.fontSize) as number} min={1} onChange={(v) => set({ fontSize: v })} testId="font-size" title="Font size" />
          </div>
          <div className="grid2">
            <NumField label={<span style={{ fontSize: 10 }}>↕A</span>} title="Line height" value={lh === 'AUTO' ? 0 : (lh as number | 'mixed')} onChange={(v) => set({ lineHeight: v <= 0 ? 'AUTO' : v })} testId="line-height" suffix={lh === 'AUTO' ? 'Auto' : undefined} />
            <NumField label={<span style={{ fontSize: 10 }}>|A|</span>} title="Letter spacing" value={t((x) => x.letterSpacing) as number} suffix="%" onChange={(v) => set({ letterSpacing: v })} testId="letter-spacing" />
          </div>
        </>
      )}
      <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
        <div className="seg">
          {(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'] as const).map((a) => (
            <button key={a} className={t((x) => x.textAlign) === a ? 'on' : ''} onClick={() => set({ textAlign: a })} data-tip={`Align ${a.toLowerCase()}`} data-testid={`text-align-${a.toLowerCase()}`}>
              <I name={a === 'LEFT' ? 'alignLeft' : a === 'CENTER' ? 'alignHCenter' : a === 'RIGHT' ? 'alignRight' : 'menu'} size={14} />
            </button>
          ))}
        </div>
        <div className="seg">
          {(['TOP', 'CENTER', 'BOTTOM'] as const).map((a) => (
            <button key={a} className={t((x) => x.verticalAlign) === a ? 'on' : ''} onClick={() => set({ verticalAlign: a })} data-tip={`Align ${a.toLowerCase()}`} data-testid={`text-valign-${a.toLowerCase()}`}>
              <I name={a === 'TOP' ? 'alignTop' : a === 'CENTER' ? 'alignVCenter' : 'alignBottom'} size={14} />
            </button>
          ))}
        </div>
        <IconButton icon="more" tip="Type settings" onClick={(e) => setDetails((e.currentTarget as HTMLElement).getBoundingClientRect())} testId="type-settings" />
      </div>
      <div className="seg" data-testid="text-resize">
        {([['WIDTH_AND_HEIGHT', 'Auto width'], ['HEIGHT', 'Auto height'], ['NONE', 'Fixed size'], ['TRUNCATE', 'Truncate']] as const).map(([v, l]) => (
          <button key={v} className={t((x) => x.autoResize) === v ? 'on' : ''} onClick={() => setProps(ids(nodes), (n) => { n.text!.autoResize = v; n.sizingH = v === 'WIDTH_AND_HEIGHT' ? 'HUG' : n.sizingH === 'HUG' ? 'FIXED' : n.sizingH; })} data-testid={`text-resize-${v.toLowerCase()}`}>{l}</button>
        ))}
      </div>
      {details ? (
        <Popover anchor={details} onClose={() => setDetails(null)} title="Type settings" testId="type-details">
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="prop-row"><span className="muted" style={{ width: 90 }}>Decoration</span>
              <div className="seg">{(['NONE', 'UNDERLINE', 'STRIKETHROUGH'] as const).map((d) => <button key={d} className={t((x) => x.decoration) === d ? 'on' : ''} onClick={() => set({ decoration: d })} data-testid={`deco-${d.toLowerCase()}`}>{d === 'NONE' ? '–' : d === 'UNDERLINE' ? <u>U</u> : <s>S</s>}</button>)}</div>
            </div>
            <div className="prop-row"><span className="muted" style={{ width: 90 }}>Case</span>
              <div className="seg">{(['ORIGINAL', 'UPPER', 'LOWER', 'TITLE'] as const).map((d) => <button key={d} className={t((x) => x.textCase) === d ? 'on' : ''} onClick={() => set({ textCase: d })} data-testid={`case-${d.toLowerCase()}`}>{d === 'ORIGINAL' ? '–' : d === 'UPPER' ? 'AG' : d === 'LOWER' ? 'ag' : 'Ag'}</button>)}</div>
            </div>
            <div className="prop-row"><span className="muted" style={{ width: 90 }}>List style</span>
              <div className="seg">{(['NONE', 'BULLET', 'NUMBER'] as const).map((d) => <button key={d} className={t((x) => x.listType) === d ? 'on' : ''} onClick={() => set({ listType: d })} data-testid={`list-${d.toLowerCase()}`}>{d === 'NONE' ? '–' : d === 'BULLET' ? '•' : '1.'}</button>)}</div>
            </div>
            <div className="prop-row"><span className="muted" style={{ width: 90 }}>Paragraph spacing</span><div className="grow"><NumField value={t((x) => x.paragraphSpacing) as number} min={0} onChange={(v) => set({ paragraphSpacing: v })} testId="paragraph-spacing" /></div></div>
            <div className="prop-row"><span className="muted" style={{ width: 90 }}>Link</span><input className="input" placeholder="https://" defaultValue={nodes[0].text!.link ?? ''} onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => set({ link: e.target.value || undefined })} /></div>
          </div>
        </Popover>
      ) : null}
      {styleMenu ? <Menu x={styleMenu.x} y={styleMenu.y} onClose={() => setStyleMenu(null)} items={[
        { header: 'Text styles' },
        ...textStyles.map((s): MenuItem => ({ label: `${s.name}  ${s.text?.fontSize ?? ''}/${s.text?.fontWeight ?? ''}`, onClick: () => applyStyle(s.id, ids(nodes)) })),
        { separator: true },
        { label: 'Create text style', onClick: () => createStyle('TEXT', nodes[0].id), testId: 'create-text-style' },
      ]} /> : null}
    </Section>
  );
}

/* ----------------------------------------------------------------- fills & strokes */

function PaintSection({ nodes, kind }: { nodes: SceneNode[]; kind: 'fills' | 'strokes' }) {
  const doc = useEditor((s) => s.doc!);
  const [picker, setPicker] = useState<{ index: number; rect: DOMRect } | null>(null);
  const [styleMenu, setStyleMenu] = useState<{ x: number; y: number } | null>(null);
  const [strokeMore, setStrokeMore] = useState<DOMRect | null>(null);
  const paintsVal = mixed(nodes, (n) => n[kind]);
  const isMixed = paintsVal === 'mixed';
  const paints = isMixed ? [] : (paintsVal as Paint[]);
  const styleKey = kind === 'fills' ? 'fillStyleId' : 'strokeStyleId';
  const styleId = mixed(nodes, (n) => n[styleKey] ?? null);
  const style = typeof styleId === 'string' ? doc.styles.find((s) => s.id === styleId) : null;
  const setPaints = (fn: (p: Paint[]) => Paint[], commit = true) => setProps(ids(nodes), (n) => { n[kind] = fn(JSON.parse(JSON.stringify(n[kind]))); delete n[styleKey]; }, { commit });
  const add = () => {
    if (isMixed) { setProps(ids(nodes), (n) => { n[kind] = [solid(kind === 'fills' ? '#D9D9D9' : '#000000')]; }); return; }
    setPaints((p) => [...p, solid(kind === 'fills' ? (p.length ? '#FFFFFF' : '#D9D9D9') : '#000000', kind === 'fills' && p.length ? 0.5 : 1)]);
    if (kind === 'strokes') setProps(ids(nodes), (n) => { if (!n.strokeWeight) n.strokeWeight = 1; });
  };
  const colorStyles = doc.styles.filter((s) => s.type === 'FILL');
  const title = kind === 'fills' ? 'Fill' : 'Stroke';
  const isLine = nodes.every((n) => n.type === 'LINE' || (n.type === 'VECTOR' && !n.closed));
  return (
    <Section title={title} testId={`${kind}-section`}
      actions={<>
        <IconButton icon="styles" tip="Apply styles and variables" testId={`${kind}-styles-btn`} onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setStyleMenu({ x: r.left - 200, y: r.bottom }); }} />
        <IconButton icon="plus" tip={`Add ${title.toLowerCase()}`} onClick={add} testId={`add-${kind}`} />
      </>}>
      {isMixed ? <div className="faint">Click + to replace mixed {kind}</div> : null}
      {style ? (
        <div className="row">
          <div className="var-chip" data-testid={`${kind}-style-chip`}><Swatch paint={style.fills?.[0]} /> {style.name}</div>
          <IconButton icon="unlink" tip="Detach style" onClick={() => detachStyle(kind === 'fills' ? 'fill' : 'stroke')} testId={`detach-${kind}-style`} />
        </div>
      ) : [...paints].map((p, i) => ({ p, i })).reverse().map(({ p, i }) => {
        const variable = p.variableId ? doc.variables.find((v) => v.id === p.variableId) : null;
        return (
          <div key={p.id} className="paint-row" data-testid={`${kind}-row-${i}`}>
            {variable ? (
              <div className="var-chip" data-testid={`${kind}-var-chip`}>
                <button onClick={(e) => setPicker({ index: i, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}><Swatch paint={p} /></button>
                {variable.name}
              </div>
            ) : (
              <div className="paint-chip" style={{ opacity: p.visible ? 1 : 0.5 }} data-popover-keep>
                <button onClick={(e) => setPicker({ index: i, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })} data-testid={`${kind}-swatch-${i}`}><Swatch paint={p} /></button>
                {p.type === 'SOLID' ? (
                  <input key={p.color} defaultValue={p.color.replace('#', '')} data-testid={`${kind}-hex-${i}`}
                    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    onBlur={(e) => { const h = normalizeHex(e.target.value); if (h && h !== p.color) setPaints((ps) => ps.map((x, j) => (j === i ? { ...x, color: h } : x))); else e.target.value = p.color.replace('#', ''); }} />
                ) : <span className="grow" onClick={(e) => setPicker({ index: i, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}>{p.type === 'IMAGE' ? 'Image' : p.type.replace('GRADIENT_', '').charAt(0) + p.type.replace('GRADIENT_', '').slice(1).toLowerCase()}</span>}
                <span className="pct"><NumInline value={p.opacity} onChange={(v) => setPaints((ps) => ps.map((x, j) => (j === i ? { ...x, opacity: v } : x)))} testId={`${kind}-opacity-${i}`} /></span>
              </div>
            )}
            {variable ? <IconButton icon="unlink" tip="Detach variable" onClick={() => setPaints((ps) => ps.map((x, j) => (j === i ? { ...x, variableId: undefined } : x)))} testId={`detach-${kind}-var`} /> : null}
            <IconButton icon={p.visible ? 'eye' : 'eyeOff'} tip={p.visible ? 'Hide' : 'Show'} onClick={() => setPaints((ps) => ps.map((x, j) => (j === i ? { ...x, visible: !x.visible } : x)))} testId={`${kind}-visible-${i}`} />
            <IconButton icon="minus" tip="Remove" onClick={() => setPaints((ps) => ps.filter((_, j) => j !== i))} testId={`remove-${kind}-${i}`} />
          </div>
        );
      })}
      {kind === 'strokes' && (paints.length > 0 || style) ? (
        <>
          <div className="row" style={{ gap: 4 }}>
            {!isLine && nodes.every((n) => n.type !== 'TEXT') ? (
              <div style={{ width: 96 }}><Select value={mixed(nodes, (n) => n.strokeAlign)} options={[{ value: 'INSIDE', label: 'Inside' }, { value: 'CENTER', label: 'Center' }, { value: 'OUTSIDE', label: 'Outside' }]} onChange={(v) => setProps(ids(nodes), { strokeAlign: v })} testId="stroke-align" /></div>
            ) : null}
            <div className="grow"><NumField icon="stroke" min={0} value={mixed(nodes, (n) => n.strokeWeight)} onChange={(v) => setProps(ids(nodes), { strokeWeight: v })} testId="stroke-weight" title="Stroke weight" /></div>
            <IconButton icon="more" tip="Advanced stroke" onClick={(e) => setStrokeMore((e.currentTarget as HTMLElement).getBoundingClientRect())} testId="stroke-more" />
          </div>
          {isLine ? (
            <div className="grid2">
              <Select value={mixed(nodes, (n) => n.startCap ?? 'NONE')} options={[{ value: 'NONE', label: 'Start: None' }, { value: 'ARROW', label: 'Start: Arrow' }, { value: 'TRIANGLE', label: 'Start: Triangle' }, { value: 'CIRCLE', label: 'Start: Circle' }]} onChange={(v) => setProps(ids(nodes), { startCap: v })} testId="start-cap" />
              <Select value={mixed(nodes, (n) => n.endCap ?? 'NONE')} options={[{ value: 'NONE', label: 'End: None' }, { value: 'ARROW', label: 'End: Arrow' }, { value: 'TRIANGLE', label: 'End: Triangle' }, { value: 'CIRCLE', label: 'End: Circle' }]} onChange={(v) => setProps(ids(nodes), { endCap: v })} testId="end-cap" />
            </div>
          ) : null}
        </>
      ) : null}
      {strokeMore ? (
        <Popover anchor={strokeMore} onClose={() => setStrokeMore(null)} title="Stroke settings" testId="stroke-settings">
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="prop-row"><span className="muted" style={{ width: 70 }}>Style</span>
              <div className="grow"><Select value={nodes[0].strokeDash.length ? 'DASH' : 'SOLID'} options={[{ value: 'SOLID', label: 'Solid' }, { value: 'DASH', label: 'Dash' }]} onChange={(v) => setProps(ids(nodes), { strokeDash: v === 'DASH' ? [4, 4] : [] })} testId="stroke-style" /></div>
            </div>
            {nodes[0].strokeDash.length ? (
              <div className="grid2">
                <NumField label="D" title="Dash" value={nodes[0].strokeDash[0]} min={0} onChange={(v) => setProps(ids(nodes), (n) => { n.strokeDash = [v, n.strokeDash[1] ?? v]; })} testId="dash-length" />
                <NumField label="G" title="Gap" value={nodes[0].strokeDash[1] ?? 4} min={0} onChange={(v) => setProps(ids(nodes), (n) => { n.strokeDash = [n.strokeDash[0] ?? 4, v]; })} testId="dash-gap" />
              </div>
            ) : null}
            <div className="prop-row"><span className="muted" style={{ width: 70 }}>Cap</span>
              <div className="grow"><Select value={nodes[0].strokeCap} options={[{ value: 'NONE', label: 'None' }, { value: 'ROUND', label: 'Round' }, { value: 'SQUARE', label: 'Square' }]} onChange={(v) => setProps(ids(nodes), { strokeCap: v })} testId="stroke-cap" /></div>
            </div>
          </div>
        </Popover>
      ) : null}
      {picker && paints[picker.index] ? (
        <PaintPicker paint={paints[picker.index]} anchor={picker.rect} onClose={() => setPicker(null)} allowImage={kind === 'fills'}
          onChange={(np) => setPaints((ps) => ps.map((x, j) => (j === picker.index ? np : x)))}
          onPickStyle={(sid) => applyStyle(sid, ids(nodes), kind === 'fills' ? 'fill' : 'stroke')}
          onPickVariable={(vid) => setPaints((ps) => ps.map((x, j) => (j === picker.index ? { ...x, type: 'SOLID', variableId: vid, color: String(resolveVariable(currentDoc(), vid, nodes[0].id) ?? x.color) } : x)))} />
      ) : null}
      {styleMenu ? <Menu x={styleMenu.x} y={styleMenu.y} onClose={() => setStyleMenu(null)} items={[
        { header: 'Color styles' },
        ...colorStyles.map((s): MenuItem => ({ label: s.name, onClick: () => applyStyle(s.id, ids(nodes), kind === 'fills' ? 'fill' : 'stroke'), testId: `apply-style-${s.name}` })),
        { header: 'Color variables' },
        ...doc.variables.filter((v) => v.type === 'COLOR').map((v): MenuItem => ({ label: v.name, testId: `apply-var-${v.name}`, onClick: () => setProps(ids(nodes), (n) => {
          const list = n[kind].length ? n[kind] : [solid('#000000')];
          list[list.length - 1] = { ...list[list.length - 1], type: 'SOLID', variableId: v.id };
          n[kind] = list;
        }) })),
        { separator: true },
        { label: `Create ${kind === 'fills' ? 'color' : 'color'} style`, onClick: () => { const n = nodes[0]; const sid = createStyle('FILL', undefined); S().update((d) => { const st = d.styles.find((x) => x.id === sid)!; st.fills = JSON.parse(JSON.stringify(n[kind])); }); applyStyle(sid, ids(nodes), kind === 'fills' ? 'fill' : 'stroke'); }, testId: `create-style-from-${kind}` },
      ]} /> : null}
    </Section>
  );
}

function NumInline({ value, onChange, testId }: { value: number; onChange: (v: number) => void; testId?: string }) {
  const [t, setT] = useState(String(Math.round(value * 100)));
  React.useEffect(() => setT(String(Math.round(value * 100))), [value]);
  return (
    <input style={{ width: '100%', textAlign: 'right' }} value={t + '%'} data-testid={testId} onChange={(e) => setT(e.target.value.replace('%', ''))}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      onBlur={() => { const v = parseFloat(t); if (!isNaN(v)) onChange(Math.max(0, Math.min(100, v)) / 100); }} />
  );
}

/* ----------------------------------------------------------------- effects */

const EFFECT_LABEL: Record<EffectType, string> = { DROP_SHADOW: 'Drop shadow', INNER_SHADOW: 'Inner shadow', LAYER_BLUR: 'Layer blur', BACKGROUND_BLUR: 'Background blur' };

function EffectsSection({ nodes }: { nodes: SceneNode[] }) {
  const doc = useEditor((s) => s.doc!);
  const [edit, setEdit] = useState<{ index: number; rect: DOMRect } | null>(null);
  const [styleMenu, setStyleMenu] = useState<{ x: number; y: number } | null>(null);
  const val = mixed(nodes, (n) => n.effects);
  const effects = val === 'mixed' ? [] : (val as Effect[]);
  const styleId = mixed(nodes, (n) => n.effectStyleId ?? null);
  const style = typeof styleId === 'string' ? doc.styles.find((s) => s.id === styleId) : null;
  const setEffects = (fn: (e: Effect[]) => Effect[]) => setProps(ids(nodes), (n) => { n.effects = fn(JSON.parse(JSON.stringify(n.effects))); delete n.effectStyleId; });
  return (
    <Section title="Effects" testId="effects-section" actions={<>
      <IconButton icon="styles" tip="Effect styles" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setStyleMenu({ x: r.left - 200, y: r.bottom }); }} testId="effect-styles-btn" />
      <IconButton icon="plus" tip="Add effect" onClick={() => setEffects((e) => [...e, newEffect('DROP_SHADOW')])} testId="add-effect" />
    </>}>
      {style ? (
        <div className="row"><div className="var-chip"><I name="effect" size={14} /> {style.name}</div><IconButton icon="unlink" tip="Detach style" onClick={() => detachStyle('effect')} /></div>
      ) : effects.map((e, i) => (
        <div key={e.id} className="paint-row" data-testid={`effect-row-${i}`}>
          <IconButton icon="effect" tip="Effect settings" onClick={(ev) => setEdit({ index: i, rect: (ev.currentTarget as HTMLElement).getBoundingClientRect() })} testId={`effect-settings-${i}`} />
          <div className="grow"><Select value={e.type} options={Object.entries(EFFECT_LABEL).map(([v, l]) => ({ value: v as EffectType, label: l }))} onChange={(v) => setEffects((es) => es.map((x, j) => (j === i ? { ...x, type: v, ...(v === 'LAYER_BLUR' || v === 'BACKGROUND_BLUR' ? { x: 0, y: 0 } : {}) } : x)))} testId={`effect-type-${i}`} /></div>
          <IconButton icon={e.visible ? 'eye' : 'eyeOff'} tip="Toggle visibility" onClick={() => setEffects((es) => es.map((x, j) => (j === i ? { ...x, visible: !x.visible } : x)))} />
          <IconButton icon="minus" tip="Remove effect" onClick={() => setEffects((es) => es.filter((_, j) => j !== i))} testId={`remove-effect-${i}`} />
        </div>
      ))}
      {edit && effects[edit.index] ? (
        <Popover anchor={edit.rect} onClose={() => setEdit(null)} title={EFFECT_LABEL[effects[edit.index].type]} testId="effect-popover">
          <EffectEditor e={effects[edit.index]} onChange={(ne) => setEffects((es) => es.map((x, j) => (j === edit.index ? ne : x)))} />
        </Popover>
      ) : null}
      {styleMenu ? <Menu x={styleMenu.x} y={styleMenu.y} onClose={() => setStyleMenu(null)} items={[
        { header: 'Effect styles' },
        ...doc.styles.filter((s) => s.type === 'EFFECT').map((s): MenuItem => ({ label: s.name, onClick: () => applyStyle(s.id, ids(nodes)) })),
        { separator: true },
        { label: 'Create effect style', onClick: () => createStyle('EFFECT', nodes[0].id), testId: 'create-effect-style' },
      ]} /> : null}
    </Section>
  );
}

function EffectEditor({ e, onChange }: { e: Effect; onChange: (e: Effect) => void }) {
  const blurOnly = e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR';
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!blurOnly ? (
        <div className="grid2">
          <NumField label="X" value={e.x} onChange={(v) => onChange({ ...e, x: v })} testId="effect-x" />
          <NumField label="Y" value={e.y} onChange={(v) => onChange({ ...e, y: v })} testId="effect-y" />
        </div>
      ) : null}
      <div className="grid2">
        <NumField label="B" title="Blur" value={e.blur} min={0} onChange={(v) => onChange({ ...e, blur: v })} testId="effect-blur" />
        {!blurOnly ? <NumField label="S" title="Spread" value={e.spread} onChange={(v) => onChange({ ...e, spread: v })} testId="effect-spread" /> : null}
      </div>
      {!blurOnly ? <SolidEditor color={e.color} opacity={e.opacity} onChange={(c, o) => onChange({ ...e, color: c, opacity: o })} /> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- layout grids */

function GridSection({ nodes }: { nodes: SceneNode[] }) {
  const [edit, setEdit] = useState<{ index: number; rect: DOMRect } | null>(null);
  const val = mixed(nodes, (n) => n.layoutGrids);
  const grids = val === 'mixed' ? [] : (val as LayoutGrid[]);
  const setGrids = (fn: (g: LayoutGrid[]) => LayoutGrid[]) => setProps(ids(nodes), (n) => { n.layoutGrids = fn(JSON.parse(JSON.stringify(n.layoutGrids))); delete n.gridStyleId; });
  return (
    <Section title="Layout guide" testId="grid-section" actions={<IconButton icon="plus" tip="Add layout guide" onClick={() => setGrids((g) => [...g, newGrid('GRID')])} testId="add-grid" />}>
      {grids.map((g, i) => (
        <div key={g.id} className="paint-row" data-testid={`grid-row-${i}`}>
          <IconButton icon={g.pattern === 'GRID' ? 'grid' : g.pattern === 'COLUMNS' ? 'columns' : 'rows'} tip="Layout guide settings" onClick={(e) => setEdit({ index: i, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })} testId={`grid-settings-${i}`} />
          <span className="grow">{g.pattern === 'GRID' ? `Grid ${g.size}px` : `${g.count} ${g.pattern === 'COLUMNS' ? 'columns' : 'rows'}`}</span>
          <IconButton icon={g.visible ? 'eye' : 'eyeOff'} tip="Toggle" onClick={() => setGrids((gs) => gs.map((x, j) => (j === i ? { ...x, visible: !x.visible } : x)))} />
          <IconButton icon="minus" tip="Remove" onClick={() => setGrids((gs) => gs.filter((_, j) => j !== i))} testId={`remove-grid-${i}`} />
        </div>
      ))}
      {edit && grids[edit.index] ? (
        <Popover anchor={edit.rect} onClose={() => setEdit(null)} title="Layout guide" testId="grid-popover">
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(() => {
              const g = grids[edit.index];
              const up = (p: Partial<LayoutGrid>) => setGrids((gs) => gs.map((x, j) => (j === edit.index ? { ...x, ...p } : x)));
              return (
                <>
                  <Select value={g.pattern} options={[{ value: 'GRID', label: 'Grid' }, { value: 'COLUMNS', label: 'Columns' }, { value: 'ROWS', label: 'Rows' }]} onChange={(v) => up({ pattern: v, count: v === 'GRID' ? 0 : g.count || 5, color: v === 'ROWS' ? '#0D99FF' : '#FF0000' })} testId="grid-pattern" />
                  {g.pattern === 'GRID' ? <NumField label="Size" value={g.size} min={1} onChange={(v) => up({ size: v })} testId="grid-size" /> : (
                    <div className="grid3">
                      <NumField label="#" title="Count" value={g.count} min={1} decimals={0} onChange={(v) => up({ count: Math.round(v) })} testId="grid-count" />
                      <NumField label="G" title="Gutter" value={g.gutter} min={0} onChange={(v) => up({ gutter: v })} testId="grid-gutter" />
                      <NumField label="M" title="Margin" value={g.margin} min={0} onChange={(v) => up({ margin: v })} testId="grid-margin" />
                    </div>
                  )}
                  <SolidEditor color={g.color} opacity={g.opacity} onChange={(c, o) => up({ color: c, opacity: o })} />
                </>
              );
            })()}
          </div>
        </Popover>
      ) : null}
    </Section>
  );
}

/* ----------------------------------------------------------------- selection colors */

function SelectionColors({ nodes }: { nodes: SceneNode[] }) {
  const doc = useEditor((s) => s.doc!);
  const [picker, setPicker] = useState<{ color: string; rect: DOMRect } | null>(null);
  const all = new Set<string>();
  for (const n of nodes) for (const id of [n.id, ...descendants(doc, n.id)]) {
    const x = doc.nodes[id];
    if (!x) continue;
    for (const p of [...x.fills, ...x.strokes]) if (p.type === 'SOLID' && p.visible) all.add(p.color.toUpperCase());
  }
  if (all.size < 2 && !(nodes.length === 1 && nodes[0].children.length && all.size >= 1)) return null;
  const replace = (from: string, to: string) => {
    const targets = nodes.flatMap((n) => [n.id, ...descendants(doc, n.id)]);
    setProps(targets, (x) => {
      x.fills = x.fills.map((p) => (p.type === 'SOLID' && p.color.toUpperCase() === from ? { ...p, color: to } : p));
      x.strokes = x.strokes.map((p) => (p.type === 'SOLID' && p.color.toUpperCase() === from ? { ...p, color: to } : p));
    });
  };
  return (
    <Section title="Selection colors" testId="selection-colors">
      {[...all].slice(0, 12).map((c) => (
        <div key={c} className="paint-chip" data-testid={`sel-color-${c}`}>
          <button onClick={(e) => setPicker({ color: c, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}><Swatch paint={solid(c)} /></button>
          <input defaultValue={c.replace('#', '')} key={c} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { const h = normalizeHex((e.target as HTMLInputElement).value); if (h) replace(c, h); } }} />
        </div>
      ))}
      {picker ? <PaintPicker paint={solid(picker.color)} anchor={picker.rect} allowImage={false} onClose={() => setPicker(null)} onChange={(p) => { replace(picker.color, p.color.toUpperCase()); setPicker({ ...picker, color: p.color.toUpperCase() }); }} /> : null}
    </Section>
  );
}

/* ----------------------------------------------------------------- export */

function ExportSection({ nodes }: { nodes: SceneNode[] }) {
  const [preview, setPreview] = useState(false);
  const val = mixed(nodes, (n) => n.exports);
  const exps = val === 'mixed' ? [] : (val as SceneNode['exports']);
  const setExps = (fn: (e: SceneNode['exports']) => SceneNode['exports']) => setProps(ids(nodes), (n) => { n.exports = fn(JSON.parse(JSON.stringify(n.exports))); });
  const doExport = async () => {
    const doc = currentDoc();
    let count = 0;
    for (const n of nodes) {
      const settings = exps.length ? exps : [{ id: 'd', scale: 1, suffix: '', format: 'PNG' as const }];
      for (const st of settings) {
        const { blob, filename } = await exportNode(doc, n.id, st);
        downloadBlob(blob, filename);
        count++;
      }
    }
    S().toast(`Exported ${count} file${count > 1 ? 's' : ''}`);
  };
  const previewUrl = preview && nodes.length === 1 ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(nodeToSvgString(currentDoc(), nodes[0].id).svg) : null;
  return (
    <Section title="Export" testId="export-section" actions={<IconButton icon="plus" tip="Add export settings" onClick={() => setExps((e) => [...e, { ...exportSetting(), scale: e.length ? 2 : 1, suffix: '' }])} testId="add-export" />}>
      {exps.map((e, i) => (
        <div key={e.id} className="paint-row" data-testid={`export-row-${i}`}>
          <div style={{ width: 64 }}><Select value={e.scale} options={[0.5, 0.75, 1, 1.5, 2, 3, 4].map((s) => ({ value: s, label: `${s}x` }))} onChange={(v) => setExps((es) => es.map((x, j) => (j === i ? { ...x, scale: v } : x)))} testId={`export-scale-${i}`} /></div>
          <input className="input grow" placeholder="Suffix" defaultValue={e.suffix} onKeyDown={(ev) => ev.stopPropagation()} onBlur={(ev) => setExps((es) => es.map((x, j) => (j === i ? { ...x, suffix: ev.target.value } : x)))} />
          <div style={{ width: 64 }}><Select value={e.format} options={['PNG', 'JPG', 'SVG', 'PDF'].map((f) => ({ value: f as 'PNG', label: f }))} onChange={(v) => setExps((es) => es.map((x, j) => (j === i ? { ...x, format: v } : x)))} testId={`export-format-${i}`} /></div>
          <IconButton icon="minus" tip="Remove" onClick={() => setExps((es) => es.filter((_, j) => j !== i))} testId={`remove-export-${i}`} />
        </div>
      ))}
      <button className="btn" onClick={doExport} data-testid="export-btn">Export {nodes.length === 1 ? nodes[0].name : `${nodes.length} layers`}</button>
      {nodes.length === 1 ? (
        <>
          <button className="row muted" onClick={() => setPreview(!preview)} data-testid="export-preview-toggle"><I name={preview ? 'chevronDown' : 'chevronRight'} size={12} /> Preview</button>
          {previewUrl ? <div style={{ background: 'var(--bg-2)', borderRadius: 6, padding: 8, display: 'flex', justifyContent: 'center' }}><img src={previewUrl} style={{ maxWidth: '100%', maxHeight: 160 }} alt="preview" data-testid="export-preview" /></div> : null}
        </>
      ) : null}
      <span style={{ display: 'none' }}>{fmt(0)}{uid.name}</span>
    </Section>
  );
}

/* ----------------------------------------------------------------- number variable binding */

type BindField = 'cornerRadius' | 'gap' | 'padding' | 'width' | 'height' | 'opacity';

function Bindable({ nodes, field, children }: { nodes: SceneNode[]; field: BindField; children: React.ReactNode }) {
  const variables = useEditor((s) => s.doc!.variables);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const bound = mixed(nodes, (n) => n.boundVars?.[field] ?? null);
  const v = typeof bound === 'string' ? variables.find((x) => x.id === bound) : undefined;
  const numVars = variables.filter((x) => x.type === 'NUMBER');
  const bind = (varId: string | null) => setProps(ids(nodes), (n) => {
    const b = { ...(n.boundVars ?? {}) };
    if (varId) b[field] = varId; else delete b[field];
    n.boundVars = b;
  });
  return (
    <div className="row" style={{ gap: 2, minWidth: 0 }}>
      <div className="grow" style={{ minWidth: 0 }}>
        {v ? <div className="var-chip" data-testid={`bound-${field}`} title={`Bound to ${v.name}`}><I name="variable" size={12} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span></div> : children}
      </div>
      {v ? (
        <IconButton icon="unlink" size={14} tip="Detach variable" onClick={() => bind(null)} testId={`unbind-${field}`} />
      ) : numVars.length ? (
        <span data-menu-anchor><IconButton icon="variable" size={14} tip="Apply variable" testId={`bind-${field}`} onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenu({ x: r.left - 160, y: r.bottom + 4 }); }} /></span>
      ) : null}
      {menu ? <Menu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={[
        { header: 'Number variables' },
        ...numVars.map((nv): MenuItem => ({ label: nv.name, testId: `bind-var-${nv.name}`, onClick: () => bind(nv.id) })),
      ]} /> : null}
    </div>
  );
}
