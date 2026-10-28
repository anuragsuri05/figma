// Agent 03 — E-commerce product detail page, built through the My Flow UI.
import { chromium } from '@playwright/test';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('designs/agent-03');
const IMG = path.join(OUT, 'img');
mkdirSync(IMG, { recursive: true });
const MOD = 'Meta';
const STAGE = Number(process.env.STAGE ?? 99);
const log = (...a) => console.log('[agent-03]', ...a);
const findings = [];
const note = (s) => { findings.push(s); log('NOTE:', s); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, baseURL: 'http://localhost:5390' });

// ---------------------------------------------------------------- 1. product images (drawn on a canvas)
async function makeImages() {
  const p = await ctx.newPage();
  await p.setContent('<html><body></body></html>');
  const out = await p.evaluate(() => {
    function shoe(w, h, o) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      // backdrop
      const bg = g.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, o.bg1); bg.addColorStop(1, o.bg2);
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      // soft circle behind
      g.fillStyle = o.circle; g.beginPath(); g.arc(w * 0.55, h * 0.45, Math.min(w, h) * 0.36, 0, Math.PI * 2); g.fill();
      g.save();
      g.translate(w / 2, h / 2);
      const s = Math.min(w / 1000, h / 700) * (o.zoom ?? 1);
      g.scale(s * (o.flip ? -1 : 1), s);
      g.rotate(o.tilt ?? -0.08);
      g.translate(-500, -350);
      // shadow
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath(); g.ellipse(500, 560, 380, 34, 0, 0, Math.PI * 2); g.fill();
      // sole (midsole)
      g.fillStyle = o.sole;
      g.beginPath();
      g.moveTo(130, 470); g.bezierCurveTo(140, 545, 260, 548, 420, 545);
      g.lineTo(800, 540); g.bezierCurveTo(880, 538, 905, 505, 880, 470); g.closePath(); g.fill();
      // outsole strip
      g.fillStyle = o.outsole;
      g.beginPath();
      g.moveTo(150, 515); g.bezierCurveTo(200, 552, 300, 556, 420, 552); g.lineTo(800, 548);
      g.bezierCurveTo(860, 546, 890, 530, 893, 505); g.lineTo(880, 528); g.bezierCurveTo(850, 560, 700, 566, 420, 566);
      g.bezierCurveTo(260, 568, 170, 560, 150, 515); g.fill();
      // upper
      const up = g.createLinearGradient(0, 200, 0, 480);
      up.addColorStop(0, o.upper1); up.addColorStop(1, o.upper2);
      g.fillStyle = up;
      g.beginPath();
      g.moveTo(140, 475);
      g.bezierCurveTo(120, 380, 150, 270, 230, 230); // heel
      g.bezierCurveTo(290, 200, 350, 215, 380, 250); // collar
      g.bezierCurveTo(420, 300, 470, 300, 500, 270); // tongue dip
      g.bezierCurveTo(560, 250, 640, 300, 720, 360); // laces line
      g.bezierCurveTo(800, 400, 880, 420, 885, 470); // toe
      g.closePath(); g.fill();
      // collar lining
      g.fillStyle = o.lining;
      g.beginPath(); g.moveTo(232, 236); g.bezierCurveTo(290, 206, 350, 220, 378, 252); g.bezierCurveTo(340, 262, 280, 262, 232, 236); g.fill();
      // tongue
      g.fillStyle = o.upper1;
      g.beginPath(); g.moveTo(470, 280); g.bezierCurveTo(480, 220, 530, 200, 560, 215); g.bezierCurveTo(560, 250, 540, 270, 520, 285); g.fill();
      // swoosh-ish accent stripe
      g.fillStyle = o.accent;
      g.beginPath(); g.moveTo(230, 450); g.bezierCurveTo(380, 470, 600, 380, 820, 300); g.bezierCurveTo(640, 410, 420, 500, 230, 450); g.fill();
      // toe cap overlay
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.beginPath(); g.moveTo(720, 362); g.bezierCurveTo(800, 400, 880, 420, 885, 470); g.lineTo(760, 470); g.bezierCurveTo(760, 430, 740, 390, 720, 362); g.fill();
      // laces
      g.strokeStyle = o.lace; g.lineWidth = 9; g.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const x = 520 + i * 45, y = 290 + i * 22;
        g.beginPath(); g.moveTo(x - 14, y - 16); g.lineTo(x + 18, y + 14); g.stroke();
        g.beginPath(); g.moveTo(x + 18, y - 16); g.lineTo(x - 14, y + 14); g.stroke();
      }
      // heel tab
      g.fillStyle = o.accent; g.beginPath(); g.roundRect(150, 300, 34, 120, 14); g.fill();
      // stitching
      g.setLineDash([10, 8]); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(160, 462); g.bezierCurveTo(400, 470, 700, 462, 870, 462); g.stroke();
      g.restore();
      return c.toDataURL('image/png');
    }
    const base = { bg1: '#F3EEE7', bg2: '#E6DED2', circle: 'rgba(255,255,255,0.55)', upper1: '#2F4A6D', upper2: '#1D2F47', sole: '#F7F4EF', outsole: '#E2553A', accent: '#F26B4E', lining: '#C9D6E8', lace: '#F7F4EF' };
    return {
      main: shoe(1280, 1120, { ...base }),
      t1: shoe(580, 480, { ...base }),
      t2: shoe(580, 480, { ...base, flip: true, tilt: 0.05, bg1: '#ECE7F2', bg2: '#DCD3E8' }),
      t3: shoe(580, 480, { ...base, zoom: 1.9, tilt: -0.25, bg1: '#E9F0EA', bg2: '#D5E2D7' }),
      t4: shoe(580, 480, { ...base, upper1: '#E9E4DA', upper2: '#CFC6B6', accent: '#2F4A6D', lining: '#F26B4E', lace: '#2F4A6D', outsole: '#2F4A6D', bg1: '#F6EDE4', bg2: '#EADBCB' }),
    };
  });
  for (const [k, v] of Object.entries(out)) writeFileSync(path.join(IMG, `${k}.png`), Buffer.from(v.split(',')[1], 'base64'));
  await p.close();
  log('images generated');
}
await makeImages();

