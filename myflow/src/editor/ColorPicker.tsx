import React, { useRef, useState } from 'react';
import type { Paint, PaintType } from '../model/types';
import { hexToRgb, hsvToRgb, normalizeHex, rgbToHex, rgbToHsv, rgbToHsl, hslToRgb } from '../model/color';
import { NumField, Popover, Select, Swatch, IconButton } from './ui';
import { useEditor, S } from '../store/editor';
import { useShallow } from 'zustand/react/shallow';
import { readAsDataUrl } from '../commands';

const TYPES: { value: PaintType; label: string }[] = [
  { value: 'SOLID', label: 'Solid' },
  { value: 'GRADIENT_LINEAR', label: 'Linear' },
  { value: 'GRADIENT_RADIAL', label: 'Radial' },
  { value: 'GRADIENT_ANGULAR', label: 'Angular' },
  { value: 'GRADIENT_DIAMOND', label: 'Diamond' },
  { value: 'IMAGE', label: 'Image' },
];

const PRESETS = ['#000000', '#545454', '#A6A6A6', '#D9D9D9', '#FFFFFF', '#F24822', '#FFA629', '#FFCD29', '#14AE5C', '#0FA958', '#0D99FF', '#007BE5', '#9747FF', '#FF24BD', '#F5F5F5', '#1E1E1E'];

function useDrag(onMove: (x: number, y: number, rect: DOMRect) => void) {
  return (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    el.setPointerCapture(e.pointerId);
    S().begin();
    onMove(e.clientX - rect.left, e.clientY - rect.top, rect);
    const move = (ev: PointerEvent) => onMove(ev.clientX - rect.left, ev.clientY - rect.top, rect);
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); S().end(); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };
}

