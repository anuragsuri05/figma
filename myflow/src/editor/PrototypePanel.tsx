import React, { useState } from 'react';
import { useEditor, S, setProps, ensureFlowStart, removeFlowStart } from '../store/editor';
import type { ActionType, AnimationType, Easing, Reaction, SceneNode, Trigger } from '../model/types';
import { reaction as newReaction } from '../model/defaults';
import { IconButton, NumField, Section, Select, Swatch } from './ui';
import { I } from './icons';
import { openPresent } from '../commands';
import { useSelNodes } from './RightPanel';
import { solid } from '../model/defaults';
import { normalizeHex } from '../model/color';

export const TRIGGERS: { value: Trigger; label: string }[] = [
  { value: 'ON_CLICK', label: 'On click' }, { value: 'ON_DRAG', label: 'On drag' }, { value: 'ON_HOVER', label: 'While hovering' },
  { value: 'ON_PRESS', label: 'While pressing' }, { value: 'KEY', label: 'Key/Gamepad' }, { value: 'MOUSE_ENTER', label: 'Mouse enter' },
  { value: 'MOUSE_LEAVE', label: 'Mouse leave' }, { value: 'AFTER_DELAY', label: 'After delay' },
];
export const ACTIONS: { value: ActionType; label: string }[] = [
  { value: 'NAVIGATE', label: 'Navigate to' }, { value: 'CHANGE_TO', label: 'Change to' }, { value: 'BACK', label: 'Back' }, { value: 'SCROLL_TO', label: 'Scroll to' },
  { value: 'OPEN_OVERLAY', label: 'Open overlay' }, { value: 'SWAP_OVERLAY', label: 'Swap overlay' }, { value: 'CLOSE_OVERLAY', label: 'Close overlay' },
  { value: 'OPEN_URL', label: 'Open link' }, { value: 'SET_VARIABLE', label: 'Set variable' },
];
export const ANIMATIONS: { value: AnimationType; label: string }[] = [
  { value: 'INSTANT', label: 'Instant' }, { value: 'DISSOLVE', label: 'Dissolve' }, { value: 'SMART_ANIMATE', label: 'Smart animate' },
  { value: 'MOVE_IN', label: 'Move in' }, { value: 'MOVE_OUT', label: 'Move out' }, { value: 'PUSH', label: 'Push' }, { value: 'SLIDE_IN', label: 'Slide in' }, { value: 'SLIDE_OUT', label: 'Slide out' },
];
export const EASINGS: { value: Easing; label: string }[] = [
  { value: 'LINEAR', label: 'Linear' }, { value: 'EASE_IN', label: 'Ease in' }, { value: 'EASE_OUT', label: 'Ease out' }, { value: 'EASE_IN_OUT', label: 'Ease in and out' },
  { value: 'EASE_IN_BACK', label: 'Ease in back' }, { value: 'EASE_OUT_BACK', label: 'Ease out back' }, { value: 'GENTLE', label: 'Gentle (spring)' }, { value: 'QUICK', label: 'Quick (spring)' },
  { value: 'BOUNCY', label: 'Bouncy (spring)' }, { value: 'SLOW', label: 'Slow (spring)' },
];

export const DEVICES = [
  { value: 'NONE', label: 'None' }, { value: 'IPHONE_16', label: 'iPhone 16' }, { value: 'IPHONE_16_PRO', label: 'iPhone 16 Pro' }, { value: 'ANDROID', label: 'Android Compact' },
  { value: 'IPAD', label: 'iPad Pro 11"' }, { value: 'MACBOOK', label: 'MacBook Air' }, { value: 'DESKTOP', label: 'Desktop' }, { value: 'PRESENTATION', label: 'Presentation' },
];

