/**
 * Converts the agent's compact JSON design spec into My Flow scene nodes,
 * and applies style patches ("props") to existing nodes.
 */
import type { DocumentData, Effect, Paint, SceneNode, TextProps } from '../model/types';
import { createNode, solid, uid, imagePaint, defaultLayout } from '../model/defaults';
import { normalizeHex } from '../model/color';
import { FONT_FAMILIES } from '../model/defaults';

export interface Spec {
  type?: string;
  name?: string;
  x?: number; y?: number; width?: number; height?: number;
  layout?: { mode?: string; gap?: number; padding?: number | number[]; align?: string; crossAlign?: string; wrapGap?: number };
  sizing?: { h?: string; v?: string } | string;
  fill?: unknown; stroke?: unknown; radius?: number | number[]; shadow?: unknown; blur?: number; backgroundBlur?: number;
  opacity?: number; rotation?: number; clip?: boolean;
  text?: string; fontSize?: number; fontWeight?: number; fontFamily?: string; italic?: boolean; color?: string;
  textAlign?: string; lineHeight?: number; letterSpacing?: number; decoration?: string; textCase?: string; list?: string;
  svg?: string; image?: string; points?: number; innerRadius?: number;
  absolute?: boolean; constraints?: { h?: string; v?: string };
  children?: Spec[];
}

const asHex = (v: unknown, fb = '#000000') => (typeof v === 'string' && normalizeHex(v)) || fb;

