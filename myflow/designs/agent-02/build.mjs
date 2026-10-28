// Designer Agent 02 — SaaS analytics dashboard, built through the My Flow UI only.
// Run from project root:  node designs/agent-02/build.mjs
import { chromium } from '@playwright/test';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('designs/agent-02');
mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:5390/';
const results = [];   // { check, pass, note }
const log = (...a) => console.log('[a02]', ...a);
const check = (name, pass, note = '') => { results.push({ check: name, pass: !!pass, note }); log(pass ? 'PASS' : 'FAIL', name, note); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|picsum|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });

/* ------------------------------------------------------------------ helpers */
const st = (fn) => page.evaluate(`(() => { const s = window.__myflow.get(); return (${fn})(s); })()`);
const allNodes = () => st('s => Object.values(s.doc.nodes)');
const sel = () => st('s => s.selection.map(id => s.doc.nodes[id])');
const byName = async (name) => (await allNodes()).find((n) => n.name === name);
const absRect = (id) => st(`s => { let n = s.doc.nodes['${id}']; let x = 0, y = 0; const w = n.width, h = n.height; while (n) { x += n.x; y += n.y; n = n.parentId ? s.doc.nodes[n.parentId] : null; } return { x, y, width: w, height: h }; }`);
const wait = (ms) => page.waitForTimeout(ms);
const blur = () => page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
let CANVAS;
async function canvasBox() {
  const c = await page.getByTestId('canvas').boundingBox();
  const l = await page.getByTestId('left-panel').boundingBox();
  const r = await page.getByTestId('right-panel').boundingBox();
  const x = l ? l.x + l.width + 8 : c.x, x2 = r ? r.x - 8 : c.x + c.width;
  CANVAS = { x, y: c.y, width: x2 - x, height: Math.min(c.height, 820) - c.y };
  return CANVAS;
}
async function view(zoom, wx, wy) { // put world (wx,wy) at canvas top-left + 40
  await canvasBox();
  await page.evaluate(([z, px, py]) => window.__myflow.get().setState({ zoom: z, panX: px, panY: py }), [zoom, CANVAS.x + 40 - wx * zoom, CANVAS.y + 40 - wy * zoom]);
  await wait(60);
}
async function ensure(x, y, w = 10, h = 10) {
  const s = await st('s => ({ zoom: s.zoom, panX: s.panX, panY: s.panY })');
  const sx = x * s.zoom + s.panX, sy = y * s.zoom + s.panY, ex = (x + w) * s.zoom + s.panX, ey = (y + h) * s.zoom + s.panY;
  if (s.zoom !== 1 || sx < CANVAS.x + 10 || sy < CANVAS.y + 10 || ex > CANVAS.x + CANVAS.width - 10 || ey > CANVAS.y + CANVAS.height - 10) await view(1, x - 20, y - 20);
}
const toScreen = async (x, y) => st(`s => ({ x: ${x} * s.zoom + s.panX, y: ${y} * s.zoom + s.panY })`);
async function drag(a, b, steps = 8) {
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps }); await page.mouse.up();
}
async function setField(id, v) {
  const f = page.getByTestId(id).first();
  await f.click(); await f.fill(String(v)); await f.press('Enter');
  await blur();
}
async function selectOpt(id, v) { await page.getByTestId(id).first().selectOption(String(v)); await blur(); }
async function key(k) { await blur(); await page.keyboard.press(k); await wait(30); }
async function drawShape(k, x, y, w, h) {
  await ensure(x, y, w, h);
  await key(k);
  await drag(await toScreen(x, y), await toScreen(x + w, y + h));
  await wait(40);
}
let twistyClicks = 0;
async function reveal(name) {
  // expand collapsed ancestors in the layers panel by clicking their twisties
  if (await page.getByTestId(`layer-${name}`).count()) return;
  const chain = await st(`s => { const n = Object.values(s.doc.nodes).find(x => x.name === ${JSON.stringify(name)}); const out = []; let p = n && n.parentId ? s.doc.nodes[n.parentId] : null; while (p) { out.unshift(p.name); p = p.parentId ? s.doc.nodes[p.parentId] : null; } return out; }`);
  for (let i = 0; i < chain.length; i++) {
    const next = i + 1 < chain.length ? chain[i + 1] : name;
    if (await page.getByTestId(`layer-${next}`).count()) continue;
    await page.getByTestId(`twisty-${chain[i]}`).first().click(); twistyClicks++;
    await wait(30);
  }
}
async function layer(name, opts = {}) {
  await reveal(name);
  const row = page.getByTestId(`layer-${name}`).first();
  await row.scrollIntoViewIfNeeded();
  await row.click({ modifiers: opts.add ? ['ControlOrMeta'] : [] });
  await wait(30);
}
async function selectLayers(names) { for (let i = 0; i < names.length; i++) await layer(names[i], { add: i > 0 }); }
async function rename(newName) {
  const row = page.locator('.layer.sel').first();
  await row.scrollIntoViewIfNeeded();
  await row.locator('.name').dblclick();
  await page.getByTestId('layer-rename-input').fill(newName);
  await page.getByTestId('layer-rename-input').press('Enter');
  await wait(30);
}
async function fill(hex) { await setField('fills-hex-0', hex); }
async function addFill(hex) { await page.getByTestId('add-fills').click(); await fill(hex); }
/** text at world top-left (x,y). width => fixed-width text box via drag. */
async function text(str, x, y, { size = 14, weight = 400, color = '0F172A', w = null, align = null } = {}) {
  await ensure(x, y, w ?? 200, 40);
  await key('t');
  if (w) await drag(await toScreen(x, y + 2), await toScreen(x + w, y + 12));
  else { const p = await toScreen(x, y + 9.68); await page.mouse.click(p.x, p.y); }
  await page.keyboard.type(str);
  await page.keyboard.press('Escape');
  await wait(40);
  if (size !== 16) await setField('font-size', size);
  if (weight !== 400) await selectOpt('font-weight', weight);
  if (color !== '000000') await fill(color);
  if (align) await page.getByTestId(`text-align-${align}`).click();
  return (await sel())[0];
}
async function shiftA() { await key('Shift+a'); await wait(60); return (await sel())[0]; }
async function shot(name) { await page.screenshot({ path: path.join(OUT, name) }); }
async function step(name, fn) {
  try { await fn(); } catch (e) { check(name, false, 'EXCEPTION: ' + e.message.split('\n')[0]); await shot(`err-${name.replace(/\W+/g, '_')}.png`).catch(() => {}); }
}

