// Agent 05 — Design system starter / component library, built through the My Flow UI.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('designs/agent-05');
const BASE = 'http://localhost:5390';
const MOD = 'Meta';
const checks = [];
const notes = [];
const errors = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const note = (s) => { notes.push(s); console.log('NOTE ' + s); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|picsum|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });

// ---------- helpers ----------
const st = (fn) => page.evaluate(`(() => { const s = window.__myflow.get(); return (${fn})(s); })()`);
const tid = (id) => page.getByTestId(id).first();
const wait = (ms = 80) => page.waitForTimeout(ms);
const setView = async (zoom, panX, panY) => { await page.evaluate(([z, x, y]) => window.__myflow.get().setState({ zoom: z, panX: x, panY: y }), [zoom, panX, panY]); await wait(100); };
const toScreen = (x, y) => st(`s => ({ x: ${x} * s.zoom + s.panX, y: ${y} * s.zoom + s.panY })`);
const selected = () => st('s => s.selection.map(id => s.doc.nodes[id])');
const sel1 = async () => (await selected())[0];
const nodeById = (id) => st(`s => s.doc.nodes[${JSON.stringify(id)}]`);
const allNodes = () => st('s => Object.values(s.doc.nodes)');
async function drag(a, b, steps = 8) {
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps }); await page.mouse.up(); await wait();
}
async function draw(key, x, y, w, h) { await page.keyboard.press(key); await drag(await toScreen(x, y), await toScreen(x + w, y + h)); }
async function clickWorld(x, y, opts = {}) { const p = await toScreen(x, y); await page.mouse.click(p.x, p.y, opts); await wait(); }
async function setField(id, value) { const f = tid(id); await f.click(); await f.fill(String(value)); await f.press('Enter'); await wait(60); }
async function escapeAll() { await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await wait(60); }
async function text(x, y, str, { size, weight, family } = {}) {
  await page.keyboard.press('t');
  await clickWorld(x, y);
  await page.keyboard.type(str);
  await page.keyboard.press('Escape');
  await wait(100);
  if (family) await tid('font-family').selectOption(family);
  if (size) await setField('font-size', size);
  if (weight) await tid('font-weight').selectOption(String(weight));
  return sel1();
}
async function bind(kind, varName) {
  await tid(`${kind}-styles-btn`).click();
  await tid(`apply-var-${varName}`).click();
  await wait(60);
}
async function textStyle(name) {
  await tid('text-styles-btn').click();
  await page.locator('.menu .menu-item', { hasText: name }).first().click();
  await wait(60);
}
const LABEL_GRAY = '9CA3AF';
async function label(x, y, str, size = 14, weight = 600) {
  await text(x, y, str, { size, weight });
  await setField('fills-hex-0', LABEL_GRAY);
  await escapeAll();
}
async function renameLayer(oldName, newName) {
  await page.getByTestId(`layer-${oldName}`).first().dblclick();
  await tid('layer-rename-input').fill(newName);
  await tid('layer-rename-input').press('Enter');
  await wait(60);
}
async function selectLayer(name, modifiers = []) { await page.getByTestId(`layer-${name}`).first().click({ modifiers }); await wait(60); }
async function shot(name) { await page.screenshot({ path: path.join(OUT, name) }); }
async function step(name, fn) {
  try { await fn(); } catch (e) { check(name + ' (step threw)', false, String(e.message).split('\n')[0]); await shot(`err-${name.replace(/\W+/g, '_')}.png`).catch(() => {}); await escapeAll().catch(() => {}); }
}

// ---------- 1. home → new file → rename ----------
await page.goto(BASE);
await tid('new-design-file').click();
await page.getByTestId('canvas').waitFor();
await wait(300);
await tid('file-name').click();
await tid('file-name-input').fill('Theme Kit — Design System Starter');
await tid('file-name-input').press('Enter');
check('File renamed', (await tid('file-name').textContent()).includes('Theme Kit'));
const canvasBox = await page.getByTestId('canvas').boundingBox();
note(`canvas box ${JSON.stringify(canvasBox)}`);

