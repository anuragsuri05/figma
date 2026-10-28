import React, { useState } from 'react';
import { useEditor, S, setProps } from '../store/editor';
import { useSelNodes } from './RightPanel';
import { toCss, toTailwind, toSwiftUI, toCompose, paintToCss } from '../model/codegen';
import { IconButton, Section, Select, Swatch } from './ui';
import { I } from './icons';
import { exportNode, downloadBlob } from '../render/export';
import { uid } from '../model/defaults';
import { parseVariantName } from '../store/editor';
import type { SceneNode } from '../model/types';
import { resolveLineHeight } from '../model/text';
import { descendants } from '../model/tree';

type Lang = 'CSS' | 'TAILWIND' | 'SWIFTUI' | 'COMPOSE';

function highlight(code: string) {
  return code.split('\n').map((line, i) => {
    const m = line.match(/^(\s*)([\w-]+)(:)(.*)$/);
    if (m && !line.trim().startsWith('/*')) return <div key={i}>{m[1]}<span className="k">{m[2]}</span>{m[3]}<span className="v">{m[4]}</span></div>;
    return <div key={i}>{line || ' '}</div>;
  });
}

export function DevPanel() {
  const nodes = useSelNodes();
  const doc = useEditor((s) => s.doc!);
  const page = useEditor((s) => s.doc!.pages.find((p) => p.id === s.pageId)!);
  const [lang, setLang] = useState<Lang>('CSS');
  const [note, setNote] = useState('');
  if (!nodes.length) {
    const ready = Object.values(doc.nodes).filter((n) => n.devStatus === 'READY' || n.devStatus === 'COMPLETED');
    return (
      <div data-testid="dev-panel">
        <Section title={<span className="row"><span className="dev-badge"><I name="code" size={12} /> Dev Mode</span></span>}>
          <div className="muted">Select a layer to inspect its properties, code and assets.</div>
        </Section>
        <Section title="Ready for development">
          {ready.length === 0 ? <div className="faint">No designs are marked ready for dev on this file.</div> : null}
          {ready.map((n) => (
            <button key={n.id} className="qa-item" style={{ width: '100%' }} onClick={() => S().select([n.id])}>
              <span className="ready-chip"><I name="check" size={14} /></span> {n.name} <span className="faint" style={{ marginLeft: 'auto' }}>{n.devStatus === 'COMPLETED' ? 'Completed' : 'Ready'}</span>
            </button>
          ))}
        </Section>
        <Section title="Page">
          <div className="row"><Swatch paint={{ id: '', type: 'SOLID', color: page.background, opacity: 1, visible: true }} /> {page.background}</div>
        </Section>
      </div>
    );
  }
  const n = nodes[0];
  const code = lang === 'CSS' ? toCss(doc, n) : lang === 'TAILWIND' ? toTailwind(doc, n) : lang === 'SWIFTUI' ? toSwiftUI(doc, n) : toCompose(doc, n);
  const copy = () => { navigator.clipboard?.writeText(code).catch(() => {}); S().toast('Copied to clipboard'); };
  const isTop = !n.parentId || doc.nodes[n.parentId]?.type === 'SECTION';
  const colors = new Map<string, { label: string; css: string }>();
  for (const id of [n.id, ...descendants(doc, n.id)].slice(0, 200)) {
    const x = doc.nodes[id];
    if (x.parentId && doc.nodes[x.parentId]?.type === 'BOOLEAN_OPERATION') continue;
    for (const p of [...x.fills, ...x.strokes]) {
      if (!p.visible || p.type !== 'SOLID') continue;
      const v = p.variableId ? doc.variables.find((vv) => vv.id === p.variableId) : null;
      const st = p.styleId ? doc.styles.find((s) => s.id === p.styleId) : null;
      const css = paintToCss(doc, p);
      colors.set(css + (v?.id ?? ''), { label: v?.name ?? st?.name ?? (p.opacity < 1 ? `${p.color} · ${Math.round(p.opacity * 100)}%` : p.color), css });
    }
  }
  const textNodes = [n, ...descendants(doc, n.id).map((id) => doc.nodes[id])].filter((x) => x.type === 'TEXT').slice(0, 10);
  const main = n.type === 'INSTANCE' && n.mainComponentId ? doc.nodes[n.mainComponentId] : null;
  return (
    <div data-testid="dev-panel">
      <Section title={<span className="row" style={{ gap: 6 }}><I name={n.type === 'TEXT' ? 'text' : n.type === 'INSTANCE' ? 'instance' : 'frame'} size={16} /> <span data-testid="dev-name">{n.name}</span></span>}>
        {isTop ? (
          <div className="row">
            {n.devStatus === 'READY' ? <span className="ready-chip" data-testid="ready-status"><I name="check" size={14} /> Ready for dev</span> : n.devStatus === 'COMPLETED' ? <span className="ready-chip">✓ Completed</span> : <span className="faint">No status</span>}
            <span className="spacer" />
            <Select value={n.devStatus ?? 'NONE'} options={[{ value: 'NONE', label: 'No status' }, { value: 'READY', label: 'Ready for dev' }, { value: 'COMPLETED', label: 'Completed' }]} onChange={(v) => setProps([n.id], { devStatus: v === 'NONE' ? null : v })} testId="dev-status" style={{ width: 120 }} />
          </div>
        ) : null}
        <div className="grid2">
          <div><span className="faint">Width</span><div data-testid="dev-width">{Math.round(n.width * 100) / 100}px</div></div>
          <div><span className="faint">Height</span><div data-testid="dev-height">{Math.round(n.height * 100) / 100}px</div></div>
          <div><span className="faint">Top</span><div>{Math.round(n.y * 100) / 100}px</div></div>
          <div><span className="faint">Left</span><div>{Math.round(n.x * 100) / 100}px</div></div>
          {n.cornerRadius ? <div><span className="faint">Radius</span><div>{n.cornerRadius}px</div></div> : null}
          {n.opacity < 1 ? <div><span className="faint">Opacity</span><div>{Math.round(n.opacity * 100)}%</div></div> : null}
        </div>
      </Section>
      {main ? (
        <Section title="Component">
          <div className="row" style={{ color: 'var(--component)' }}><I name="componentFill" size={14} /> {main.parentId && doc.nodes[main.parentId]?.type === 'COMPONENT_SET' ? doc.nodes[main.parentId].name : main.name}</div>
          {Object.entries(parseVariantName(main.name)).map(([k, v]) => <div key={k} className="row"><span className="muted" style={{ width: 90 }}>{k}</span>{v}</div>)}
          {main.componentDescription ? <div className="muted">{main.componentDescription}</div> : null}
        </Section>
      ) : null}
      <Section title="Code" actions={<IconButton icon="check" tip="Copy code" onClick={copy} testId="copy-code" />} testId="code-section">
        <Select value={lang} options={[{ value: 'CSS', label: 'CSS' }, { value: 'TAILWIND', label: 'Tailwind' }, { value: 'SWIFTUI', label: 'iOS (SwiftUI)' }, { value: 'COMPOSE', label: 'Android (Compose)' }]} onChange={setLang} testId="code-lang" />
        <div className="code-block" data-testid="code-block">{highlight(code)}</div>
      </Section>
      {textNodes.length ? (
        <Section title="Typography">
          {textNodes.map((t) => (
            <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0' }}>
              <span style={{ fontWeight: 600 }}>{t.textStyleId ? doc.styles.find((s) => s.id === t.textStyleId)?.name : t.text!.fontFamily}</span>
              <span className="muted">{t.text!.fontFamily} · {t.text!.fontWeight} · {t.text!.fontSize}px / {Math.round(resolveLineHeight(t.text!) * 100) / 100}px</span>
            </div>
          ))}
        </Section>
      ) : null}
      {colors.size ? (
        <Section title="Colors">
          {[...colors.values()].map((c) => (
            <div key={c.label + c.css} className="row" style={{ height: 24 }}>
              <span className="swatch"><i style={{ background: c.css }} /></span>
              <span className="grow" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
              <span className="faint" title={c.css} style={{ fontFamily: 'Source Code Pro, monospace', fontSize: 10, flex: 'none', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.css}</span>
            </div>
          ))}
        </Section>
      ) : null}
      <Section title="Assets" testId="dev-assets">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {(['PNG', 'SVG', 'JPG', 'PDF'] as const).map((f) => (
            <button key={f} className="btn small" data-testid={`dev-export-${f}`} onClick={async () => { const { blob, filename } = await exportNode(doc, n.id, { format: f, scale: f === 'PNG' ? 2 : 1, suffix: '' }); downloadBlob(blob, filename); }}>
              <I name="export" size={14} /> {f}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Annotations" testId="annotations-section">
        {(n.annotations ?? []).map((a) => (
          <div key={a.id} className="row" style={{ alignItems: 'flex-start' }}>
            <I name="annotate" size={14} />
            <span className="grow" data-testid="annotation-text">{a.text}</span>
            <IconButton icon="minus" tip="Delete annotation" onClick={() => setProps([n.id], (x) => { x.annotations = (x.annotations ?? []).filter((y) => y.id !== a.id); })} />
          </div>
        ))}
        <div className="row">
          <input className="input" placeholder="Add an annotation…" value={note} onChange={(e) => setNote(e.target.value)} data-testid="annotation-input"
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && note.trim()) { setProps([n.id], (x) => { x.annotations = [...(x.annotations ?? []), { id: uid('a'), text: note.trim() }]; }); setNote(''); } }} />
        </div>
      </Section>
      <span style={{ display: 'none' }}>{(null as unknown as SceneNode)?.id}</span>
    </div>
  );
}
