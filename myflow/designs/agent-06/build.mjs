// Agent 06 — Music player "Now Playing" screen, built only through the My Flow UI.
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUT = path.resolve('designs/agent-06');
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
const log = (...a) => console.log('[a06]', ...a);
const checks = {};
const notes = [];
const check = (k, ok, info = '') => { checks[k] = { ok: !!ok, info }; log(ok ? 'PASS' : 'FAIL', k, info); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|picsum|Failed to load resource/.test(m.text())) errors.push(m.text()); });

// ---------- helpers ----------
const st = (fn) => page.evaluate(`(() => { const s = window.__myflow.get(); return (${fn})(s); })()`);
const allNodes = () => st('s => Object.values(s.doc.nodes)');
const sel = () => st('s => s.selection.map(id => s.doc.nodes[id])');
const sel0 = async () => (await sel())[0];
const byName = async (name) => (await allNodes()).find((n) => n.name === name);
const tid = (id) => page.getByTestId(id).first();
async function setField(id, v) { const f = tid(id); await f.click(); await f.fill(String(v)); await f.press('Enter'); }
async function canvasBox() { return page.getByTestId('canvas').boundingBox(); }
async function view(z, cx, cy) { // put world (cx,cy) at canvas centre at zoom z
  const b = await canvasBox();
  await page.evaluate(([z, cx, cy, bx, by, bw, bh]) => {
    const s = window.__myflow.get();
    // pan is canvas-local
    s.setState({ zoom: z, panX: bw / 2 - cx * z, panY: bh / 2 - cy * z });
  }, [z, cx, cy, b.x, b.y, b.width, b.height]);
  await page.waitForTimeout(60);
}
let CB = null;
const toScreen = async (x, y) => { if (!CB) CB = await canvasBox(); const l = await st(`s => ({ x: ${x} * s.zoom + s.panX, y: ${y} * s.zoom + s.panY })`); return { x: l.x + CB.x, y: l.y + CB.y }; };
async function drag(a, b, steps = 8) {
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps }); await page.mouse.up();
}
async function draw(key, x, y, w, h) {
  await page.keyboard.press(key);
  await drag(await toScreen(x, y), await toScreen(x + w, y + h));
}
async function clickW(x, y, opts = {}) { const p = await toScreen(x, y); await page.mouse.click(p.x, p.y, opts); }
async function geom(x, y, w, h) {
  if (x != null) await setField('prop-x', x);
  if (y != null) await setField('prop-y', y);
  if (w != null) await setField('prop-w', w);
  if (h != null) await setField('prop-h', h);
}
async function fill(hex, i = 0) { await setField(`fills-hex-${i}`, hex); }
async function rename(oldName, newName) {
  await tid(`layer-${oldName}`).dblclick();
  await tid('layer-rename-input').fill(newName);
  await tid('layer-rename-input').press('Enter');
}
async function renameSelected(newName) {
  const n = await sel0();
  await rename(n.name, newName);
}
async function esc(n = 1) { for (let i = 0; i < n; i++) await page.keyboard.press('Escape'); }
async function selectLayer(name, modifiers, parents = []) {
  if (!(await page.getByTestId(`layer-${name}`).count())) {
    for (const p of parents) if (!(await page.getByTestId(`layer-${name}`).count()) && await page.getByTestId(`twisty-${p}`).count()) { await tid(`twisty-${p}`).click(); notes.push(`had to expand ${p} in layers to reach ${name}`); }
  }
  await tid(`layer-${name}`).click({ modifiers });
}
async function shot(name) { await page.screenshot({ path: path.join(OUT, name) }); }