// ---------- 2. Variables: collection Theme, modes Light/Dark ----------
const VARS = [
  ['bg', 'F5F6FA', '0E1015'],
  ['surface', 'FFFFFF', '181B23'],
  ['text', '111827', 'F3F4F6'],
  ['text-muted', '6B7280', '9CA3AF'],
  ['primary', '4F46E5', '8B8DFB'],
  ['on-primary', 'FFFFFF', '0E1015'],
  ['border', 'E3E6EE', '2A2F3A'],
];
const NUMS = [['radius', 10, 10], ['spacing', 16, 16]];
await step('variables', async () => {
  await tid('open-variables-btn').click();
  await tid('variables-modal').waitFor();
  // first variable creates the collection
  let n = 0;
  for (const [name] of VARS) {
    n++;
    await tid('create-variable').click();
    await tid('create-var-color').click();
    await tid(`var-name-color-${n}`).fill(name);
    await tid(`var-name-color-${n}`).press('Tab');
    await wait(60);
  }
  // rename collection + modes
  await tid('collection-name').fill('Theme');
  await tid('collection-name').press('Tab');
  await tid('add-mode').click();
  await tid('mode-name-Mode 1').fill('Light'); await tid('mode-name-Mode 1').press('Tab');
  await wait(60);
  await tid('mode-name-Mode 2').fill('Dark'); await tid('mode-name-Mode 2').press('Tab');
  await wait(60);
  for (const [name, light, dark] of VARS) {
    for (const [mode, val] of [['Light', light], ['Dark', dark]]) {
      const f = tid(`var-value-${name}-${mode}`);
      await f.fill(val); await f.press('Enter'); await wait(40);
    }
  }
  let k = 0;
  for (const [name, light, dark] of NUMS) {
    k++;
    await tid('create-variable').click();
    await tid('create-var-number').click();
    await wait(60);
    const nm = (await st('s => s.doc.variables.filter(v => v.type === "NUMBER").map(v => v.name)')).slice(-1)[0];
    await tid(`var-name-${nm}`).fill(name); await tid(`var-name-${nm}`).press('Tab'); await wait(60);
    for (const [mode, val] of [['Light', light], ['Dark', dark]]) {
      const f = tid(`var-value-${name}-${mode}`);
      await f.click(); await f.fill(String(val)); await f.press('Enter'); await wait(40);
    }
  }
  // CRUD: create a throwaway variable and delete it
  await tid('create-variable').click();
  await tid('create-var-color').click();
  await wait(60);
  const tmp = (await st('s => s.doc.variables.map(v => v.name)')).slice(-1)[0];
  await tid(`var-name-${tmp}`).fill('temp-delete-me'); await tid(`var-name-${tmp}`).press('Tab'); await wait(60);
  const hadTemp = await st('s => s.doc.variables.some(v => v.name === "temp-delete-me")');
  await tid('delete-var-temp-delete-me').click(); await wait(60);
  const goneTemp = await st('s => !s.doc.variables.some(v => v.name === "temp-delete-me")');
  check('Variables CRUD: create + rename + delete variable', hadTemp && goneTemp);
  await shot('variables-modal.png');
  await tid('modal-close').click();

  const doc = await st('s => ({ cols: s.doc.collections, vars: s.doc.variables })');
  const col = doc.cols.find((c) => c.name === 'Theme');
  check('Collection "Theme" with modes Light/Dark', col && col.modes.map((m) => m.name).join(',') === 'Light,Dark', col ? col.modes.map((m) => m.name).join(',') : 'missing');
  const colorOk = VARS.every(([nm, l, d]) => { const v = doc.vars.find((x) => x.name === nm); return v && v.type === 'COLOR' && v.values[col.modes[0].id] === '#' + l && v.values[col.modes[1].id] === '#' + d; });
  check(`${VARS.length} COLOR variables with real Light/Dark values`, colorOk, doc.vars.filter((v) => v.type === 'COLOR').map((v) => v.name + '=' + Object.values(v.values).join('/')).join('; '));
  const numOk = NUMS.every(([nm, l, d]) => { const v = doc.vars.find((x) => x.name === nm); return v && v.type === 'NUMBER' && v.values[col.modes[0].id] === l && v.values[col.modes[1].id] === d; });
  check('2 NUMBER variables (radius, spacing) with values', numOk, doc.vars.filter((v) => v.type === 'NUMBER').map((v) => v.name + '=' + JSON.stringify(v.values)).join('; '));
});