export function SolidEditor({ color, opacity, onChange }: { color: string; opacity: number; onChange: (color: string, opacity: number) => void }) {
  const rgb = hexToRgb(color);
  const hsvRef = useRef(rgbToHsv(rgb));
  const cur = rgbToHsv(rgb);
  // keep hue stable for greys
  if (rgbToHex(hsvToRgb(hsvRef.current.h, hsvRef.current.s, hsvRef.current.v)) !== color.toUpperCase()) hsvRef.current = cur;
  const hsv = hsvRef.current;
  const [model, setModel] = useState<'HEX' | 'RGB' | 'HSL' | 'HSB' | 'CSS'>('HEX');
  const [hexText, setHexText] = useState(color.replace('#', ''));
  React.useEffect(() => setHexText(color.replace('#', '').toUpperCase()), [color]);
  const set = (h: number, s: number, v: number, a = opacity) => {
    hsvRef.current = { h, s, v };
    onChange(rgbToHex(hsvToRgb(h, s, v)), a);
  };
  const svDrag = useDrag((x, y, r) => set(hsv.h, Math.max(0, Math.min(1, x / r.width)), Math.max(0, Math.min(1, 1 - y / r.height))));
  const hueDrag = useDrag((x, _y, r) => set(Math.max(0, Math.min(359.9, (x / r.width) * 360)), hsv.s, hsv.v));
  const alphaDrag = useDrag((x, _y, r) => onChange(color, Math.round(Math.max(0, Math.min(1, x / r.width)) * 100) / 100));
  const pure = rgbToHex(hsvToRgb(hsv.h, 1, 1));
  const hsl = rgbToHsl(rgb);
  const eyedrop = async () => {
    const ED = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!ED) { S().toast('Eyedropper is not supported in this browser'); return; }
    try { const r = await new ED().open(); onChange(normalizeHex(r.sRGBHex) ?? color, opacity); } catch { /* cancelled */ }
  };
  return (
    <div className="cp" data-testid="solid-editor">
      <div className="cp-sv" style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pure})` }} onPointerDown={svDrag} data-testid="cp-sv">
        <div className="knob" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: color }} />
      </div>
      <div className="row" style={{ padding: '12px 12px 8px' }}>
        <IconButton icon="target" tip="Eyedropper" keys="i" onClick={eyedrop} testId="eyedropper" />
        <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="cp-hue" onPointerDown={hueDrag} data-testid="cp-hue"><div className="knob" style={{ left: `${(hsv.h / 360) * 100}%`, background: pure }} /></div>
          <div className="cp-alpha" onPointerDown={alphaDrag} style={{ background: `linear-gradient(90deg, transparent, ${color}), repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0/8px 8px` }}>
            <div className="knob" style={{ left: `${opacity * 100}%`, background: color }} />
          </div>
        </div>
      </div>
      <div className="row" style={{ padding: '0 12px 10px', gap: 4 }}>
        <div style={{ width: 64 }}>
          <Select value={model} options={['HEX', 'RGB', 'HSL', 'HSB', 'CSS'].map((m) => ({ value: m as typeof model, label: m === 'HEX' ? 'Hex' : m }))} onChange={setModel} />
        </div>
        {model === 'HEX' && (
          <input className="input" style={{ flex: 1 }} value={hexText} data-testid="hex-input"
            onChange={(e) => setHexText(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { const h = normalizeHex(hexText); if (h) onChange(h, opacity); } }}
            onBlur={() => { const h = normalizeHex(hexText); if (h && h !== color) onChange(h, opacity); }} />
        )}
        {model === 'RGB' && (['r', 'g', 'b'] as const).map((k) => (
          <div key={k} style={{ flex: 1 }}><NumField value={Math.round(rgb[k])} min={0} max={255} onChange={(v) => onChange(rgbToHex({ ...rgb, [k]: v }), opacity)} decimals={0} /></div>
        ))}
        {model === 'HSL' && (['h', 's', 'l'] as const).map((k) => (
          <div key={k} style={{ flex: 1 }}><NumField value={hsl[k]} min={0} max={k === 'h' ? 360 : 100} onChange={(v) => { const n = { ...hsl, [k]: v }; onChange(rgbToHex(hslToRgb(n.h, n.s, n.l)), opacity); }} decimals={0} /></div>
        ))}
        {model === 'HSB' && (
          <>
            <div style={{ flex: 1 }}><NumField value={Math.round(hsv.h)} min={0} max={360} onChange={(v) => set(v, hsv.s, hsv.v)} decimals={0} /></div>
            <div style={{ flex: 1 }}><NumField value={Math.round(hsv.s * 100)} min={0} max={100} onChange={(v) => set(hsv.h, v / 100, hsv.v)} decimals={0} /></div>
            <div style={{ flex: 1 }}><NumField value={Math.round(hsv.v * 100)} min={0} max={100} onChange={(v) => set(hsv.h, hsv.s, v / 100)} decimals={0} /></div>
          </>
        )}
        {model === 'CSS' && <input className="input" style={{ flex: 1 }} readOnly value={opacity < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})` : color} />}
        <div style={{ width: 56 }}><NumField value={opacity} scale={100} decimals={0} min={0} max={1} suffix="%" onChange={(v) => onChange(color, v)} testId="cp-opacity" /></div>
      </div>
      <div className="section-head" style={{ height: 24, fontWeight: 500, fontSize: 11 }}><span className="title muted">On this page</span></div>
      <div className="cp-swatches">
        {PRESETS.map((c) => <button key={c} style={{ background: c }} onClick={() => onChange(c, opacity)} data-tip={c} />)}
      </div>
    </div>
  );
}

