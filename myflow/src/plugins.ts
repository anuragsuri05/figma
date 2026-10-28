import { S, currentDoc, currentPage, selectedNodes, setProps, createStyle, screenToWorld } from './store/editor';
import { createNode, imagePaint, solid, uid } from './model/defaults';
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from './model/color';
import { removeNode, insertNode } from './model/tree';
import type { DocumentData, SceneNode, VectorPoint } from './model/types';

export const PLUGINS = [
  { id: 'lorem', name: 'Lorem ipsum', description: 'Fill selected text layers with placeholder copy or insert a paragraph.' },
  { id: 'image', name: 'Random image fill', description: 'Fill selected shapes with photos (Picsum) — falls back to generated art offline.' },
  { id: 'contrast', name: 'Contrast checker', description: 'Check WCAG contrast of a text layer against its background.' },
  { id: 'rename', name: 'Auto rename layers', description: 'Rename selected (or all) layers based on their content.' },
  { id: 'palette', name: 'Generate color palette', description: 'Create a 50–900 tint scale from the selected fill and save as color styles.' },
  { id: 'cleanup', name: 'Clean document', description: 'Delete hidden layers on the current page.' },
  { id: 'icons', name: 'Insert icon set', description: 'Insert a set of simple vector icons.' },
  { id: 'chart', name: 'Bar chart', description: 'Generate a bar chart with auto layout.' },
];

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

function viewportCenter() {
  const s = S();
  return screenToWorld(s.viewport.width / 2, s.viewport.height / 2);
}

function addTopLevel(nodes: SceneNode[], rootIds: string[]) {
  S().update((d) => {
    const page = d.pages.find((p) => p.id === S().pageId)!;
    for (const n of nodes) d.nodes[n.id] = n;
    for (const r of rootIds) { page.children.push(r); }
  });
  S().select(rootIds);
}

function generatedArt(seed: number): string {
  const c = document.createElement('canvas');
  c.width = 800; c.height = 600;
  const ctx = c.getContext('2d')!;
  const h = (seed * 67) % 360;
  const g = ctx.createLinearGradient(0, 0, 800, 600);
  g.addColorStop(0, `hsl(${h},70%,60%)`);
  g.addColorStop(1, `hsl(${(h + 80) % 360},70%,40%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 600);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `hsla(${(h + i * 40) % 360},80%,70%,0.35)`;
    ctx.beginPath(); ctx.arc((seed * 131 * (i + 1)) % 800, (seed * 71 * (i + 2)) % 600, 60 + i * 25, 0, Math.PI * 2); ctx.fill();
  }
  return c.toDataURL('image/jpeg', 0.85);
}

async function fetchImage(seed: number): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`https://picsum.photos/seed/myflow${seed}/800/600`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error('bad');
    const blob = await res.blob();
    return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); });
  } catch {
    return generatedArt(seed);
  }
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: string, b: string) {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function backgroundOf(doc: DocumentData, n: SceneNode): string {
  let p = n.parentId ? doc.nodes[n.parentId] : undefined;
  while (p) {
    const f = p.fills.find((x) => x.visible && x.type === 'SOLID');
    if (f) return f.color;
    p = p.parentId ? doc.nodes[p.parentId] : undefined;
  }
  return '#FFFFFF';
}

const ICONS: { name: string; points: VectorPoint[]; closed: boolean; fill?: boolean }[] = [
  { name: 'check', points: [{ x: 4, y: 12 }, { x: 9, y: 17 }, { x: 20, y: 6 }], closed: false },
  { name: 'arrow-right', points: [{ x: 4, y: 12 }, { x: 20, y: 12 }, { x: 14, y: 6 }, { x: 20, y: 12 }, { x: 14, y: 18 }], closed: false },
  { name: 'chevron-down', points: [{ x: 6, y: 9 }, { x: 12, y: 15 }, { x: 18, y: 9 }], closed: false },
  { name: 'menu', points: [{ x: 4, y: 7 }, { x: 20, y: 7 }, { x: 20, y: 12 }, { x: 4, y: 12 }, { x: 4, y: 17 }, { x: 20, y: 17 }], closed: false },
  { name: 'triangle-alert', points: [{ x: 12, y: 3 }, { x: 22, y: 20 }, { x: 2, y: 20 }], closed: true },
  { name: 'heart', points: [
    { x: 12, y: 20, inX: 0, inY: 0, outX: 0, outY: 0 },
    { x: 3, y: 9, inX: 0, inY: 5, outX: 0, outY: -4 },
    { x: 12, y: 6, inX: -3, inY: -5, outX: 3, outY: -5 },
    { x: 21, y: 9, inX: 0, inY: -4, outX: 0, outY: 5 },
  ], closed: true, fill: true },
  { name: 'star', points: Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 4 : 10; return { x: 12 + Math.cos(a) * r, y: 12 + Math.sin(a) * r }; }), closed: true, fill: true },
  { name: 'play', points: [{ x: 7, y: 4 }, { x: 20, y: 12 }, { x: 7, y: 20 }], closed: true, fill: true },
];

