// Agent 10 — A4 print poster for a design conference, built through the My Flow UI.
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const OUT = path.resolve('designs/agent-10');
mkdirSync(OUT, { recursive: true });
const MOD = 'Meta';
const log = (...a) => console.log('[agent10]', ...a);
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); log(ok ? 'PASS' : 'FAIL', name, info); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|Failed to load resource/.test(m.text())) errors.push(m.text()); });

const st = (fn) => page.evaluate(`(() => { const s = window.__myflow.get(); return (${fn})(s); })()`);
const sel = () => st('s => s.selection.map(id => s.doc.nodes[id])');
const allNodes = () => st('s => Object.values(s.doc.nodes)');
const tid = (id) => page.getByTestId(id).first();
const toScreen = (x, y) => st(`s => ({ x: ${x} * s.zoom + s.panX, y: ${y} * s.zoom + s.panY })`);
async function drag(a, b) {
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
}
async function draw(key, x, y, w, h) {
  await page.keyboard.press(key);
  await drag(await toScreen(x, y), await toScreen(x + w, y + h));
  await page.waitForTimeout(60);
}
async function clickWorld(x, y, mods = []) {
  const p = await toScreen(x, y);
  for (const m of mods) await page.keyboard.down(m);
  await page.mouse.click(p.x, p.y);
  for (const m of mods) await page.keyboard.up(m);
}
async function setField(id, v) { const f = tid(id); await f.click(); await f.fill(String(v)); await f.press('Enter'); await page.waitForTimeout(30); }
async function geom(x, y, w, h) {
  if (w != null) await setField('prop-w', w);
  if (h != null) await setField('prop-h', h);
  await setField('prop-x', x); await setField('prop-y', y);
}
async function menu(group, cmd) {
  await tid('main-menu-btn').click();
  await tid(`menu-${group}`).hover();
  await tid(`cmd-${cmd}`).click();
  await page.waitForTimeout(150);
}
async function gradient(type, c0, c1, angle) {
  await tid('fills-swatch-0').click();
  await tid('paint-type').selectOption(type);
  await tid('grad-stop-0').click(); await tid('hex-input').fill(c0); await tid('hex-input').press('Enter');
  await tid('grad-stop-1').click(); await tid('hex-input').fill(c1); await tid('hex-input').press('Enter');
  if (angle != null) {
    const a = page.locator('[data-testid="gradient-editor"] input').first();
    await a.click(); await a.fill(String(angle)); await a.press('Enter');
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
}
/** Seamless 3-stop gradient: c0 → c1 → c0 (adds a middle stop by clicking the gradient bar). */
async function gradientLoop(type, c0, c1) {
  await tid('fills-swatch-0').click();
  await tid('paint-type').selectOption(type);
  await tid('grad-stop-0').click(); await tid('hex-input').fill(c0); await tid('hex-input').press('Enter');
  await tid('grad-stop-1').click(); await tid('hex-input').fill(c1); await tid('hex-input').press('Enter');
  const bar = await tid('grad-bar').boundingBox();
  await page.mouse.click(bar.x + bar.width * 0.5, bar.y + bar.height / 2); // new stop (copies c1) at 50%
  await tid('grad-stop-1').click(); await tid('hex-input').fill(c0); await tid('hex-input').press('Enter');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
}
/** Text: drag a box (fixed width) or click (auto width), type, Escape. */
async function text(x, y, chars, { w, family, size, weight, lh, ls, color, align, upper, list, resize } = {}) {
  await page.keyboard.press('t');
  if (w) await drag(await toScreen(x, y), await toScreen(x + w, y + 20));
  else await clickWorld(x, y);
  await page.waitForTimeout(80);
  await page.keyboard.type(chars, { delay: 2 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  if (family) await tid('font-family').selectOption(family);
  if (weight != null) await tid('font-weight').selectOption(String(weight));
  if (size) await setField('font-size', size);
  if (lh) await setField('line-height', lh);
  if (ls != null) await setField('letter-spacing', ls);
  if (color) await setField('fills-hex-0', color);
  if (align) await tid(`text-align-${align}`).click();
  if (resize) await tid(`text-resize-${resize}`).click();
  if (upper || list) {
    await tid('type-settings').click();
    if (upper) await tid('case-upper').click();
    if (list) await tid(`list-${list}`).click();
    await page.keyboard.press('Escape');
  }
  // keep the top-left where we asked for it
  await setField('prop-x', x); await setField('prop-y', y);
  const n = (await sel())[0];
  return n;
}

process.on('unhandledRejection', async (e) => { console.error(e); try { await page.screenshot({ path: path.join(OUT, 'debug-fail.png') }); console.log(JSON.stringify(await st('s => ({tool: s.tool, sel: s.selection, modal: s.modal, editing: s.editingTextId})'))); } catch {} process.exit(1); });
// ---------------------------------------------------------------- start
await page.goto('http://localhost:5390/');
await tid('new-design-file').click();
await tid('editor').waitFor();
await page.waitForTimeout(300);
await tid('file-name').click();
await tid('file-name-input').fill('Type Matters — A4 Poster');
await tid('file-name-input').press('Enter');
await page.evaluate(() => window.__myflow.get().setState({ zoom: 1, panX: 300, panY: 40 }));

// ---------------------------------------------------------------- A4 frame via presets
await draw('f', 0, 0, 200, 200);
await tid('frame-presets').click();
await tid('menu-paper').hover();
await page.getByText('A4  595×842').click();
let f = (await sel())[0];
check('Frame preset Paper → A4 = 595×842', f.width === 595 && f.height === 842, `${f.width}×${f.height}`);
await setField('prop-x', 0); await setField('prop-y', 0);
await setField('fills-hex-0', '111014');
const frameId = f.id;
// rename frame via layers panel
await page.locator('[data-testid^="layer-Frame"]').first().dblclick();
await tid('layer-rename-input').fill('Poster A4');
await tid('layer-rename-input').press('Enter');
await page.keyboard.press('Escape');

// fit the A4 frame into the viewport (same as zoom/pan by hand)
await page.evaluate(() => window.__myflow.get().setState({ zoom: 0.95, panX: 440, panY: 30 }));

// ---------------------------------------------------------------- gradient geometry
// diamond-gradient square, rotated 45° (top-right)
await draw('r', 400, 10, 200, 200);
await geom(400, -50, 250, 250);
await setField('prop-rotation', 45);
await gradient('GRADIENT_DIAMOND', 'FF5A36', '111014');
let n = (await sel())[0];
check('Diamond gradient on rotated square', n.fills[0].type === 'GRADIENT_DIAMOND' && Math.abs(n.rotation) === 45, `${n.fills[0].type} rot ${n.rotation}`);
await page.keyboard.press('Escape');

// angular-gradient disc (bottom-right, bleeding off the page)
await draw('o', 360, 600, 200, 200);
await geom(395, 640, 300, 300);
await gradientLoop('GRADIENT_ANGULAR', 'FFC94A', '6B4EFF');
await setField('prop-opacity', 85);
n = (await sel())[0];
check('Angular gradient on ellipse (3 stops)', n.fills[0].type === 'GRADIENT_ANGULAR' && n.fills[0].stops.length === 3, n.fills[0].type + ' ' + JSON.stringify(n.fills[0].stops.map(x => x.color + '@' + x.offset)));
await page.keyboard.press('Escape');

// small angular ring accent (polygon / triangle) — left
await page.getByTestId('tool-caret-shape').click();
await page.getByTestId('tool-menu-polygon').click();
await drag(await toScreen(430, 300), await toScreen(530, 390));
await geom(455, 300, 96, 84);
await setField('point-count', 3);
await gradientLoop('GRADIENT_ANGULAR', 'F3EDE2', 'FF5A36');
n = (await sel())[0];
check('Angular gradient on triangle polygon', n.fills[0].type === 'GRADIENT_ANGULAR' && n.pointCount === 3, `${n.type} pts ${n.pointCount}`);
await page.keyboard.press('Escape');

// ---------------------------------------------------------------- dashed border
await draw('r', 20, 20, 400, 400);
await geom(18, 18, 559, 806);
await tid('remove-fills-0').click();
await tid('add-strokes').click();
await setField('strokes-hex-0', 'F3EDE2');
await setField('stroke-weight', 1);
await tid('stroke-more').click();
await tid('stroke-style').selectOption('DASH');
await setField('dash-length', 6);
await setField('dash-gap', 5);
await page.keyboard.press('Escape');
n = (await sel())[0];
check('Dashed stroke border (Dash style)', n.strokes.length === 1 && Array.isArray(n.strokeDash) && n.strokeDash[0] === 6, JSON.stringify(n.strokeDash));
await page.keyboard.press('Escape');

// ---------------------------------------------------------------- typography
const CREAM = 'F3EDE2', ACCENT = 'FF5A36', MUTED = 'A39D92';
await text(42, 44, 'the international conference on type & form  ·  vol. 07', { family: 'Inter', weight: 600, size: 8, ls: 22, color: CREAM, upper: true });
const title2 = await text(42, 236, 'matters', { family: 'Inter', weight: 900, size: 84, lh: 84, ls: -4, color: ACCENT, upper: true });
const title1 = await text(38, 92, 'Type,', { family: 'Playfair Display', weight: '400.5', size: 150, lh: 140, ls: -3, color: CREAM });
const title3 = await text(44, 330, 'Two days of talks, workshops and critique on\ntypography, systems and the craft of making.', { family: 'Playfair Display', weight: '400.5', size: 15, lh: 21, color: CREAM, w: 380 });
n = await st(`s => s.doc.nodes['${title1.id}']`);
const n2 = await st(`s => s.doc.nodes['${title2.id}']`);
check('Display title: Playfair Display italic 150 / LH 140 / LS -3%', n.text.fontFamily === 'Playfair Display' && n.text.fontSize === 150 && n.text.italic && n.text.lineHeight === 140 && n.text.letterSpacing === -3, JSON.stringify({ f: n.text.fontFamily, s: n.text.fontSize, i: n.text.italic, lh: n.text.lineHeight, ls: n.text.letterSpacing }));
check('Display title 2: Inter 900, Case → UPPER', n2.text.fontFamily === 'Inter' && n2.text.fontWeight === 900 && n2.text.textCase === 'UPPER', JSON.stringify({ f: n2.text.fontFamily, w: n2.text.fontWeight, c: n2.text.textCase, chars: n2.text.characters }));

// arrow divider with caps
await draw('Shift+L', 42, 400, 511, 0);
await setField('strokes-hex-0', CREAM);
await setField('stroke-weight', 1.5);
await tid('start-cap').selectOption('CIRCLE');
await tid('end-cap').selectOption('ARROW');
n = (await sel())[0];
check('Arrow divider: start CIRCLE / end ARROW caps', n.startCap === 'CIRCLE' && n.endCap === 'ARROW', `${n.type} ${n.startCap}/${n.endCap} w=${n.width}`);
const arrowId = n.id;
await page.keyboard.press('Escape');

// column headings
await text(42, 428, 'speakers', { family: 'Inter', weight: 700, size: 9, ls: 24, color: ACCENT, upper: true });
await text(312, 428, 'schedule — day one', { family: 'Inter', weight: 700, size: 9, ls: 24, color: ACCENT, upper: true });

// bulleted speakers list
const speakers = await text(42, 450, 'Mara Okonkwo, Studio North\nJulian Reyes, Kern & Co.\nInes Vartanian, Atlas Type\nTheo Lindqvist, Grid Works\nPriya Natarajan, Foundry Nine', { family: 'Inter', weight: 500, size: 11, lh: 20, color: CREAM, w: 240, list: 'bullet' });
// numbered schedule list (with a deliberate typo: "Typograpy")
const sched = await text(312, 450, '09:00  Opening keynote\n10:30  Variable fonts in practice\n13:00  Workshop: Typograpy at scale\n15:30  Grids, rhythm & white space\n17:00  Panel & closing drinks', { family: 'Inter', weight: 400, size: 11, lh: 20, color: CREAM, w: 245, list: 'number' });
n = await st(`s => s.doc.nodes['${speakers.id}']`);
check('Speakers list = BULLET list', n.text.listType === 'BULLET', n.text.listType);
n = await st(`s => s.doc.nodes['${sched.id}']`);
check('Schedule = NUMBER list', n.text.listType === 'NUMBER', n.text.listType);

// speaker avatar discs (to be batch renamed)
const avColors = [['FF5A36', 'FFC94A'], ['6B4EFF', 'F3EDE2'], ['FFC94A', 'FF5A36'], ['F3EDE2', '6B4EFF'], ['FF5A36', '6B4EFF']];
for (let i = 0; i < 5; i++) {
  await draw('o', 42 + i * 40, 575, 30, 30);
  await geom(42 + i * 40, 575, 32, 32);
  await gradient('GRADIENT_DIAMOND', avColors[i][0], avColors[i][1]);
  await page.keyboard.press('Escape');
}

// about placeholder (Lorem ipsum plugin)
await text(42, 630, 'Placeholder', { family: 'Inter', weight: 400, size: 8, lh: 12, color: MUTED, w: 250 });
const placeholderId = (await sel())[0].id;

// footer
await draw('l', 42, 742, 511, 0);
await setField('strokes-hex-0', '4A463F');
await page.keyboard.press('Escape');
await text(42, 756, '14 – 15 March 2026', { family: 'Playfair Display', weight: '700.5', size: 26, lh: 30, color: CREAM });
await text(42, 792, 'lx factory, lisbon  ·  designconf.example', { family: 'Inter', weight: 500, size: 8, ls: 16, color: MUTED, upper: true });
await text(470, 760, 'Vol.\n07', { family: 'Inter', weight: 800, size: 22, lh: 22, color: '111014', align: 'right', w: 80 });

// ---------------------------------------------------------------- Lorem ipsum plugin
await page.locator(`[data-testid="layer-Placeholder"]`).first().click().catch(async () => { await clickWorld(60, 636); });
let s0 = await sel();
log('selected for lorem', s0.map((x) => x.name + ':' + x.type));
await menu('plugins', 'plugin.lorem');
n = await st(`s => s.doc.nodes['${placeholderId}']`);
check('Lorem ipsum plugin fills placeholder', n.text.characters.startsWith('Lorem ipsum'), n.text.characters.slice(0, 40));
await page.keyboard.press('Escape');

// ---------------------------------------------------------------- Find & replace (fix typo)
await page.keyboard.press(`${MOD}+f`);
await tid('find-input').fill('Typograpy');
const cnt = await tid('find-count').textContent();
await tid('replace-input').fill('Typography');
await tid('replace-all').click();
await page.waitForTimeout(100);
await tid('modal-close').click();
n = await st(`s => s.doc.nodes['${sched.id}']`);
check('Find & Replace fixed "Typograpy" → "Typography"', cnt === '1 result' && n.text.characters.includes('Workshop: Typography at scale') && !/Typograpy/.test(n.text.characters), `count="${cnt}"`);

// ---------------------------------------------------------------- batch rename avatars "Speaker $n"
await page.keyboard.press('Escape');
for (let i = 0; i < 5; i++) await clickWorld(42 + i * 40 + 16, 591, i ? ['Shift'] : []);
s0 = await sel();
log('avatar selection', s0.map((x) => x.name + ':' + x.type));
await page.keyboard.press(`${MOD}+r`);
await tid('rename-to').fill('Speaker $n');
await tid('rename-apply').click();
await page.waitForTimeout(100);
const avNames = (await st(`s => s.doc.nodes['${frameId}'].children.map(id => s.doc.nodes[id]).filter(n => n.type === 'ELLIPSE' && n.width < 40).map(n => n.name)`));
check('Batch rename ⌘R "Speaker $n" on 5 avatar layers', s0.length === 5 && ['Speaker 1', 'Speaker 2', 'Speaker 3', 'Speaker 4', 'Speaker 5'].every((x) => avNames.includes(x)), avNames.join(', '));
await page.keyboard.press('Escape');

// ---------------------------------------------------------------- screenshot before versioning
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, 'canvas.png') });