// ---------------------------------------------------------------- 2. editor helpers
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|Failed to load resource/.test(m.text())) errors.push(m.text()); });

const st = (fn) => page.evaluate(`(() => { const s = window.__myflow.get(); return (${fn})(s); })()`);
const sel = () => st('s => s.selection.map(id => { const n = s.doc.nodes[id]; return { id, type: n.type, name: n.name, x: n.x, y: n.y, w: n.width, h: n.height, parentId: n.parentId }; })');
const node = (id) => st(`s => s.doc.nodes['${id}']`);
const allNodes = () => st('s => Object.values(s.doc.nodes)');
const sleep = (ms) => page.waitForTimeout(ms);
let view = { zoom: 1, panX: 0, panY: 0 };
async function focus(x, y, zoom = 1) {
  // put world (x, y) at screen (300, 110)
  view = { zoom, panX: 300 - x * zoom, panY: 110 - y * zoom };
  await page.evaluate((v) => window.__myflow.get().setState(v), view);
  await sleep(80);
}
const S = (x, y) => ({ x: x * view.zoom + view.panX, y: y * view.zoom + view.panY });
async function drag(a, b, steps = 8) {
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps }); await page.mouse.up();
}
async function draw(key, x, y, w, h) { await page.keyboard.press(key); await drag(S(x, y), S(x + w, y + h)); await sleep(60); }
async function setF(testId, value) {
  const f = page.getByTestId(testId).first();
  await f.click(); await f.fill(String(value)); await f.press('Enter'); await sleep(30);
}
async function geom(x, y, w, h) {
  if (w != null) await setF('prop-w', w);
  if (h != null) await setF('prop-h', h);
  if (x != null) await setF('prop-x', x);
  if (y != null) await setF('prop-y', y);
}
async function fill(hex) { await setF('fills-hex-0', hex.replace('#', '')); }
async function esc() { await page.keyboard.press('Escape'); await sleep(40); }
async function rename(currentName, newName) {
  await page.getByTestId(`layer-${currentName}`).first().dblclick();
  await page.getByTestId('layer-rename-input').fill(newName);
  await page.getByTestId('layer-rename-input').press('Enter');
  await sleep(40);
}
// text: click (auto width) or drag (fixed width) at world coords
async function text(str, x, y, opts = {}) {
  await page.keyboard.press('t');
  if (opts.width) await drag(S(x, y), S(x + opts.width, y + (opts.h ?? 30)));
  else await page.mouse.click(S(x, y).x, S(x, y).y);
  await page.getByTestId('text-editor').waitFor();
  await page.keyboard.type(str, { delay: 2 });
  await esc();
  const [t] = await sel();
  if (!t || t.type !== 'TEXT') throw new Error('text not selected after typing ' + str);
  if (opts.family) await page.getByTestId('font-family').selectOption(opts.family);
  if (opts.size) await setF('font-size', opts.size);
  if (opts.weight) await page.getByTestId('font-weight').selectOption(String(opts.weight));
  if (opts.lh) await setF('line-height', opts.lh);
  if (opts.ls != null) await setF('letter-spacing', opts.ls);
  if (opts.color) await fill(opts.color);
  if (opts.align) await page.getByTestId(`text-align-${opts.align}`).click();
  if (opts.x != null || opts.y != null) await geom(opts.x, opts.y);
  return t;
}
async function menuCmd(menu, cmd) {
  await page.getByTestId('main-menu-btn').click();
  await page.getByTestId(`menu-${menu}`).hover();
  await page.getByTestId(`cmd-${cmd}`).click();
  await sleep(100);
}
async function shot(name) { await page.screenshot({ path: path.join(OUT, name) }); }