function GradientEditor({ paint, onChange }: { paint: Paint; onChange: (p: Paint) => void }) {
  const [sel, setSel] = useState(0);
  const stops = paint.stops ?? [];
  const barRef = useRef<HTMLDivElement>(null);
  const css = `linear-gradient(90deg, ${[...stops].sort((a, b) => a.offset - b.offset).map((s) => `${s.color} ${s.offset * 100}%`).join(',')})`;
  const stop = stops[sel] ?? stops[0];
  const dragStop = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    setSel(i);
    const rect = barRef.current!.getBoundingClientRect();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    S().begin();
    const move = (ev: PointerEvent) => {
      const off = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      onChange({ ...paint, stops: stops.map((s, j) => (j === i ? { ...s, offset: Math.round(off * 100) / 100 } : s)) });
    };
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); S().end(); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };
  return (
    <div data-testid="gradient-editor">
      <div className="row" style={{ padding: '10px 12px 0' }}>
        <span className="muted">Angle</span>
        <div style={{ width: 70 }}><NumField icon="angle" value={paint.angle ?? 90} suffix="°" onChange={(v) => onChange({ ...paint, angle: v })} /></div>
        <span className="spacer" />
        <IconButton icon="rotate" tip="Rotate 90°" onClick={() => onChange({ ...paint, angle: ((paint.angle ?? 90) + 90) % 360 })} />
        <IconButton icon="flipH" tip="Flip gradient" onClick={() => onChange({ ...paint, stops: stops.map((s) => ({ ...s, offset: 1 - s.offset })) })} />
      </div>
      <div
        ref={barRef}
        className="grad-bar"
        style={{ background: css }}
        onPointerDown={(e) => {
          const rect = barRef.current!.getBoundingClientRect();
          const off = Math.round(((e.clientX - rect.left) / rect.width) * 100) / 100;
          const ns = [...stops, { offset: off, color: stop?.color ?? '#888888' }];
          onChange({ ...paint, stops: ns });
          setSel(ns.length - 1);
        }}
        data-testid="grad-bar"
      >
        {stops.map((s, i) => (
          <div key={i} className={'grad-stop' + (i === sel ? ' on' : '')} style={{ left: `${s.offset * 100}%`, background: s.color }} onPointerDown={dragStop(i)} data-testid={`grad-stop-${i}`} />
        ))}
      </div>
      <div className="row" style={{ padding: '0 12px 6px' }}>
        <span className="muted grow">Stops</span>
        <IconButton icon="minus" tip="Remove stop" disabled={stops.length <= 2} onClick={() => { onChange({ ...paint, stops: stops.filter((_, j) => j !== sel) }); setSel(0); }} />
      </div>
      {stop && (
        <SolidEditor color={stop.color} opacity={1} onChange={(c) => onChange({ ...paint, stops: stops.map((s, j) => (j === sel ? { ...s, color: c } : s)) })} />
      )}
    </div>
  );
}

function ImageEditor({ paint, onChange }: { paint: Paint; onChange: (p: Paint) => void }) {
  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (f) onChange({ ...paint, imageSrc: await readAsDataUrl(f) });
    };
    input.click();
  };
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="image-editor">
      <Select value={paint.scaleMode ?? 'FILL'} options={[{ value: 'FILL', label: 'Fill' }, { value: 'FIT', label: 'Fit' }, { value: 'CROP', label: 'Crop (stretch)' }, { value: 'TILE', label: 'Tile' }]} onChange={(v) => onChange({ ...paint, scaleMode: v })} />
      <div style={{ height: 160, borderRadius: 6, background: paint.imageSrc ? `center/contain no-repeat url(${paint.imageSrc}), var(--bg-2)` : 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button className="btn small" onClick={pick} data-testid="choose-image">{paint.imageSrc ? 'Replace image…' : 'Choose image…'}</button>
      </div>
    </div>
  );
}