/* ------------------------------------------------------------------ open + name */
await page.goto(URL);
await page.getByTestId('new-design-file').click();
await page.getByTestId('editor').waitFor();
await wait(300);
await canvasBox();
log('canvas', CANVAS);
await page.getByTestId('file-name').click();
await page.getByTestId('file-name-input').fill('Pulse — SaaS Analytics Dashboard');
await page.getByTestId('file-name-input').press('Enter');
check('Rename file through left-panel file name', (await page.getByTestId('file-name').textContent()).includes('Pulse'));

/* ------------------------------------------------------------------ main frame */
await step('Desktop frame via Frame presets', async () => {
  await view(0.5, -20, -20);
  await key('f');
  await drag(await toScreen(0, 0), await toScreen(400, 300));
  await page.getByTestId('frame-presets').click();
  await page.getByTestId('menu-desktop').hover();
  await page.getByText('Desktop  1440×1024', { exact: true }).click();
  const f = (await sel())[0];
  check('Desktop frame via Frame presets (1440×1024)', f.width === 1440 && f.height === 1024, `${f.width}×${f.height}`);
  await rename('Dashboard');
  await fill('F4F6FB');
});

/* ------------------------------------------------------------------ sidebar */
const NAV = ['Dashboard', 'Analytics', 'Customers', 'Orders', 'Reports', 'Settings'];
await step('Sidebar', async () => {
  // logo
  await drawShape('r', 24, 28, 32, 32);
  await fill('6366F1'); await setField('prop-radius', 8); await rename('Logo mark');
  await text('Pulse', 66, 32, { size: 20, weight: 700, color: 'FFFFFF' });
  await selectLayers(['Logo mark', 'Pulse']);
  await shiftA(); await rename('Logo');
  await page.getByTestId('al-align-3').click();
  await text('MENU', 24, 100, { size: 11, weight: 600, color: '64748B' });
  for (let i = 0; i < NAV.length; i++) {
    const y = 124 + i * 48;
    await drawShape('r', 36, y + 13, 18, 18);
    await fill(i === 0 ? 'FFFFFF' : '64748B'); await setField('prop-radius', 5); await rename(`Icon/${NAV[i]}`);
    await text(NAV[i] === 'Dashboard' ? 'Overview' : NAV[i], 66, y + 12, { size: 14, weight: 500, color: i === 0 ? 'FFFFFF' : 'CBD5E1' });
    const tname = (await sel())[0].name;
    await selectLayers([`Icon/${NAV[i]}`, tname]);
    await shiftA(); await rename(`Nav/${NAV[i]}`);
    await setField('al-pad-h', 12); await setField('al-pad-v', 10); await setField('al-gap', 12);
    await page.getByTestId('al-align-3').click();
    if (i === 0) { await addFill('6366F1'); await setField('prop-radius', 8); }
  }
  await selectLayers(['Logo', 'MENU', ...NAV.map((n) => `Nav/${n}`)]);
  const sb = await shiftA(); await rename('Sidebar');
  check('Sidebar wraps logo + label + 6 nav items in vertical auto layout', sb.layout.mode === 'VERTICAL' && sb.children.length === 8, `mode=${sb.layout.mode} kids=${sb.children.length}`);
  await addFill('0F172A');
  await setField('al-gap', 6); await setField('al-pad-h', 16); await setField('al-pad-v', 28);
  await selectOpt('sizing-H', 'FIXED'); await selectOpt('sizing-V', 'FIXED');
  await setField('prop-w', 240); await setField('prop-h', 1024); await setField('prop-x', 0); await setField('prop-y', 0);
  for (const n of NAV) { await layer(`Nav/${n}`); await selectOpt('sizing-H', 'FILL'); }
  await layer('Logo'); await setField('al-pad-v', 0); await page.getByTestId('pad-individual').click(); await setField('al-pad-b', 20); await page.getByTestId('pad-individual').click();
  await layer('MENU'); // spacer feel: nothing else
});