// ---------------------------------------------------------------- 3. new file
await page.goto('/');
await page.getByTestId('new-design-file').click();
await page.getByTestId('editor').waitFor();
await page.getByTestId('canvas').waitFor();
await sleep(300);
await page.getByTestId('file-name').click();
await page.getByTestId('file-name-input').fill('Aero Glide — Product Page');
await page.getByTestId('file-name-input').press('Enter');
log('file created, canvas box', await page.getByTestId('canvas').boundingBox());

const FONT = 'Inter';
const INK = '#16181D', MUTED = '#6B6F78', LINE = '#E7E2DA', BG = '#FBF9F6', ACCENT = '#E2553A';

// ---------------------------------------------------------------- 4. main frame
await focus(-50, -50, 0.5);
await draw('f', 0, 0, 600, 500);
await geom(0, 0, 1440, 1024);
await fill(BG);
const frame = (await sel())[0];
await rename(frame.name, 'Product Page');
log('frame', await sel());

// header bar
await focus(-20, -20, 1);
await draw('r', 0, 0, 300, 50);
await geom(0, 0, 1440, 72); await fill('#FFFFFF');
await rename('Rectangle', 'Header bg');
await draw('r', 10, 80, 300, 5);
await geom(0, 72, 1440, 1); await fill(LINE);
await rename('Rectangle', 'Header divider');
await text('NORDKAMM', 80, 20, { family: FONT, size: 20, weight: 800, ls: 3, color: INK, x: 80, y: 24 });
let nx = 520;
for (const l of ['New', 'Men', 'Women', 'Running', 'Journal']) {
  await focus(nx - 100, -20, 1);
  await text(l, nx, 26, { family: FONT, size: 15, weight: l === 'Running' ? 600 : 500, color: l === 'Running' ? INK : MUTED, x: nx, y: 26 });
  nx += l.length * 9 + 44;
}
await focus(1100, -20, 1);
await text('Search', 1150, 26, { family: FONT, size: 15, weight: 500, color: MUTED, x: 1150, y: 26 });
await text('Account', 1226, 26, { family: FONT, size: 15, weight: 500, color: MUTED, x: 1226, y: 26 });
await text('Bag (2)', 1306, 26, { family: FONT, size: 15, weight: 600, color: INK, x: 1306, y: 26 });

// breadcrumb
await focus(-20, 60, 1);
await text('Home  /  Running  /  Men’s shoes  /  Aero Glide 3', 80, 100, { family: FONT, size: 13, weight: 400, color: MUTED, x: 80, y: 100 });
await shot('step-header.png');
if (STAGE < 2) { await browser.close(); process.exit(0); }