export function parsePaint(v: unknown): Paint | null {
  if (v == null || v === 'none' || v === false) return null;
  if (typeof v === 'string') {
    const m = v.trim().match(/^(#[0-9a-f]{3,8})(?:\s*\/\s*(\d+(?:\.\d+)?)%?)?$/i);
    if (m) {
      const p = solid(asHex(m[1]));
      if (m[2]) p.opacity = Math.max(0, Math.min(1, +m[2] > 1 ? +m[2] / 100 : +m[2]));
      if (/^#[0-9a-f]{8}$/i.test(m[1])) p.opacity = parseInt(m[1].slice(7, 9), 16) / 255;
      return p;
    }
    const lg = v.match(/linear-gradient\(\s*(\d+)deg\s*,(.+)\)/i);
    if (lg) return gradientPaint('GRADIENT_LINEAR', +lg[1], lg[2]);
    const rg = v.match(/radial-gradient\((.+)\)/i);
    if (rg) return gradientPaint('GRADIENT_RADIAL', 0, rg[1].replace(/^[^#]*?(?=#)/, ''));
    return solid(asHex(v));
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (o.gradient || o.type === 'linear' || o.type === 'radial') {
      const g = (o.gradient ?? o) as Record<string, unknown>;
      const colors = (g.colors ?? g.stops ?? []) as (string | { color: string; offset?: number })[];
      const stops = colors.map((c, i) => (typeof c === 'string' ? { color: asHex(c), offset: colors.length > 1 ? i / (colors.length - 1) : 0 } : { color: asHex(c.color), offset: c.offset ?? i / Math.max(1, colors.length - 1) }));
      return { id: uid('p'), type: g.type === 'radial' ? 'GRADIENT_RADIAL' : 'GRADIENT_LINEAR', visible: true, opacity: 1, color: stops[0]?.color ?? '#000000', angle: (g.angle as number) ?? 135, stops };
    }
    if (o.color) { const p = solid(asHex(o.color)); if (typeof o.opacity === 'number') p.opacity = o.opacity > 1 ? o.opacity / 100 : o.opacity; return p; }
  }
  return null;
}

function gradientPaint(type: Paint['type'], angle: number, list: string): Paint {
  const parts = list.split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
  const stops = parts.map((s, i) => {
    const m = s.match(/(#[0-9a-f]{3,8})\s*(\d+(?:\.\d+)?)?%?/i);
    return { color: asHex(m?.[1]), offset: m?.[2] ? +m[2] / 100 : i / Math.max(1, parts.length - 1) };
  });
  return { id: uid('p'), type, visible: true, opacity: 1, color: stops[0]?.color ?? '#000000', angle, stops };
}

function parseShadow(v: unknown): Effect[] {
  if (!v) return [];
  const list = Array.isArray(v) ? v : [v];
  return list.map((s) => {
    const o = (s === true ? {} : s) as Record<string, unknown>;
    return {
      id: uid('e'), type: o.inner ? 'INNER_SHADOW' : 'DROP_SHADOW', visible: true,
      color: asHex(o.color, '#000000'), opacity: typeof o.opacity === 'number' ? (o.opacity > 1 ? o.opacity / 100 : o.opacity) : 0.12,
      x: (o.x as number) ?? 0, y: (o.y as number) ?? 4, blur: (o.blur as number) ?? 16, spread: (o.spread as number) ?? 0,
    } as Effect;
  });
}

const sizingOf = (v: string | undefined) => (v === 'fill' ? 'FILL' : v === 'hug' ? 'HUG' : v === 'fixed' ? 'FIXED' : undefined);
const alignOf = (v: string | undefined) => (v === 'center' ? 'CENTER' : v === 'end' ? 'MAX' : v === 'space-between' ? 'SPACE_BETWEEN' : 'MIN');

/** Apply style/geometry props (the same vocabulary as Spec) to a node in place. */
export function applyProps(n: SceneNode, p: Spec & Record<string, unknown>) {
  if (p.name !== undefined) n.name = String(p.name);
  if (typeof p.x === 'number') n.x = p.x;
  if (typeof p.y === 'number') n.y = p.y;
  if (typeof p.width === 'number' && p.width > 0) { n.width = p.width; if (n.sizingH === 'HUG') n.sizingH = 'FIXED'; if (n.text?.autoResize === 'WIDTH_AND_HEIGHT') n.text.autoResize = 'HEIGHT'; }
  if (typeof p.height === 'number' && p.height > 0) { n.height = p.height; if (n.sizingV === 'HUG') n.sizingV = 'FIXED'; }
  if (typeof p.opacity === 'number') n.opacity = p.opacity > 1 ? p.opacity / 100 : p.opacity;
  if (typeof p.rotation === 'number') n.rotation = p.rotation;
  if (typeof p.clip === 'boolean') n.clipContent = p.clip;
  if (typeof p.visible === 'boolean') n.visible = p.visible;
  if (p.fill !== undefined) {
    if (Array.isArray(p.fill)) n.fills = p.fill.map(parsePaint).filter(Boolean) as Paint[];
    else { const f = parsePaint(p.fill); n.fills = f ? [f] : []; }
    if (n.type === 'TEXT' && !n.fills.length) n.fills = [solid('#000000')];
  }
  if (p.color !== undefined && n.type === 'TEXT') { const f = parsePaint(p.color); if (f) n.fills = [f]; }
  if (p.stroke !== undefined) {
    if (!p.stroke) n.strokes = [];
    else {
      const s = (typeof p.stroke === 'string' ? { color: p.stroke } : p.stroke) as Record<string, unknown>;
      const paint = parsePaint(s.color ?? s);
      n.strokes = paint ? [paint] : [];
      n.strokeWeight = (s.weight as number) ?? (s.width as number) ?? n.strokeWeight ?? 1;
      if (s.align === 'inside' || s.align === 'outside' || s.align === 'center') n.strokeAlign = (s.align as string).toUpperCase() as SceneNode['strokeAlign'];
      if (s.dashed) n.strokeDash = [6, 4];
    }
  }
  if (p.radius !== undefined) {
    if (Array.isArray(p.radius)) n.corners = [p.radius[0] ?? 0, p.radius[1] ?? 0, p.radius[2] ?? 0, p.radius[3] ?? 0];
    else { n.cornerRadius = p.radius; n.corners = null; }
  }
  const effects: Effect[] = [];
  if (p.shadow !== undefined) effects.push(...parseShadow(p.shadow));
  if (typeof p.blur === 'number' && p.blur > 0) effects.push({ id: uid('e'), type: 'LAYER_BLUR', visible: true, color: '#000000', opacity: 1, x: 0, y: 0, blur: p.blur, spread: 0 });
  if (typeof p.backgroundBlur === 'number' && p.backgroundBlur > 0) effects.push({ id: uid('e'), type: 'BACKGROUND_BLUR', visible: true, color: '#000000', opacity: 1, x: 0, y: 0, blur: p.backgroundBlur, spread: 0 });
  if (p.shadow !== undefined || p.blur !== undefined || p.backgroundBlur !== undefined) n.effects = effects;
  if (p.layout && (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE')) {
    const L = p.layout;
    const mode = L.mode === 'horizontal' || L.mode === 'row' ? 'HORIZONTAL' : L.mode === 'wrap' ? 'WRAP' : L.mode === 'none' ? 'NONE' : 'VERTICAL';
    const pad = Array.isArray(L.padding) ? L.padding : [L.padding ?? 0, L.padding ?? 0, L.padding ?? 0, L.padding ?? 0];
    const [pt, pr, pb, pl] = pad.length === 2 ? [pad[0], pad[1], pad[0], pad[1]] : [pad[0] ?? 0, pad[1] ?? 0, pad[2] ?? 0, pad[3] ?? 0];
    n.layout = { ...defaultLayout(), ...n.layout, mode, gap: L.gap ?? n.layout.gap ?? 0, counterGap: L.wrapGap ?? L.gap ?? 0, paddingTop: pt, paddingRight: pr, paddingBottom: pb, paddingLeft: pl, alignMain: alignOf(L.align), alignCross: alignOf(L.crossAlign) === 'SPACE_BETWEEN' ? 'MIN' : (alignOf(L.crossAlign) as 'MIN') };
  }
  const sz = typeof p.sizing === 'string' ? { h: p.sizing, v: p.sizing } : p.sizing;
  if (sz) {
    const h = sizingOf(sz.h), v = sizingOf(sz.v);
    if (h) n.sizingH = h;
    if (v) n.sizingV = v;
    if (n.text && h === 'FILL' && n.text.autoResize === 'WIDTH_AND_HEIGHT') n.text.autoResize = 'HEIGHT';
    if (n.text && h === 'HUG') n.text.autoResize = 'WIDTH_AND_HEIGHT';
  }
  if (typeof p.absolute === 'boolean') n.absolutePosition = p.absolute;
  if (p.constraints) {
    const mapH: Record<string, SceneNode['constraintH']> = { left: 'LEFT', right: 'RIGHT', 'left-right': 'LEFT_RIGHT', center: 'CENTER', scale: 'SCALE' };
    const mapV: Record<string, SceneNode['constraintV']> = { top: 'TOP', bottom: 'BOTTOM', 'top-bottom': 'TOP_BOTTOM', center: 'CENTER', scale: 'SCALE' };
    if (p.constraints.h && mapH[p.constraints.h]) n.constraintH = mapH[p.constraints.h];
    if (p.constraints.v && mapV[p.constraints.v]) n.constraintV = mapV[p.constraints.v];
  }
  if (n.text) {
    const t = n.text;
    if (p.text !== undefined) t.characters = String(p.text);
    if (typeof p.fontSize === 'number') t.fontSize = p.fontSize;
    if (typeof p.fontWeight === 'number') t.fontWeight = Math.round(p.fontWeight / 100) * 100 || 400;
    if (typeof p.fontFamily === 'string') t.fontFamily = FONT_FAMILIES.find((f) => f.toLowerCase() === p.fontFamily!.toLowerCase()) ?? 'Inter';
    if (typeof p.italic === 'boolean') t.italic = p.italic;
    if (typeof p.lineHeight === 'number') t.lineHeight = p.lineHeight <= 4 ? Math.round(p.lineHeight * t.fontSize) : p.lineHeight;
    if (typeof p.letterSpacing === 'number') t.letterSpacing = p.letterSpacing;
    if (p.textAlign) t.textAlign = (p.textAlign === 'justify' ? 'JUSTIFIED' : String(p.textAlign).toUpperCase()) as TextProps['textAlign'];
    if (p.decoration) t.decoration = p.decoration === 'underline' ? 'UNDERLINE' : p.decoration === 'strikethrough' ? 'STRIKETHROUGH' : 'NONE';
    if (p.textCase) t.textCase = p.textCase === 'upper' ? 'UPPER' : p.textCase === 'lower' ? 'LOWER' : p.textCase === 'title' ? 'TITLE' : 'ORIGINAL';
    if (p.list) t.listType = p.list === 'bullet' ? 'BULLET' : p.list === 'number' ? 'NUMBER' : 'NONE';
  }
  if ((n.type === 'POLYGON' || n.type === 'STAR') && typeof p.points === 'number') n.pointCount = Math.max(3, Math.round(p.points));
  if (n.type === 'STAR' && typeof p.innerRadius === 'number') n.innerRadius = p.innerRadius;
  if (typeof p.svg === 'string' && p.svg.includes('<svg')) n.fills = [imagePaint(svgDataUrl(p.svg))];
}

export function svgDataUrl(svg: string) {
  let s = svg.trim();
  if (!/xmlns=/.test(s)) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
}

const TYPE_MAP: Record<string, SceneNode['type']> = {
  frame: 'FRAME', group: 'FRAME', stack: 'FRAME', row: 'FRAME', column: 'FRAME', container: 'FRAME', button: 'FRAME', card: 'FRAME',
  text: 'TEXT', rect: 'RECTANGLE', rectangle: 'RECTANGLE', ellipse: 'ELLIPSE', circle: 'ELLIPSE', line: 'LINE',
  polygon: 'POLYGON', star: 'STAR', icon: 'RECTANGLE', image: 'RECTANGLE', svg: 'RECTANGLE', component: 'COMPONENT',
};

/** Build a node subtree from spec into doc. Returns the root id and a name→id map. Images are resolved later. */
export function buildSpec(doc: DocumentData, spec: Spec, parent: SceneNode | null, created: { id: string; name: string }[] = [], pendingImages: { id: string; query: string }[] = []): string {
  const kind = (spec.type ?? (spec.children ? 'frame' : spec.text !== undefined ? 'text' : 'rect')).toLowerCase();
  const type = TYPE_MAP[kind] ?? 'FRAME';
  const n = createNode(type, { name: spec.name ?? (kind === 'text' ? String(spec.text ?? 'Text').slice(0, 40) : kind.charAt(0).toUpperCase() + kind.slice(1)) });
  // sensible defaults per kind
  if (type === 'FRAME' || type === 'COMPONENT') { n.fills = []; n.clipContent = false; }
  if (kind === 'icon' || kind === 'svg' || kind === 'image') { n.width = spec.width ?? 24; n.height = spec.height ?? 24; n.fills = [solid('#D9D9D9')]; }
  if (type === 'TEXT') { n.text!.characters = String(spec.text ?? ''); n.fills = [solid('#1E1E1E')]; }
  if (type === 'LINE') { n.width = spec.width ?? 100; n.height = 0; n.points = [{ x: 0, y: 0 }, { x: n.width, y: 0 }]; n.strokes = [solid(asHex(spec.color ?? '#D9D9D9'))]; }
  const parentAuto = !!parent && parent.layout.mode !== 'NONE';
  // frames with children default to auto layout + hug unless sized
  if ((type === 'FRAME' || type === 'COMPONENT') && spec.children?.length && !spec.layout) spec = { ...spec, layout: { mode: 'vertical', gap: 0 } };
  applyProps(n, spec as Spec & Record<string, unknown>);
  if ((type === 'FRAME' || type === 'COMPONENT') && n.layout.mode !== 'NONE') {
    const sz = typeof spec.sizing === 'string' ? { h: spec.sizing, v: spec.sizing } : spec.sizing ?? {};
    if (!sz.h) n.sizingH = spec.width ? 'FIXED' : parentAuto ? 'FILL' : 'HUG';
    if (!sz.v) n.sizingV = spec.height ? 'FIXED' : 'HUG';
  }
  if (type === 'TEXT') {
    const sz = typeof spec.sizing === 'string' ? { h: spec.sizing } : spec.sizing ?? {};
    if (spec.width) n.text!.autoResize = 'HEIGHT';
    else if (!sz.h && parentAuto && String(spec.text ?? '').length > 60) { n.sizingH = 'FILL'; n.text!.autoResize = 'HEIGHT'; }
  }
  if (kind === 'image' && !spec.svg) pendingImages.push({ id: n.id, query: String(spec.image ?? spec.name ?? 'photo') });
  doc.nodes[n.id] = n;
  n.parentId = parent?.id ?? null;
  if (parent) parent.children.push(n.id);
  created.push({ id: n.id, name: n.name });
  for (const c of spec.children ?? []) buildSpec(doc, c, n, created, pendingImages);
  return n.id;
}

/** Fetch a stock photo for an image placeholder (Picsum, seeded by query), fallback to a generated gradient. */
export async function resolveImage(query: string, w: number, h: number): Promise<string> {
  const seed = encodeURIComponent(query.toLowerCase().replace(/\s+/g, '-').slice(0, 40) || 'myflow');
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`https://picsum.photos/seed/${seed}/${Math.min(1200, Math.max(64, Math.round(w * 2)))}/${Math.min(1200, Math.max(64, Math.round(h * 2)))}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error('bad');
    const blob = await res.blob();
    return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); });
  } catch {
    let hash = 0;
    for (const ch of query) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const h1 = hash % 360, h2 = (h1 + 60) % 360;
    return svgDataUrl(`<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1},70%,62%)"/><stop offset="1" stop-color="hsl(${h2},70%,42%)"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><circle cx="300" cy="80" r="40" fill="rgba(255,255,255,.35)"/><path d="M0 300 L140 150 L230 230 L300 170 L400 260 L400 300Z" fill="rgba(0,0,0,.25)"/></svg>`);
  }
}