/** Pen: points = [{x,y, dx?, dy?}] in world coords. dx/dy => drag to create curve handle. closed => click first point. */
async function pen(points, closed = true) {
  await page.keyboard.press('p');
  for (const p of points) {
    const s = await toScreen(p.x, p.y);
    if (p.dx || p.dy) {
      const z = await st('s => s.zoom');
      await page.mouse.move(s.x, s.y); await page.mouse.down();
      await page.mouse.move(s.x + p.dx * z, s.y + p.dy * z, { steps: 6 }); await page.mouse.up();
    } else await page.mouse.click(s.x, s.y);
  }
  if (closed) { const f = await toScreen(points[0].x, points[0].y); await page.mouse.click(f.x, f.y); }
  else await page.keyboard.press('Enter');
  await page.waitForTimeout(50);
  return sel0();
}
/** style a freshly drawn vector: solid fill, no stroke */
async function solidVector(hex, keepStroke = false) {
  const n = await sel0();
  if (!n.fills.length) await tid('add-fills').click();
  await fill(hex);
  if (!keepStroke) while ((await sel0()).strokes.length) await tid('remove-strokes-0').click();
}
/** Reparent selected node into the container under (wx,wy) by dragging it there, then set exact relative x/y */
async function moveInto(gx, gy, relX, relY, exactGrab = false) {
  await page.keyboard.press('v');
  // grab at the centre of the selection (away from resize handles on the edges) unless an exact grab point is given
  const n = await sel0();
  if (relX == null) { relX = n.x; relY = n.y; }
  const a = exactGrab ? await toScreen(gx, gy) : await toScreen(n.x + n.width / 2, n.y + n.height / 2);
  await drag(a, { x: a.x + 12, y: a.y + 12 });
  await geom(relX, relY);
}
async function gradient(stops, type = 'GRADIENT_LINEAR') {
  await tid('fills-swatch-0').click();
  await tid('paint-type').selectOption(type);
  // add stops if needed
  for (let i = 2; i < stops.length; i++) {
    const bar = await tid('grad-bar').boundingBox();
    await page.mouse.click(bar.x + bar.width * (i - 1) / (stops.length - 1) * 0.999, bar.y + bar.height / 2);
  }
  const cur = (await sel0()).fills[0].stops;
  // stops sorted? map by offset order
  const order = cur.map((s, i) => ({ i, o: s.offset })).sort((a, b) => a.o - b.o).map((x) => x.i);
  for (let k = 0; k < stops.length; k++) {
    await tid(`grad-stop-${order[k]}`).click();
    await tid('hex-input').fill(stops[k]);
    await tid('hex-input').press('Enter');
  }
  await esc();
}
async function text(x, y, str, { size, weight, color, family, ls } = {}) {
  await page.keyboard.press('t');
  await clickW(x, y);
  await page.keyboard.type(str);
  await esc();
  await page.waitForTimeout(50);
  if (family) await tid('font-family').selectOption(family);
  if (size) await setField('font-size', size);
  if (weight) await tid('font-weight').selectOption(String(weight));
  if (ls != null) await setField('letter-spacing', ls);
  if (color) await fill(color);
  return sel0();
}
async function shadow(blur, y, opacityHex) {
  await tid('add-effect').click();
  await tid('effect-settings-0').click();
  await setField('effect-blur', blur);
  await setField('effect-y', y);
  if (opacityHex) {
    const c = page.getByTestId('effect-popover').getByTestId('hex-input');
    if (await c.count()) {
      await c.first().fill(opacityHex); await c.first().press('Enter');
      const o = page.getByTestId('effect-popover').getByTestId('cp-opacity').first();
      if (await o.count()) { await o.click(); await o.fill('75'); await o.press('Enter'); }
    }
    else notes.push('no colour input in effect popover');
  }
  await esc();
}

// ---------- start ----------
await page.goto('http://localhost:5390/');
await tid('new-design-file').click();
await page.getByTestId('editor').waitFor();
await page.waitForTimeout(300);
await tid('file-name').click();
await tid('file-name-input').fill('Now Playing — Music Player');
await tid('file-name-input').press('Enter');
await view(1, 300, 300);

// ---------- iPhone frame ----------
await draw('f', 0, 0, 200, 200);
await tid('frame-presets').click();
await tid('menu-phone').hover();
await page.getByText('iPhone 16  393×852').click();
await geom(0, 0);
await fill('0E0B16');
await renameSelected('Now Playing');
const frameNode = await byName('Now Playing');
check('iPhone frame preset 393x852', frameNode.width === 393 && frameNode.height === 852);
await esc(2);

