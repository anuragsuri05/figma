import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { S } from '../store/editor';
import { I, type IconName } from './icons';
import { displayKeys } from '../commands';
import type { Paint } from '../model/types';

export function evalNumber(input: string, current: number): number | null {
  let s = input.trim().replace(/,/g, '.');
  if (!s) return null;
  if (/^[+\-*/]/.test(s) && !/^-\d/.test(s)) s = `${current}${s}`;
  if (!/^[\d+\-*/().\s%]+$/.test(s)) return null;
  s = s.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict";return (${s})`)();
    return typeof v === 'number' && isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export const fmt = (v: number, decimals = 2) => {
  const r = Math.round(v * 10 ** decimals) / 10 ** decimals;
  return String(Object.is(r, -0) ? 0 : r);
};

interface NumFieldProps {
  label?: React.ReactNode;
  icon?: IconName;
  value: number | 'mixed';
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  decimals?: number;
  title?: string;
  testId?: string;
  disabled?: boolean;
  scale?: number; // display multiplier (e.g. opacity 0..1 shown as %)
}

export function NumField({ label, icon, value, onChange, min = -Infinity, max = Infinity, step = 1, suffix, decimals = 2, title, testId, disabled, scale = 1 }: NumFieldProps) {
  const display = value === 'mixed' ? 'Mixed' : fmt(value * scale, decimals);
  const [text, setText] = useState(display);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(display); }, [display, focused]);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const commit = (raw: string) => {
    const cur = value === 'mixed' ? 0 : value * scale;
    const v = evalNumber(raw, cur);
    if (v === null) { setText(display); return; }
    onChange(clamp(v / scale));
  };
  const scrub = (e: React.PointerEvent) => {
    if (disabled || value === 'mixed') return;
    e.preventDefault();
    const startX = e.clientX;
    const start = value * scale;
    S().begin();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const mult = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
      onChange(clamp(Math.round((start + dx * step * mult) * 100) / 100 / scale));
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      S().end();
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  };
  return (
    <label className={'field' + (value === 'mixed' ? ' mixed' : '')} title={title} style={disabled ? { opacity: 0.5 } : undefined}>
      {(label !== undefined || icon) && (
        <span className="lbl" onPointerDown={scrub}>{icon ? <I name={icon} size={16} /> : label}</span>
      )}
      <input
        data-testid={testId}
        value={text}
        disabled={disabled}
        onFocus={(e) => { setFocused(true); e.currentTarget.select(); }}
        onBlur={(e) => { setFocused(false); if (e.currentTarget.value !== display) commit(e.currentTarget.value); }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { commit(text); (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') { setText(display); (e.target as HTMLInputElement).blur(); }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const cur = value === 'mixed' ? 0 : value * scale;
            const nv = clamp((cur + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)) / scale);
            onChange(nv);
          }
        }}
        style={{ paddingLeft: label === undefined && !icon ? 7 : undefined }}
      />
      {suffix ? <span className="suffix">{suffix}</span> : null}
    </label>
  );
}