// ---------------------------------------------------------------- version history: save, change, restore
await page.keyboard.press(`${MOD}+Alt+s`);
await tid('version-name').fill('Final poster v1');
await tid('save-version').click();
const vVisible = await tid('version-Final poster v1').waitFor({ timeout: 4000 }).then(() => true).catch(() => false);
await tid('modal-close').click();
const countBefore = (await allNodes()).length;
// change: delete the arrow divider and recolor the background
await page.locator(`[data-testid^="layer-"]`).filter({ hasText: /^Arrow/ }).first().click().catch(() => {});
let cur = await sel();
if (!cur.length || cur[0].id !== arrowId) { await clickWorld(300, 400); cur = await sel(); }
log('selected for delete', cur.map((x) => x.name + ':' + x.type));
await page.keyboard.press('Backspace');
const afterDelete = (await allNodes()).length;
await page.screenshot({ path: path.join(OUT, 'version-changed.png') });
await menu('file', 'file.versionHistory');
await tid('restore-Final poster v1').click();
await page.waitForTimeout(200);
const modalStill = await tid('modal-close').isVisible().catch(() => false);
if (modalStill) await tid('modal-close').click();
const restored = await st(`s => !!s.doc.nodes['${arrowId}']`);
const countAfter = (await allNodes()).length;
check('Version history: save named → change → restore', vVisible && afterDelete === countBefore - 1 && restored && countAfter === countBefore, `saved=${vVisible} before=${countBefore} afterDelete=${afterDelete} afterRestore=${countAfter}`);