// ---------- background glow (radial gradient ellipse) ----------
await view(1, 196, 300);
await draw('o', 40, 60, 300, 300);
await geom(-80, -60, 560, 560);
await gradient(['6D2BD9', '0E0B16'], 'GRADIENT_RADIAL');
await setField('prop-opacity', 55);
await renameSelected('BG Glow');
await esc(2);

// ---------- status bar ----------
await text(30, 16, '9:41', { size: 16, weight: 600, color: 'FFFFFF' });
await geom(32, 16);
await renameSelected('Time');
await esc(2);
await draw('r', 330, 20, 25, 12);
await geom(334, 19, 25, 12);
await fill('FFFFFF');
await setField('prop-radius', 3);
await renameSelected('Battery');
await esc(2);
// signal bars as small rects
for (const [i, h] of [[0, 4], [1, 6], [2, 8], [3, 10]].map(([i, h]) => [i, h])) {
  await draw('r', 290 + i * 6, 30 - h, 3, h);
  await geom(292 + i * 6, 29 - h, 4, h);
  await fill('FFFFFF');
  await setField('prop-radius', 1);
  await esc(2);
}

// ---------- header: chevron (open pen path), title, more dots ----------
await view(3, 40, 70);
let chev = await pen([{ x: 30, y: 64 }, { x: 38, y: 72 }, { x: 46, y: 64 }], false);
check('pen open path (chevron)', chev?.type === 'VECTOR' && chev.closed === false && chev.points.length === 3, JSON.stringify({ closed: chev?.closed, n: chev?.points?.length }));
await setField('stroke-weight', 2.5);
const strokeHex = page.getByTestId('strokes-hex-0');
if (await strokeHex.count()) await setField('strokes-hex-0', 'FFFFFF');
await renameSelected('Chevron Down');
// grab ON the stroke (mid-segment): grabbing the empty centre of an open path picks the BG Glow layer underneath
await moveInto(34, 68, 28, 62, true);
check('chevron reparented into frame', (await byName('Chevron Down')).parentId === frameNode.id);
await esc(2);
await view(1, 196, 300);
let hdr = await text(150, 62, 'NOW PLAYING', { size: 12, weight: 600, color: 'B9B3C9', ls: 2 });
await geom(Math.round((393 - hdr.width) / 2), 64);
await renameSelected('Header Label');
await esc(2);
for (let i = 0; i < 3; i++) {
  await draw('o', 340 + i * 7, 68, 4, 4);
  await geom(343 + i * 7, 69, 4, 4);
  await fill('FFFFFF');
  await esc(2);
}

// ---------- album art frame with gradient, clip, shadow ----------
await draw('f', 40, 120, 300, 300);
await geom(36, 112, 321, 321);
await setField('prop-radius', 28);
await gradient(['7B2FF7', 'F107A3', 'FF9A3C']);
await shadow(60, 28, '7A1B8F');
await renameSelected('Album Art');
const album = await byName('Album Art');
check('album art nested frame', album.parentId === frameNode.id, `parent=${album.parentId}`);
await esc(2);
// sun
await draw('o', 220, 150, 80, 80);
await geom(196, 52, 84, 84);
await fill('FFE29A');
await setField('prop-opacity', 90);
await renameSelected('Sun');
await esc(2);
// mountains via pen (closed, one curved point)
await view(1, 196, 300);
let m1 = await pen([{ x: 36, y: 433 }, { x: 36, y: 330 }, { x: 110, y: 262 }, { x: 175, y: 318, dx: 18, dy: -6 }, { x: 250, y: 240 }, { x: 357, y: 345 }, { x: 357, y: 433 }], true);
check('pen closed path with curve handle (mountains)', m1?.closed === true && m1.points.some((p) => p.outX !== undefined), JSON.stringify({ closed: m1?.closed, curves: m1?.points?.filter((p) => p.outX !== undefined).length }));
await solidVector('3A1366');
await setField('fills-opacity-0', 85);
await renameSelected('Mountains Back');
await moveInto(250, 380, 0, 128);
const mb = await byName('Mountains Back');
check('pen vector reparented into Album Art by dragging', mb.parentId === album.id, `parent=${mb.parentId}`);
await esc(2);
let m2 = await pen([{ x: 36, y: 433 }, { x: 36, y: 380 }, { x: 120, y: 330, dx: 30, dy: 0 }, { x: 260, y: 372, dx: 30, dy: 10 }, { x: 357, y: 350 }, { x: 357, y: 433 }], true);
await solidVector('1B0B33');
await renameSelected('Mountains Front');
await moveInto(200, 410, 0, (m2.y - 112));
await esc(2);

