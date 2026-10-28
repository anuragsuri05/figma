import {
  S, currentDoc, currentPage, selectedNodes, setProps, deleteSelection, selectAll, selectInverse, selectMatching, duplicateSelection,
  copySelection, pasteClipboard, groupSelection, ungroupSelection, frameSelection, addAutoLayout, removeAutoLayout, createComponent,
  createMultipleComponents, combineAsVariants, addVariant, detachInstance, resetInstance, goToMainComponent, pushOverridesToMain,
  reorder, align, distribute, tidyUp, flip, rotateSelection, toggleLock, toggleVisible, flattenSelection, outlineStroke, swapFillStroke,
  removeFill, removeStroke, useAsMask, zoomAt, zoomToFit, zoomToSelection, addPage, goToPage, unlockAll, showAllHidden, ensureFlowStart,
  zoomToRect, selectionBounds, type ViewState,
} from './store/editor';
import { absRect, visualAbsRect } from './model/tree';
import { exportNode, downloadBlob, pdfForNodes, copyNodeAsPng, nodeToSvgString, safeName } from './render/export';
import { toCss } from './model/codegen';
import type { SceneNode, TextProps, ToolId } from './model/types';
import { createNode, imagePaint, solid, uid } from './model/defaults';
import { runPlugin } from './plugins';
import { AI_ACTIONS, openAgent, useAgent } from './editor/AIPanel';

export interface Command {
  id: string;
  label: string;
  keys?: string[]; // e.g. 'mod+shift+g'
  run: () => void | Promise<void>;
  enabled?: () => boolean;
  checked?: () => boolean;
  category: string;
  hidden?: boolean; // from quick actions
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function displayKeys(k?: string): string {
  if (!k) return '';
  const parts = k.split('+');
  const map: Record<string, string> = isMac
    ? { mod: '⌘', shift: '⇧', alt: '⌥', ctrl: '⌃', enter: '↩', backspace: '⌫', delete: '⌫', escape: 'Esc', pageup: 'PgUp', pagedown: 'PgDn', tab: '⇥', space: 'Space' }
    : { mod: 'Ctrl+', shift: 'Shift+', alt: 'Alt+', ctrl: 'Ctrl+', enter: 'Enter', backspace: 'Backspace', delete: 'Del', escape: 'Esc', pageup: 'PgUp', pagedown: 'PgDn', tab: 'Tab', space: 'Space' };
  const order = ['ctrl', 'alt', 'shift', 'mod'];
  const mods = parts.slice(0, -1).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const key = parts[parts.length - 1];
  const keyLabel = map[key] ?? (key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1));
  return mods.map((m) => map[m] ?? m).join('') + keyLabel;
}

const sel = () => S().selection;
const hasSel = () => S().selection.length > 0;
const single = () => selectedNodes().length === 1;
const textSel = () => selectedNodes().some((n) => n.type === 'TEXT');
const isInstanceSel = () => selectedNodes().some((n) => n.type === 'INSTANCE');
const toggleView = (k: keyof ViewState) => () => S().setView({ [k]: !S().view[k] } as Partial<ViewState>);

export function setTool(t: ToolId) {
  if (t === 'IMAGE') { pickImages(); return; }
  S().setTool(t);
}

export function pickImages() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = async () => {
    const files = [...(input.files ?? [])];
    const urls = await Promise.all(files.map(readAsDataUrl));
    if (!urls.length) return;
    S().setState({ imageToPlace: urls, tool: 'IMAGE' });
    S().toast(`Click or drag to place ${urls.length} image${urls.length > 1 ? 's' : ''}`);
  };
  input.click();
}

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth || 100, h: img.naturalHeight || 100 });
    img.onerror = () => res({ w: 100, h: 100 });
    img.src = src;
  });
}

export async function placeImageAt(src: string, x: number, y: number, parentId: string | null = null, maxSize = 800) {
  let { w, h } = await imageSize(src);
  const k = Math.min(1, maxSize / Math.max(w, h));
  w = Math.round(w * k); h = Math.round(h * k);
  const n = createNode('RECTANGLE', { name: 'Image', x: x - w / 2, y: y - h / 2, width: w, height: h, fills: [imagePaint(src)] });
  S().update((d) => {
    const page = d.pages.find((p) => p.id === S().pageId)!;
    if (parentId) {
      const pa = absRect(d, parentId);
      n.x -= pa.x; n.y -= pa.y;
      n.parentId = parentId;
      d.nodes[parentId].children.push(n.id);
    } else page.children.push(n.id);
    d.nodes[n.id] = n;
  });
  S().select([n.id]);
  return n.id;
}

export async function exportSelection() {
  const s = S();
  const doc = currentDoc();
  let ids = s.selection;
  if (!ids.length) ids = currentPage().children.filter((id) => doc.nodes[id].exports.length);
  if (!ids.length) ids = currentPage().children.filter((id) => ['FRAME', 'COMPONENT', 'SECTION'].includes(doc.nodes[id].type));
  if (!ids.length) { s.toast('Nothing to export'); return; }
  let count = 0;
  for (const id of ids) {
    const n = doc.nodes[id];
    const settings = n.exports.length ? n.exports : [{ id: 'd', scale: 1, suffix: '', format: 'PNG' as const }];
    for (const st of settings) {
      const { blob, filename } = await exportNode(doc, id, st);
      downloadBlob(blob, filename);
      count++;
    }
  }
  s.toast(`Exported ${count} file${count > 1 ? 's' : ''}`);
}