// ---------------------------------------------------------------- export PNG + PDF through Export button
const downloads = [];
page.on('download', async (d) => { const p = await d.path(); downloads.push({ name: d.suggestedFilename(), p }); });
await page.keyboard.press('Escape');
await tid('frame-label-Poster A4').click();
cur = await sel();
log('export selection', cur.map((x) => x.name));
await tid('add-export').click();
await tid('export-scale-0').selectOption('2').catch((e) => log('scale select failed', e.message.split('\n')[0]));
await tid('add-export').click();
await tid('export-format-1').selectOption('PDF');
await tid('export-btn').click();
for (let i = 0; i < 100 && downloads.length < 2; i++) await page.waitForTimeout(150);
const { readFileSync, copyFileSync } = await import('fs');
const png = downloads.find((d) => d.name.endsWith('.png'));
const pdf = downloads.find((d) => d.name.endsWith('.pdf'));
if (png) copyFileSync(png.p, path.join(OUT, 'design.png'));
if (pdf) copyFileSync(pdf.p, path.join(OUT, 'design.pdf'));
check('PNG export via Export button', png && readFileSync(png.p).subarray(1, 4).toString() === 'PNG', png?.name);
check('PDF export starts with %PDF', pdf && readFileSync(pdf.p).subarray(0, 4).toString() === '%PDF', pdf ? `${pdf.name} ${readFileSync(pdf.p).length}B` : 'none');