// ---------------------------------------------------------------- 5. images
// main image + 3 thumbnails via Place image (⌘⇧K + file chooser, multi-select queue)
await focus(40, 120, 0.6);
{
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press(`${MOD}+Shift+k`);
  await (await chooser).setFiles(['main', 't1', 't2', 't3'].map((k) => path.join(IMG, `${k}.png`)));
  await page.getByTestId('toast').waitFor();
  log('toast:', await page.getByTestId('toast').textContent());
  // drag to place main image (640×560) inside the frame
  await drag(S(80, 140), S(720, 700));
  await sleep(400);
  let [img] = await sel();
  log('main image placed', img);
  await geom(80, 140, 640, 560);
  await setF('prop-radius', 16);
  await rename(img.name, 'Product image');
  // thumbnails 1..3
  const TW = 145, TH = 120, TY = 720;
  for (let i = 0; i < 3; i++) {
    const tx = 80 + i * (TW + 20);
    await drag(S(tx, TY), S(tx + TW, TY + TH));
    await sleep(400);
    const [t] = await sel();
    await geom(tx, TY, TW, TH);
    await setF('prop-radius', 10);
    await rename(t.name, `Thumbnail ${i + 1}`);
  }
}
// 4th thumbnail: rectangle, then fill type → Image → Choose image… in the color picker
{
  const tx = 80 + 3 * 165;
  await draw('r', tx, 720, 145, 120);
  await geom(tx, 720, 145, 120);
  await setF('prop-radius', 10);
  await rename('Rectangle', 'Thumbnail 4');
  await page.getByTestId('fills-swatch-0').click();
  await page.getByTestId('paint-picker').waitFor();
  await page.getByTestId('paint-type').selectOption('IMAGE');
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('choose-image').click();
  await (await chooser).setFiles(path.join(IMG, 't4.png'));
  await sleep(500);
  await esc();
}
// selected-thumbnail ring on Thumbnail 1
await page.getByTestId('layer-Thumbnail 1').first().click();
await page.getByTestId('add-strokes').click();
await setF('strokes-hex-0', INK.slice(1));
await setF('stroke-weight', 2);
await esc();
// small "New" badge over image
await focus(40, 120, 1);
await draw('r', 100, 160, 80, 28);
await geom(104, 164, 84, 28); await setF('prop-radius', 14); await fill(INK);
await rename('Rectangle', 'Badge bg');
await text('NEW IN', 114, 168, { family: FONT, size: 12, weight: 700, ls: 1.5, color: '#FFFFFF', width: 64, h: 16, align: 'center', x: 114, y: 171 });
await shot('step-images.png');
if (STAGE < 3) { await browser.close(); process.exit(0); }

// ---------------------------------------------------------------- 6. right column text
const RX = 800, RW = 560;
await focus(760, 100, 1);
await text('RUNNING  ·  MEN’S', RX, 144, { family: FONT, size: 12, weight: 700, ls: 2, color: ACCENT, x: RX, y: 144 });
await text('Aero Glide 3 Road Running Shoe', RX, 168, { family: FONT, size: 40, weight: 800, lh: 46, ls: -1, color: INK, width: RW, h: 50, x: RX, y: 166 });
const title = (await sel())[0];

// stars via the Star tool (toolbar dropdown) — 5 in a row
for (let i = 0; i < 5; i++) {
  await page.getByTestId('tool-caret-shape').click();
  await page.getByTestId('tool-menu-star').click();
  const sx = RX + i * 24;
  await drag(S(sx, 270), S(sx + 20, 290));
  await sleep(60);
  const [s] = await sel();
  if (s.type !== 'STAR') note(`Star tool created ${s.type} instead of STAR`);
  await geom(sx, 272, 20, 20);
  await fill(i < 4 ? '#F5A623' : '#F8CF86');
  if (i === 0) log('star node', await node(s.id).then((n) => ({ pointCount: n.pointCount, innerRadius: n.innerRadius })));
  await setF('star-ratio', 45);
  await rename(s.name, `Star ${i + 1}`);
}
await text('4.8', RX + 132, 272, { family: FONT, size: 15, weight: 700, color: INK, x: RX + 130, y: 273 });
await text('312 reviews', RX + 160, 272, { family: FONT, size: 15, weight: 400, color: MUTED, x: RX + 158, y: 273 });
await page.keyboard.press(`${MOD}+u`); // underline the review link
await esc();

