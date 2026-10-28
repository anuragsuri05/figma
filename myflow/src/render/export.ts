import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DocumentData, ExportSetting, SceneNode } from '../model/types';
import { SvgNode, StaticRenderRoot } from './NodeRenderer';
import { descendants, rotatedBounds } from '../model/tree';

const fontCssCache = new Map<string, string>();

async function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

const GOOGLE = new Set(['Inter', 'Roboto', 'Poppins', 'Montserrat', 'Lato', 'Playfair Display', 'Source Code Pro']);

async function fontFaceCss(families: Set<string>): Promise<string> {
  let css = '';
  for (const fam of families) {
    if (!GOOGLE.has(fam)) continue;
    if (fontCssCache.has(fam)) { css += fontCssCache.get(fam); continue; }
    try {
      const res = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam)}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap`);
      let text = await res.text();
      // only latin subsets to keep size down
      const blocks = text.split('}').filter((b) => b.includes('@font-face'));
      const latin = text.includes('/* latin */') ? text.split('/* ').filter((b) => b.startsWith('latin */')).map((b) => b.replace('latin */', '')) : blocks.map((b) => b + '}');
      text = latin.join('\n');
      const urls = [...text.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
      for (const u of urls) {
        const blob = await (await fetch(u)).blob();
        text = text.replace(u, await toDataUrl(blob));
      }
      fontCssCache.set(fam, text);
      css += text;
    } catch {
      fontCssCache.set(fam, '');
    }
  }
  return css;
}

export function exportBounds(doc: DocumentData, id: string) {
  const n = doc.nodes[id];
  return rotatedBounds({ x: 0, y: 0, width: n.width, height: n.height }, n.rotation);
}

export function nodeToSvgString(doc: DocumentData, id: string, opts: { fontCss?: string; scale?: number; background?: string } = {}): { svg: string; width: number; height: number } {
  const n = doc.nodes[id];
  const b = exportBounds(doc, id);
  // place node at origin
  const shifted: Record<string, SceneNode> = { ...doc.nodes, [id]: { ...n, x: -b.x, y: -b.y } };
  const scale = opts.scale ?? 1;
  const w = Math.max(1, Math.round(b.width * scale)), h = Math.max(1, Math.round(b.height * scale));
  const wrapped = renderToStaticMarkup(
    React.createElement('svg', null,
      React.createElement(StaticRenderRoot, { nodes: shifted, opts: { prefix: 'x' + id.slice(-6), interactive: false, exportMode: true } },
        React.createElement(SvgNode, { id }))),
  );
  const inner = wrapped.replace(/^<svg>/, '').replace(/<\/svg>$/, '');
  const style = opts.fontCss ? `<style>${opts.fontCss}</style>` : '';
  const bg = opts.background ? `<rect width="${b.width}" height="${b.height}" fill="${opts.background}"/>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${b.width} ${b.height}" fill="none">${style}${bg}${inner}</svg>`;
  return { svg, width: w, height: h };
}

function usedFamilies(doc: DocumentData, id: string) {
  const fam = new Set<string>();
  for (const nid of [id, ...descendants(doc, id)]) {
    const t = doc.nodes[nid]?.text;
    if (t) fam.add(t.fontFamily);
  }
  return fam;
}

export async function rasterize(doc: DocumentData, id: string, scale: number, type: 'image/png' | 'image/jpeg', background?: string): Promise<{ blob: Blob; canvas: HTMLCanvasElement }> {
  const fontCss = await fontFaceCss(usedFamilies(doc, id));
  const { svg, width, height } = nodeToSvgString(doc, id, { fontCss, scale });
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('render failed')); img.src = url; });
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (type === 'image/jpeg' || background) { ctx.fillStyle = background ?? '#FFFFFF'; ctx.fillRect(0, 0, width, height); }
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), type, 0.92));
  return { blob, canvas };
}

/* ------------------------------------------------------------ PDF */

function bytes(s: string) { return new TextEncoder().encode(s); }

export async function buildPdf(pages: { jpeg: Uint8Array; pxW: number; pxH: number; w: number; h: number }[]): Promise<Blob> {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (b: Uint8Array) => { chunks.push(b); len += b.length; };
  const obj = (num: number, body: (Uint8Array | string)[]) => {
    offsets[num] = len;
    push(bytes(`${num} 0 obj\n`));
    for (const b of body) push(typeof b === 'string' ? bytes(b) : b);
    push(bytes('\nendobj\n'));
  };
  push(bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
  const pageCount = pages.length;
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  obj(2, [`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`]);
  pages.forEach((p, i) => {
    const pn = 3 + i * 3, im = pn + 1, ct = pn + 2;
    obj(pn, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.w} ${p.h}] /Resources << /XObject << /Im${i} ${im} 0 R >> >> /Contents ${ct} 0 R >>`]);
    obj(im, [`<< /Type /XObject /Subtype /Image /Width ${p.pxW} /Height ${p.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, '\nendstream']);
    const content = `q ${p.w} 0 0 ${p.h} 0 0 cm /Im${i} Do Q`;
    obj(ct, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
  });
  const total = 3 + pageCount * 3;
  const xrefAt = len;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  push(bytes(xref));
  push(bytes(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`));
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

export async function pdfForNodes(doc: DocumentData, ids: string[], scale = 2): Promise<Blob> {
  const pages = [];
  for (const id of ids) {
    const { blob, canvas } = await rasterize(doc, id, scale, 'image/jpeg', '#FFFFFF');
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    pages.push({ jpeg, pxW: canvas.width, pxH: canvas.height, w: canvas.width / scale, h: canvas.height / scale });
  }
  return buildPdf(pages);
}

/* ------------------------------------------------------------ download */

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function safeName(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'export';
}

export async function exportNode(doc: DocumentData, id: string, setting: Pick<ExportSetting, 'format' | 'scale' | 'suffix'>): Promise<{ blob: Blob; filename: string }> {
  const n = doc.nodes[id];
  const base = safeName(n.name) + (setting.suffix || (setting.scale !== 1 && setting.format !== 'SVG' && setting.format !== 'PDF' ? `@${setting.scale}x` : ''));
  if (setting.format === 'SVG') {
    const fontCss = await fontFaceCss(usedFamilies(doc, id));
    const { svg } = nodeToSvgString(doc, id, { fontCss });
    return { blob: new Blob([svg], { type: 'image/svg+xml' }), filename: base + '.svg' };
  }
  if (setting.format === 'PDF') return { blob: await pdfForNodes(doc, [id], 2), filename: base + '.pdf' };
  const type = setting.format === 'JPG' ? 'image/jpeg' : 'image/png';
  const { blob } = await rasterize(doc, id, setting.scale, type);
  return { blob, filename: base + (setting.format === 'JPG' ? '.jpg' : '.png') };
}

export async function thumbnailFor(doc: DocumentData, pageIndex = 0): Promise<string | undefined> {
  const page = doc.pages[pageIndex];
  const first = page?.children.find((id) => doc.nodes[id]?.visible && doc.nodes[id].type === 'FRAME') ?? page?.children.find((id) => doc.nodes[id]?.visible);
  if (!first) return undefined;
  try {
    const n = doc.nodes[first];
    const scale = Math.min(1, 400 / Math.max(n.width, n.height));
    const { svg } = nodeToSvgString(doc, first, { scale });
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  } catch {
    return undefined;
  }
}

export async function copyNodeAsPng(doc: DocumentData, id: string) {
  const { blob } = await rasterize(doc, id, 2, 'image/png');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