// ---------- 3. Components page ----------
await step('add Components page', async () => {
  await tid('add-page').click();
  await tid('page-rename-input').fill('Components');
  await tid('page-rename-input').press('Enter');
  await wait(100);
  const pages = await st('s => s.doc.pages.map(p => p.name)');
  const cur = await st('s => s.doc.pages.find(p => p.id === s.pageId).name');
  check('Second page "Components" added + renamed (and active)', pages.includes('Components') && cur === 'Components', pages.join(', '));
});
await setView(0.8, 290, 110);

// Section headings
await step('headings', async () => {
  await label(0, -90, 'Theme Kit — Components', 28, 700);
});

// --- color styles (palette)
const PALETTE = [
  ['Brand/Primary', '4F46E5'], ['Brand/Primary Hover', '4338CA'], ['Neutral/900', '111827'], ['Neutral/500', '6B7280'],
  ['Neutral/100', 'F3F4F6'], ['Feedback/Success', '16A34A'], ['Feedback/Danger', 'DC2626'],
];
const createdStyleNames = [];
await step('color styles', async () => {
  await label(560, -90, 'Color styles', 16, 600);
  for (let i = 0; i < PALETTE.length; i++) {
    await draw('r', 560 + i * 72, -50, 56, 56);
    await setField('fills-hex-0', PALETTE[i][1]);
    await setField('prop-radius', '12');
    await tid('fills-styles-btn').click();
    await tid('create-style-from-fills').click();
    await wait(60);
    createdStyleNames.push({ from: (await st('s => s.doc.styles.slice(-1)[0].name')), to: PALETTE[i][0] });
    await escapeAll();
  }
});

// --- typography scale (text styles)
const TYPE = [
  ['Display', 40, 700, 'Display 40'], ['Heading', 28, 700, 'Heading 28'], ['Title', 20, 600, 'Title 20'],
  ['Body', 16, 400, 'Body 16 — The quick brown fox'], ['Label', 14, 600, 'Label 14'], ['Caption', 12, 500, 'Caption 12'],
];
await step('text styles', async () => {
  await label(560, 50, 'Type scale', 16, 600);
  let y = 85;
  for (const [nm, size, weight, sample] of TYPE) {
    await text(560, y, sample, { size, weight });
    await tid('text-styles-btn').click();
    await tid('create-text-style').click();
    await wait(60);
    createdStyleNames.push({ from: (await st('s => s.doc.styles.slice(-1)[0].name')), to: 'Type/' + nm });
    await setField('fills-hex-0', 'D1D5DB');
    await escapeAll();
    y += size * 1.3 + 14;
  }
});

// rename styles in the Styles modal
await step('rename styles', async () => {
  await escapeAll();
  await page.getByTestId(`style-row-${createdStyleNames[0].from}`).locator('button').click();
  await tid('styles-modal').waitFor();
  for (const { from, to } of createdStyleNames) {
    await tid(`styles-item-${from}`).click();
    await tid('style-name').fill(to);
    await tid('style-name').press('Tab');
    await wait(50);
  }
  await shot('styles-modal.png');
  await tid('modal-close').click();
  const styles = await st('s => s.doc.styles.map(x => x.type + ":" + x.name)');
  check('Color styles created + named', PALETTE.every(([n]) => styles.includes('FILL:' + n)), styles.filter((x) => x.startsWith('FILL')).join(', '));
  check('Typography scale text styles created + named', TYPE.every(([n]) => styles.includes('TEXT:Type/' + n)), styles.filter((x) => x.startsWith('TEXT')).join(', '));
});

