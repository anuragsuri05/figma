import type { DocumentData, Paint, SceneNode } from './types';
import { cssColor, hexToRgb } from './color';
import { resolveLineHeight } from './text';

const r2 = (v: number) => Math.round(v * 100) / 100;

function varName(doc: DocumentData, id?: string) {
  if (!id) return null;
  const v = doc.variables.find((x) => x.id === id);
  return v ? '--' + v.name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase() : null;
}

export function paintToCss(doc: DocumentData, p: Paint): string {
  const vn = varName(doc, p.variableId);
  if (p.type === 'SOLID') return vn ? `var(${vn}, ${cssColor(p.color, p.opacity)})` : cssColor(p.color, p.opacity);
  const stops = (p.stops ?? []).map((s) => `${cssColor(s.color, p.opacity)} ${r2(s.offset * 100)}%`).join(', ');
  if (p.type === 'GRADIENT_LINEAR') return `linear-gradient(${p.angle ?? 90}deg, ${stops})`;
  if (p.type === 'GRADIENT_RADIAL') return `radial-gradient(50% 50% at 50% 50%, ${stops})`;
  if (p.type === 'GRADIENT_ANGULAR') return `conic-gradient(from ${p.angle ?? 0}deg at 50% 50%, ${stops})`;
  if (p.type === 'GRADIENT_DIAMOND') return `radial-gradient(50% 50% at 50% 50%, ${stops})`;
  if (p.type === 'IMAGE') return `url(<path-to-image>) lightgray ${p.scaleMode === 'FIT' ? '50% / contain' : '50% / cover'} no-repeat`;
  return 'transparent';
}