/* ------------------------------------------------------------------ top bar */
await step('Top bar', async () => {
  await text('Overview', 272, 22, { size: 22, weight: 700, color: '0F172A' });
  await rename('Page title');
  await text('Welcome back, Laksh — here is what happened this week.', 272, 50, { size: 12, color: '64748B' });
  await rename('Page subtitle');
  await selectLayers(['Page title', 'Page subtitle']);
  await shiftA(); await rename('Heading'); await setField('al-gap', 2);
  // search field
  await drawShape('f', 940, 16, 340, 40);
  await rename('Search'); await fill('F1F5F9'); await setField('prop-radius', 10);
  await drawShape('o', 954, 29, 14, 14);
  await fill('94A3B8'); await rename('Search icon');
  await text('Search orders, customers…', 978, 26, { size: 13, color: '94A3B8' });
  await layer('Search');
  const s = await shiftA();
  check('Shift+A on a frame with children turns it into auto layout', s.layout.mode === 'HORIZONTAL', s.layout.mode);
  await selectOpt('sizing-H', 'FIXED'); await setField('prop-w', 320);
  await setField('al-pad-h', 14); await setField('al-pad-v', 10); await setField('al-gap', 10);
  await page.getByTestId('al-align-3').click();
  // avatar
  await drawShape('o', 1300, 16, 40, 40);
  await fill('F59E0B'); await rename('Avatar');
  await selectLayers(['Search', 'Avatar']);
  await shiftA(); await rename('Actions'); await setField('al-gap', 16); await page.getByTestId('al-align-3').click();
  await selectLayers(['Heading', 'Actions']);
  const tb = await shiftA(); await rename('Top bar');
  await addFill('FFFFFF');
  await selectOpt('sizing-H', 'FIXED'); await selectOpt('sizing-V', 'FIXED');
  await setField('prop-w', 1200); await setField('prop-h', 80); await setField('prop-x', 240); await setField('prop-y', 0);
  await setField('al-pad-h', 32); await setField('al-pad-v', 0);
  await selectOpt('al-spacing-mode', 'auto');
  await page.getByTestId('al-align-3').click();
  const tb2 = (await sel())[0];
  check('Top bar: horizontal auto layout, space-between, search + avatar', tb2.layout.mode === 'HORIZONTAL' && tb2.layout.alignMain === 'SPACE_BETWEEN', `${tb2.layout.mode}/${tb2.layout.alignMain} ${tb2.width}×${tb2.height}`);
});

