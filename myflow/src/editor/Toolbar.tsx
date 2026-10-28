import React, { useState } from 'react';
import { useEditor, S } from '../store/editor';
import { I, type IconName } from './icons';
import { Menu, type MenuItem } from './ui';
import { setTool, pickImages, displayKeys } from '../commands';
import { useAgent, openAgent } from './AIPanel';
import type { ToolId } from '../model/types';

interface ToolDef { id: ToolId; label: string; icon: IconName; keys?: string }

const GROUPS: { key: 'move' | 'region' | 'shape' | 'creation'; tools: ToolDef[] }[] = [
  { key: 'move', tools: [
    { id: 'MOVE', label: 'Move', icon: 'move', keys: 'v' },
    { id: 'HAND', label: 'Hand tool', icon: 'hand', keys: 'h' },
    { id: 'SCALE', label: 'Scale', icon: 'scale', keys: 'k' },
  ] },
  { key: 'region', tools: [
    { id: 'FRAME', label: 'Frame', icon: 'frame', keys: 'f' },
    { id: 'SECTION', label: 'Section', icon: 'section', keys: 'shift+s' },
    { id: 'SLICE', label: 'Slice', icon: 'slice', keys: 's' },
  ] },
  { key: 'shape', tools: [
    { id: 'RECTANGLE', label: 'Rectangle', icon: 'rect', keys: 'r' },
    { id: 'LINE', label: 'Line', icon: 'line', keys: 'l' },
    { id: 'ARROW', label: 'Arrow', icon: 'arrow', keys: 'shift+l' },
    { id: 'ELLIPSE', label: 'Ellipse', icon: 'ellipse', keys: 'o' },
    { id: 'POLYGON', label: 'Polygon', icon: 'polygon' },
    { id: 'STAR', label: 'Star', icon: 'star' },
    { id: 'IMAGE', label: 'Image/video', icon: 'image', keys: 'mod+shift+k' },
  ] },
  { key: 'creation', tools: [
    { id: 'PEN', label: 'Pen', icon: 'pen', keys: 'p' },
    { id: 'PENCIL', label: 'Pencil', icon: 'pencil', keys: 'shift+p' },
  ] },
];

export function Toolbar() {
  const tool = useEditor((s) => s.tool);
  const mode = useEditor((s) => s.mode);
  const sub = useEditor((s) => s.shapeSubtool);
  const [menu, setMenu] = useState<{ key: string; x: number; y: number } | null>(null);

  if (mode === 'dev') {
    return (
      <div className="toolbar" data-testid="toolbar">
        <button className={'tool' + (tool === 'MOVE' ? ' on' : '')} data-tip="Move" data-keys="V" onClick={() => setTool('MOVE')} data-testid="tool-move"><I name="move" /></button>
        <button className={'tool' + (tool === 'HAND' ? ' on' : '')} data-tip="Hand tool" data-keys="H" onClick={() => setTool('HAND')}><I name="hand" /></button>
        <button className={'tool' + (tool === 'COMMENT' ? ' on' : '')} data-tip="Comment" data-keys="C" onClick={() => { setTool('COMMENT'); S().setState({ commentsPanel: true }); }}><I name="comment" /></button>
        <button className="tool" data-tip="Annotate" data-keys="⇧T" onClick={() => S().setState({ modal: null, rightTab: 'design' })} data-testid="tool-annotate"><I name="annotate" /></button>
        <button className="tool" data-tip="Measure (hold ⌥ and hover)" data-keys="⇧M" onClick={() => S().toast('Hold Option/Alt and hover layers to measure')}><I name="measure" /></button>
        <div className="sep" />
        <AgentButton />
        <ModeToggle />
      </div>
    );
  }

  const groupTool = (key: 'move' | 'region' | 'shape' | 'creation') => {
    const g = GROUPS.find((x) => x.key === key)!;
    const active = g.tools.find((t) => t.id === tool);
    if (active) return active;
    return g.tools.find((t) => t.id === sub[key]) ?? g.tools[0];
  };

  const choose = (key: 'move' | 'region' | 'shape' | 'creation', t: ToolDef) => {
    S().setState({ shapeSubtool: { ...S().shapeSubtool, [key]: t.id } });
    if (t.id === 'IMAGE') pickImages(); else setTool(t.id);
  };

  return (
    <div className="toolbar" data-testid="toolbar">
      {GROUPS.map((g) => {
        const t = groupTool(g.key);
        const on = g.tools.some((x) => x.id === tool);
        return (
          <React.Fragment key={g.key}>
            <button className={'tool' + (on ? ' on' : '')} data-tip={t.label} data-keys={t.keys ? displayKeys(t.keys) : undefined} data-testid={`tool-${t.id.toLowerCase()}`} onClick={() => choose(g.key, t)}>
              <I name={t.icon} />
            </button>
            <button className="caret" data-menu-anchor data-testid={`tool-caret-${g.key}`} onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenu({ key: g.key, x: r.left - 30, y: r.top - 8 - g.tools.length * 26 - 16 }); }}>
              <I name="chevronDown" size={12} />
            </button>
          </React.Fragment>
        );
      })}
      <button className={'tool' + (tool === 'TEXT' ? ' on' : '')} data-tip="Text" data-keys="T" data-testid="tool-text" onClick={() => setTool('TEXT')}><I name="text" /></button>
      <button className={'tool' + (tool === 'COMMENT' ? ' on' : '')} data-tip="Comment" data-keys="C" data-testid="tool-comment" onClick={() => { setTool('COMMENT'); S().setState({ commentsPanel: true }); }}><I name="comment" /></button>
      <div className="sep" />
      <button className="tool" data-tip="Actions" data-keys={displayKeys('mod+k')} data-testid="tool-actions" onClick={() => S().setState({ modal: 'quickActions' })}><I name="search" /></button>
      <AgentButton />
      <ModeToggle />
      {menu ? (
        <Menu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={GROUPS.find((g) => g.key === menu.key)!.tools.map((t): MenuItem => ({
            label: t.label, keys: t.keys, checked: tool === t.id, testId: `tool-menu-${t.id.toLowerCase()}`,
            onClick: () => choose(menu.key as 'move', t),
          }))}
        />
      ) : null}
    </div>
  );
}

function ModeToggle() {
  const mode = useEditor((s) => s.mode);
  return (
    <div className="mode-toggle">
      <button className={mode === 'design' ? 'on' : ''} data-tip="Design mode" onClick={() => S().setState({ mode: 'design' })} data-testid="mode-design"><I name="move" size={16} /></button>
      <button className={mode === 'dev' ? 'on dev' : ''} data-tip="Dev Mode" data-keys="⇧D" onClick={() => S().setState({ mode: 'dev', tool: 'MOVE', rightTab: 'design' })} data-testid="mode-dev"><I name="code" size={16} /></button>
    </div>
  );
}

function AgentButton() {
  const open = useAgent((s) => s.open);
  return (
    <button className={'tool' + (open ? ' on' : '')} data-tip="AI agent" data-keys={displayKeys('mod+j')} data-testid="tool-agent"
      onClick={() => (open ? useAgent.setState({ open: false }) : openAgent())}
      style={open ? undefined : { color: '#9747FF' }}>
      <I name="actions" />
    </button>
  );
}