// ---------- title / artist / heart ----------
let title = await text(36, 470, 'Midnight Bloom', { size: 26, weight: 700, color: 'FFFFFF' });
await geom(36, 468);
await renameSelected('Song Title');
await esc(2);
await text(36, 506, 'Luna Vale · Neon Gardens', { size: 16, weight: 400, color: 'A79FBF' });
await geom(36, 506);
await renameSelected('Artist');
await esc(2);
// heart with pen curves (zoom 3)
await view(3, 340, 488);
let heart = await pen([
  { x: 340, y: 480 },
  { x: 326, y: 482, dx: 0, dy: 9 },
  { x: 340, y: 500 },
  { x: 354, y: 482, dx: 0, dy: -9 },
], true);
check('pen heart: closed + 2 curve handles', heart?.closed === true && heart.points.filter((p) => p.outX !== undefined).length === 2);
await solidVector('FF4D8D');
await renameSelected('Heart');
await moveInto(340, 488, 326, 474);
const heartN = await byName('Heart');
check('heart inside frame', heartN.parentId === frameNode.id);
// vector edit mode: Enter, drag bottom tip point down a bit
await page.keyboard.press('Enter');
await page.waitForTimeout(100);
const vp = page.getByTestId('vpoint-2');
const inEdit = await vp.isVisible().catch(() => false);
const before = (await byName('Heart')).points.map((p) => ({ ...p }));
let pointMoved = false;
if (inEdit) {
  const b = await vp.boundingBox();
  await drag({ x: b.x + b.width / 2, y: b.y + b.height / 2 }, { x: b.x + b.width / 2, y: b.y + b.height / 2 + 9 });
  const after = (await byName('Heart')).points;
  pointMoved = JSON.stringify(after) !== JSON.stringify(before);
  await shot('vector-edit.png');
}
check('vector edit mode (Enter, drag point)', inEdit && pointMoved, `edit=${inEdit} moved=${pointMoved}`);
await esc(3);

// ---------- progress bar ----------
await view(1, 196, 520);
await draw('r', 40, 556, 300, 6);
await geom(36, 560, 321, 4);
await fill('FFFFFF'); await setField('fills-opacity-0', 18);
await setField('prop-radius', 2);
await renameSelected('Track');
await esc(2);
await draw('r', 40, 556, 100, 6);
await geom(36, 560, 132, 4);
await gradient(['F107A3', 'FF9A3C']);
await setField('prop-radius', 2);
await renameSelected('Track Fill');
await esc(2);
await draw('o', 165, 552, 14, 14);
await geom(161, 555, 14, 14);
await fill('FFFFFF');
await shadow(8, 2);
await renameSelected('Knob');
await esc(2);
await text(36, 578, '1:24', { size: 12, weight: 500, color: '8E86A6' });
await geom(36, 576);
await renameSelected('Elapsed');
await esc(2);
let rem = await text(320, 578, '-2:18', { size: 12, weight: 500, color: '8E86A6' });
await geom(Math.round(357 - rem.width), 576);
await renameSelected('Remaining');
await esc(2);