/* ------------------------------------------------------------------ KPI cards */
const KPI = [
  ['Total revenue', '$84,254', '▲ 12.4% vs last month', '16A34A'],
  ['Active users', '12,893', '▲ 8.1% vs last month', '16A34A'],
  ['Conversion rate', '3.42%', '▼ 0.6% vs last month', 'DC2626'],
  ['Avg. order value', '$68.20', '▲ 4.3% vs last month', '16A34A'],
];
await step('KPI cards', async () => {
  await text(KPI[0][0], 292, 124, { size: 13, weight: 500, color: '64748B' });
  await text(KPI[0][1], 292, 146, { size: 28, weight: 700, color: '0F172A' });
  await text(KPI[0][2], 292, 190, { size: 12, weight: 600, color: KPI[0][3] });
  await selectLayers([KPI[0][0], KPI[0][1], KPI[0][2]]);
  await shiftA(); await rename('Stat card');
  await addFill('FFFFFF'); await setField('prop-radius', 12);
  await setField('al-pad-h', 20); await setField('al-pad-v', 20); await setField('al-gap', 8);
  await selectOpt('sizing-H', 'FIXED'); await setField('prop-w', 266);
  await setField('prop-x', 272); await setField('prop-y', 112);
  // drop shadow
  await page.getByTestId('add-effect').click();
  await page.getByTestId('effect-settings-0').click();
  await setField('effect-y', 4); await setField('effect-blur', 24);
  const pop = page.getByTestId('effect-popover');
  const hex = pop.getByTestId('hex-input');
  if (await hex.count()) { await hex.fill('0F172A'); await hex.press('Enter'); }
  await page.keyboard.press('Escape');
  await layer('Stat card');
  let c = (await sel())[0];
  check('Stat card: drop shadow effect + 12px radius', c.effects[0]?.type === 'DROP_SHADOW' && c.cornerRadius === 12, JSON.stringify(c.effects[0]));
  // duplicates
  for (let i = 1; i < 4; i++) {
    await layer('Stat card');
    await key('ControlOrMeta+d');
    const d = (await sel())[0];
    check(`⌘D duplicates the stat card (#${i + 1})`, d && d.id !== c.id && d.children.length === 3, d?.name);
    await rename(`Stat card ${i + 1}`);
    await setField('prop-x', 272 + i * 290); await setField('prop-y', 112 + (i % 2) * 6); // deliberately misaligned → fixed by align tools
  }
  await layer('Stat card'); await rename('Stat card 1');
  // edit texts in duplicates by double-clicking on canvas
  for (let i = 1; i < 4; i++) {
    const card = await byName(`Stat card ${i + 1}`);
    for (let k = 0; k < 3; k++) {
      await layer(`Stat card ${i + 1}`);
      const kidId = (await st(`s => s.doc.nodes['${card.id}'].children`))[k];
      const r = await absRect(kidId);
      await ensure(r.x, r.y, r.width, r.height);
      const p = await toScreen(r.x + 6, r.y + r.height / 2);
      await page.mouse.dblclick(p.x, p.y);
      await wait(80);
      const editing = await st('s => s.editingTextId');
      if (editing !== kidId) {
        // second double-click (deep select → edit)
        await page.mouse.dblclick(p.x, p.y); await wait(80);
      }
      const editing2 = await st('s => s.editingTextId');
      if (editing2 !== kidId) { check(`Double-click edits text inside duplicated card ${i + 1}`, false, `editing=${editing2} expected=${kidId}`); continue; }
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type(KPI[i][k]);
      await page.keyboard.press('Escape');
      await wait(40);
      if (k === 2 && KPI[i][3] !== '16A34A') { await layer(KPI[i][k]); await fill(KPI[i][3]); }
    }
  }
  const texts = (await allNodes()).filter((n) => n.type === 'TEXT').map((n) => n.text.characters);
  check('Edited duplicated stat-card texts via double-click', KPI.every((k) => texts.includes(k[1]) && texts.includes(k[0])), '');
  // align + distribute
  await selectLayers(['Stat card 1', 'Stat card 2', 'Stat card 3', 'Stat card 4']);
  await page.getByTestId('align-top').click();
  await page.getByTestId('dist-h').click();
  const cards = (await sel()).sort((a, b) => a.x - b.x);
  const gaps = cards.slice(1).map((c2, i) => c2.x - (cards[i].x + cards[i].width));
  check('Align top + distribute horizontally on 4 cards', new Set(cards.map((x) => x.y)).size === 1 && Math.max(...gaps) - Math.min(...gaps) < 0.01, `ys=${cards.map((x) => x.y)} gaps=${gaps}`);
  const row = await shiftA(); await rename('KPI row');
  await setField('al-gap', 24);
  const row2 = (await sel())[0];
  check('KPI row: horizontal auto layout of 4 cards', row2.layout.mode === 'HORIZONTAL' && row2.children.length === 4, `${row2.layout.mode} w=${row2.width}`);
});