// --- Buttons
const BUTTONS = [
  { type: 'Primary', x: 0, label: 'Get started', fill: 'primary', textVar: 'on-primary', stroke: null },
  { type: 'Secondary', x: 170, label: 'Learn more', fill: 'surface', textVar: 'text', stroke: 'border' },
  { type: 'Ghost', x: 340, label: 'Cancel', fill: null, textVar: 'primary', stroke: null },
];
const compIds = {};
await step('button components', async () => {
  for (const b of BUTTONS) {
    await text(b.x, 0, b.label);
    await textStyle('Type/Label');
    await bind('fills', b.textVar);
    await page.keyboard.press('Shift+A');
    await wait(100);
    const fr = await sel1();
    if (fr.type !== 'FRAME') note(`Shift+A on text gave ${fr.type}`);
    await setField('al-pad-h', 20);
    await setField('al-pad-v', 12);
    if (b.fill) { await tid('add-fills').click(); await bind('fills', b.fill); }
    if (b.stroke) { await tid('add-strokes').click(); await bind('strokes', b.stroke); }
    await setField('prop-radius', 10);
    await page.keyboard.press(`${MOD}+Alt+k`);
    await wait(100);
    const c = await sel1();
    compIds[b.type] = c.id;
    await renameLayer(c.name, `Type=${b.type}`);
    await escapeAll();
  }
  // combine as variants
  await selectLayer('Type=Primary');
  await selectLayer('Type=Secondary', ['Shift']);
  await selectLayer('Type=Ghost', ['Shift']);
  await tid('combine-variants').click();
  await wait(100);
  const set = await sel1();
  check('Button component set created (COMPONENT_SET)', set.type === 'COMPONENT_SET', set.type + ' ' + set.name);
  await renameLayer(set.name, 'Button');
  const kids = await st(`s => s.doc.nodes[${JSON.stringify(set.id)}].children.map(id => s.doc.nodes[id].name)`);
  check('Variants Type=Primary/Secondary/Ghost', ['Type=Primary', 'Type=Secondary', 'Type=Ghost'].every((k) => kids.includes(k)), kids.join(', '));
  const setNode = await nodeById(set.id);
  check('Set renamed "Button"', setNode.name === 'Button', setNode.name);
  await escapeAll();
});

// --- Input
await step('input component', async () => {
  await label(0, 120, 'Input');
  await text(0, 160, 'you@company.com', { size: 14, weight: 400 });
  await bind('fills', 'text-muted');
  await page.keyboard.press('Shift+A');
  await wait(100);
  await setField('al-pad-h', 14);
  await setField('al-pad-v', 12);
  await tid('sizing-H').selectOption('FIXED');
  await setField('prop-w', 300);
  await tid('add-fills').click(); await bind('fills', 'surface');
  await tid('add-strokes').click(); await bind('strokes', 'border');
  await setField('prop-radius', 10);
  await page.keyboard.press(`${MOD}+Alt+k`);
  await wait(100);
  const c = await sel1();
  compIds.Input = c.id;
  await renameLayer(c.name, 'Input');
  const n = await nodeById(c.id);
  check('Input component: fill + stroke bound to variables', n.type === 'COMPONENT' && n.fills[0]?.variableId && n.strokes[0]?.variableId, `${n.type} w=${n.width} fill=${n.fills[0]?.color}`);
  await escapeAll();
});

// --- Card
await step('card component', async () => {
  await label(0, 250, 'Card');
  const t1 = await text(0, 290, 'Pro plan'); await textStyle('Type/Title'); await bind('fills', 'text'); await escapeAll();
  const t2 = await text(0, 326, 'Everything your team needs to ship a consistent UI, in light and dark.', { size: 14, weight: 400 }); await bind('fills', 'text-muted'); await escapeAll();
  const t3 = await text(0, 380, '$12 / month'); await textStyle('Type/Heading'); await bind('fills', 'primary'); await escapeAll();
  // marquee-select the three texts
  await page.keyboard.press('v');
  await drag(await toScreen(-30, 280), await toScreen(520, 430));
  const s = await selected();
  if (s.length !== 3) note(`Card marquee selected ${s.length} (${s.map((x) => x.name).join(', ')})`);
  await page.keyboard.press('Shift+A');
  await wait(100);
  const fr = await sel1();
  await setField('al-gap', 10);
  await setField('al-pad-h', 24);
  await setField('al-pad-v', 24);
  await tid('sizing-H').selectOption('FIXED');
  await setField('prop-w', 320);
  await tid('add-fills').click(); await bind('fills', 'surface');
  await tid('add-strokes').click(); await bind('strokes', 'border');
  await setField('prop-radius', 16);
  // body text fills the width so it wraps
  await escapeAll();
  const bt = await nodeById(t2.id);
  const fa = await nodeById(fr.id);
  await page.keyboard.down(MOD); await clickWorld(fa.x + bt.x + 20, fa.y + bt.y + bt.height / 2); await page.keyboard.up(MOD);
  const bodySel = await sel1();
  if (bodySel?.id === t2.id) { await tid('sizing-H').selectOption('FILL'); } else note(`deep-select picked ${bodySel?.name}`);
  await escapeAll();
  // make the component
  await page.evaluate(() => 0);
  await selectLayer(fr.name);
  await page.keyboard.press(`${MOD}+Alt+k`);
  await wait(100);
  const c = await sel1();
  compIds.Card = c.id;
  await renameLayer(c.name, 'Card');
  const n = await nodeById(c.id);
  check('Card component: fill + stroke bound to variables', n.type === 'COMPONENT' && n.fills[0]?.variableId && n.strokes[0]?.variableId, `${n.type} ${n.width}x${n.height}`);
  await escapeAll();
});