// Export frames to PDF (menu)
let dl = page.waitForEvent('download');
await menu('file', 'file.exportPdf');
let d = await dl; copyFileSync(await d.path(), path.join(OUT, 'frames.pdf'));
check('File → Export frames to PDF starts with %PDF', readFileSync(path.join(OUT, 'frames.pdf')).subarray(0, 4).toString() === '%PDF', d.suggestedFilename());

// Save local copy
dl = page.waitForEvent('download');
await menu('file', 'file.saveLocal');
d = await dl; copyFileSync(await d.path(), path.join(OUT, 'design.myflow'));
const json = JSON.parse(readFileSync(path.join(OUT, 'design.myflow'), 'utf8'));
check('Save local copy (.myflow JSON)', d.suggestedFilename().endsWith('.myflow') && json.doc?.pages?.length === 1, `${d.suggestedFilename()} nodes=${Object.keys(json.doc.nodes).length}`);

// final details
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, 'canvas-final.png') });
const summary = await st(`s => { const ns = Object.values(s.doc.nodes); const fr = s.doc.nodes['${frameId}']; return { total: ns.length, frameChildren: fr.children.length, types: ns.reduce((a, n) => (a[n.type] = (a[n.type] || 0) + 1, a), {}), fonts: [...new Set(ns.filter(n => n.text).map(n => n.text.fontFamily))], texts: ns.filter(n => n.text).map(n => ({ name: n.name, chars: n.text.characters.slice(0, 50), case: n.text.textCase, list: n.text.listType, ls: n.text.letterSpacing, lh: n.text.lineHeight, w: n.width, h: n.height })) }; }`);
writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ results, errors, summary }, null, 2));
log('summary', JSON.stringify(summary, null, 1));
log('errors', errors);
log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
await browser.close();