/* ------------------------------------------------------------------ Revenue card + plugin */
const CARD_H = 520;
await step('Revenue card', async () => {
  await drawShape('f', 272, 268, 700, 480);
  await rename('Revenue card'); await setField('prop-radius', 12);
  await text('Revenue', 296, 292, { size: 16, weight: 700 });
  await text('Monthly recurring revenue · last 7 months', 296, 316, { size: 12, color: '64748B' });
  // plugin: Main menu → Plugins → Bar chart
  await view(1, 240, 260);
  await page.getByTestId('main-menu-btn').click();
  await page.getByTestId('menu-plugins').hover();
  await page.getByTestId('cmd-plugin.chart').click();
  await wait(150);
  const ch = (await sel())[0];
  check('Bar chart plugin (Main menu → Plugins) inserts a chart', ch?.name === 'Bar chart' && ch.children.length === 7, `${ch?.name} parent=${ch?.parentId}`);
  // drag it into the card (grab padding area, not a bar)
  const r = await absRect(ch.id);
  const from = await toScreen(r.x + 8, r.y + 8);
  const to = await toScreen(296 + 8, 344 + 8);
  await drag(from, to, 12);
  await wait(100);
  const ch2 = await byName('Bar chart');
  const card = await byName('Revenue card');
  check('Drag plugin chart into the Revenue card (reparent on drop)', ch2.parentId === card.id, `parent=${ch2.parentId} card=${card.id}`);
  // month labels under the bars (fixed-width centered text boxes) → horizontal auto layout
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
  for (let i = 0; i < 7; i++) {
    await text(MONTHS[i], 296 + 24 + i * 56, 600, { size: 12, weight: 500, color: '94A3B8', w: 36, align: 'center' });
  }
  await selectLayers(MONTHS); await shiftA(); await rename('Month labels');
  // recolor bars through Selection colors
  await layer('Bar chart');
  const chip = page.getByTestId('sel-color-#0D99FF').locator('input');
  if (await chip.count()) { await chip.fill('6366F1'); await chip.press('Enter'); }
  const bars = (await allNodes()).filter((n) => n.parentId === ch2.id);
  check('Recolor chart bars via Selection colors', bars.every((b) => b.fills[0].color.toUpperCase() === '#6366F1'), bars[0]?.fills[0].color);
  // card → auto layout
  await layer('Revenue card');
  const c = await shiftA();
  check('Revenue card becomes vertical auto layout (title, subtitle, chart, months)', c.layout.mode === 'VERTICAL' && c.children.length === 4, `${c.layout.mode} kids=${c.children.length}`);
  await setField('al-pad-h', 24); await setField('al-pad-v', 24); await setField('al-gap', 6);
  await selectOpt('sizing-H', 'FIXED'); await setField('prop-w', 700);
  await selectOpt('sizing-V', 'FIXED'); await setField('prop-h', CARD_H);
  await layer('Bar chart');
  await selectOpt('sizing-H', 'FILL'); await selectOpt('sizing-V', 'FILL');
  await setField('al-pad-h', 8); await setField('al-pad-v', 16);
  await layer('Month labels');
  await selectOpt('sizing-H', 'FILL'); await selectOpt('al-spacing-mode', 'auto'); await setField('al-pad-h', 8); await setField('al-pad-v', 0);
});