// number variables can't be bound: probe the UI around corner radius / gap for any binding affordance
await step('number var binding probe', async () => {
  await selectLayer('Card');
  const radiusRow = page.getByTestId('prop-radius').locator('xpath=ancestor::div[contains(@class,"row") or contains(@class,"grid")][1]');
  const hasBind = await radiusRow.locator('[data-testid*="var"], [data-tip*="ariable"]').count().catch(() => 0);
  check('UI to bind NUMBER variables (radius/spacing) to radius/gap/padding', hasBind > 0, hasBind ? 'found' : 'no bind control next to radius / gap / padding fields');
  await escapeAll();
});

await escapeAll();
await setView(0.8, 290, 110);
await shot('components.png');

// Assets panel
await step('assets panel', async () => {
  await tid('tab-assets').click();
  await wait(200);
  const names = await page.locator('[data-testid^="asset-"]:not([data-testid^="asset-style"]):not([data-testid="assets-tab"]):not([data-testid="assets-search"])').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  await shot('assets.png');
  check('Assets panel lists components', ['asset-Type=Primary', 'asset-Type=Secondary', 'asset-Type=Ghost', 'asset-Input', 'asset-Card'].every((n) => names.includes(n)), names.join(', '));
  const styleItems = await page.locator('[data-testid^="asset-style-"]').count();
  check('Assets panel lists color styles', styleItems >= PALETTE.length, `${styleItems} color style rows`);
  await tid('tab-file').click();
});

// ---------- 4. Preview page ----------
await step('rename page 1', async () => {
  await tid('page-Page 1').click();
  await wait(150);
  await tid('page-Page 1').dblclick();
  await tid('page-rename-input').fill('Previews');
  await tid('page-rename-input').press('Enter');
  await wait(100);
});
await setView(0.7, 270, 100);

const PW = 520, PH = 520;
const frames = {};
await step('preview frames', async () => {
  for (const [mode, x] of [['Light', 0], ['Dark', PW + 60]]) {
    await draw('f', x, 0, PW, PH);
    const f = await sel1();
    frames[mode] = f.id;
    await renameLayer(f.name, `Preview – ${mode}`);
    await bind('fills', 'bg');
    await escapeAll();
  }
});

async function dropAsset(assetName, wx, wy) {
  await tid('tab-assets').click();
  await wait(100);
  const target = await toScreen(wx, wy);
  const cb = await page.getByTestId('canvas').boundingBox();
  await page.getByTestId(`asset-${assetName}`).dragTo(page.getByTestId('canvas'), { targetPosition: { x: target.x - cb.x, y: target.y - cb.y } });
  await wait(120);
  const n = await sel1();
  await tid('tab-file').click();
  return n;
}