export async function exportFramesToPdf() {
  const doc = currentDoc();
  const frames = currentPage().children.filter((id) => ['FRAME', 'COMPONENT', 'INSTANCE'].includes(doc.nodes[id].type) && doc.nodes[id].visible);
  if (!frames.length) { S().toast('No frames on this page'); return; }
  const sorted = [...frames].sort((a, b) => doc.nodes[a].y - doc.nodes[b].y || doc.nodes[a].x - doc.nodes[b].x);
  const blob = await pdfForNodes(doc, sorted, 2);
  downloadBlob(blob, safeName(doc.name) + '.pdf');
  S().toast(`Exported ${frames.length} frame${frames.length > 1 ? 's' : ''} to PDF`);
}

export function saveLocalCopy() {
  const doc = currentDoc();
  const blob = new Blob([JSON.stringify({ format: 'myflow', version: 1, doc })], { type: 'application/json' });
  downloadBlob(blob, safeName(doc.name) + '.myflow');
  S().toast('Saved local copy');
}

let copiedProps: Partial<SceneNode> | null = null;

function copyProperties() {
  const n = selectedNodes()[0];
  if (!n) return;
  copiedProps = JSON.parse(JSON.stringify({ fills: n.fills, strokes: n.strokes, strokeWeight: n.strokeWeight, strokeAlign: n.strokeAlign, effects: n.effects, opacity: n.opacity, cornerRadius: n.cornerRadius, blendMode: n.blendMode, strokeDash: n.strokeDash, text: n.text ? { ...n.text, characters: undefined } : undefined }));
  S().toast('Copied properties');
}

function pasteProperties() {
  if (!copiedProps) return;
  const p = copiedProps;
  setProps(sel(), (n) => {
    if (p.fills) n.fills = JSON.parse(JSON.stringify(p.fills)).map((f: object) => ({ ...f, id: uid('p') }));
    if (p.strokes) n.strokes = JSON.parse(JSON.stringify(p.strokes));
    if (p.strokeWeight != null) n.strokeWeight = p.strokeWeight;
    if (p.effects) n.effects = JSON.parse(JSON.stringify(p.effects));
    if (p.opacity != null) n.opacity = p.opacity;
    if (p.cornerRadius != null && n.type !== 'TEXT') n.cornerRadius = p.cornerRadius;
    if (p.blendMode) n.blendMode = p.blendMode;
    if (p.strokeAlign) n.strokeAlign = p.strokeAlign;
    if (p.strokeDash) n.strokeDash = [...p.strokeDash];
    if (p.text && n.text) { const { characters: _c, ...rest } = p.text as TextProps; Object.assign(n.text, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))); }
  });
}

function textPatch(fn: (t: TextProps) => void) {
  const ids = selectedNodes().filter((n) => n.text).map((n) => n.id);
  if (!ids.length) return;
  setProps(ids, (n) => { if (n.text) fn(n.text); });
}

function navigateFrame(dir: 1 | -1) {
  const doc = currentDoc();
  const frames = currentPage().children.filter((id) => ['FRAME', 'COMPONENT', 'INSTANCE', 'SECTION'].includes(doc.nodes[id].type));
  if (!frames.length) return;
  frames.sort((a, b) => doc.nodes[a].y - doc.nodes[b].y || doc.nodes[a].x - doc.nodes[b].x);
  const cur = sel()[0] ? frames.indexOf(sel()[0]) : -1;
  const next = frames[(cur + dir + frames.length) % frames.length];
  S().select([next]);
  zoomToRect(visualAbsRect(doc, next), 1);
}

function navigatePage(dir: 1 | -1) {
  const doc = currentDoc();
  const i = doc.pages.findIndex((p) => p.id === S().pageId);
  const next = doc.pages[(i + dir + doc.pages.length) % doc.pages.length];
  goToPage(next.id);
}

export function openPresent(nodeId?: string) {
  const s = S();
  const doc = currentDoc();
  const page = currentPage();
  let start = nodeId;
  if (!start && s.selection.length) {
    let n: SceneNode | undefined = doc.nodes[s.selection[0]];
    while (n?.parentId && doc.nodes[n.parentId].type !== 'SECTION') n = doc.nodes[n.parentId];
    start = n?.id;
  }
  if (!start) start = page.flowStarts[0]?.nodeId;
  if (!start) start = page.children.find((id) => ['FRAME', 'COMPONENT', 'INSTANCE'].includes(doc.nodes[id].type));
  if (!start) { s.toast('Add a frame to present'); return; }
  window.location.hash = `#/file/${s.fileId}/present?node=${start}&page=${page.id}`;
}

async function copyAsSvg() {
  const n = selectedNodes()[0];
  if (!n) return;
  const { svg } = nodeToSvgString(currentDoc(), n.id);
  await navigator.clipboard.writeText(svg).catch(() => {});
  S().toast('Copied as SVG');
}

async function copyAsCss() {
  const n = selectedNodes()[0];
  if (!n) return;
  await navigator.clipboard.writeText(toCss(currentDoc(), n)).catch(() => {});
  S().toast('Copied as CSS');
}

async function copyAsPng() {
  const n = selectedNodes()[0];
  if (!n) return;
  try { await copyNodeAsPng(currentDoc(), n.id); S().toast('Copied as PNG'); } catch { S().toast('Copy as PNG not permitted by browser'); }
}

function copyLink() {
  const url = `${location.origin}${location.pathname}#/file/${S().fileId}${sel()[0] ? `?node-id=${sel()[0]}` : ''}`;
  navigator.clipboard?.writeText(url).catch(() => {});
  S().toast('Link copied to clipboard');
}

function setAsThumbnail() {
  const n = selectedNodes()[0];
  if (!n) return;
  S().update((d) => {
    const page = d.pages.find((p) => p.id === S().pageId)!;
    page.children = [n.id, ...page.children.filter((c) => c !== n.id)];
  });
  S().toast('Set as thumbnail');
}