/* ------------------------------------------------------------------ Orders table */
const COLS = [[0, 72], [80, 124], [212, 80], [300, 64]]; // x offset, width
const ORDERS = [
  ['#3021', 'Olivia Martin', '$1,240.00', 'Paid', '16A34A'],
  ['#3020', 'Jackson Lee', '$389.50', 'Pending', 'D97706'],
  ['#3019', 'Isabella Nguyen', '$742.10', 'Paid', '16A34A'],
  ['#3018', 'William Kim', '$99.00', 'Refunded', 'DC2626'],
  ['#3017', 'Sofia Davis', '$2,105.00', 'Paid', '16A34A'],
  ['#3016', 'Liam Johnson', '$564.75', 'Pending', 'D97706'],
  ['#3015', 'Mia Thompson', '$1,018.40', 'Paid', '16A34A'],
  ['#3014', 'Noah Garcia', '$212.00', 'Paid', '16A34A'],
];
await step('Recent orders table', async () => {
  const X = 996, Y = 268;
  await drawShape('f', X, Y, 412, 480);
  await rename('Orders card'); await setField('prop-radius', 12);
  await text('Recent orders', X + 24, Y + 24, { size: 16, weight: 700 }); await rename('Orders title');
  await text('View all', X + 330, Y + 26, { size: 13, weight: 600, color: '6366F1' });
  await selectLayers(['Orders title', 'View all']);
  await shiftA(); await rename('Orders header');
  const hdr = ['ORDER', 'CUSTOMER', 'AMOUNT', 'STATUS'];
  const rowY = (i) => Y + 64 + i * 46;
  for (let c = 0; c < 4; c++) await text(hdr[c], X + 24 + COLS[c][0], rowY(0), { size: 11, weight: 600, color: '94A3B8', w: COLS[c][1] });
  await selectLayers(hdr); await shiftA(); await rename('Table head');
  await setField('al-pad-v', 8); await setField('al-gap', 8);
  for (let i = 0; i < ORDERS.length; i++) {
    const o = ORDERS[i];
    const names = [];
    for (let c = 0; c < 4; c++) {
      const t = await text(o[c], X + 24 + COLS[c][0], rowY(i + 1), { size: 13, weight: c === 2 || c === 3 ? 600 : 400, color: c === 3 ? o[4] : c === 0 ? '64748B' : '0F172A', w: COLS[c][1] });
      await rename(`r${i + 1}c${c + 1}`); names.push(`r${i + 1}c${c + 1}`);
    }
    await selectLayers(names);
    await shiftA(); await rename(`Order row ${i + 1}`);
    await setField('al-pad-v', 12); await setField('al-gap', 8); await setField('prop-radius', 8);
    if (i % 2 === 0) await addFill('F8FAFC');
  }
  await layer('Orders card');
  const card = await shiftA();
  check('Orders card: vertical auto layout of header + table head + rows', card.layout.mode === 'VERTICAL' && card.children.length === 2 + ORDERS.length, `${card.layout.mode} kids=${card.children.length}`);
  await setField('al-pad-h', 24); await setField('al-pad-v', 24); await setField('al-gap', 2);
  await selectOpt('sizing-H', 'FIXED'); await setField('prop-w', 412);
  await selectOpt('sizing-V', 'FIXED'); await setField('prop-h', CARD_H);
  await layer('Orders header');
  await selectOpt('sizing-H', 'FILL'); await selectOpt('al-spacing-mode', 'auto'); await setField('al-pad-v', 0);
  await page.getByTestId('al-align-3').click();
  for (const n of ['Table head', ...ORDERS.map((_, i) => `Order row ${i + 1}`)]) { await layer(n); await selectOpt('sizing-H', 'FILL'); }
  // shadows on both cards via the effect panel
  for (const n of ['Revenue card', 'Orders card']) {
    await layer(n);
    await page.getByTestId('add-effect').click();
    await page.getByTestId('effect-settings-0').click();
    await setField('effect-y', 4); await setField('effect-blur', 24);
    const hex = page.getByTestId('effect-popover').getByTestId('hex-input');
    if (await hex.count()) { await hex.fill('0F172A'); await hex.press('Enter'); }
    await page.keyboard.press('Escape');
  }
});