// price + strikethrough old price
await text('$129.00', RX, 312, { family: FONT, size: 32, weight: 800, color: INK, x: RX, y: 310 });
await text('$180.00', RX + 150, 322, { family: FONT, size: 20, weight: 400, color: '#9A9EA6', x: RX + 142, y: 320 });
await page.getByTestId('type-settings').click();
await page.getByTestId('deco-strikethrough').click();
await esc();
const oldPrice = (await sel())[0];
await esc();
await draw('r', RX + 240, 318, 60, 26);
await geom(RX + 236, 318, 92, 28); await setF('prop-radius', 14); await fill('#FCE7E2');
await rename('Rectangle', 'Discount bg');
await text('Save 28%', RX + 246, 322, { family: FONT, size: 13, weight: 700, color: ACCENT, width: 92, h: 16, align: 'center', x: RX + 236, y: 323 });
await text('Tax included. Free shipping over $100.', RX, 360, { family: FONT, size: 13, weight: 400, color: MUTED, x: RX, y: 358 });
await draw('r', RX, 396, 300, 4);
await geom(RX, 396, RW, 1); await fill(LINE);
await rename('Rectangle', 'Divider 1');
await text('Select size (US)', RX, 420, { family: FONT, size: 15, weight: 600, color: INK, x: RX, y: 420 });
await text('Size guide', RX + 480, 420, { family: FONT, size: 14, weight: 500, color: MUTED, x: RX + 486, y: 421 });
await page.keyboard.press(`${MOD}+u`);
await esc();
await shot('step-text.png');
if (STAGE < 4) { await browser.close(); process.exit(0); }

// ---------------------------------------------------------------- 7. size chip component set with variants
// build two frames outside the page frame, style them, make each a component, then combine as variants
const CY = 1150;
await focus(-40, CY - 80, 1);
await draw('f', 0, CY, 72, 48);
await geom(0, CY, 72, 48);
await fill('#FFFFFF'); await setF('prop-radius', 10);
await page.getByTestId('add-strokes').click();
await setF('strokes-hex-0', 'D9D3C9');
await setF('stroke-weight', 1);
const chipA = (await sel())[0];
await text('9', 6, CY + 14, { family: FONT, size: 15, weight: 600, color: INK, width: 60, h: 20, align: 'center' });
const chipText = (await sel())[0];
await geom(0, 14, 72, null);
log('chip text parent', (await node(chipText.id)).parentId === chipA.id ? 'inside chip' : 'NOT inside chip');
await rename(chipA.name, 'State=Default');
// duplicate the frame and restyle as Selected
await page.getByTestId('layer-State=Default').first().click();
await page.keyboard.press(`${MOD}+d`);
await sleep(100);
const chipB = (await sel())[0];
await geom(140, CY);
await fill(INK);
await setF('strokes-hex-0', INK.slice(1));
const chipBNode = await node(chipB.id);
await esc();
// select its label by double-clicking into the frame on canvas
await page.mouse.dblclick(S(140 + 36, CY + 24).x, S(140 + 36, CY + 24).y);
await sleep(100);
let inner = (await sel())[0];
log('dblclick into duplicate selected', inner);
if (!inner || inner.type !== 'TEXT') {
  note('Double-click on frame did not select inner text');
  await page.getByTestId(`layer-9`).nth(1).click();
  inner = (await sel())[0];
}
await fill('#FFFFFF');
await esc(); await esc();
await rename(chipBNode.name === 'State=Default' ? 'State=Default' : chipBNode.name, 'State=Selected');
// hmm: if duplicate kept the same name, rename the second row
// make components
for (const nm of ['State=Default', 'State=Selected']) {
  await page.getByTestId(`layer-${nm}`).first().click();
  await page.keyboard.press(`${MOD}+Alt+k`);
  await sleep(80);
  const [c] = await sel();
  if (c.type !== 'COMPONENT') note(`⌘⌥K on frame "${nm}" produced ${c.type}`);
}
await page.getByTestId('layer-State=Default').first().click();
await page.getByTestId('layer-State=Selected').first().click({ modifiers: ['Meta'] });
log('selected for combine', (await sel()).map((n) => n.name + ':' + n.type));
await page.getByTestId('combine-variants').click();
await sleep(100);
const set = (await sel())[0];
log('component set', JSON.stringify(set));
const setNode = await node(set.id);
await rename(setNode.name, 'Size option');
await esc();
await shot('step-component.png');
if (STAGE < 5) { await browser.close(); process.exit(0); }