const instances = { Light: [], Dark: [] };
await step('fill previews with instances', async () => {
  for (const mode of ['Light', 'Dark']) {
    const ox = mode === 'Light' ? 0 : PW + 60;
    await text(ox + 40, 40, 'Account settings', { size: 28, weight: 700 }); await bind('fills', 'text'); await escapeAll();
    await text(ox + 40, 84, `${mode} mode · Theme collection`, { size: 14, weight: 400 }); await bind('fills', 'text-muted'); await escapeAll();
    await text(ox + 40, 130, 'Email', { size: 13, weight: 600 }); await bind('fills', 'text'); await escapeAll();
    const inp = await dropAsset('Input', ox + 40 + 150, 155 + 22); instances[mode].push(inp);
    const card = await dropAsset('Card', ox + 40 + 160, 230 + 90); instances[mode].push(card);
    // buttons row
    const b1 = await dropAsset('Type=Primary', ox + 40 + 60, 450); instances[mode].push(b1);
    const b2 = await dropAsset('Type=Primary', ox + 200 + 60, 450); instances[mode].push(b2);
    await tid('variant-select-Type').selectOption('Secondary'); await wait(80);
    const b3 = await dropAsset('Type=Primary', ox + 350 + 50, 450); instances[mode].push(b3);
    await tid('variant-select-Type').selectOption('Ghost'); await wait(80);
    await escapeAll();
  }
  const all = await allNodes();
  const inFrame = (fid) => all.filter((n) => n.type === 'INSTANCE' && n.parentId === fid);
  const lI = inFrame(frames.Light), dI = inFrame(frames.Dark);
  check('Instances inserted from Assets into both preview frames', lI.length === 5 && dI.length === 5, `light=${lI.length} dark=${dI.length}`);
  const mains = await st(`s => Object.values(s.doc.nodes).filter(n => n.type === 'INSTANCE' && n.parentId === ${JSON.stringify(frames.Light)}).map(n => s.doc.nodes[n.mainComponentId]?.name)`);
  check('Variant switch on instance (Primary → Secondary / Ghost)', ['Type=Primary', 'Type=Secondary', 'Type=Ghost'].every((v) => mains.includes(v)), mains.join(', '));
});

// tidy x positions: report instance geometry
note('light instances: ' + JSON.stringify(await st(`s => Object.values(s.doc.nodes).filter(n => n.parentId === ${JSON.stringify(frames.Light)}).map(n => [n.name, Math.round(n.x), Math.round(n.y), Math.round(n.width), Math.round(n.height)])`)));

await escapeAll();
await shot('preview-before-mode.png');

// ---------- 5. Mode switching via the Appearance/mode switcher ----------
const colorOf = async (frameId, pred) => st(`s => { const f = s.doc.nodes[${JSON.stringify(frameId)}]; const out = {}; const walk = (id) => { const n = s.doc.nodes[id]; if (!n) return; out[n.name + ':' + n.type + ':' + id.slice(-4)] = n.fills[0] && n.fills[0].color; n.children.forEach(walk); }; walk(f.id); return out; }`);
await step('mode switch', async () => {
  const before = await colorOf(frames.Dark);
  for (const mode of ['Light', 'Dark']) {
    await selectLayer(`Preview – ${mode}`);
    const ms = tid('mode-select-Theme');
    await ms.waitFor({ timeout: 3000 });
    await ms.selectOption({ label: mode });
    await wait(150);
  }
  const fl = await nodeById(frames.Light), fd = await nodeById(frames.Dark);
  const col = await st('s => s.doc.collections.find(c => c.name === "Theme")');
  check('Mode set on frames via mode switcher (Light / Dark)', fl.variableModes?.[col.id] === col.modes[0].id && fd.variableModes?.[col.id] === col.modes[1].id, JSON.stringify([fl.variableModes, fd.variableModes]));
  check('Dark frame bg resolves to Dark value', fd.fills[0].color === '#0E1015' && fl.fills[0].color === '#F5F6FA', `light=${fl.fills[0].color} dark=${fd.fills[0].color}`);
  const after = await colorOf(frames.Dark);
  const changed = Object.keys(after).filter((k) => after[k] !== before[k]);
  note('dark-frame colors after switch: ' + JSON.stringify(after));
  check('Mode switch changes descendants incl. instance internals', changed.length >= 8, `${changed.length} layer fills changed`);
  // instance internals: card surface in dark?
  const cardInst = await st(`s => Object.values(s.doc.nodes).find(n => n.type === 'INSTANCE' && n.parentId === ${JSON.stringify(frames.Dark)} && s.doc.nodes[n.mainComponentId]?.name === 'Card')`);
  check('Card instance in Dark preview uses Dark surface (#181B23)', cardInst?.fills[0]?.color === '#181B23', cardInst?.fills[0]?.color);
  const primInst = await st(`s => Object.values(s.doc.nodes).find(n => n.type === 'INSTANCE' && n.parentId === ${JSON.stringify(frames.Dark)} && s.doc.nodes[n.mainComponentId]?.name === 'Type=Primary')`);
  check('Primary button instance in Dark preview uses Dark primary (#8B8DFB)', primInst?.fills[0]?.color === '#8B8DFB', primInst?.fills[0]?.color);
  await escapeAll();
});
await setView(0.7, 270, 100);
await shot('mode-switch.png');
await shot('canvas.png');