/* ------------------------------------------------------------------ content wrapper + grid */
await step('Content wrapper', async () => {
  await selectLayers(['Revenue card', 'Orders card']);
  await shiftA(); await rename('Charts row'); await setField('al-gap', 24);
  await selectLayers(['KPI row', 'Charts row']);
  const c = await shiftA(); await rename('Content'); await setField('al-gap', 28);
  await setField('prop-x', 272); await setField('prop-y', 112);
  const clipBefore = (await sel())[0].clipContent;
  check('Shift+A wrapper frames clip content by default (shadows of children get cut off)', clipBefore === false, `clipContent=${clipBefore}`);
  for (const n of ['Content', 'KPI row', 'Charts row']) { await layer(n); const cb = page.getByTestId('clip-content').first(); if (await cb.isChecked()) await cb.uncheck(); }
  await layer('Content');
  check('Nested auto layout: Content(V) › Charts row(H) › Orders card(V) › Order row(H)', c.layout.mode === 'VERTICAL', '');
});

await step('12-column layout guide', async () => {
  await layer('Dashboard');
  await page.getByTestId('add-grid').click();
  await page.getByTestId('grid-settings-0').click();
  await page.getByTestId('grid-pattern').selectOption('COLUMNS');
  await setField('grid-count', 12); await setField('grid-gutter', 24); await setField('grid-margin', 32);
  await page.keyboard.press('Escape');
  await layer('Dashboard');
  const d = (await sel())[0];
  const g = d.layoutGrids[0];
  check('12-column layout guide on main frame', g?.pattern === 'COLUMNS' && g.count === 12, JSON.stringify({ p: g?.pattern, c: g?.count, gut: g?.gutter, m: g?.margin }));
});

/* ------------------------------------------------------------------ verify tree */
const tree = await allNodes();
const dash = tree.find((n) => n.name === 'Dashboard');
const under = (id) => { const out = []; const w = (i) => { for (const c of tree.find((n) => n.id === i).children) { out.push(c); w(c); } }; w(id); return out; };
const desc = under(dash.id);
const depth = (id) => { let d = 0; let n = tree.find((x) => x.id === id); while (n.parentId) { d++; n = tree.find((x) => x.id === n.parentId); } return d; };
const alFrames = tree.filter((n) => n.layout?.mode && n.layout.mode !== 'NONE');
const maxDepth = Math.max(...desc.map(depth));
log('layers in Dashboard:', desc.length, 'auto-layout frames:', alFrames.length, 'max depth', maxDepth);
check('Everything lives inside the Dashboard frame', tree.filter((n) => !n.parentId).length === 1, `top-level=${tree.filter((n) => !n.parentId).map((n) => n.name)}`);
check('Auto layout nesting depth ≥ 4', maxDepth >= 4, `maxDepth=${maxDepth}, AL frames=${alFrames.length}`);