// ---------------------------------------------------------------- 8. size instances inside the page
const sizes = ['7', '8', '8.5', '9', '9.5', '10', '11'];
const defId = (await allNodes()).find((n) => n.parentId === set.id && n.name === 'State=Default').id;
const instIds = [];
const CW = 72, GAP = 9.33;
for (let i = 0; i < sizes.length; i++) {
  if (i === 0) {
    await focus(-40, CY - 80, 1);
    // copy the Default variant: click it on the canvas
    await page.mouse.click(S(20, CY + 6).x, S(20, CY + 6).y);
    await sleep(60);
    let [v] = await sel();
    log('clicked on canvas variant ->', v?.name, v?.type, await page.evaluate(([x, y]) => document.elementsFromPoint(x, y).slice(0, 4).map((e) => e.tagName + '.' + (e.getAttribute('class') || '') + '#' + (e.getAttribute('data-id') || e.getAttribute('data-testid') || '')), [S(20, CY + 6).x, S(20, CY + 6).y]));
    if (v?.name !== 'State=Default') {
      note('Single click on a variant inside a component set on canvas selected nothing; used the variant frame label instead');
      await page.getByTestId('frame-label-State=Default').click();
      [v] = await sel();
      log('label click ->', v?.name);
    }
    if (v?.name !== 'State=Default') {
      await page.mouse.dblclick(S(20, CY + 6).x, S(20, CY + 6).y);
      log('after dblclick ->', (await sel())[0]?.name);
    }
    await page.keyboard.press(`${MOD}+c`);
  }
  // select the page frame and paste into it
  await page.getByTestId('layer-Product Page').first().click();
  await page.keyboard.press(`${MOD}+v`);
  await sleep(120);
  const [inst] = await sel();
  if (inst.type !== 'INSTANCE') note(`Paste of variant gave ${inst.type}, not INSTANCE`);
  const ix = Math.round(RX + i * (CW + GAP)), iy = 452;
  await geom(ix, iy);
  instIds.push(inst.id);
  // override the label: double-click into the instance, double-click text to edit
  await focus(ix - 200, iy - 200, 1);
  await page.mouse.dblclick(S(ix + CW / 2, iy + 24).x, S(ix + CW / 2, iy + 24).y);
  await sleep(80);
  let [t] = await sel();
  let editing = await st('s => s.editingTextId');
  if (!editing && t?.type === 'TEXT') {
    await page.mouse.dblclick(S(ix + CW / 2, iy + 24).x, S(ix + CW / 2, iy + 24).y);
    editing = await st('s => s.editingTextId');
  }
  if (i === 0) log('double-click on instance -> selected', t?.type, 'editing', !!editing);
  if (editing) {
    await page.keyboard.press(`${MOD}+a`);
    await page.keyboard.type(sizes[i]);
    await esc();
  } else note(`could not edit text inside instance (selected ${t?.type})`);
  await esc(); await esc();
}
// switch the "9" instance (index 3) to Selected via the variant property dropdown
await page.evaluate(() => 0);
{
  const target = instIds[5];
  const n = await node(target);
  // click the instance on the canvas
  const ix = Math.round(RX + 5 * (CW + GAP));
  await focus(ix - 200, 300, 1);
  log('selection before click', (await sel()).map((x) => x.name));
  await page.mouse.click(S(ix + 8, 452 + 8).x, S(ix + 8, 452 + 8).y);
  let cur = (await sel())[0];
  if (cur?.id !== target) {
    note('With the page frame selected, clicking a child instance kept the frame selected: ' + cur?.name);
    await esc(); await esc();
    await page.mouse.click(S(ix + 8, 452 + 8).x, S(ix + 8, 452 + 8).y);
    cur = (await sel())[0];
    log('after deselect + click', cur?.name, cur?.type);
  }
  log('instance to switch', cur);
  await page.getByTestId('variant-prop-State').waitFor();
  await page.getByTestId('variant-select-State').selectOption('Selected');
  await sleep(100);
  const after = await node(cur.id);
  const selVariant = (await allNodes()).find((x) => x.parentId === set.id && x.name === 'State=Selected');
  log('switched instance main =', after.mainComponentId === selVariant.id ? 'Selected ✓' : after.mainComponentId);
  const kids = await st(`s => s.doc.nodes['${cur.id}'].children.map(c => s.doc.nodes[c].text?.characters)`);
  log('after switch: instance name =', after.name, 'size', after.width, 'x', after.height, 'label =', kids);
  await shot('variant-switch.png');
  // the label override was lost on switch (bug) — re-type it through the UI
  if (!kids.includes(sizes[5])) {
    note(`Variant switch reset the overridden label "${sizes[5]}" back to "${kids.join('')}"`);
    await page.mouse.dblclick(S(ix + CW / 2, 452 + 24).x, S(ix + CW / 2, 452 + 24).y);
    await sleep(80);
    if (!(await st('s => s.editingTextId'))) await page.mouse.dblclick(S(ix + CW / 2, 452 + 24).x, S(ix + CW / 2, 452 + 24).y);
    await page.keyboard.press(`${MOD}+a`);
    await page.keyboard.type(sizes[5]);
    await esc();
  }
  await esc(); await esc();
}
await page.getByTestId('layer-Product Page').first().click();
await esc();
await shot('step-sizes.png');
if (STAGE < 6) { await browser.close(); process.exit(0); }