export function PrototypePanel() {
  const nodes = useSelNodes();
  const doc = useEditor((s) => s.doc!);
  const page = useEditor((s) => s.doc!.pages.find((p) => p.id === s.pageId)!);
  if (!nodes.length) {
    return (
      <div data-testid="prototype-panel">
        <Section title="Flows" actions={<IconButton icon="play" tip="Present" onClick={() => openPresent()} />}>
          {page.flowStarts.length === 0 ? <div className="faint">Select a frame and add a starting point to create a flow.</div> : null}
          {page.flowStarts.map((f) => (
            <div key={f.id} className="row" style={{ height: 28 }} data-testid={`flow-${f.name}`}>
              <I name="flow" size={14} style={{ color: 'var(--accent)' }} />
              <input className="input grow" defaultValue={f.name} onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => S().update((d) => { const fl = d.pages.find((p) => p.id === page.id)!.flowStarts.find((x) => x.id === f.id); if (fl) fl.name = e.target.value; })} />
              <IconButton icon="play" tip="Present flow" onClick={() => openPresent(f.nodeId)} testId={`present-flow-${f.name}`} />
              <IconButton icon="minus" tip="Remove flow" onClick={() => removeFlowStart(f.nodeId)} />
            </div>
          ))}
        </Section>
        <Section title="Prototype settings">
          <div className="prop-row"><span className="muted" style={{ width: 80 }}>Device</span><div className="grow"><Select value={page.prototypeDevice} options={DEVICES} onChange={(v) => S().update((d) => { d.pages.find((p) => p.id === page.id)!.prototypeDevice = v; })} testId="proto-device" /></div></div>
          <div className="prop-row"><span className="muted" style={{ width: 80 }}>Background</span>
            <div className="paint-chip grow"><Swatch paint={solid(page.prototypeBackground)} />
              <input defaultValue={page.prototypeBackground.replace('#', '')} key={page.prototypeBackground} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} onBlur={(e) => { const h = normalizeHex(e.target.value); if (h) S().update((d) => { d.pages.find((p) => p.id === page.id)!.prototypeBackground = h; }); }} data-testid="proto-bg" />
            </div>
          </div>
        </Section>
        <Section title="Interactions">
          <div className="faint">Select a layer to add interactions. Drag the ⊕ handle onto a frame to connect.</div>
        </Section>
        <span style={{ display: 'none' }}>{doc.id}</span>
      </div>
    );
  }
  const n = nodes[0];
  const isTop = !n.parentId || doc.nodes[n.parentId]?.type === 'SECTION';
  const isFlow = page.flowStarts.some((f) => f.nodeId === n.id);
  const frameLike = ['FRAME', 'COMPONENT', 'INSTANCE'].includes(n.type);
  return (
    <div data-testid="prototype-panel">
      {nodes.length === 1 && isTop && frameLike ? (
        <Section title="Flow starting point" actions={isFlow ? <IconButton icon="minus" tip="Remove starting point" onClick={() => removeFlowStart(n.id)} testId="remove-flow" /> : <IconButton icon="plus" tip="Add starting point" onClick={() => ensureFlowStart(n.id)} testId="add-flow" />}>
          {isFlow ? <div className="row"><I name="flow" size={14} style={{ color: 'var(--accent)' }} /> {page.flowStarts.find((f) => f.nodeId === n.id)!.name}</div> : <div className="faint">Not a starting point</div>}
        </Section>
      ) : null}
      <Section title="Interactions" testId="interactions-section" actions={<IconButton icon="plus" tip="Add interaction" onClick={() => setProps(nodes.map((x) => x.id), (x) => { x.reactions = [...x.reactions, newReaction(null)]; })} testId="add-interaction" />}>
        {nodes.length > 1 ? <div className="faint">Editing interactions on {nodes.length} layers</div> : null}
        {n.reactions.length === 0 ? <div className="faint">No interactions</div> : null}
        {n.reactions.map((r, i) => <ReactionEditor key={r.id} node={n} r={r} index={i} />)}
      </Section>
      {frameLike ? (
        <Section title="Scroll behavior" testId="scroll-section">
          <div className="prop-row"><span className="muted" style={{ width: 80 }}>Overflow</span>
            <div className="grow"><Select value={n.overflow} options={[{ value: 'NONE', label: 'No scrolling' }, { value: 'HORIZONTAL', label: 'Horizontal' }, { value: 'VERTICAL', label: 'Vertical' }, { value: 'BOTH', label: 'Both directions' }]} onChange={(v) => setProps([n.id], { overflow: v })} testId="overflow" /></div>
          </div>
        </Section>
      ) : null}
      {!isTop ? (
        <Section title="Position">
          <div className="prop-row"><span className="muted" style={{ width: 80 }}>When scrolling</span>
            <div className="grow"><Select value={n.scrollBehavior} options={[{ value: 'SCROLLS', label: 'Scroll with parent' }, { value: 'FIXED', label: 'Fixed' }, { value: 'STICKY', label: 'Sticky' }]} onChange={(v) => setProps(nodes.map((x) => x.id), { scrollBehavior: v })} testId="scroll-position" /></div>
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function ReactionEditor({ node, r, index }: { node: SceneNode; r: Reaction; index: number }) {
  const doc = useEditor((s) => s.doc!);
  const page = useEditor((s) => s.doc!.pages.find((p) => p.id === s.pageId)!);
  const [open, setOpen] = useState(index === node.reactions.length - 1 && !r.destinationId);
  const up = (p: Partial<Reaction>) => setProps([node.id], (n) => { n.reactions = n.reactions.map((x) => (x.id === r.id ? { ...x, ...p } : x)); });
  const frames = page.children.flatMap((id) => { const x = doc.nodes[id]; return x?.type === 'SECTION' ? x.children : [id]; }).map((id) => doc.nodes[id]).filter((x) => x && ['FRAME', 'COMPONENT', 'INSTANCE', 'COMPONENT_SET'].includes(x.type));
  const variants = (() => {
    let set: SceneNode | undefined;
    let x: SceneNode | undefined = node;
    while (x) { if (x.type === 'COMPONENT' && x.parentId && doc.nodes[x.parentId]?.type === 'COMPONENT_SET') { set = doc.nodes[x.parentId]; break; } x = x.parentId ? doc.nodes[x.parentId] : undefined; }
    return set ? set.children.map((c) => doc.nodes[c]) : [];
  })();
  const needsDest = ['NAVIGATE', 'CHANGE_TO', 'SCROLL_TO', 'OPEN_OVERLAY', 'SWAP_OVERLAY'].includes(r.action);
  const destOptions = r.action === 'CHANGE_TO' ? variants : r.action === 'SCROLL_TO' ? Object.values(doc.nodes).filter((x) => x.parentId && doc.nodes[x.parentId] && ['FRAME', 'COMPONENT'].includes(doc.nodes[x.parentId].type)) : frames;
  const summary = `${TRIGGERS.find((t) => t.value === r.trigger)?.label} → ${ACTIONS.find((a) => a.value === r.action)?.label}${r.destinationId && doc.nodes[r.destinationId] ? ' ' + doc.nodes[r.destinationId].name : ''}`;
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }} data-testid={`reaction-${index}`}>
      <div className="row">
        <button className="row grow" onClick={() => setOpen(!open)} style={{ textAlign: 'left' }} data-testid={`reaction-toggle-${index}`}>
          <I name={open ? 'chevronDown' : 'chevronRight'} size={12} /> <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
        </button>
        <IconButton icon="minus" tip="Remove interaction" onClick={() => setProps([node.id], (n) => { n.reactions = n.reactions.filter((x) => x.id !== r.id); })} testId={`remove-reaction-${index}`} />
      </div>
      {open ? (
        <>
          <Select value={r.trigger} options={TRIGGERS} onChange={(v) => up({ trigger: v })} testId={`trigger-${index}`} />
          {r.trigger === 'AFTER_DELAY' ? <NumField label="ms" value={r.delay ?? 800} min={0} onChange={(v) => up({ delay: v })} testId={`delay-${index}`} /> : null}
          {r.trigger === 'KEY' ? <input className="input" placeholder="Press a key…" value={r.key ?? ''} onKeyDown={(e) => { e.preventDefault(); e.stopPropagation(); up({ key: e.key }); }} onChange={() => {}} data-testid={`key-${index}`} /> : null}
          <Select value={r.action} options={ACTIONS} onChange={(v) => up({ action: v, destinationId: v === 'CHANGE_TO' ? variants[0]?.id ?? null : r.destinationId })} testId={`action-${index}`} />
          {needsDest ? (
            <Select value={r.destinationId ?? '__none'} options={[{ value: '__none', label: 'None' }, ...destOptions.map((f) => ({ value: f.id, label: f.name }))]} onChange={(v) => up({ destinationId: v === '__none' ? null : v })} testId={`destination-${index}`} />
          ) : null}
          {r.action === 'OPEN_URL' ? <input className="input" placeholder="https://" defaultValue={r.url ?? ''} onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => up({ url: e.target.value })} data-testid={`url-${index}`} /> : null}
          {r.action === 'SET_VARIABLE' ? (
            <>
              <Select value={r.variableId ?? '__none'} options={[{ value: '__none', label: 'Choose variable' }, ...doc.variables.map((v) => ({ value: v.id, label: v.name }))]} onChange={(v) => up({ variableId: v === '__none' ? undefined : v })} testId={`set-var-${index}`} />
              <input className="input" placeholder="Value" defaultValue={r.variableValue ?? ''} onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => up({ variableValue: e.target.value })} />
            </>
          ) : null}
          {r.action === 'OPEN_OVERLAY' || r.action === 'SWAP_OVERLAY' ? (
            <>
              <Select value={r.overlayPosition ?? 'CENTER'} options={['CENTER', 'TOP_LEFT', 'TOP_CENTER', 'TOP_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_CENTER', 'BOTTOM_RIGHT'].map((p) => ({ value: p as 'CENTER', label: p.replace('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) }))} onChange={(v) => up({ overlayPosition: v })} testId={`overlay-position-${index}`} />
              <label className="checkbox"><input type="checkbox" data-testid={`overlay-close-outside-${index}`} checked={!!r.closeOnOutside} onChange={(e) => up({ closeOnOutside: e.target.checked })} /> Close when clicking outside</label>
              <label className="checkbox"><input type="checkbox" data-testid={`overlay-background-${index}`} checked={!!r.overlayBackground} onChange={(e) => up({ overlayBackground: e.target.checked })} /> Add background behind overlay</label>
            </>
          ) : null}
          {['NAVIGATE', 'CHANGE_TO', 'BACK', 'OPEN_OVERLAY', 'SWAP_OVERLAY', 'SCROLL_TO'].includes(r.action) ? (
            <>
              <div className="divider" />
              <span className="muted">Animation</span>
              <Select value={r.animation} options={ANIMATIONS} onChange={(v) => up({ animation: v })} testId={`animation-${index}`} />
              {['MOVE_IN', 'MOVE_OUT', 'PUSH', 'SLIDE_IN', 'SLIDE_OUT'].includes(r.animation) ? (
                <div className="seg">
                  {(['LEFT', 'RIGHT', 'TOP', 'BOTTOM'] as const).map((d) => <button key={d} className={r.direction === d ? 'on' : ''} aria-label={`Direction ${d.toLowerCase()}`} data-tip={`From ${d.toLowerCase()}`} data-testid={`direction-${d.toLowerCase()}-${index}`} onClick={() => up({ direction: d })}>{d === 'LEFT' ? '←' : d === 'RIGHT' ? '→' : d === 'TOP' ? '↑' : '↓'}</button>)}
                </div>
              ) : null}
              {r.animation !== 'INSTANT' ? (
                <div className="grid2">
                  <Select value={r.easing} options={EASINGS} onChange={(v) => up({ easing: v })} testId={`easing-${index}`} />
                  <NumField label="ms" value={r.duration} min={0} onChange={(v) => up({ duration: v })} testId={`duration-${index}`} />
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