// ---------- 6. Variable edit propagates to bound layers ----------
await step('variable edit propagation', async () => {
  await escapeAll();
  await tid('open-variables-btn').click();
  const f = tid('var-value-border-Dark');
  await f.fill('343A48'); await f.press('Enter'); await wait(80);
  await tid('modal-close').click();
  const inp = await st(`s => Object.values(s.doc.nodes).find(n => n.type === 'INSTANCE' && n.parentId === ${JSON.stringify(frames.Dark)} && s.doc.nodes[n.mainComponentId]?.name === 'Input')`);
  check('Editing a variable value updates bound layers (Dark Input stroke)', inp?.strokes[0]?.color === '#343A48', inp?.strokes[0]?.color);
});

// ---------- 7. Exports ----------
async function exportFrame(frameName, file) {
  await selectLayer(frameName);
  await tid('add-export').click();
  await wait(80);
  const fmt = await page.getByTestId('export-format-0').inputValue().catch(() => '?');
  if (fmt !== 'PNG') await tid('export-format-0').selectOption('PNG');
  const dl = page.waitForEvent('download', { timeout: 15000 });
  await tid('export-btn').click();
  const d = await dl;
  await d.saveAs(path.join(OUT, file));
  const buf = fs.readFileSync(path.join(OUT, file));
  return { name: d.suggestedFilename(), png: buf.subarray(1, 4).toString() === 'PNG', size: buf.length };
}
await step('png export', async () => {
  const a = await exportFrame('Preview – Light', 'design.png');
  const b = await exportFrame('Preview – Dark', 'design-dark.png');
  check('PNG export via Export button (Light + Dark previews)', a.png && b.png, `${a.name} ${a.size}B, ${b.name} ${b.size}B`);
  await escapeAll();
});

// ---------- 8. Save local copy ----------
await step('save local copy', async () => {
  const dl = page.waitForEvent('download', { timeout: 15000 });
  await tid('main-menu-btn').click();
  await tid('menu-file').hover();
  await tid('cmd-file.saveLocal').click();
  const d = await dl;
  await d.saveAs(path.join(OUT, 'design.myflow'));
  const j = JSON.parse(fs.readFileSync(path.join(OUT, 'design.myflow'), 'utf8'));
  check('Save local copy (.myflow) contains pages, variables, styles', j.doc.pages.length === 2 && j.doc.variables.length === 9 && j.doc.styles.length === 13, `${d.suggestedFilename()} pages=${j.doc.pages.map((p) => p.name)} vars=${j.doc.variables.length} styles=${j.doc.styles.length}`);
});

// summary stats
const stats = await st(`s => { const ns = Object.values(s.doc.nodes); const c = {}; ns.forEach(n => c[n.type] = (c[n.type] || 0) + 1); return { total: ns.length, byType: c, pages: s.doc.pages.map(p => p.name + '(' + p.children.length + ')') }; }`);
note('stats ' + JSON.stringify(stats));
const tsUse = await st('s => Object.values(s.doc.nodes).filter(n => n.textStyleId).map(n => s.doc.styles.find(x => x.id === n.textStyleId)?.name)');
check('Text styles applied to component text (Button/Card labels)', tsUse.filter((x) => x === 'Type/Label').length >= 3 && tsUse.includes('Type/Title') && tsUse.includes('Type/Heading'), tsUse.join(', '));
check('No console/page errors', errors.length === 0, errors.slice(0, 5).join(' | '));

// components page final screenshot with Dev-ish zoom
await tid('page-Components').click();
await wait(150);
await setView(0.8, 290, 110);
await escapeAll();
await shot('components.png');

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ checks, notes, errors, stats }, null, 2));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed`);
await browser.close();