// ---------- progress rings (ellipse arc) around the play button ----------
await draw('o', 160, 620, 80, 80);
await geom(152.5, 617, 88, 88);
await fill('FFFFFF'); await setField('fills-opacity-0', 10);
await setField('arc-ratio', 94);
await renameSelected('Ring Track');
await esc(2);
await draw('o', 160, 620, 80, 80);
await geom(152.5, 617, 88, 88);
await gradient(['FF9A3C', 'F107A3'], 'GRADIENT_ANGULAR');
await setField('arc-ratio', 94);
await setField('arc-sweep', 38);
// start angle (no testid): first input inside arc-controls
const startInput = page.locator('[data-testid="arc-controls"] input').first();
await startInput.click(); await startInput.fill('-90'); await startInput.press('Enter');
await renameSelected('Progress Ring');
const ring = await byName('Progress Ring');
check('ellipse arc (sweep 38%, ratio 94%, start -90)', Math.round(ring.arcSweep) === 137 && Math.abs(ring.arcInner - 0.94) < 0.001, JSON.stringify({ sweep: ring.arcSweep, inner: ring.arcInner, start: ring.arcStart }));
await esc(2);

// ---------- prev / next icons (closed pen polygons) ----------
await view(3, 196, 661);
const prevPts = [[0, 0], [4, 0], [4, 9], [22, 0], [22, 22], [4, 13], [4, 22], [0, 22]];
let prev = await pen(prevPts.map(([x, y]) => ({ x: 86 + x, y: 650 + y })), true);
check('pen closed polygon (previous)', prev?.closed && prev.points.length === 8, `n=${prev?.points?.length}`);
await solidVector('FFFFFF');
await renameSelected('Previous');
await moveInto(86 + 2, 650 + 11, 86, 650);
await esc(2);
let next = await pen(prevPts.map(([x, y]) => ({ x: 286 + 22 - x, y: 650 + y })), true);
check('pen closed polygon (next)', next?.closed && next.points.length === 8);
await solidVector('FFFFFF');
await renameSelected('Next');
await moveInto(286 + 20, 650 + 11, 286, 650);
await esc(2);

// shuffle / repeat as open curved pen strokes
await view(3, 60, 661);
let shuf = await pen([{ x: 34, y: 655 }, { x: 46, y: 655, dx: 4, dy: 0 }, { x: 54, y: 667, dx: 4, dy: 0 }, { x: 62, y: 667 }], false);
check('pen open path with curve (shuffle)', shuf?.closed === false && shuf.points.some((p) => p.outX !== undefined));
await setField('stroke-weight', 2);
if (await page.getByTestId('strokes-hex-0').count()) await setField('strokes-hex-0', 'A79FBF');
await renameSelected('Shuffle');
await moveInto(48, 661, 34, 655);
await esc(2);
await pen([{ x: 59, y: 662 }, { x: 65, y: 667 }, { x: 59, y: 672 }], true);
await solidVector('A79FBF');
await renameSelected('Shuffle Arrow');
await moveInto();
await esc(2);
await view(3, 340, 661);
let rep = await pen([{ x: 342, y: 668 }, { x: 332, y: 668 }, { x: 332, y: 656 }, { x: 350, y: 656 }], false);
await setField('stroke-weight', 2);
if (await page.getByTestId('strokes-hex-0').count()) await setField('strokes-hex-0', 'A79FBF');
await renameSelected('Repeat');
await moveInto();
await esc(2);
await pen([{ x: 348, y: 651 }, { x: 354, y: 656 }, { x: 348, y: 661 }], true);
await solidVector('A79FBF');
await renameSelected('Repeat Arrow');
await moveInto();
await esc(2);
const rp = await byName('Repeat'), ra = await byName('Repeat Arrow');
check('repeat + arrows reparented', rp.parentId === frameNode.id && ra.parentId === frameNode.id && (await byName('Shuffle Arrow')).parentId === frameNode.id);

// ---------- bottom: device row + home indicator ----------
await view(1, 196, 600);
await text(150, 780, 'AirPods Pro', { size: 13, weight: 500, color: 'FF9AC8' });
const dev = await sel0();
await geom(Math.round((393 - dev.width) / 2), 772);
await renameSelected('Device');
await esc(2);
await draw('r', 130, 830, 134, 5);
await geom(129.5, 831, 134, 5);
await fill('FFFFFF'); await setField('prop-radius', 3);
await renameSelected('Home Indicator');
await esc(2);