// ---------------------------------------------------------------- 9. CTA + description
await focus(760, 450, 1);
await text('Only 3 left in size 10', RX, 516, { family: FONT, size: 13, weight: 500, color: ACCENT, x: RX, y: 516 });
await draw('r', RX, 548, 400, 56);
await geom(RX, 548, 476, 56); await setF('prop-radius', 12); await fill(INK);
await rename('Rectangle', 'Add to cart bg');
await text('Add to cart  —  $129.00', RX + 20, 566, { family: FONT, size: 16, weight: 700, color: '#FFFFFF', width: 400, h: 20, align: 'center', x: RX, y: 566 });
await geom(null, null, 476, null);
await draw('r', RX + 488, 548, 72, 56);
await geom(RX + 488, 548, 72, 56); await setF('prop-radius', 12); await fill('#FFFFFF');
await page.getByTestId('add-strokes').click();
await setF('strokes-hex-0', 'D9D3C9');
await rename('Rectangle', 'Wishlist bg');
await text('♡', RX + 510, 560, { family: FONT, size: 26, weight: 400, color: INK, width: 72, h: 30, align: 'center', x: RX + 488, y: 558 });

await text('Free delivery in 2–4 days  ·  30-day free returns', RX, 624, { family: FONT, size: 13, weight: 400, color: MUTED, x: RX, y: 624 });
await draw('r', RX, 660, 300, 4);
await geom(RX, 660, RW, 1); await fill(LINE);
await rename('Rectangle', 'Divider 2');
await focus(760, 640, 1);
await text('Description', RX, 684, { family: FONT, size: 17, weight: 700, color: INK, x: RX, y: 684 });
const desc = 'Built for daily miles, the Aero Glide 3 pairs a featherlight engineered-mesh upper with our responsive FoamCore midsole for a smooth, energetic ride from the first step to the last kilometre. A reinforced heel counter locks you in, while the grippy rubber outsole keeps every stride confident on wet city streets.';
await text(desc, RX, 716, { family: FONT, size: 15, weight: 400, lh: 24, color: '#454952', width: RW, h: 40, x: RX, y: 716 });
const descNode = (await sel())[0];
await text('Weight 248 g  ·  Drop 8 mm  ·  Recycled mesh upper', RX, 836, { family: FONT, size: 13, weight: 500, color: MUTED, x: RX, y: 832 });
await esc(); await esc();
// trust strip at the bottom of the page
await focus(-20, 860, 1);
await draw('r', 0, 950, 300, 40);
await geom(0, 924, 1440, 100); await fill('#F1ECE4');
await rename('Rectangle', 'Trust strip');
const perks = [['Free shipping', 'On orders over $100'], ['30-day returns', 'Run in them, then decide'], ['2-year warranty', 'On every NORDKAMM shoe'], ['Carbon neutral', 'Delivery offset by default']];
for (let i = 0; i < perks.length; i++) {
  const px = 80 + i * 330;
  await focus(px - 100, 860, 1);
  await text(perks[i][0], px, 950, { family: FONT, size: 15, weight: 700, color: INK, x: px, y: 950 });
  await text(perks[i][1], px, 976, { family: FONT, size: 13, weight: 400, color: MUTED, x: px, y: 975 });
}
await esc(); await esc();
await shot('step-cta.png');