function addText(characters: string) {
  const s = S();
  const c = { x: (s.viewport.width / 2 - s.panX) / s.zoom, y: (s.viewport.height / 2 - s.panY) / s.zoom };
  const n = createNode('TEXT', { x: c.x, y: c.y, name: characters.slice(0, 40), fills: [solid('#000000')] });
  n.text!.characters = characters;
  s.update((d) => { d.pages.find((p) => p.id === s.pageId)!.children.push(n.id); d.nodes[n.id] = n; });
  s.select([n.id]);
}

export const commands: Command[] = [
  // ---------------- Tools
  { id: 'tool.move', label: 'Move', keys: ['v'], category: 'Tools', run: () => setTool('MOVE') },
  { id: 'tool.hand', label: 'Hand tool', keys: ['h'], category: 'Tools', run: () => setTool('HAND') },
  { id: 'tool.scale', label: 'Scale', keys: ['k'], category: 'Tools', run: () => setTool('SCALE') },
  { id: 'tool.frame', label: 'Frame', keys: ['f', 'a'], category: 'Tools', run: () => setTool('FRAME') },
  { id: 'tool.section', label: 'Section', keys: ['shift+s'], category: 'Tools', run: () => setTool('SECTION') },
  { id: 'tool.slice', label: 'Slice', keys: ['s'], category: 'Tools', run: () => setTool('SLICE') },
  { id: 'tool.rectangle', label: 'Rectangle', keys: ['r'], category: 'Tools', run: () => setTool('RECTANGLE') },
  { id: 'tool.line', label: 'Line', keys: ['l'], category: 'Tools', run: () => setTool('LINE') },
  { id: 'tool.arrow', label: 'Arrow', keys: ['shift+l'], category: 'Tools', run: () => setTool('ARROW') },
  { id: 'tool.ellipse', label: 'Ellipse', keys: ['o'], category: 'Tools', run: () => setTool('ELLIPSE') },
  { id: 'tool.polygon', label: 'Polygon', category: 'Tools', run: () => setTool('POLYGON') },
  { id: 'tool.star', label: 'Star', category: 'Tools', run: () => setTool('STAR') },
  { id: 'tool.image', label: 'Place image…', keys: ['mod+shift+k'], category: 'Tools', run: () => pickImages() },
  { id: 'tool.pen', label: 'Pen', keys: ['p'], category: 'Tools', run: () => setTool('PEN') },
  { id: 'tool.pencil', label: 'Pencil', keys: ['shift+p'], category: 'Tools', run: () => setTool('PENCIL') },
  { id: 'tool.text', label: 'Text', keys: ['t'], category: 'Tools', run: () => setTool('TEXT') },
  { id: 'tool.comment', label: 'Comment', keys: ['c'], category: 'Tools', run: () => { setTool('COMMENT'); S().setState({ commentsPanel: true }); } },

  // ---------------- File
  { id: 'file.back', label: 'Back to files', category: 'File', run: () => { window.location.hash = '#/'; } },
  { id: 'file.new', label: 'New design file', category: 'File', run: () => { window.location.hash = '#/new'; } },
  { id: 'file.placeImage', label: 'Place image…', category: 'File', run: () => pickImages() },
  { id: 'file.saveLocal', label: 'Save local copy…', category: 'File', run: saveLocalCopy },
  { id: 'file.saveVersion', label: 'Save to version history…', keys: ['alt+mod+s'], category: 'File', run: () => S().setState({ modal: 'versions' }) },
  { id: 'file.versionHistory', label: 'Show version history', category: 'File', run: () => S().setState({ modal: 'versions' }) },
  { id: 'file.export', label: 'Export…', keys: ['mod+shift+e'], category: 'File', run: exportSelection },
  { id: 'file.exportPdf', label: 'Export frames to PDF…', category: 'File', run: exportFramesToPdf },
  { id: 'file.share', label: 'Share…', category: 'File', run: () => S().setState({ modal: 'share' }) },
  { id: 'file.duplicate', label: 'Duplicate file', category: 'File', run: () => { window.dispatchEvent(new CustomEvent('myflow:duplicate-file')); } },
  { id: 'file.rename', label: 'Rename file', category: 'File', run: () => { window.dispatchEvent(new CustomEvent('myflow:rename-file')); } },
  { id: 'file.delete', label: 'Delete file…', category: 'File', run: () => { window.dispatchEvent(new CustomEvent('myflow:delete-file')); } },
  { id: 'file.libraries', label: 'Libraries…', keys: ['alt+3'], category: 'File', run: () => S().setState({ modal: 'libraries' }) },

  // ---------------- Edit
  { id: 'edit.undo', label: 'Undo', keys: ['mod+z'], category: 'Edit', run: () => S().undo(), enabled: () => S().past.length > 0 },
  { id: 'edit.redo', label: 'Redo', keys: ['mod+shift+z'], category: 'Edit', run: () => S().redo(), enabled: () => S().future.length > 0 },
  { id: 'edit.copy', label: 'Copy', keys: ['mod+c'], category: 'Edit', run: () => copySelection(false), enabled: hasSel },
  { id: 'edit.cut', label: 'Cut', keys: ['mod+x'], category: 'Edit', run: () => copySelection(true), enabled: hasSel },
  { id: 'edit.paste', label: 'Paste', keys: ['mod+v'], category: 'Edit', run: () => pasteClipboard(), enabled: () => !!S().clipboard },
  { id: 'edit.pasteOver', label: 'Paste over selection', keys: ['mod+shift+v'], category: 'Edit', run: () => pasteClipboard(undefined, 'over'), enabled: () => !!S().clipboard },
  { id: 'edit.pasteReplace', label: 'Paste to replace', keys: ['mod+shift+r'], category: 'Edit', run: () => pasteClipboard(undefined, 'replace'), enabled: () => !!S().clipboard && hasSel() },
  { id: 'edit.duplicate', label: 'Duplicate', keys: ['mod+d'], category: 'Edit', run: () => duplicateSelection(), enabled: hasSel },
  { id: 'edit.delete', label: 'Delete', keys: ['backspace', 'delete'], category: 'Edit', run: deleteSelection, enabled: hasSel },
  { id: 'edit.copyAsPng', label: 'Copy as PNG', keys: ['mod+shift+c'], category: 'Edit', run: copyAsPng, enabled: hasSel },
  { id: 'edit.copyAsSvg', label: 'Copy as SVG', category: 'Edit', run: copyAsSvg, enabled: hasSel },
  { id: 'edit.copyAsCss', label: 'Copy as CSS', category: 'Edit', run: copyAsCss, enabled: hasSel },
  { id: 'edit.copyLink', label: 'Copy link to selection', keys: ['mod+l'], category: 'Edit', run: copyLink },
  { id: 'edit.copyProps', label: 'Copy properties', keys: ['alt+mod+c'], category: 'Edit', run: copyProperties, enabled: single },
  { id: 'edit.pasteProps', label: 'Paste properties', keys: ['alt+mod+v'], category: 'Edit', run: pasteProperties, enabled: () => !!copiedProps && hasSel() },
  { id: 'edit.selectAll', label: 'Select all', keys: ['mod+a'], category: 'Edit', run: selectAll },
  { id: 'edit.selectInverse', label: 'Select inverse', keys: ['mod+shift+a'], category: 'Edit', run: selectInverse },
  { id: 'edit.selectNone', label: 'Select none', category: 'Edit', run: () => S().select([]) },
  { id: 'edit.selectSameFill', label: 'Select all with same fill', category: 'Edit', run: () => selectMatching('fill'), enabled: single },
  { id: 'edit.selectSameStroke', label: 'Select all with same stroke', category: 'Edit', run: () => selectMatching('stroke'), enabled: single },
  { id: 'edit.selectSameEffect', label: 'Select all with same effect', category: 'Edit', run: () => selectMatching('effect'), enabled: single },
  { id: 'edit.selectSameFont', label: 'Select all with same font', category: 'Edit', run: () => selectMatching('font'), enabled: single },
  { id: 'edit.selectSameInstance', label: 'Select all with same instance', category: 'Edit', run: () => selectMatching('instance'), enabled: single },
  { id: 'edit.selectMatching', label: 'Select matching layers', keys: ['alt+mod+a'], category: 'Edit', run: () => selectMatching('type'), enabled: single },
  { id: 'edit.find', label: 'Find and replace…', keys: ['mod+f'], category: 'Edit', run: () => S().setState({ modal: 'find' }) },
  { id: 'edit.rename', label: 'Rename selection…', keys: ['mod+r'], category: 'Edit', run: () => S().setState({ modal: 'rename' }), enabled: hasSel },

  // ---------------- View
  { id: 'view.dotGrid', label: 'Dot grid', keys: ["shift+;"], category: 'View', run: toggleView('dotGrid'), checked: () => S().view.dotGrid },
  { id: 'view.pixelGrid', label: 'Pixel grid', keys: ["shift+'"], category: 'View', run: toggleView('pixelGrid'), checked: () => S().view.pixelGrid },
  { id: 'view.snapPixel', label: 'Snap to pixel grid', keys: ["mod+shift+'"], category: 'View', run: () => S().setPrefs({ snapToPixel: !S().prefs.snapToPixel }), checked: () => S().prefs.snapToPixel },
  { id: 'view.layoutGrids', label: 'Layout grids', keys: ['ctrl+g', 'ctrl+shift+4'], category: 'View', run: toggleView('layoutGrids'), checked: () => S().view.layoutGrids },
  { id: 'view.rulers', label: 'Rulers', keys: ['shift+r'], category: 'View', run: toggleView('rulers'), checked: () => S().view.rulers },
  { id: 'view.outlines', label: 'Outlines', keys: ['mod+y'], category: 'View', run: toggleView('outlines'), checked: () => S().view.outlines },
  { id: 'view.pixelPreview', label: 'Pixel preview', category: 'View', run: toggleView('pixelPreview'), checked: () => S().view.pixelPreview },
  { id: 'view.maskOutlines', label: 'Mask outlines', category: 'View', run: toggleView('maskOutlines'), checked: () => S().view.maskOutlines },
  { id: 'view.frameOutlines', label: 'Frame outlines', category: 'View', run: toggleView('frameOutlines'), checked: () => S().view.frameOutlines },
  { id: 'view.cursors', label: 'Multiplayer cursors', keys: ['alt+mod+\\'], category: 'View', run: toggleView('multiplayerCursors'), checked: () => S().view.multiplayerCursors },
  { id: 'view.comments', label: 'Comments', keys: ['shift+c'], category: 'View', run: () => { toggleView('comments')(); }, checked: () => S().view.comments },
  { id: 'view.ui', label: 'Show/Hide UI', keys: ['mod+\\', 'mod+.'], category: 'View', run: toggleView('showUI'), checked: () => S().view.showUI },
  { id: 'view.leftPanel', label: 'Layers panel', keys: ['alt+1'], category: 'View', run: () => { S().setView({ leftPanel: true }); S().setState({ leftTab: 'file' }); } },
  { id: 'view.assets', label: 'Assets panel', keys: ['alt+2', 'alt+i'], category: 'View', run: () => { S().setView({ leftPanel: true }); S().setState({ leftTab: 'assets' }); } },
  { id: 'view.designTab', label: 'Design panel', keys: ['alt+8'], category: 'View', run: () => S().setState({ rightTab: 'design', mode: 'design' }) },
  { id: 'view.prototypeTab', label: 'Prototype panel', keys: ['alt+9'], category: 'View', run: () => S().setState({ rightTab: 'prototype', mode: 'design' }) },
  { id: 'view.toggleTab', label: 'Toggle Design/Prototype', keys: ['shift+e'], category: 'View', run: () => S().setState({ rightTab: S().rightTab === 'design' ? 'prototype' : 'design' }), hidden: true },
  { id: 'view.devMode', label: 'Dev Mode', keys: ['shift+d'], category: 'View', run: () => S().setState({ mode: S().mode === 'dev' ? 'design' : 'dev' }), checked: () => S().mode === 'dev' },
  { id: 'view.zoomIn', label: 'Zoom in', keys: ['mod+=', '=', 'shift+='], category: 'View', run: () => zoomAt(S().zoom * 2) },
  { id: 'view.zoomOut', label: 'Zoom out', keys: ['mod+-', '-'], category: 'View', run: () => zoomAt(S().zoom / 2) },
  { id: 'view.zoom100', label: 'Zoom to 100%', keys: ['shift+0', 'mod+0'], category: 'View', run: () => zoomAt(1) },
  { id: 'view.zoomFit', label: 'Zoom to fit', keys: ['shift+1'], category: 'View', run: zoomToFit },
  { id: 'view.zoomSelection', label: 'Zoom to selection', keys: ['shift+2'], category: 'View', run: zoomToSelection },
  { id: 'view.zoom50', label: 'Zoom to 50%', category: 'View', run: () => zoomAt(0.5) },
  { id: 'view.zoom200', label: 'Zoom to 200%', category: 'View', run: () => zoomAt(2) },
  { id: 'view.prevFrame', label: 'Previous frame', keys: ['shift+n'], category: 'View', run: () => navigateFrame(-1) },
  { id: 'view.nextFrame', label: 'Next frame', keys: ['n'], category: 'View', run: () => navigateFrame(1) },
  { id: 'view.prevPage', label: 'Previous page', keys: ['pageup'], category: 'View', run: () => navigatePage(-1) },
  { id: 'view.nextPage', label: 'Next page', keys: ['pagedown'], category: 'View', run: () => navigatePage(1) },
  { id: 'view.theme', label: 'Dark theme', category: 'View', run: () => S().setPrefs({ theme: S().prefs.theme === 'dark' ? 'light' : 'dark' }), checked: () => S().prefs.theme === 'dark' },

  // ---------------- Object
  { id: 'obj.group', label: 'Group selection', keys: ['mod+g'], category: 'Object', run: () => groupSelection(), enabled: hasSel },
  { id: 'obj.ungroup', label: 'Ungroup selection', keys: ['mod+shift+g'], category: 'Object', run: ungroupSelection, enabled: hasSel },
  { id: 'obj.frame', label: 'Frame selection', keys: ['alt+mod+g'], category: 'Object', run: () => frameSelection(), enabled: hasSel },
  { id: 'obj.autoLayout', label: 'Add auto layout', keys: ['shift+a'], category: 'Object', run: addAutoLayout, enabled: hasSel },
  { id: 'obj.removeAutoLayout', label: 'Remove auto layout', keys: ['alt+shift+a'], category: 'Object', run: removeAutoLayout, enabled: () => selectedNodes().some((n) => n.layout.mode !== 'NONE') },
  { id: 'obj.createComponent', label: 'Create component', keys: ['alt+mod+k'], category: 'Object', run: createComponent, enabled: hasSel },
  { id: 'obj.createMultiple', label: 'Create multiple components', category: 'Object', run: createMultipleComponents, enabled: () => sel().length > 1 },
  { id: 'obj.combineVariants', label: 'Combine as variants', category: 'Object', run: combineAsVariants, enabled: () => selectedNodes().some((n) => n.type === 'COMPONENT') },
  { id: 'obj.addVariant', label: 'Add variant', category: 'Object', run: addVariant, enabled: () => selectedNodes().some((n) => n.type === 'COMPONENT_SET' || (n.parentId && currentDoc().nodes[n.parentId]?.type === 'COMPONENT_SET')) },
  { id: 'obj.detach', label: 'Detach instance', keys: ['alt+mod+b'], category: 'Object', run: detachInstance, enabled: isInstanceSel },
  { id: 'obj.resetInstance', label: 'Reset all changes', category: 'Object', run: resetInstance, enabled: isInstanceSel },
  { id: 'obj.goToMain', label: 'Go to main component', category: 'Object', run: goToMainComponent, enabled: isInstanceSel },
  { id: 'obj.pushToMain', label: 'Push changes to main component', category: 'Object', run: pushOverridesToMain, enabled: isInstanceSel },
  { id: 'obj.mask', label: 'Use as mask', keys: ['ctrl+mod+m'], category: 'Object', run: useAsMask, enabled: hasSel },
  { id: 'obj.setThumbnail', label: 'Set as thumbnail', category: 'Object', run: setAsThumbnail, enabled: single },
  { id: 'obj.bringFront', label: 'Bring to front', keys: ['alt+mod+]', 'mod+shift+]'], category: 'Object', run: () => reorder('front'), enabled: hasSel },
  { id: 'obj.bringForward', label: 'Bring forward', keys: ['mod+]'], category: 'Object', run: () => reorder('forward'), enabled: hasSel },
  { id: 'obj.sendBackward', label: 'Send backward', keys: ['mod+['], category: 'Object', run: () => reorder('backward'), enabled: hasSel },
  { id: 'obj.sendBack', label: 'Send to back', keys: ['alt+mod+[', 'mod+shift+['], category: 'Object', run: () => reorder('back'), enabled: hasSel },
  { id: 'obj.flipH', label: 'Flip horizontal', keys: ['shift+h'], category: 'Object', run: () => flip('x'), enabled: hasSel },
  { id: 'obj.flipV', label: 'Flip vertical', keys: ['shift+v'], category: 'Object', run: () => flip('y'), enabled: hasSel },
  { id: 'obj.rotate180', label: 'Rotate 180°', category: 'Object', run: () => rotateSelection(180), enabled: hasSel },
  { id: 'obj.rotateCW', label: 'Rotate 90° right', category: 'Object', run: () => rotateSelection(-90), enabled: hasSel },
  { id: 'obj.rotateCCW', label: 'Rotate 90° left', category: 'Object', run: () => rotateSelection(90), enabled: hasSel },
  { id: 'obj.flatten', label: 'Flatten', keys: ['mod+e'], category: 'Object', run: flattenSelection, enabled: hasSel },
  { id: 'obj.outlineStroke', label: 'Outline stroke', keys: ['alt+mod+o'], category: 'Object', run: outlineStroke, enabled: hasSel },
  { id: 'obj.union', label: 'Union selection', keys: ['alt+shift+u'], category: 'Object', run: () => groupSelection('BOOLEAN_OPERATION', 'UNION'), enabled: () => sel().length > 1 },
  { id: 'obj.subtract', label: 'Subtract selection', keys: ['alt+shift+s'], category: 'Object', run: () => groupSelection('BOOLEAN_OPERATION', 'SUBTRACT'), enabled: () => sel().length > 1 },
  { id: 'obj.intersect', label: 'Intersect selection', keys: ['alt+shift+i'], category: 'Object', run: () => groupSelection('BOOLEAN_OPERATION', 'INTERSECT'), enabled: () => sel().length > 1 },
  { id: 'obj.exclude', label: 'Exclude selection', keys: ['alt+shift+e'], category: 'Object', run: () => groupSelection('BOOLEAN_OPERATION', 'EXCLUDE'), enabled: () => sel().length > 1 },
  { id: 'obj.lock', label: 'Lock/Unlock selection', keys: ['mod+shift+l'], category: 'Object', run: toggleLock, enabled: hasSel },
  { id: 'obj.hide', label: 'Show/Hide selection', keys: ['mod+shift+h'], category: 'Object', run: toggleVisible, enabled: hasSel },
  { id: 'obj.unlockAll', label: 'Unlock all', category: 'Object', run: unlockAll },
  { id: 'obj.showAll', label: 'Show all hidden layers', category: 'Object', run: showAllHidden },
  { id: 'obj.removeFill', label: 'Remove fill', keys: ['alt+/'], category: 'Object', run: removeFill, enabled: hasSel },
  { id: 'obj.removeStroke', label: 'Remove stroke', keys: ['shift+/'], category: 'Object', run: removeStroke, enabled: hasSel },
  { id: 'obj.swapFillStroke', label: 'Swap fill and stroke', keys: ['shift+x'], category: 'Object', run: swapFillStroke, enabled: hasSel },
  { id: 'obj.collapseLayers', label: 'Collapse layers', keys: ['alt+l'], category: 'Object', run: () => window.dispatchEvent(new CustomEvent('myflow:collapse-layers')) },

  // ---------------- Arrange
  { id: 'arr.alignLeft', label: 'Align left', keys: ['alt+a'], category: 'Arrange', run: () => align('left'), enabled: hasSel },
  { id: 'arr.alignHCenter', label: 'Align horizontal centers', keys: ['alt+h'], category: 'Arrange', run: () => align('hcenter'), enabled: hasSel },
  { id: 'arr.alignRight', label: 'Align right', keys: ['alt+d'], category: 'Arrange', run: () => align('right'), enabled: hasSel },
  { id: 'arr.alignTop', label: 'Align top', keys: ['alt+w'], category: 'Arrange', run: () => align('top'), enabled: hasSel },
  { id: 'arr.alignVCenter', label: 'Align vertical centers', keys: ['alt+v'], category: 'Arrange', run: () => align('vcenter'), enabled: hasSel },
  { id: 'arr.alignBottom', label: 'Align bottom', keys: ['alt+s'], category: 'Arrange', run: () => align('bottom'), enabled: hasSel },
  { id: 'arr.distH', label: 'Distribute horizontal spacing', keys: ['ctrl+alt+h'], category: 'Arrange', run: () => distribute('h'), enabled: () => sel().length > 2 },
  { id: 'arr.distV', label: 'Distribute vertical spacing', keys: ['ctrl+alt+v'], category: 'Arrange', run: () => distribute('v'), enabled: () => sel().length > 2 },
  { id: 'arr.tidy', label: 'Tidy up', keys: ['ctrl+alt+t'], category: 'Arrange', run: tidyUp, enabled: () => sel().length > 1 },
  { id: 'arr.roundPixel', label: 'Round to pixel', category: 'Arrange', run: () => setProps(sel(), (n) => { n.x = Math.round(n.x); n.y = Math.round(n.y); n.width = Math.round(n.width) || 1; n.height = Math.round(n.height) || 1; }), enabled: hasSel },

  // ---------------- Text
  { id: 'text.bold', label: 'Bold', keys: ['mod+b'], category: 'Text', run: () => textPatch((t) => { t.fontWeight = t.fontWeight >= 700 ? 400 : 700; }), enabled: textSel },
  { id: 'text.italic', label: 'Italic', keys: ['mod+i'], category: 'Text', run: () => textPatch((t) => { t.italic = !t.italic; }), enabled: textSel },
  { id: 'text.underline', label: 'Underline', keys: ['mod+u'], category: 'Text', run: () => textPatch((t) => { t.decoration = t.decoration === 'UNDERLINE' ? 'NONE' : 'UNDERLINE'; }), enabled: textSel },
  { id: 'text.strike', label: 'Strikethrough', keys: ['mod+shift+x'], category: 'Text', run: () => textPatch((t) => { t.decoration = t.decoration === 'STRIKETHROUGH' ? 'NONE' : 'STRIKETHROUGH'; }), enabled: textSel },
  { id: 'text.alignLeft', label: 'Text align left', keys: ['alt+mod+l'], category: 'Text', run: () => textPatch((t) => { t.textAlign = 'LEFT'; }), enabled: textSel },
  { id: 'text.alignCenter', label: 'Text align center', keys: ['alt+mod+t'], category: 'Text', run: () => textPatch((t) => { t.textAlign = 'CENTER'; }), enabled: textSel },
  { id: 'text.alignRight', label: 'Text align right', keys: ['alt+mod+r'], category: 'Text', run: () => textPatch((t) => { t.textAlign = 'RIGHT'; }), enabled: textSel },
  { id: 'text.alignJustify', label: 'Text align justified', keys: ['alt+mod+j'], category: 'Text', run: () => textPatch((t) => { t.textAlign = 'JUSTIFIED'; }), enabled: textSel },
  { id: 'text.sizeUp', label: 'Increase font size', keys: ['mod+shift+.'], category: 'Text', run: () => textPatch((t) => { t.fontSize += 1; }), enabled: textSel },
  { id: 'text.sizeDown', label: 'Decrease font size', keys: ['mod+shift+,'], category: 'Text', run: () => textPatch((t) => { t.fontSize = Math.max(1, t.fontSize - 1); }), enabled: textSel },
  { id: 'text.spacingUp', label: 'Increase letter spacing', keys: ['alt+.'], category: 'Text', run: () => textPatch((t) => { t.letterSpacing += 1; }), enabled: textSel },
  { id: 'text.spacingDown', label: 'Decrease letter spacing', keys: ['alt+,'], category: 'Text', run: () => textPatch((t) => { t.letterSpacing -= 1; }), enabled: textSel },
  { id: 'text.lhUp', label: 'Increase line height', keys: ['alt+shift+.'], category: 'Text', run: () => textPatch((t) => { t.lineHeight = (t.lineHeight === 'AUTO' ? Math.round(t.fontSize * 1.21) : t.lineHeight) + 1; }), enabled: textSel },
  { id: 'text.lhDown', label: 'Decrease line height', keys: ['alt+shift+,'], category: 'Text', run: () => textPatch((t) => { t.lineHeight = Math.max(1, (t.lineHeight === 'AUTO' ? Math.round(t.fontSize * 1.21) : t.lineHeight) - 1); }), enabled: textSel },
  { id: 'text.weightUp', label: 'Increase font weight', keys: ['alt+mod+.'], category: 'Text', run: () => textPatch((t) => { t.fontWeight = Math.min(900, t.fontWeight + 100); }), enabled: textSel },
  { id: 'text.weightDown', label: 'Decrease font weight', keys: ['alt+mod+,'], category: 'Text', run: () => textPatch((t) => { t.fontWeight = Math.max(100, t.fontWeight - 100); }), enabled: textSel },
  { id: 'text.bullets', label: 'Bulleted list', keys: ['mod+shift+8'], category: 'Text', run: () => textPatch((t) => { t.listType = t.listType === 'BULLET' ? 'NONE' : 'BULLET'; }), enabled: textSel },
  { id: 'text.numbers', label: 'Numbered list', keys: ['mod+shift+7'], category: 'Text', run: () => textPatch((t) => { t.listType = t.listType === 'NUMBER' ? 'NONE' : 'NUMBER'; }), enabled: textSel },
  { id: 'text.upper', label: 'Uppercase', category: 'Text', run: () => textPatch((t) => { t.textCase = 'UPPER'; }), enabled: textSel },
  { id: 'text.lower', label: 'Lowercase', category: 'Text', run: () => textPatch((t) => { t.textCase = 'LOWER'; }), enabled: textSel },
  { id: 'text.title', label: 'Title case', category: 'Text', run: () => textPatch((t) => { t.textCase = 'TITLE'; }), enabled: textSel },
  { id: 'text.originalCase', label: 'Original case', category: 'Text', run: () => textPatch((t) => { t.textCase = 'ORIGINAL'; }), enabled: textSel },

  // ---------------- Prototype
  { id: 'proto.present', label: 'Present', keys: ['alt+mod+enter'], category: 'Prototype', run: () => openPresent() },
  { id: 'proto.addFlow', label: 'Add flow starting point', category: 'Prototype', run: () => { const n = selectedNodes()[0]; if (n) ensureFlowStart(n.id); }, enabled: single },

  // ---------------- Plugins (built in)
  { id: 'plugin.lorem', label: 'Lorem ipsum', category: 'Plugins', run: () => runPlugin('lorem') },
  { id: 'plugin.image', label: 'Random image fill', category: 'Plugins', run: () => runPlugin('image') },
  { id: 'plugin.contrast', label: 'Contrast checker', category: 'Plugins', run: () => runPlugin('contrast') },
  { id: 'plugin.rename', label: 'Auto rename layers', category: 'Plugins', run: () => runPlugin('rename') },
  { id: 'plugin.palette', label: 'Generate color palette', category: 'Plugins', run: () => runPlugin('palette') },
  { id: 'plugin.cleanup', label: 'Clean document (remove hidden layers)', category: 'Plugins', run: () => runPlugin('cleanup') },
  { id: 'plugin.icons', label: 'Insert icon set', category: 'Plugins', run: () => runPlugin('icons') },
  { id: 'plugin.chart', label: 'Bar chart', category: 'Plugins', run: () => runPlugin('chart') },
  { id: 'plugin.manage', label: 'Manage plugins…', category: 'Plugins', run: () => S().setState({ modal: 'plugins' }) },

  // ---------------- AI (bring your own Claude / ChatGPT / Gemini key)
  { id: 'ai.agent', label: 'AI agent', keys: ['mod+j'], category: 'AI', run: () => (useAgent.getState().open ? useAgent.setState({ open: false }) : openAgent()) },
  { id: 'ai.firstDraft', label: 'First draft (generate a design)', category: 'AI', run: () => AI_ACTIONS.firstDraft() },
  { id: 'ai.rename', label: 'Rename layers with AI', category: 'AI', run: () => AI_ACTIONS.rename() },
  { id: 'ai.realistic', label: 'Replace with realistic content', category: 'AI', run: () => AI_ACTIONS.text('realistic', 'Replace with realistic content') },
  { id: 'ai.rewrite', label: 'Rewrite text', category: 'AI', run: () => AI_ACTIONS.text('rewrite', 'Rewrite text') },
  { id: 'ai.shorten', label: 'Shorten text', category: 'AI', run: () => AI_ACTIONS.text('shorten', 'Shorten text') },
  { id: 'ai.lengthen', label: 'Make text longer', category: 'AI', run: () => AI_ACTIONS.text('lengthen', 'Make text longer') },
  { id: 'ai.fix', label: 'Fix spelling & grammar', category: 'AI', run: () => AI_ACTIONS.text('fix', 'Fix spelling & grammar') },
  { id: 'ai.friendly', label: 'Tone: friendly', category: 'AI', run: () => AI_ACTIONS.text('friendly', 'Make tone friendly') },
  { id: 'ai.formal', label: 'Tone: formal', category: 'AI', run: () => AI_ACTIONS.text('formal', 'Make tone formal') },
  { id: 'ai.translate', label: 'Translate text…', category: 'AI', run: () => AI_ACTIONS.translate() },
  { id: 'ai.prototype', label: 'Make prototype (auto-wire screens)', category: 'AI', run: () => AI_ACTIONS.prototype() },
  { id: 'ai.critique', label: 'Design critique', category: 'AI', run: () => AI_ACTIONS.critique() },
  { id: 'ai.a11y', label: 'Accessibility review', category: 'AI', run: () => AI_ACTIONS.a11y() },
  { id: 'ai.code', label: 'Generate code from design…', category: 'AI', run: () => AI_ACTIONS.code() },
  { id: 'ai.make', label: 'Make — prompt to app…', category: 'AI', run: () => AI_ACTIONS.make() },
  { id: 'ai.illustration', label: 'Make illustration…', category: 'AI', run: () => AI_ACTIONS.illustration('illustration') },
  { id: 'ai.icon', label: 'Make icon…', category: 'AI', run: () => AI_ACTIONS.illustration('icon') },
  { id: 'ai.settings', label: 'AI settings (API keys, model, skills)…', category: 'AI', run: () => AI_ACTIONS.settings() },

  // ---------------- Help / misc
  { id: 'help.shortcuts', label: 'Keyboard shortcuts', keys: ['ctrl+shift+/', 'ctrl+shift+?'], category: 'Help', run: () => S().setState({ modal: 'shortcuts' }) },
  { id: 'help.quick', label: 'Quick actions…', keys: ['mod+/', 'mod+k'], category: 'Help', run: () => S().setState({ modal: 'quickActions' }), hidden: true },
  { id: 'help.about', label: 'About My Flow', category: 'Help', run: () => S().setState({ modal: 'about' }) },
  { id: 'help.preferences', label: 'Preferences…', category: 'Help', run: () => S().setState({ modal: 'preferences' }) },
  { id: 'misc.variables', label: 'Open variables', category: 'Edit', run: () => S().setState({ modal: 'variables' }) },
  { id: 'misc.styles', label: 'Open styles', category: 'Edit', run: () => S().setState({ modal: 'styles' }) },
  { id: 'misc.addPage', label: 'Add page', category: 'File', run: () => { addPage(); } },
  { id: 'misc.addText', label: 'Add text', category: 'Tools', run: () => addText('Text'), hidden: true },
  { id: 'misc.commentsPanel', label: 'Show comments', category: 'View', run: () => S().setState({ commentsPanel: !S().commentsPanel }) },
];