// ---------- Play/Pause component set (outside frame) ----------
await view(3, 516, 536);
// play triangle first, then frame around it (frame tool wraps contained siblings)
let tri = await pen([{ x: 509, y: 522 }, { x: 509, y: 550 }, { x: 533, y: 536 }], true);
await solidVector('140F1F');
await renameSelected('Play Icon');
await esc(2);
await view(1, 520, 600);
await draw('f', 480, 500, 72, 72);
await geom(480, 500, 72, 72);
await fill('FFFFFF');
await setField('prop-radius', 36);
let playF = await sel0();
check('frame tool wrapped pen triangle', playF.children.length === 1, `children=${playF.children.length}`);
await renameSelected('State=Play');
await page.keyboard.press(`${MOD}+Alt+k`);
check('component State=Play', (await sel0()).type === 'COMPONENT');
await esc(2);
// pause
await draw('f', 480, 600, 72, 72);
await geom(480, 600, 72, 72);
await fill('FFFFFF');
await setField('prop-radius', 36);
await renameSelected('State=Pause');
await esc(2);
await draw('r', 505, 622, 8, 28); await geom(25, 22, 8, 28); await fill('140F1F'); await setField('prop-radius', 2); await esc(2);
await draw('r', 519, 622, 8, 28); await geom(39, 22, 8, 28); await fill('140F1F'); await setField('prop-radius', 2); await esc(2);
await selectLayer('State=Pause');
await page.keyboard.press(`${MOD}+Alt+k`);
check('component State=Pause', (await sel0()).type === 'COMPONENT' && (await sel0()).children.length === 2);
await esc(2);
await selectLayer('State=Play');
await selectLayer('State=Pause', [MOD]);
await tid('combine-variants').click();
const set = await sel0();
check('component set combined', set.type === 'COMPONENT_SET');
await renameSelected('Play Button');
await esc(2);
const playC = await byName('State=Play');
const pauseC = await byName('State=Pause');
check('variants named State=Play/Pause', playC?.parentId === set.id && pauseC?.parentId === set.id);

// interactions
await tid('tab-prototype').click();
for (const [from, to] of [[playC, pauseC], [pauseC, playC]]) {
  await selectLayer(from.name, undefined, ['Play Button']);
  await tid('add-interaction').click();
  await tid('trigger-0').selectOption('ON_CLICK');
  await tid('action-0').selectOption('CHANGE_TO');
  await tid('destination-0').selectOption(to.id);
  const anim = page.getByTestId('animation-0');
  if (await anim.count()) await anim.selectOption('SMART_ANIMATE').catch(() => {});
}
const r1 = (await byName('State=Play')).reactions[0];
const r2 = (await byName('State=Pause')).reactions[0];
check('On click → Change to interactions on both variants', r1?.action === 'CHANGE_TO' && r1.destinationId === pauseC.id && r2?.action === 'CHANGE_TO' && r2.destinationId === playC.id, JSON.stringify([r1, r2].map((r) => r && [r.trigger, r.action])));
await shot('prototype-panel.png');
await tid('tab-design').click().catch(() => {});
await esc(2);

// instance into the phone frame via assets panel drag
await view(1, 300, 600);
await tid('tab-assets').click();
const cb = await canvasBox();
const target = await toScreen(196, 661);
await tid('asset-State=Play').dragTo(page.getByTestId('canvas'), { targetPosition: { x: target.x - cb.x, y: target.y - cb.y } });
await page.waitForTimeout(150);
let inst = (await allNodes()).find((n) => n.type === 'INSTANCE');
check('instance dropped into phone frame', inst && inst.parentId === frameNode.id, `parent=${inst?.parentId}`);
await tid('tab-file').click();
if (inst) {
  if ((await st('s => s.selection'))[0] !== inst.id) { notes.push('instance not selected after asset drop'); await selectLayer(inst.name, undefined, ['Now Playing']); }
  await geom(160.5, 625);
  await renameSelected('Play/Pause');
}
await esc(2);