export function TextField({ value, onChange, placeholder, testId, autoFocus, className, onEnter }: { value: string; onChange: (v: string) => void; placeholder?: string; testId?: string; autoFocus?: boolean; className?: string; onEnter?: () => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      className={'input ' + (className ?? '')}
      data-testid={testId}
      value={text}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { if (text !== value) onChange(text); }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { onChange(text); onEnter?.(); (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') { setText(value); (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
}

export function Select<T extends string | number>({ value, options, onChange, testId, title, style }: { value: T | 'mixed'; options: { value: T; label: string }[]; onChange: (v: T) => void; testId?: string; title?: string; style?: React.CSSProperties }) {
  return (
    <select
      className="select"
      data-testid={testId}
      title={title}
      style={style}
      value={value === 'mixed' ? '__mixed' : String(value)}
      onChange={(e) => {
        const o = options.find((x) => String(x.value) === e.target.value);
        if (o) onChange(o.value);
        e.target.blur();
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {value === 'mixed' ? <option value="__mixed">Mixed</option> : null}
      {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
    </select>
  );
}

export function IconButton({ icon, onClick, active, tip, keys, testId, size = 16, disabled, className, style }: { icon: IconName; onClick?: (e: React.MouseEvent) => void; active?: boolean; tip?: string; keys?: string; testId?: string; size?: number; disabled?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <button
      className={'icon-btn' + (active ? ' active' : '') + (className ? ' ' + className : '')}
      onClick={onClick}
      data-tip={tip}
      data-keys={keys ? displayKeys(keys) : undefined}
      data-testid={testId}
      aria-label={tip}
      disabled={disabled}
      style={style}
    >
      <I name={icon} size={size} />
    </button>
  );
}

export function Section({ title, children, actions, testId, collapsible }: { title: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode; testId?: string; collapsible?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="section" data-testid={testId}>
      <div className="section-head">
        <span className="title" onClick={collapsible ? () => setOpen(!open) : undefined}>{title}</span>
        {actions}
      </div>
      {open && children ? <div className="section-body">{children}</div> : null}
    </div>
  );
}

export function Swatch({ paint, size = 14 }: { paint?: Paint | null; size?: number }) {
  let bg = 'transparent';
  if (paint) {
    if (paint.type === 'SOLID') bg = paint.color;
    else if (paint.type === 'IMAGE') bg = `center/cover url(${paint.imageSrc})`;
    else {
      const stops = (paint.stops ?? []).map((s) => `${s.color} ${s.offset * 100}%`).join(',');
      bg = paint.type === 'GRADIENT_RADIAL' || paint.type === 'GRADIENT_DIAMOND' ? `radial-gradient(${stops})` : paint.type === 'GRADIENT_ANGULAR' ? `conic-gradient(${stops})` : `linear-gradient(${paint.angle ?? 90}deg, ${stops})`;
    }
  }
  return (
    <span className="swatch" style={{ width: size, height: size }}>
      <i style={{ background: bg, opacity: paint?.opacity ?? 1 }} />
    </span>
  );
}

/* ------------------------------------------------------------------ popover */

export function Popover({ anchor, onClose, children, width = 240, placement = 'left', testId, title, offset = 8 }: {
  anchor: DOMRect | { x: number; y: number; width?: number; height?: number }; onClose: () => void; children: React.ReactNode; width?: number;
  placement?: 'left' | 'below' | 'above' | 'right'; testId?: string; title?: React.ReactNode; offset?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: -9999 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    const a = anchor as DOMRect;
    const aw = a.width ?? 0, ah = a.height ?? 0;
    let left = a.x, top = a.y;
    if (placement === 'left') { left = a.x - width - offset; top = a.y - 10; }
    if (placement === 'right') { left = a.x + aw + offset; top = a.y - 10; }
    if (placement === 'below') { left = a.x; top = a.y + ah + offset; }
    if (placement === 'above') { left = a.x; top = a.y - h - offset; }
    left = Math.max(8, Math.min(window.innerWidth - width - 8, left));
    top = Math.max(8, Math.min(window.innerHeight - h - 8, top));
    setPos({ left, top });
  }, [anchor, width, placement, offset]);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current && !ref.current.contains(t) && !t.closest('[data-popover-keep]') && !t.closest('.menu')) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const id = setTimeout(() => window.addEventListener('pointerdown', onDown, true), 0);
    window.addEventListener('keydown', onKey, true);
    return () => { clearTimeout(id); window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey, true); };
  }, [onClose]);
  return createPortal(
    <div ref={ref} className="popover" style={{ ...pos, width }} data-testid={testId} onKeyDown={(e) => e.stopPropagation()}>
      {title ? (
        <div className="popover-header">
          <span className="grow">{title}</span>
          <IconButton icon="close" onClick={onClose} tip="Close" />
        </div>
      ) : null}
      {children}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ dark menus */

export interface MenuItem {
  label?: string;
  onClick?: () => void;
  keys?: string;
  checked?: boolean;
  disabled?: boolean;
  separator?: boolean;
  header?: string;
  submenu?: MenuItem[];
  testId?: string;
}

export function Menu({ items, x, y, onClose, testId, search }: { items: MenuItem[]; x: number; y: number; onClose: () => void; testId?: string; search?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [open, setOpen] = useState<number | null>(null);
  const [subAnchor, setSubAnchor] = useState<DOMRect | null>(null);
  const [q, setQ] = useState('');
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    setPos({ left: Math.max(4, Math.min(window.innerWidth - w - 4, x)), top: Math.max(4, Math.min(window.innerHeight - h - 4, y)) });
  }, [x, y, items]);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.menu') && !t.closest('[data-menu-anchor]')) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const id = setTimeout(() => window.addEventListener('pointerdown', onDown, true), 0);
    window.addEventListener('keydown', onKey, true);
    return () => { clearTimeout(id); window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey, true); };
  }, [onClose]);
  const flat = (list: MenuItem[], path: string[] = []): { item: MenuItem; path: string[] }[] =>
    list.flatMap((it) => (it.submenu ? flat(it.submenu, [...path, it.label ?? '']) : it.label && it.onClick ? [{ item: it, path }] : []));
  const shown = search && q ? flat(items).filter(({ item }) => item.label!.toLowerCase().includes(q.toLowerCase())).map(({ item, path }) => ({ ...item, label: [...path, item.label].join(' › ') })) : items;
  return createPortal(
    <>
      <div ref={ref} className="menu" style={pos} data-testid={testId} onContextMenu={(e) => e.preventDefault()}>
        {search ? <input className="menu-search" placeholder="Search menus" value={q} autoFocus onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} data-testid="menu-search" /> : null}
        {shown.map((it, i) => {
          if (it.separator) return <div key={i} className="menu-sep" />;
          if (it.header) return <div key={i} className="menu-header">{it.header}</div>;
          return (
            <div
              key={i}
              className={'menu-item' + (it.disabled ? ' disabled' : '') + (open === i ? ' open' : '')}
              data-testid={it.testId ?? 'menu-' + (it.label ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}
              onMouseEnter={(e) => {
                if (it.submenu) { setOpen(i); setSubAnchor((e.currentTarget as HTMLElement).getBoundingClientRect()); } else setOpen(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (it.disabled) return;
                if (it.submenu) { setOpen(i); setSubAnchor((e.currentTarget as HTMLElement).getBoundingClientRect()); return; }
                onClose();
                it.onClick?.();
              }}
            >
              {it.checked ? <span className="check">✓</span> : null}
              <span>{it.label}</span>
              {it.keys ? <span className="kbd">{displayKeys(it.keys)}</span> : null}
              {it.submenu ? <span className="arrow">›</span> : null}
            </div>
          );
        })}
      </div>
      {open !== null && shown[open]?.submenu && subAnchor ? (
        <Menu items={shown[open].submenu!} x={subAnchor.right + 4} y={subAnchor.top - 8} onClose={onClose} />
      ) : null}
    </>,
    document.body,
  );
}