export function PaintPicker({ paint, anchor, onChange, onClose, allowImage = true, onPickStyle, onPickVariable }: {
  paint: Paint; anchor: DOMRect; onChange: (p: Paint) => void; onClose: () => void; allowImage?: boolean;
  onPickStyle?: (styleId: string) => void; onPickVariable?: (varId: string) => void;
}) {
  const [tab, setTab] = useState<'custom' | 'libraries'>('custom');
  const styles = useEditor(useShallow((s) => s.doc?.styles.filter((x) => x.type === 'FILL') ?? []));
  const vars = useEditor(useShallow((s) => s.doc?.variables.filter((v) => v.type === 'COLOR') ?? []));
  const doc = useEditor((s) => s.doc);
  const changeType = (t: PaintType) => {
    if (t === paint.type) return;
    if (t === 'SOLID') onChange({ ...paint, type: t, color: paint.stops?.[0]?.color ?? paint.color, variableId: undefined });
    else if (t === 'IMAGE') onChange({ ...paint, type: t, scaleMode: 'FILL', variableId: undefined });
    else onChange({ ...paint, type: t, angle: paint.angle ?? 90, stops: paint.stops ?? [{ offset: 0, color: paint.type === 'SOLID' ? paint.color : '#FFFFFF' }, { offset: 1, color: paint.type === 'SOLID' ? '#FFFFFF' : '#000000' }], variableId: undefined });
  };
  return (
    <Popover anchor={anchor} onClose={onClose} width={240} testId="paint-picker" title={
      <div className="row" style={{ gap: 2 }}>
        <button className={'tab' + (tab === 'custom' ? ' on' : '')} onClick={() => setTab('custom')}>Custom</button>
        <button className={'tab' + (tab === 'libraries' ? ' on' : '')} onClick={() => setTab('libraries')} data-testid="picker-libraries">Libraries</button>
      </div>
    }>
      {tab === 'custom' ? (
        <>
          <div className="row" style={{ padding: '8px 12px 0', gap: 2, flexWrap: 'wrap' }}>
            <div style={{ width: '100%' }}>
              <Select value={paint.type} options={TYPES.filter((t) => allowImage || t.value !== 'IMAGE')} onChange={changeType} testId="paint-type" />
            </div>
          </div>
          {paint.type === 'SOLID' && (
            <div style={{ paddingTop: 8 }}>
              <SolidEditor color={paint.color} opacity={paint.opacity} onChange={(c, o) => onChange({ ...paint, color: c, opacity: o, variableId: undefined, styleId: undefined })} />
            </div>
          )}
          {paint.type.startsWith('GRADIENT') && <GradientEditor paint={paint} onChange={onChange} />}
          {paint.type === 'IMAGE' && <ImageEditor paint={paint} onChange={onChange} />}
        </>
      ) : (
        <div style={{ padding: '8px 0', maxHeight: 360, overflow: 'auto' }}>
          <div className="section-head" style={{ height: 24 }}><span className="title muted">Color styles</span></div>
          {styles.length === 0 ? <div className="faint" style={{ padding: '0 16px 8px' }}>No color styles</div> : null}
          {styles.map((st) => (
            <div key={st.id} className="qa-item" style={{ margin: '0 6px' }} onClick={() => { onPickStyle?.(st.id); onClose(); }} data-testid={`pick-style-${st.name}`}>
              <Swatch paint={st.fills?.[0]} /> {st.name}
            </div>
          ))}
          <div className="section-head" style={{ height: 24 }}><span className="title muted">Color variables</span></div>
          {vars.length === 0 ? <div className="faint" style={{ padding: '0 16px 8px' }}>No color variables</div> : null}
          {vars.map((v) => {
            const col = doc?.collections.find((c) => c.id === v.collectionId);
            const val = col ? v.values[col.modes[0].id] : undefined;
            return (
              <div key={v.id} className="qa-item" style={{ margin: '0 6px' }} onClick={() => { onPickVariable?.(v.id); onClose(); }} data-testid={`pick-var-${v.name}`}>
                <Swatch paint={{ id: '', type: 'SOLID', visible: true, opacity: 1, color: typeof val === 'string' ? val : '#888888' }} /> {v.name}
                <span className="faint" style={{ marginLeft: 'auto' }}>{col?.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