export function cssProps(doc: DocumentData, n: SceneNode): [string, string][] {
  const out: [string, string][] = [];
  const parent = n.parentId ? doc.nodes[n.parentId] : undefined;
  const inAuto = parent && parent.layout.mode !== 'NONE' && !n.absolutePosition;
  if (n.layout.mode !== 'NONE' && (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE')) {
    out.push(['display', 'flex']);
    if (n.layout.mode === 'VERTICAL') out.push(['flex-direction', 'column']);
    if (n.layout.mode === 'WRAP') out.push(['flex-wrap', 'wrap']);
    const L = n.layout;
    const map = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between' } as const;
    out.push(['justify-content', map[L.alignMain]]);
    out.push(['align-items', map[L.alignCross]]);
    if (L.alignMain !== 'SPACE_BETWEEN') out.push(['gap', L.mode === 'WRAP' ? `${r2(L.counterGap)}px ${r2(L.gap)}px` : `${r2(L.gap)}px`]);
    const pads = [L.paddingTop, L.paddingRight, L.paddingBottom, L.paddingLeft];
    if (pads.some(Boolean)) out.push(['padding', pads.map((p) => `${r2(p)}px`).join(' ')]);
  }
  if (!inAuto && parent) {
    out.push(['position', 'absolute']);
    out.push(['left', `${r2(n.x)}px`]);
    out.push(['top', `${r2(n.y)}px`]);
  }
  if (n.type !== 'TEXT' || n.text?.autoResize !== 'WIDTH_AND_HEIGHT') {
    const parentRow = inAuto && parent!.layout.mode !== 'VERTICAL';
    const fillMain = (axis: 'H' | 'V') => (axis === 'H' ? parentRow : !parentRow);
    if (inAuto && n.sizingH === 'FILL') out.push(fillMain('H') ? ['flex', '1 0 0'] : ['align-self', 'stretch']);
    else if (n.sizingH === 'HUG') out.push(['width', 'fit-content']);
    else out.push(['width', `${r2(n.width)}px`]);
    if (inAuto && n.sizingV === 'FILL') out.push(fillMain('V') ? ['flex', '1 0 0'] : ['align-self', 'stretch']);
    else if (n.sizingV === 'HUG' || n.type === 'TEXT') { if (n.type !== 'TEXT') out.push(['height', 'fit-content']); }
    else out.push(['height', `${r2(n.height)}px`]);
  }
  if (n.minW != null) out.push(['min-width', `${n.minW}px`]);
  if (n.maxW != null) out.push(['max-width', `${n.maxW}px`]);
  if (n.rotation) out.push(['transform', `rotate(${r2(n.rotation)}deg)`]);
  if (n.type === 'TEXT' && n.text) {
    const t = n.text;
    const f = n.fills.find((x) => x.visible);
    if (f) out.push(['color', paintToCss(doc, f)]);
    out.push(['font-family', `"${t.fontFamily}"`]);
    out.push(['font-size', `${t.fontSize}px`]);
    if (t.italic) out.push(['font-style', 'italic']);
    out.push(['font-weight', String(t.fontWeight)]);
    out.push(['line-height', t.lineHeight === 'AUTO' ? 'normal' : `${r2(resolveLineHeight(t))}px`]);
    if (t.letterSpacing) out.push(['letter-spacing', `${r2((t.letterSpacing / 100) * t.fontSize)}px`]);
    if (t.textAlign !== 'LEFT') out.push(['text-align', t.textAlign === 'JUSTIFIED' ? 'justify' : t.textAlign.toLowerCase()]);
    if (t.decoration !== 'NONE') out.push(['text-decoration-line', t.decoration === 'UNDERLINE' ? 'underline' : 'line-through']);
    if (t.textCase !== 'ORIGINAL') out.push(['text-transform', t.textCase === 'UPPER' ? 'uppercase' : t.textCase === 'LOWER' ? 'lowercase' : 'capitalize']);
    if (t.autoResize === 'TRUNCATE') { out.push(['overflow', 'hidden']); out.push(['text-overflow', 'ellipsis']); }
  } else {
    const fills = n.fills.filter((f) => f.visible);
    if (fills.length === 1 && fills[0].type === 'SOLID') out.push(['background', paintToCss(doc, fills[0])]);
    else if (fills.length) out.push(['background', [...fills].reverse().map((f) => f.type === 'SOLID' ? `linear-gradient(0deg, ${paintToCss(doc, f)} 0%, ${paintToCss(doc, f)} 100%)` : paintToCss(doc, f)).join(', ')]);
  }
  const strokes = n.strokes.filter((s) => s.visible);
  if (strokes.length && n.type !== 'TEXT') {
    const s = strokes[0];
    const style = n.strokeDash.length ? 'dashed' : 'solid';
    out.push([n.strokeAlign === 'OUTSIDE' ? 'outline' : 'border', `${r2(n.strokeWeight)}px ${style} ${paintToCss(doc, s)}`]);
    if (n.strokeAlign === 'OUTSIDE') out.push(['outline-offset', '0']);
  }
  if (n.type === 'ELLIPSE') out.push(['border-radius', '50%']);
  else if (n.corners && n.corners.some(Boolean)) out.push(['border-radius', n.corners.map((c) => `${r2(c)}px`).join(' ')]);
  else if (n.cornerRadius) out.push(['border-radius', `${r2(n.cornerRadius)}px`]);
  const shadows = n.effects.filter((e) => e.visible && (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW'));
  if (shadows.length) out.push([n.type === 'TEXT' ? 'text-shadow' : 'box-shadow', shadows.map((e) => `${e.type === 'INNER_SHADOW' ? 'inset ' : ''}${r2(e.x)}px ${r2(e.y)}px ${r2(e.blur)}px ${n.type === 'TEXT' ? '' : r2(e.spread) + 'px '}${cssColor(e.color, e.opacity)}`).join(', ')]);
  const lb = n.effects.find((e) => e.visible && e.type === 'LAYER_BLUR');
  if (lb) out.push(['filter', `blur(${r2(lb.blur / 2)}px)`]);
  const bb = n.effects.find((e) => e.visible && e.type === 'BACKGROUND_BLUR');
  if (bb) out.push(['backdrop-filter', `blur(${r2(bb.blur / 2)}px)`]);
  if (n.opacity < 1) out.push(['opacity', String(r2(n.opacity))]);
  if (n.blendMode !== 'PASS_THROUGH' && n.blendMode !== 'NORMAL') out.push(['mix-blend-mode', n.blendMode.toLowerCase().replace(/_/g, '-')]);
  if (n.clipContent && n.children.length) out.push(['overflow', 'hidden']);
  return out;
}

export function toCss(doc: DocumentData, n: SceneNode) {
  return `/* ${n.name} */\n` + cssProps(doc, n).map(([k, v]) => `${k}: ${v};`).join('\n');
}

const twSpacing = (px: number) => {
  const map: Record<number, string> = { 0: '0', 1: 'px', 2: '0.5', 4: '1', 6: '1.5', 8: '2', 10: '2.5', 12: '3', 14: '3.5', 16: '4', 20: '5', 24: '6', 28: '7', 32: '8', 36: '9', 40: '10', 44: '11', 48: '12', 56: '14', 64: '16', 80: '20', 96: '24' };
  return map[Math.round(px)] ?? `[${r2(px)}px]`;
};

export function toTailwind(doc: DocumentData, n: SceneNode) {
  const c: string[] = [];
  const parent = n.parentId ? doc.nodes[n.parentId] : undefined;
  const inAuto = parent && parent.layout.mode !== 'NONE' && !n.absolutePosition;
  if (n.layout.mode !== 'NONE') {
    c.push('flex');
    if (n.layout.mode === 'VERTICAL') c.push('flex-col');
    if (n.layout.mode === 'WRAP') c.push('flex-wrap');
    const jm = { MIN: 'justify-start', CENTER: 'justify-center', MAX: 'justify-end', SPACE_BETWEEN: 'justify-between' } as const;
    const ia = { MIN: 'items-start', CENTER: 'items-center', MAX: 'items-end' } as const;
    c.push(jm[n.layout.alignMain], ia[n.layout.alignCross]);
    if (n.layout.alignMain !== 'SPACE_BETWEEN') c.push(`gap-${twSpacing(n.layout.gap)}`);
    const L = n.layout;
    if (L.paddingLeft === L.paddingRight && L.paddingLeft) c.push(`px-${twSpacing(L.paddingLeft)}`);
    else { if (L.paddingLeft) c.push(`pl-${twSpacing(L.paddingLeft)}`); if (L.paddingRight) c.push(`pr-${twSpacing(L.paddingRight)}`); }
    if (L.paddingTop === L.paddingBottom && L.paddingTop) c.push(`py-${twSpacing(L.paddingTop)}`);
    else { if (L.paddingTop) c.push(`pt-${twSpacing(L.paddingTop)}`); if (L.paddingBottom) c.push(`pb-${twSpacing(L.paddingBottom)}`); }
  }
  if (!inAuto && parent) c.push('absolute', `left-[${r2(n.x)}px]`, `top-[${r2(n.y)}px]`);
  const row = inAuto && parent!.layout.mode !== 'VERTICAL';
  if (inAuto && n.sizingH === 'FILL') c.push(row ? 'flex-1' : 'self-stretch'); else if (n.sizingH !== 'HUG' && !(n.type === 'TEXT' && n.text?.autoResize === 'WIDTH_AND_HEIGHT')) c.push(`w-[${r2(n.width)}px]`);
  if (inAuto && n.sizingV === 'FILL') c.push(row ? 'self-stretch' : 'flex-1'); else if (n.sizingV !== 'HUG' && n.type !== 'TEXT') c.push(`h-[${r2(n.height)}px]`);
  const twColor = (hex: string, a: number) => `[${hex}]${a < 1 ? `/[${r2(a)}]` : ''}`;
  const f = n.fills.find((x) => x.visible && x.type === 'SOLID');
  if (f) c.push(n.type === 'TEXT' ? `text-${twColor(f.color, f.opacity)}` : `bg-${twColor(f.color, f.opacity)}`);
  const grad = n.fills.find((x) => x.visible && x.type.startsWith('GRADIENT'));
  if (grad && !f) c.push(`bg-[${paintToCss(doc, grad).replace(/\s+/g, '_')}]`);
  if (n.cornerRadius && n.type !== 'ELLIPSE') c.push(`rounded-[${r2(n.cornerRadius)}px]`);
  if (n.type === 'ELLIPSE') c.push('rounded-full');
  const s = n.strokes.find((x) => x.visible && x.type === 'SOLID');
  if (s) c.push(n.strokeWeight === 1 ? 'border' : `border-[${r2(n.strokeWeight)}px]`, `border-${twColor(s.color, s.opacity)}`);
  if (n.text) {
    c.push(`text-[${n.text.fontSize}px]`, `font-[${n.text.fontWeight}]`, `font-['${n.text.fontFamily.replace(/ /g, '_')}']`);
    if (n.text.textAlign === 'CENTER') c.push('text-center');
    if (n.text.textAlign === 'RIGHT') c.push('text-right');
  }
  const sh = n.effects.filter((e) => e.visible && (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW'));
  if (sh.length) c.push(`shadow-[${sh.map((e) => `${e.type === 'INNER_SHADOW' ? 'inset_' : ''}${r2(e.x)}px_${r2(e.y)}px_${r2(e.blur)}px_${r2(e.spread)}px_${cssColor(e.color, e.opacity).replace(/\s+/g, '')}`).join(',')}]`);
  const lblur = n.effects.find((e) => e.visible && e.type === 'LAYER_BLUR');
  if (lblur) c.push(`blur-[${r2(lblur.blur / 2)}px]`);
  const bblur = n.effects.find((e) => e.visible && e.type === 'BACKGROUND_BLUR');
  if (bblur) c.push(`backdrop-blur-[${r2(bblur.blur / 2)}px]`);
  if (n.opacity < 1) c.push(`opacity-[${r2(n.opacity)}]`);
  if (n.clipContent && n.children.length) c.push('overflow-hidden');
  const tag = n.type === 'TEXT' ? 'p' : 'div';
  const content = n.type === 'TEXT' ? n.text!.characters : '';
  return `<${tag} className="${c.join(' ')}">${content}</${tag}>`;
}

function swiftColor(hex: string, a = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `Color(red: ${r2(r / 255)}, green: ${r2(g / 255)}, blue: ${r2(b / 255)}${a < 1 ? `).opacity(${r2(a)}` : ''})`;
}

export function toSwiftUI(doc: DocumentData, n: SceneNode) {
  const lines: string[] = [];
  const f = n.fills.find((x) => x.visible && x.type === 'SOLID');
  if (n.type === 'TEXT' && n.text) {
    lines.push(`Text(${JSON.stringify(n.text.characters)})`);
    lines.push(`  .font(Font.custom("${n.text.fontFamily}", size: ${n.text.fontSize}).weight(.${n.text.fontWeight >= 700 ? 'bold' : n.text.fontWeight >= 600 ? 'semibold' : n.text.fontWeight >= 500 ? 'medium' : 'regular'}))`);
    if (f) lines.push(`  .foregroundColor(${swiftColor(f.color, f.opacity)})`);
  } else if (n.layout.mode !== 'NONE') {
    lines.push(`${n.layout.mode === 'VERTICAL' ? 'VStack' : 'HStack'}(alignment: .${n.layout.alignCross === 'CENTER' ? 'center' : n.layout.mode === 'VERTICAL' ? (n.layout.alignCross === 'MIN' ? 'leading' : 'trailing') : (n.layout.alignCross === 'MIN' ? 'top' : 'bottom')}, spacing: ${n.layout.gap}) {`);
    lines.push('  // children');
    lines.push('}');
    lines.push(`.padding(EdgeInsets(top: ${n.layout.paddingTop}, leading: ${n.layout.paddingLeft}, bottom: ${n.layout.paddingBottom}, trailing: ${n.layout.paddingRight}))`);
    lines.push(`.frame(width: ${r2(n.width)}, height: ${r2(n.height)})`);
    if (f) lines.push(`.background(${swiftColor(f.color, f.opacity)})`);
  } else {
    lines.push(n.type === 'ELLIPSE' ? 'Ellipse()' : 'Rectangle()');
    lines.push(`  .foregroundColor(.clear)`);
    lines.push(`  .frame(width: ${r2(n.width)}, height: ${r2(n.height)})`);
    if (f) lines.push(`  .background(${swiftColor(f.color, f.opacity)})`);
  }
  if (n.cornerRadius) lines.push(`  .cornerRadius(${n.cornerRadius})`);
  const s = n.strokes.find((x) => x.visible && x.type === 'SOLID');
  if (s) lines.push(`  .overlay(RoundedRectangle(cornerRadius: ${n.cornerRadius}).inset(by: ${n.strokeWeight / 2}).stroke(${swiftColor(s.color, s.opacity)}, lineWidth: ${n.strokeWeight}))`);
  const bb = n.effects.find((e) => e.visible && e.type === 'BACKGROUND_BLUR');
  if (bb) lines.push(`  .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: ${n.cornerRadius})) // background blur ${r2(bb.blur / 2)}`);
  const lb = n.effects.find((e) => e.visible && e.type === 'LAYER_BLUR');
  if (lb) lines.push(`  .blur(radius: ${r2(lb.blur / 2)})`);
  const sh = n.effects.find((e) => e.visible && e.type === 'DROP_SHADOW');
  if (sh) lines.push(`  .shadow(color: ${swiftColor(sh.color, sh.opacity)}, radius: ${sh.blur / 2}, x: ${sh.x}, y: ${sh.y})`);
  if (n.opacity < 1) lines.push(`  .opacity(${r2(n.opacity)})`);
  return lines.join('\n');
}

export function toCompose(doc: DocumentData, n: SceneNode) {
  const f = n.fills.find((x) => x.visible && x.type === 'SOLID');
  const col = (hex: string, a = 1) => `Color(0x${Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase()}${hex.replace('#', '').toUpperCase()})`;
  if (n.type === 'TEXT' && n.text) {
    return [
      'Text(',
      `  text = ${JSON.stringify(n.text.characters)},`,
      '  style = TextStyle(',
      `    fontSize = ${n.text.fontSize}.sp,`,
      `    fontWeight = FontWeight(${n.text.fontWeight}),`,
      f ? `    color = ${col(f.color, f.opacity)},` : '',
      '  )',
      ')',
    ].filter(Boolean).join('\n');
  }
  const mods = [
    `.width(${r2(n.width)}.dp)`,
    `.height(${r2(n.height)}.dp)`,
    ...n.effects.filter((e) => e.visible && e.type === 'DROP_SHADOW').map((e) => `.shadow(elevation = ${r2(e.blur / 2)}.dp, shape = RoundedCornerShape(size = ${n.cornerRadius}.dp), spotColor = ${col(e.color, e.opacity)})`),
    f ? `.background(color = ${col(f.color, f.opacity)}, shape = RoundedCornerShape(size = ${n.cornerRadius}.dp))` : '',
    ...n.strokes.filter((st) => st.visible && st.type === 'SOLID').slice(0, 1).map((st) => `.border(width = ${r2(n.strokeWeight)}.dp, color = ${col(st.color, st.opacity)}, shape = RoundedCornerShape(size = ${n.cornerRadius}.dp))`),
    ...n.effects.filter((e) => e.visible && (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR')).map((e) => `.blur(radius = ${r2(e.blur / 2)}.dp)${e.type === 'BACKGROUND_BLUR' ? ' // background blur: use a blurred backdrop / Haze' : ''}`),
    n.layout.mode !== 'NONE' ? `.padding(start = ${n.layout.paddingLeft}.dp, top = ${n.layout.paddingTop}.dp, end = ${n.layout.paddingRight}.dp, bottom = ${n.layout.paddingBottom}.dp)` : '',
  ].filter(Boolean);
  const container = n.layout.mode === 'VERTICAL' ? 'Column' : n.layout.mode === 'HORIZONTAL' || n.layout.mode === 'WRAP' ? 'Row' : 'Box';
  const arr = n.layout.mode === 'VERTICAL' ? `  verticalArrangement = Arrangement.spacedBy(${n.layout.gap}.dp),` : n.layout.mode !== 'NONE' ? `  horizontalArrangement = Arrangement.spacedBy(${n.layout.gap}.dp),` : '';
  return [`${container}(`, '  modifier = Modifier', ...mods.map((m) => '    ' + m), arr ? '  ,' + arr.trim() : '', ') {', '  // Child views', '}'].filter(Boolean).join('\n');
}