/* ------------------------------------------------------------------ tooltip */

export function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; keys?: string; x: number; y: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const over = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest('[data-tip]') as HTMLElement | null;
      if (timer) clearTimeout(timer);
      if (!el) { setTip(null); return; }
      timer = setTimeout(() => {
        const r = el.getBoundingClientRect();
        const below = r.top < 60;
        setTip({ text: el.dataset.tip!, keys: el.dataset.keys, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 30 });
      }, 450);
    };
    const down = () => { if (timer) clearTimeout(timer); setTip(null); };
    window.addEventListener('mouseover', over);
    window.addEventListener('pointerdown', down);
    return () => { window.removeEventListener('mouseover', over); window.removeEventListener('pointerdown', down); };
  }, []);
  if (!tip) return null;
  return createPortal(
    <div className="tooltip" style={{ left: tip.x, top: tip.y, transform: 'translateX(-50%)' }}>
      {tip.text}{tip.keys ? <span className="kbd">{tip.keys}</span> : null}
    </div>,
    document.body,
  );
}

export function Modal({ title, onClose, children, footer, wide, testId }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean; testId?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return createPortal(
    <div className="modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal' + (wide ? ' wide' : '')} data-testid={testId} onKeyDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="grow">{title}</span>
          <IconButton icon="close" onClick={onClose} tip="Close" testId="modal-close" />
        </div>
        {children}
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