export const commandMap = new Map(commands.map((c) => [c.id, c]));

export function runCommand(id: string) {
  const c = commandMap.get(id);
  if (!c) return;
  if (c.enabled && !c.enabled()) return;
  void c.run();
}

/* ---------------------------------------------------------------- keyboard */

const CODE_KEYS: Record<string, string> = {
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Slash: '/', Quote: "'", Comma: ',', Period: '.', Equal: '=', Minus: '-', Semicolon: ';', Backquote: '`',
};

export function eventKey(e: KeyboardEvent): string {
  let key: string;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3).toLowerCase();
  else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5);
  else if (/^Numpad[0-9]$/.test(e.code)) key = e.code.slice(6);
  else if (CODE_KEYS[e.code]) key = CODE_KEYS[e.code];
  else if (e.code === 'NumpadAdd') key = '=';
  else if (e.code === 'NumpadSubtract') key = '-';
  else key = (e.key || '').toLowerCase();
  if (key === 'del') key = 'delete';
  if (key === '?') key = '/';
  const mods: string[] = [];
  if (isMac) {
    if (e.ctrlKey) mods.push('ctrl');
    if (e.metaKey) mods.push('mod');
  } else {
    if (e.ctrlKey) mods.push('mod');
  }
  if (e.altKey) mods.push('alt');
  if (e.shiftKey) mods.push('shift');
  return normalizeCombo([...mods, key].join('+'));
}

export function normalizeCombo(k: string) {
  const parts = k.split('+');
  const key = parts.pop()!;
  const order = ['ctrl', 'mod', 'alt', 'shift'];
  const mods = parts.map((p) => (!isMac && p === 'ctrl' ? 'mod' : p)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return [...new Set(mods), key].join('+');
}

let keyIndex: Map<string, Command> | null = null;
export function commandForKey(combo: string): Command | undefined {
  if (!keyIndex) {
    keyIndex = new Map();
    for (const c of commands) for (const k of c.keys ?? []) {
      const nk = normalizeCombo(k);
      if (!keyIndex.has(nk)) keyIndex.set(nk, c);
    }
  }
  return keyIndex.get(combo);
}

export { selectionBounds };