// ---------- screenshots ----------
await view(0.92, 470, 430);
await page.waitForTimeout(200);
await shot('canvas.png');

// ---------- export main frame ----------
await selectLayer('Now Playing');
await tid('add-export').click();
const sc = page.getByTestId('export-scale-0');
if (await sc.count()) await sc.selectOption('2').catch(() => {});
const [dl] = await Promise.all([page.waitForEvent('download'), tid('export-btn').click()]);
await dl.saveAs(path.join(OUT, 'design.png'));
check('PNG export download', fs.existsSync(path.join(OUT, 'design.png')), dl.suggestedFilename());

// ---------- save local copy ----------
await tid('main-menu-btn').click();
await tid('menu-file').hover();
const [dl2] = await Promise.all([page.waitForEvent('download'), tid('cmd-file.saveLocal').click()]);
await dl2.saveAs(path.join(OUT, 'design.myflow'));
const saved = JSON.parse(fs.readFileSync(path.join(OUT, 'design.myflow'), 'utf8'));
check('Save local copy', saved.format === 'myflow' && Object.keys(saved.doc.nodes).length > 20, `${Object.keys(saved.doc.nodes).length} nodes, file ${dl2.suggestedFilename()}`);
await esc(2);

// ---------- present: click toggles play/pause ----------
inst = await byName('Play/Pause');
await selectLayer('Now Playing');
await tid('present-btn').click();
await page.getByTestId('present').waitFor();
await page.waitForTimeout(500);
await shot('present.png');
const scr = await tid('present-screen').boundingBox();
const scale = scr.width / 393;
const kids = () => page.evaluate((id) => { const el = document.querySelector(`[data-testid="present-screen"] [data-id="${id}"]`); return el ? el.querySelectorAll('[data-id]').length : -1; }, inst.id);
const k0 = await kids();
await page.mouse.move(5, 300);
const img0 = await page.screenshot({ clip: { x: scr.x + 140 * scale, y: scr.y + 600 * scale, width: 120 * scale, height: 120 * scale } });
await page.mouse.click(scr.x + 196.5 * scale, scr.y + 661 * scale);
await page.waitForTimeout(700);
const k1 = await kids();
await page.mouse.move(5, 300); await page.waitForTimeout(300);
const img1 = await page.screenshot({ clip: { x: scr.x + 140 * scale, y: scr.y + 600 * scale, width: 120 * scale, height: 120 * scale } });
await shot('present-paused.png');
await page.mouse.click(scr.x + 196.5 * scale, scr.y + 661 * scale);
await page.waitForTimeout(700);
const k2 = await kids();
await page.mouse.move(5, 300); await page.waitForTimeout(300);
const img2 = await page.screenshot({ clip: { x: scr.x + 140 * scale, y: scr.y + 600 * scale, width: 120 * scale, height: 120 * scale } });
fs.writeFileSync(path.join(OUT, 'present-crop-0.png'), img0); fs.writeFileSync(path.join(OUT, 'present-crop-1.png'), img1); fs.writeFileSync(path.join(OUT, 'present-crop-2.png'), img2);
check('Present: click toggles Play→Pause→Play', !img0.equals(img1) && k0 !== k1 && k0 === k2 && k1 === 2, `children ${k0}→${k1}→${k2}; px0≠px1:${!img0.equals(img1)} px0=px2:${img0.equals(img2)}`);
await esc();
await page.waitForTimeout(300);

const counts = await st('s => { const ns = Object.values(s.doc.nodes); const c = {}; ns.forEach(n => c[n.type] = (c[n.type]||0)+1); return { total: ns.length, c }; }');
log('node counts', JSON.stringify(counts));
log('errors', JSON.stringify(errors));
fs.writeFileSync(path.join(OUT, 'checks.json'), JSON.stringify({ checks, counts, errors, notes }, null, 2));
await browser.close();