// ---------------------------------------------------------------- 10. verification
const doc = await st('s => s.doc');
const N = Object.values(doc.nodes);
const desc2 = doc.nodes[descNode.id];
const checks = {
  imageFills: N.filter((n) => n.fills?.some((f) => f.type === 'IMAGE' && f.imageSrc)).map((n) => n.name),
  stars: N.filter((n) => n.type === 'STAR').map((n) => `${n.name} pts=${n.pointCount} r=${n.innerRadius} fill=${n.fills[0]?.color}`),
  strike: doc.nodes[oldPrice.id].text.decoration,
  set: N.filter((n) => n.type === 'COMPONENT_SET').map((n) => ({ name: n.name, variants: n.children.map((c) => doc.nodes[c].name) })),
  instances: N.filter((n) => n.type === 'INSTANCE').map((n) => ({ main: doc.nodes[n.mainComponentId]?.name, label: n.children.map((c) => doc.nodes[c].text?.characters).join('') })),
  descWrap: { autoResize: desc2.text.autoResize, w: desc2.width, h: desc2.height },
  titleWrap: { autoResize: doc.nodes[title.id].text.autoResize, w: doc.nodes[title.id].width, h: doc.nodes[title.id].height },
  layerCount: N.length,
};
log('checks', JSON.stringify(checks, null, 1));
writeFileSync(path.join(OUT, 'checks.json'), JSON.stringify(checks, null, 2));

// ---------------------------------------------------------------- 11. canvas screenshot
await page.getByTestId('layer-Product Page').first().click();
await page.keyboard.press('Shift+2');
await sleep(300);
await shot('canvas.png');
await page.keyboard.press('Shift+1');
await sleep(300);
await shot('canvas-all.png');

// ---------------------------------------------------------------- 12. export (PNG 1x as design.png, JPG 2x)
await page.getByTestId('layer-Product Page').first().click();
await page.getByTestId('add-export').click(); // row 0: PNG 1x
await page.getByTestId('add-export').click(); // row 1: defaults 2x
await page.getByTestId('export-format-1').selectOption('JPG');
await page.getByTestId('export-scale-1').selectOption('2');
const exps = (await node(frame.id)).exports;
log('export settings', exps);
const downloads = [];
page.on('download', async (d) => { const p = await d.path(); downloads.push({ name: d.suggestedFilename(), buf: readFileSync(p) }); });
await page.getByTestId('export-btn').click();
for (let i = 0; i < 100 && downloads.length < 2; i++) await sleep(200);
log('downloads', downloads.map((d) => d.name + ' ' + d.buf.length));
for (const d of downloads) {
  if (d.name.endsWith('.png')) writeFileSync(path.join(OUT, 'design.png'), d.buf);
  if (d.name.endsWith('.jpg') || d.name.endsWith('.jpeg')) writeFileSync(path.join(OUT, 'design@2x.jpg'), d.buf);
}

// ---------------------------------------------------------------- 13. save local copy
{
  const dl = page.waitForEvent('download');
  await menuCmd('file', 'file.saveLocal');
  const d = await dl;
  const buf = readFileSync(await d.path());
  writeFileSync(path.join(OUT, 'design.myflow'), buf);
  log('saved local copy', d.suggestedFilename(), buf.length);
}

log('errors', errors);
log('findings', findings);
writeFileSync(path.join(OUT, 'run-log.json'), JSON.stringify({ errors, findings, downloads: downloads.map((d) => d.name) }, null, 2));
await browser.close();
