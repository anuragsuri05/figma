import type { TextProps } from './types';

let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, TextLayout>();

export interface TextLayout {
  lines: { text: string; width: number; bullet?: string; para: number }[];
  width: number;
  height: number;
  lineHeight: number;
  ascent: number;
}

export function fontString(t: Pick<TextProps, 'fontFamily' | 'fontWeight' | 'italic' | 'fontSize'>) {
  return `${t.italic ? 'italic ' : ''}${t.fontWeight} ${t.fontSize}px "${t.fontFamily}", Inter, sans-serif`;
}

export function applyCase(s: string, c: TextProps['textCase']) {
  if (c === 'UPPER') return s.toUpperCase();
  if (c === 'LOWER') return s.toLowerCase();
  if (c === 'TITLE') return s.replace(/\b\w/g, (m) => m.toUpperCase());
  return s;
}

export function resolveLineHeight(t: TextProps) {
  return t.lineHeight === 'AUTO' ? Math.round(t.fontSize * 1.21 * 100) / 100 : t.lineHeight;
}

function measure(s: string, t: TextProps): number {
  if (!ctx) {
    if (typeof document === 'undefined') return s.length * t.fontSize * 0.5;
    ctx = document.createElement('canvas').getContext('2d');
  }
  if (!ctx) return s.length * t.fontSize * 0.5;
  ctx.font = fontString(t);
  const spacing = (t.letterSpacing / 100) * t.fontSize;
  return ctx.measureText(s).width + spacing * s.length;
}

export function clearTextCache() { cache.clear(); }

/** wrapWidth null => no wrapping */
export function layoutText(t: TextProps, wrapWidth: number | null): TextLayout {
  const key = JSON.stringify([t, wrapWidth]);
  const hit = cache.get(key);
  if (hit) return hit;
  const lh = resolveLineHeight(t);
  const text = applyCase(t.characters, t.textCase);
  const paragraphs = text.split('\n');
  const lines: TextLayout['lines'] = [];
  paragraphs.forEach((para, pi) => {
    const bullet = t.listType === 'BULLET' ? '•  ' : t.listType === 'NUMBER' ? `${pi + 1}.  ` : '';
    const bulletW = bullet ? measure(bullet, t) : 0;
    const avail = wrapWidth == null ? Infinity : Math.max(1, wrapWidth - bulletW);
    if (para === '') { lines.push({ text: '', width: 0, bullet: bullet || undefined, para: pi }); return; }
    const words = para.split(/(\s+)/);
    let cur = '';
    let first = true;
    const push = (s: string) => {
      lines.push({ text: s, width: measure(s, t) + (first ? bulletW : bulletW), bullet: first && bullet ? bullet : bullet ? ' ' : undefined, para: pi });
      first = false;
    };
    for (const w of words) {
      const cand = cur + w;
      if (measure(cand.trimEnd(), t) <= avail || cur === '') {
        if (measure(cand.trimEnd(), t) > avail && cur === '') {
          // break long word by chars
          let chunk = '';
          for (const ch of w) {
            if (measure(chunk + ch, t) > avail && chunk) { push(chunk); chunk = ch; }
            else chunk += ch;
          }
          cur = chunk;
        } else cur = cand;
      } else {
        push(cur.trimEnd());
        cur = w.trimStart();
      }
    }
    push(cur.trimEnd());
  });
  const width = Math.max(0, ...lines.map((l) => l.width));
  const height = lines.length * lh + Math.max(0, paragraphs.length - 1) * t.paragraphSpacing;
  const res: TextLayout = { lines, width: Math.ceil(width), height: Math.ceil(height), lineHeight: lh, ascent: t.fontSize * 0.8 };
  cache.set(key, res);
  if (cache.size > 2000) cache.clear();
  return res;
}