export async function runPlugin(id: string) {
  const s = S();
  const doc = currentDoc();
  const sel = selectedNodes();
  switch (id) {
    case 'lorem': {
      const texts = sel.filter((n) => n.type === 'TEXT');
      if (texts.length) {
        setProps(texts.map((t) => t.id), (n) => {
          if (!n.text) return;
          n.text.characters = n.text.autoResize === 'WIDTH_AND_HEIGHT' ? LOREM.split(' ').slice(0, 4).join(' ') : LOREM;
        });
      } else {
        const c = viewportCenter();
        const t = createNode('TEXT', { x: c.x - 160, y: c.y - 40, width: 320, name: 'Lorem ipsum' });
        t.text!.characters = LOREM;
        t.text!.autoResize = 'HEIGHT';
        addTopLevel([t], [t.id]);
      }
      s.toast('Lorem ipsum inserted');
      break;
    }
    case 'image': {
      const shapes = sel.filter((n) => n.type !== 'TEXT' && n.type !== 'GROUP' && n.type !== 'LINE');
      if (!shapes.length) {
        const c = viewportCenter();
        const n = createNode('RECTANGLE', { x: c.x - 200, y: c.y - 150, width: 400, height: 300, name: 'Image' });
        addTopLevel([n], [n.id]);
        shapes.push(S().doc!.nodes[n.id]);
      }
      s.toast('Fetching images…');
      const urls = await Promise.all(shapes.map((_, i) => fetchImage(Math.floor(Math.random() * 1000) + i)));
      S().update((d) => {
        shapes.forEach((sh, i) => { const n = d.nodes[sh.id]; if (n) n.fills = [imagePaint(urls[i])]; });
      });
      S().toast('Image fills applied');
      break;
    }
    case 'contrast': {
      const t = sel.find((n) => n.type === 'TEXT');
      if (!t) { s.toast('Select a text layer to check contrast'); return; }
      const fg = t.fills.find((f) => f.visible && f.type === 'SOLID')?.color ?? '#000000';
      const bg = backgroundOf(doc, t);
      const ratio = contrastRatio(fg, bg);
      const large = (t.text?.fontSize ?? 16) >= 24 || ((t.text?.fontSize ?? 16) >= 18.66 && (t.text?.fontWeight ?? 400) >= 700);
      const aa = ratio >= (large ? 3 : 4.5), aaa = ratio >= (large ? 4.5 : 7);
      s.toast(`Contrast ${ratio.toFixed(2)}:1 — AA ${aa ? '✓ pass' : '✗ fail'} · AAA ${aaa ? '✓ pass' : '✗ fail'}`);
      break;
    }
    case 'rename': {
      const ids = sel.length ? sel.map((n) => n.id) : Object.keys(doc.nodes);
      S().update((d) => {
        for (const id of ids) {
          const n = d.nodes[id];
          if (!n) continue;
          if (n.type === 'TEXT' && n.text) n.name = n.text.characters.slice(0, 30) || 'Text';
          else if (n.fills.some((f) => f.type === 'IMAGE')) n.name = 'Image';
          else if (n.layout.mode === 'HORIZONTAL') n.name = 'Row';
          else if (n.layout.mode === 'VERTICAL') n.name = 'Stack';
          else if (n.type === 'FRAME' && n.children.length && !n.parentId) n.name = 'Screen';
          else if (n.type === 'FRAME' && n.children.length) n.name = 'Container';
          else if (n.type === 'ELLIPSE') n.name = n.width === n.height ? 'Circle' : 'Ellipse';
          else if (n.type === 'RECTANGLE' && n.cornerRadius >= Math.min(n.width, n.height) / 2) n.name = 'Pill';
          else if (n.type === 'RECTANGLE' && n.height <= 2) n.name = 'Divider';
        }
      });
      s.toast(`Renamed ${ids.length} layers`);
      break;
    }
    case 'palette': {
      const base = sel[0]?.fills.find((f) => f.type === 'SOLID')?.color ?? '#0D99FF';
      const hsl = rgbToHsl(hexToRgb(base));
      const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
      const lights = [96, 90, 80, 70, 60, hsl.l, 42, 33, 24, 15];
      const c = viewportCenter();
      const frame = createNode('FRAME', { name: 'Palette', x: c.x - 330, y: c.y - 60, fills: [solid('#FFFFFF')], sizingH: 'HUG', sizingV: 'HUG' });
      frame.layout = { ...frame.layout, mode: 'HORIZONTAL', gap: 8, paddingTop: 16, paddingBottom: 16, paddingLeft: 16, paddingRight: 16 };
      const nodes: SceneNode[] = [frame];
      const colors: { name: string; color: string }[] = [];
      steps.forEach((st, i) => {
        const col = rgbToHex(hslToRgb(hsl.h, hsl.s, lights[i]));
        const sw = createNode('RECTANGLE', { name: `${st}`, width: 56, height: 80, cornerRadius: 8, fills: [solid(col)], parentId: frame.id });
        frame.children.push(sw.id);
        nodes.push(sw);
        colors.push({ name: `Palette/${st}`, color: col });
      });
      addTopLevel(nodes, [frame.id]);
      for (const col of colors) {
        S().update((d) => { d.styles.push({ id: uid('s'), type: 'FILL', name: col.name, fills: [solid(col.color)] }); });
      }
      s.toast('Palette created with 10 color styles');
      void createStyle;
      break;
    }
    case 'cleanup': {
      const page = currentPage();
      let count = 0;
      S().update((d) => {
        const walk = (ids: string[]) => {
          for (const id of [...ids]) {
            const n = d.nodes[id];
            if (!n) continue;
            if (!n.visible) { removeNode(d as DocumentData, id); count++; } else walk(n.children);
          }
        };
        walk(d.pages.find((p) => p.id === page.id)!.children);
      });
      s.toast(`Removed ${count} hidden layer${count === 1 ? '' : 's'}`);
      break;
    }
    case 'icons': {
      const c = viewportCenter();
      const frame = createNode('FRAME', { name: 'Icons', x: c.x - 200, y: c.y - 30, fills: [solid('#FFFFFF')], sizingH: 'HUG', sizingV: 'HUG', cornerRadius: 8 });
      frame.layout = { ...frame.layout, mode: 'HORIZONTAL', gap: 16, paddingTop: 16, paddingBottom: 16, paddingLeft: 16, paddingRight: 16, alignCross: 'CENTER' };
      const nodes: SceneNode[] = [frame];
      for (const ic of ICONS) {
        const box = createNode('FRAME', { name: ic.name, width: 24, height: 24, fills: [], parentId: frame.id, clipContent: false });
        const v = createNode('VECTOR', {
          name: 'Vector', x: 0, y: 0, width: 24, height: 24, points: JSON.parse(JSON.stringify(ic.points)), closed: ic.closed,
          strokes: ic.fill ? [] : [solid('#1E1E1E')], fills: ic.fill ? [solid('#1E1E1E')] : [], strokeWeight: 2, strokeCap: 'ROUND', parentId: box.id,
        });
        box.children.push(v.id);
        frame.children.push(box.id);
        nodes.push(box, v);
      }
      addTopLevel(nodes, [frame.id]);
      s.toast(`Inserted ${ICONS.length} icons`);
      break;
    }
    case 'chart': {
      const c = viewportCenter();
      const values = [40, 75, 55, 90, 65, 30, 80];
      const frame = createNode('FRAME', { name: 'Bar chart', x: c.x - 200, y: c.y - 120, width: 400, height: 240, fills: [solid('#FFFFFF')], cornerRadius: 12 });
      frame.layout = { ...frame.layout, mode: 'HORIZONTAL', gap: 12, paddingTop: 24, paddingBottom: 24, paddingLeft: 24, paddingRight: 24, alignCross: 'MAX', alignMain: 'SPACE_BETWEEN' };
      const nodes: SceneNode[] = [frame];
      values.forEach((v, i) => {
        const bar = createNode('RECTANGLE', { name: `Bar ${i + 1}`, width: 36, height: v * 1.8, cornerRadius: 6, fills: [solid('#0D99FF')], parentId: frame.id });
        frame.children.push(bar.id);
        nodes.push(bar);
      });
      addTopLevel(nodes, [frame.id]);
      s.toast('Chart inserted');
      break;
    }
  }
  void insertNode;
}