/* ------------------------------------------------------------------ screenshots + export */
await step('canvas screenshot', async () => {
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await key('Shift+1'); await wait(300);
  await shot('canvas-fit.png');
  const v = await st('s => ({ zoom: s.zoom, panX: s.panX, panY: s.panY })');
  const l = v.panX, r = 1440 * v.zoom + v.panX;
  check('Zoom to fit (Shift+1) keeps the frame clear of the floating panels', l >= CANVAS.x - 1 && r <= CANVAS.x + CANVAS.width + 1, `frame spans screen x ${Math.round(l)}–${Math.round(r)}, visible canvas ${Math.round(CANVAS.x)}–${Math.round(CANVAS.x + CANVAS.width)} (zoom ${v.zoom.toFixed(2)})`);
  const z = Math.min((CANVAS.width - 60) / 1440, (CANVAS.height - 60) / 1024);
  await page.evaluate(([z, px, py]) => window.__myflow.get().setState({ zoom: z, panX: px, panY: py }), [z, CANVAS.x + (CANVAS.width - 1440 * z) / 2, CANVAS.y + 40]);
  await wait(200);
  await shot('canvas.png');
  await layer('Dashboard'); await wait(100);
  await shot('canvas-selected-grid.png');
});

await step('Export PNG + SVG', async () => {
  await layer('Dashboard');
  await page.getByTestId('add-export').click();
  await page.getByTestId('add-export').click();
  await page.getByTestId('export-scale-1').selectOption('1');
  await page.getByTestId('export-format-1').selectOption('SVG');
  const n = (await sel())[0];
  log('exports', JSON.stringify(n.exports));
  const dls = [];
  page.on('download', (d) => dls.push(d));
  await page.getByTestId('export-btn').click();
  for (let i = 0; i < 50 && dls.length < 2; i++) await wait(200);
  for (const d of dls) {
    const name = d.suggestedFilename();
    const ext = name.split('.').pop();
    await d.saveAs(path.join(OUT, `design.${ext}`));
    log('downloaded', name);
  }
  const png = readFileSync(path.join(OUT, 'design.png'));
  const svg = readFileSync(path.join(OUT, 'design.svg')).toString();
  check('PNG export via Export button', png.subarray(1, 4).toString() === 'PNG', `${png.length} bytes, ${png.readUInt32BE(16)}×${png.readUInt32BE(20)}`);
  check('SVG export via Export button', svg.includes('<svg') && svg.includes('Overview'), `${svg.length} bytes`);
  page.removeAllListeners('download');
});

await step('Save local copy', async () => {
  const dl = page.waitForEvent('download');
  await page.getByTestId('main-menu-btn').click();
  await page.getByTestId('menu-file').hover();
  await page.getByTestId('cmd-file.saveLocal').click();
  const d = await dl;
  await d.saveAs(path.join(OUT, 'design.myflow'));
  const json = JSON.parse(readFileSync(path.join(OUT, 'design.myflow')).toString());
  check('Save local copy (.myflow)', d.suggestedFilename().endsWith('.myflow') && Object.keys(json.doc.nodes).length === tree.length, `${d.suggestedFilename()} nodes=${Object.keys(json.doc.nodes).length}`);
});

await step('Dev Mode inspection', async () => {
  await layer('Stat card 1');
  await key('Shift+d');
  await page.getByTestId('dev-panel').waitFor();
  await wait(300);
  const code = await page.getByTestId('code-block').innerText();
  writeFileSync(path.join(OUT, 'devmode-css.txt'), code);
  const scrollTop = await page.getByTestId('dev-panel').evaluate((el) => { let p = el; while (p && p.scrollTop === 0) p = p.parentElement; return p ? p.scrollTop : 0; });
  check('Dev Mode panel opens scrolled to the top (code header visible)', scrollTop === 0, `inherited scrollTop=${scrollTop}`);
  await shot('devmode-initial.png');
  await page.mouse.move(1310, 300); await page.mouse.wheel(0, -3000); await wait(200);
  await shot('devmode.png');
  check('Dev Mode CSS for stat card (radius, shadow, flex)', /border-radius: 12px/.test(code) && /box-shadow/.test(code) && /display: flex/.test(code), code.split('\n').slice(0, 3).join(' | '));
  await page.getByTestId('mode-design').click();
});

writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ results, errors, twistyClicks, layers: desc.length, alFrames: alFrames.length, maxDepth }, null, 2));
log('errors', errors);
log(`PASS ${results.filter((r) => r.pass).length} / ${results.length}`);
await browser.close();
