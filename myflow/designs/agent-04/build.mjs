// Agent 04 — Startup landing page hero (1440x900), built through the My Flow UI only.
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('designs/agent-04');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5390';
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

const log = (...a) => console.log('[a04]', ...a);
const checks = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); log(ok ? 'PASS' : 'FAIL', name, detail); };
const findings = [];
const note = (s) => { findings.push(s); log('NOTE', s); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|picsum|Failed to load resource/.test(m.text())) errors.push(m.text()); });

// ---------- helpers (read-only state + UI interactions) ----------
const st = (fn) => page.evaluate(`(() => { const s = window.__myflow.get(); return (${fn})(s); })()`);
const allNodes = () => st('s => Object.values(s.doc.nodes)');
const sel = () => st('s => s.selection.map(id => s.doc.nodes[id])');
const one = async () => (await sel())[0];
const byName = async (n) => (await allNodes()).find((x) => x.name === n);
const toScreen = (x, y) => st(`s => ({ x: ${x} * s.zoom + s.panX, y: ${y} * s.zoom + s.panY })`);
const wait = (ms = 80) => page.waitForTimeout(ms);
async function drag(a, b) {
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
}
async function draw(key, x, y, w, h) { await page.keyboard.press(key); await drag(await toScreen(x, y), await toScreen(x + w, y + h)); await wait(); }
async function setField(id, v) { const f = page.getByTestId(id).first(); await f.click(); await f.fill(String(v)); await f.press('Enter'); await wait(40); }
async function geom(x, y, w, h) {
  if (w != null) await setField('prop-w', w);
  if (h != null) await setField('prop-h', h);
  if (x != null) await setField('prop-x', x);
  if (y != null) await setField('prop-y', y);
}
async function rename(name) {
  const n = await one();
  const row = page.locator(`[data-layer="${n.id}"]`);
  await row.scrollIntoViewIfNeeded();
  await row.locator('.name').dblclick();
  await page.getByTestId('layer-rename-input').fill(name);
  await page.getByTestId('layer-rename-input').press('Enter');
  await wait(40);
}
async function pickLayer(name, shift = false) {
  const n = await byName(name);
  if (!n) throw new Error('no layer ' + name);
  // expand ancestors through the twisty if row is not rendered
  let row = page.locator(`[data-layer="${n.id}"]`);
  if (!(await row.count())) {
    const chain = await st(`s => { const out=[]; let p=s.doc.nodes['${n.id}'].parentId; while(p){ out.unshift(s.doc.nodes[p].name); p=s.doc.nodes[p].parentId; } return out; }`);
    for (const a of chain) {
      const anc = await byName(a);
      const r = page.locator(`[data-layer="${anc.id}"]`);
      const kid = page.locator(`[data-layer="${(await st(`s => s.doc.nodes['${anc.id}'].children[0]`))}"]`);
      if (!(await kid.count())) await r.locator('.twisty').click();
    }
    row = page.locator(`[data-layer="${n.id}"]`);
  }
  await row.scrollIntoViewIfNeeded();
  if (shift) await page.keyboard.down('Shift');
  await row.locator('.name').click();
  if (shift) await page.keyboard.up('Shift');
  await wait(40);
}
async function pickMany(names) { for (let i = 0; i < names.length; i++) await pickLayer(names[i], i > 0); }
async function text(x, y, chars) {
  await page.keyboard.press('t');
  const p = await toScreen(x, y);
  await page.mouse.click(p.x, p.y);
  await wait(60);
  const ed = await st('s => s.editingTextId');
  if (!ed) { await shot('dbg-text.png'); log('DEBUG text not editing', chars, JSON.stringify(await st('s => ({tool: s.tool, sel: s.selection, active: document.activeElement && document.activeElement.outerHTML.slice(0,200)})'))); }
  await page.keyboard.type(chars, { delay: 2 });
  await page.keyboard.press('Escape');
  await wait(60);
  const ss = await st('s => s.selection.map(i => s.doc.nodes[i].name + ":" + s.doc.nodes[i].type)');
  if (ss.length !== 1) { await shot('dbg-text.png'); log('DEBUG after text', chars, JSON.stringify(ss)); }
}
let mixedNoted = false;
async function fillHex(hex, i = 0) {
  if (!(await page.getByTestId(`fills-hex-${i}`).count()) && (await page.getByText('Click + to replace mixed fills').count())) {
    if (!mixedNoted) { mixedNoted = true; note('Multi-select of layers with identical solid fills shows "Click + to replace mixed fills" (paint ids differ)'); }
    await page.getByTestId('add-fills').click();
    await wait(40);
    if (!(await page.getByTestId(`fills-hex-${i}`).count())) { note('Even after clicking + on mixed fills, multi-selection still shows mixed: fills cannot be edited on a multi-selection'); throw new Error('mixed'); }
  }
  await setField(`fills-hex-${i}`, hex);
}
async function gradient(type, stops, angle) {
  await page.getByTestId('fills-swatch-0').click();
  await page.getByTestId('paint-type').selectOption(type);
  await wait();
  for (let i = 0; i < stops.length; i++) {
    const stop = page.getByTestId(`grad-stop-${i}`);
    const b = await stop.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.up();
    await wait(40);
    const hex = page.getByTestId('paint-picker').getByTestId('hex-input');
    await hex.fill(stops[i]); await hex.press('Enter');
    await wait(40);
  }
  if (angle != null) {
    const ang = page.getByTestId('gradient-editor').locator('input').first();
    await ang.click(); await ang.fill(String(angle)); await ang.press('Enter');
  }
  await page.keyboard.press('Escape');
  await wait();
}
async function textProps({ size, weight, lh, ls, align }) {
  if (weight != null) await page.getByTestId('font-weight').selectOption(String(weight));
  if (size != null) await setField('font-size', size);
  if (lh != null) await setField('line-height', lh);
  if (ls != null) await setField('letter-spacing', ls);
  if (align) await page.getByTestId(`text-align-${align}`).click();
}
async function esc() { for (let i = 0; i < 6; i++) { await page.keyboard.press('Escape'); await wait(30); if (!(await st('s => s.selection.length'))) break; } }
async function menuCmd(menu, cmd) {
  await page.getByTestId('main-menu-btn').click();
  await page.getByTestId(`menu-${menu}`).hover();
  await page.getByTestId(`cmd-${cmd}`).click();
}
async function shot(name) { await page.screenshot({ path: path.join(OUT, name) }); }

// ---------- 0. open app, new file, rename ----------
await page.goto(BASE + '/');
await page.getByTestId('new-design-file').click();
await page.getByTestId('editor').waitFor();
await wait(300);
await page.getByTestId('file-name').click();
await page.getByTestId('file-name-input').fill('Lumen – Startup Hero');
await page.getByTestId('file-name-input').press('Enter');
check('File renamed', (await page.getByTestId('file-name').textContent()) === 'Lumen – Startup Hero');
await page.evaluate(() => window.__myflow.get().setState({ zoom: 0.5, panX: 290, panY: 110 }));

// palette
const C = { bg: '0B0A1A', brand: '6D5BFF', white: 'FFFFFF', sub: 'B4AFD3', muted: '7D78A3', logo: '9E9AC0' };

// ---------- 1. Hero frame ----------
await draw('f', 0, 0, 1440, 900);
await geom(0, 0, 1440, 900);
await rename('Hero');
await fillHex(C.bg);
const hero = await one();
check('Hero frame 1440x900', hero.type === 'FRAME' && hero.width === 1440 && hero.height === 900, `${hero.width}x${hero.height}`);

// ---------- 2. Decorative blobs ----------
// a) big radial blob (top right)
await draw('o', 1000, 100, 300, 300);
await geom(760, -220, 820, 820);
await rename('Blob / Radial');
await gradient('GRADIENT_RADIAL', ['7C5CFF', C.bg]);
let n = await one();
check('Radial gradient fill on ellipse', n.type === 'ELLIPSE' && n.fills[0].type === 'GRADIENT_RADIAL', JSON.stringify(n.fills[0].stops));
check('Blob parented into Hero', n.parentId === hero.id);
await esc();

// b) cyan radial glow (top left)
await draw('o', 100, 100, 200, 200);
await geom(-260, -300, 680, 680);
await rename('Blob / Glow');
await gradient('GRADIENT_RADIAL', ['155E75', C.bg]);
await setField('prop-opacity', 70);
await esc();

// c) linear gradient blob with layer blur (bottom left)
await draw('o', 200, 600, 200, 200);
await geom(-180, 560, 560, 560);
await rename('Blob / Linear Blur');
await gradient('GRADIENT_LINEAR', ['F472B6', '6D5BFF'], 45);
n = await one();
check('Linear gradient fill on ellipse', n.fills[0].type === 'GRADIENT_LINEAR', `angle=${n.fills[0].angle} stops=${JSON.stringify(n.fills[0].stops)}`);
await page.getByTestId('add-effect').click();
await page.getByTestId('effect-type-0').selectOption('LAYER_BLUR');
await page.getByTestId('effect-settings-0').click();
await setField('effect-blur', 140);
await page.keyboard.press('Escape');
await setField('prop-opacity', 55);
n = await one();
check('Layer blur effect', n.effects[0]?.type === 'LAYER_BLUR' && n.effects[0].blur === 140, JSON.stringify(n.effects[0]));
await esc();

// d) boolean ring: big ellipse minus small ellipse
await draw('o', 1100, 560, 150, 150);
await geom(1090, 520, 300, 300);
await rename('Ring Outer');
await esc();
await draw('o', 1150, 600, 100, 100);
await geom(1150, 580, 180, 180);
await rename('Ring Inner');
await pickMany(['Ring Outer', 'Ring Inner']);
await page.getByTestId('bool-subtract').click();
await wait();
n = await one();
check('Boolean SUBTRACT created', n.type === 'BOOLEAN_OPERATION' && n.booleanOp === 'SUBTRACT', `${n.type}/${n.booleanOp} kids=${n.children.length}`);
await rename('Ring / Subtract');
await gradient('GRADIENT_LINEAR', ['A78BFA', '22D3EE'], 135);
await setField('prop-opacity', 85);
await esc();

// small union sparkle: two thin rects crossed -> Union (plus sign accent)
await draw('r', 1260, 160, 40, 10);
await geom(1250, 186, 48, 12);
await setField('prop-radius', 6);
await rename('Plus H');
await esc();
await draw('r', 1268, 170, 10, 40);
await geom(1268, 168, 12, 48);
await setField('prop-radius', 6);
await rename('Plus V');
await pickMany(['Plus H', 'Plus V']);
await page.keyboard.press('Alt+Shift+u');
await wait();
n = await one();
check('Boolean UNION created (shortcut)', n.type === 'BOOLEAN_OPERATION' && n.booleanOp === 'UNION', `${n.type}/${n.booleanOp}`);
await rename('Sparkle / Union');
await fillHex('F9A8D4');
await esc();

await shot('step-blobs.png');

// ---------- 3. Nav bar ----------
// logo mark + wordmark
await draw('r', 80, 40, 30, 30);
await geom(80, 40, 32, 32);
await setField('prop-radius', 9);
await rename('Logo Mark');
await fillHex(C.brand);
await esc();
await text(126, 42, 'Lumen');
await fillHex(C.white);
await textProps({ size: 24, weight: 700, ls: -2 });
await esc();
await pickMany(['Logo Mark', 'Lumen']);
await page.keyboard.press('Shift+a');
await page.getByTestId('al-horizontal').click();
await setField('al-gap', 10);
await page.getByTestId('al-align-4').click().catch(() => {});
await rename('Logo');
await esc();

const links = ['Product', 'Solutions', 'Pricing', 'Customers', 'Docs'];
for (let i = 0; i < links.length; i++) { await text(440 + i * 120, 46, links[i]); await fillHex('D6D3EA'); }
await pickMany(links);
try { await fillHex('D6D3EA'); } catch { await esc(); await pickMany(links); }
await page.keyboard.press('Shift+a');
await page.getByTestId('al-horizontal').click();
await setField('al-gap', 36);
await rename('Nav Links');
await esc();

await text(1180, 46, 'Get started');
await fillHex(C.white);
await textProps({ size: 15, weight: 600 });
await page.keyboard.press('Shift+a');
await setField('al-pad-h', 20);
await setField('al-pad-v', 10);
await page.getByTestId('add-fills').click();
await fillHex(C.brand);
await setField('prop-radius', 10);
await rename('Nav CTA');
await esc();

await pickMany(['Logo', 'Nav Links', 'Nav CTA']);
await page.keyboard.press('Shift+a');
await page.getByTestId('al-horizontal').click();
await page.getByTestId('sizing-H').selectOption('FIXED');
await setField('prop-w', 1280);
await page.getByTestId('al-spacing-mode').selectOption('auto');
await page.getByTestId('al-align-4').click().catch(() => {});
await geom(80, 28);
await rename('Nav');
n = await one();
check('Nav: horizontal auto layout, space-between, 1280 wide', n.layout.mode === 'HORIZONTAL' && n.layout.alignMain === 'SPACE_BETWEEN' && n.width === 1280, `${n.layout.mode}/${n.layout.alignMain}/${n.width}`);
await esc();

// ---------- 4. Headline + subheadline ----------
// pill badge above the headline
await text(100, 214, 'New  ·  Lumen 2.0 is live — see what’s new →');
await fillHex('D9D2FF');
await textProps({ size: 14, weight: 500 });
await page.keyboard.press('Shift+a');
await setField('al-pad-h', 14);
await setField('al-pad-v', 6);
await page.getByTestId('add-fills').click();
await fillHex(C.brand);
await setField('fills-opacity-0', 18);
await page.getByTestId('add-strokes').click();
await setField('strokes-hex-0', '8B7CFF');
await setField('prop-radius', 999);
await geom(80, 196);
await rename('Badge');
await esc();

await text(80, 250, 'Analytics that move\nat the speed of thought');
await fillHex(C.white);
await textProps({ size: 64, weight: 700, lh: 72, ls: -2 });
await geom(80, 248);
await rename('Headline');
// text style Heading/H1
await page.getByTestId('text-styles-btn').click();
await page.getByTestId('create-text-style').click();
await wait();
n = await one();
check('Headline 64px bold, 2 lines', n.text.fontSize === 64 && n.text.fontWeight === 700 && n.text.characters.split('\n').length === 2, `${n.text.fontSize}/${n.text.fontWeight} h=${n.height}`);
await esc();

await text(80, 420, 'Lumen turns raw product events into answers your whole team can trust. Build dashboards in minutes, not sprints.');
await fillHex(C.sub);
await textProps({ size: 20, weight: 400, lh: 32 });
await page.getByTestId('text-resize-height').click();
await setField('prop-w', 600);
await geom(80, 412);
await rename('Subheadline');
await page.getByTestId('text-styles-btn').click();
await page.getByTestId('create-text-style').click();
await wait();
await esc();

// rename the two text styles through the Local styles modal
async function renameStyle(oldName, newName) {
  await page.getByTestId(`style-row-${oldName}`).locator('button').click();
  await page.getByTestId('styles-modal').waitFor();
  await page.getByTestId(`styles-item-${oldName}`).click();
  const f = page.getByTestId('style-name');
  await f.fill(newName);
  await f.press('Tab');
  await wait(60);
  await page.getByTestId('modal-close').click();
  await wait(60);
}
await renameStyle('Text style 1', 'Heading/H1');
await renameStyle('Text style 2', 'Body');
const styles1 = await st('s => s.doc.styles.map(x => x.name)');
check('Text styles created & named', styles1.includes('Heading/H1') && styles1.includes('Body'), styles1.join(', '));

// ---------- 5. CTA buttons + color style ----------
await text(100, 520, 'Start free trial');
await fillHex(C.white);
await textProps({ size: 17, weight: 600 });
await page.keyboard.press('Shift+a');
await setField('al-pad-h', 28);
await setField('al-pad-v', 16);
await page.getByTestId('add-fills').click();
await fillHex(C.brand);
await setField('prop-radius', 12);
await page.getByTestId('add-effect').click();
await page.getByTestId('effect-settings-0').click();
await setField('effect-blur', 32);
await setField('effect-y', 12);
await page.keyboard.press('Escape');
await rename('CTA Primary');
// color style from this fill
await page.getByTestId('fills-styles-btn').click();
await page.getByTestId('create-style-from-fills').click();
await wait();
await esc();
await renameStyle('Color style 1', 'Brand/Primary');

await text(320, 520, 'Book a demo');
await fillHex(C.white);
await textProps({ size: 17, weight: 600 });
await page.keyboard.press('Shift+a');
await setField('al-pad-h', 28);
await setField('al-pad-v', 16);
await page.getByTestId('add-fills').click();
await fillHex(C.white);
await setField('fills-opacity-0', 6);
await page.getByTestId('add-strokes').click();
await setField('strokes-hex-0', '4A4570');
await setField('prop-radius', 12);
await rename('CTA Secondary');
await esc();

await pickMany(['CTA Primary', 'CTA Secondary']);
await page.keyboard.press('Shift+a');
await page.getByTestId('al-horizontal').click();
await setField('al-gap', 16);
await geom(80, 516);
await rename('CTA Group');
await esc();

// ---------- 6. Trusted-by strip ----------
await text(80, 700, 'TRUSTED BY 2,000+ FAST-MOVING TEAMS');
await fillHex(C.muted);
await textProps({ size: 13, weight: 600, ls: 12 });
await rename('Trusted label');
await esc();
const logos = ['Northwind', 'Acme Corp', 'Globex', 'Initech', 'Hooli', 'Vandelay'];
for (let i = 0; i < logos.length; i++) { await text(80 + i * 190, 750, logos[i]); await fillHex(C.logo); }
await pickMany(logos);
await textProps({ size: 26, weight: 700, ls: -3 });
await page.keyboard.press('Shift+a');
await page.getByTestId('al-horizontal').click();
await setField('al-gap', 72);
await rename('Logo Row');
await esc();
await pickMany(['Trusted label', 'Logo Row']);
await page.keyboard.press('Shift+a');
await page.getByTestId('al-vertical').click().catch(() => {});
await setField('al-gap', 22);
await geom(80, 720);
await rename('Trusted By');
await esc();
// divider line above strip
await draw('r', 80, 690, 400, 2);
await geom(80, 680, 940, 1);
await fillHex('FFFFFF');
await setField('fills-opacity-0', 10);
await rename('Divider');
await esc();

// ---------- 7. Apply styles to other layers ----------
// Body text style -> nav links + trusted label? (nav links use Body)
await pickMany(links);
await page.getByTestId('text-styles-btn').click();
await page.getByText(/^Body\s/).first().click();
await wait();
let ls = await Promise.all(links.map(byName));
check('Body text style applied to 5 nav links', ls.every((x) => x.textStyleId && x.text.fontSize === 20), ls.map((x) => x.text.fontSize).join(','));
if (ls.some((x) => x.text.autoResize !== 'WIDTH_AND_HEIGHT')) {
  note(`Applying text style "Body" (created from a fixed-width/auto-height paragraph) changed nav links from Auto width to ${ls[0].text.autoResize}; they wrapped mid-word ("Produ/ct"). The style carries autoResize.`);
  await shot('bug-textstyle-wrap.png');
  await page.getByTestId('text-resize-width_and_height').click();
  await wait();
  ls = await Promise.all(links.map(byName));
  check('Nav links back to auto width (still styled)', ls.every((x) => x.text.autoResize === 'WIDTH_AND_HEIGHT' && x.textStyleId), ls.map((x) => `${x.width}x${x.height}`).join(','));
}
await esc();
// Body style -> CTA labels? keep CTA labels as-is. Heading/H1 -> second heading? apply H1 to wordmark "Lumen"? no — apply H1 to a copy check:
// Color style -> Nav CTA fill + Logo mark + Badge stroke? (apply to fills)
for (const nm of ['Nav CTA', 'Logo Mark']) {
  await pickLayer(nm);
  await page.getByTestId('fills-styles-btn').click();
  await page.getByTestId('apply-style-Brand/Primary').click();
  await wait();
  await esc();
}
const brandStyle = await st(`s => s.doc.styles.find(x => x.name === 'Brand/Primary')`);
const bound = (await allNodes()).filter((x) => x.fillStyleId === brandStyle.id).map((x) => x.name);
check('Color style applied to 3 layers', bound.length >= 3, bound.join(', '));

// Nav links are now 20px (Body) — that’s large for nav; edit the Body style size to 18 to test text-style propagation
await page.getByTestId('style-row-Body').locator('button').click();
await page.getByTestId('styles-item-Body').click();
await setField('style-font-size', 18);
await page.getByTestId('modal-close').click();
ls = await Promise.all(links.map(byName));
const subN = await byName('Subheadline');
check('Text style edit propagates (Body 20→18)', ls.every((x) => x.text.fontSize === 18) && subN.text.fontSize === 18, `links=${ls.map((x) => x.text.fontSize)} sub=${subN.text.fontSize}`);

// ---------- 8. Color style edit propagates ----------
await page.getByTestId('style-row-Brand/Primary').locator('button').click();
await page.getByTestId('styles-item-Brand/Primary').click();
const hx = page.getByTestId('styles-modal').getByTestId('hex-input');
await hx.fill('7C4DFF'); await hx.press('Enter');
await wait();
await page.getByTestId('modal-close').click();
const after = (await allNodes()).filter((x) => x.fillStyleId === brandStyle.id);
check('Color style edit propagates to all bound layers', after.length >= 3 && after.every((x) => x.fills[0].color === '#7C4DFF'), after.map((x) => `${x.name}:${x.fills[0].color}`).join(', '));
await shot('styles-panel.png');

// ---------- 9. Constraints ----------
async function constrain(name, h, v) {
  await pickLayer(name);
  if (h) await page.getByTestId('constraint-h').selectOption(h);
  if (v) await page.getByTestId('constraint-v').selectOption(v);
  await esc();
}
await constrain('Nav', 'LEFT_RIGHT', 'TOP');
await constrain('Blob / Radial', 'RIGHT', 'TOP');
await constrain('Ring / Subtract', 'RIGHT', 'BOTTOM');
await constrain('Sparkle / Union', 'RIGHT', 'TOP');
await constrain('Trusted By', 'LEFT', 'BOTTOM');
await constrain('Divider', 'LEFT_RIGHT', 'BOTTOM');
const before = Object.fromEntries((await allNodes()).map((x) => [x.name, x]));
await pickLayer('Hero');
await setField('prop-w', 1600);
await setField('prop-h', 1000);
const after2 = Object.fromEntries((await allNodes()).map((x) => [x.name, x]));
const navCta = after2['Nav CTA'];
check('Constraint LEFT_RIGHT: Nav stretches 1280→1440', after2['Nav'].width === 1440, `nav w=${after2['Nav'].width}, CTA x=${before['Nav CTA'].x}→${navCta.x}`);
check('Constraint RIGHT/BOTTOM: Ring moves +160/+100', after2['Ring / Subtract'].x === before['Ring / Subtract'].x + 160 && after2['Ring / Subtract'].y === before['Ring / Subtract'].y + 100, `${before['Ring / Subtract'].x},${before['Ring / Subtract'].y} → ${after2['Ring / Subtract'].x},${after2['Ring / Subtract'].y}`);
check('Constraint BOTTOM: Trusted By moves +100', after2['Trusted By'].y === before['Trusted By'].y + 100, `${before['Trusted By'].y}→${after2['Trusted By'].y}`);
await page.evaluate(() => window.__myflow.get().setState({ zoom: 0.5, panX: 290, panY: 110 }));
await page.keyboard.press('Escape');
await shot('constraints-1600.png');
await pickLayer('Hero');
await setField('prop-w', 1440);
await setField('prop-h', 900);
const back = Object.fromEntries((await allNodes()).map((x) => [x.name, x]));
check('Resize back to 1440x900 restores layout', back['Nav'].width === 1280 && back['Ring / Subtract'].x === before['Ring / Subtract'].x, `nav=${back['Nav'].width} ring.x=${back['Ring / Subtract'].x}`);

// ---------- 10. Screens ----------
await esc();
await page.evaluate(() => window.__myflow.get().setState({ zoom: 0.62, panX: 260, panY: 70 }));
await wait(300);
await shot('canvas.png');

// ---------- 11. Export PNG + PDF through the Export button ----------
await pickLayer('Hero');
await page.getByTestId('add-export').click();
await page.getByTestId('add-export').click();
await page.getByTestId('export-format-1').selectOption('PDF');
const downloads = [];
page.on('download', async (d) => { const p = await d.path(); downloads.push({ name: d.suggestedFilename(), buf: readFileSync(p) }); });
await page.getByTestId('export-btn').click();
for (let i = 0; i < 100 && downloads.length < 2; i++) await wait(150);
const png = downloads.find((d) => d.name.endsWith('.png'));
const pdf = downloads.find((d) => d.name.endsWith('.pdf'));
if (png) writeFileSync(path.join(OUT, 'design.png'), png.buf);
if (pdf) writeFileSync(path.join(OUT, 'design.pdf'), pdf.buf);
check('PNG export via Export button', png && png.buf.subarray(1, 4).toString() === 'PNG', png ? `${png.name} ${png.buf.length}B` : 'none');
check('PDF export via Export button', pdf && pdf.buf.subarray(0, 5).toString() === '%PDF-', pdf ? `${pdf.name} ${pdf.buf.length}B` : 'none');

// File → Export frames to PDF as well
const dlP = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
await menuCmd('file', 'file.exportPdf');
const framesPdf = await dlP;
if (framesPdf) { const b = readFileSync(await framesPdf.path()); writeFileSync(path.join(OUT, 'frames.pdf'), b); check('File → Export frames to PDF', b.subarray(0, 5).toString() === '%PDF-', `${framesPdf.suggestedFilename()} ${b.length}B`); }
else check('File → Export frames to PDF', false, 'no download');

// ---------- 12. Save local copy ----------
const dlS = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
await menuCmd('file', 'file.saveLocal');
const local = await dlS;
if (local) {
  const b = readFileSync(await local.path());
  writeFileSync(path.join(OUT, 'design.myflow'), b);
  const j = JSON.parse(b.toString());
  check('Save local copy (.myflow)', local.suggestedFilename().endsWith('.myflow') && j.doc.styles.length >= 3, `${local.suggestedFilename()} nodes=${Object.keys(j.doc.nodes).length} styles=${j.doc.styles.map((s) => s.name).join('|')}`);
} else check('Save local copy (.myflow)', false, 'no download');

// ---------- summary ----------
const nodesFinal = await allNodes();
const summary = {
  layers: nodesFinal.length,
  types: nodesFinal.reduce((a, x) => ((a[x.type] = (a[x.type] || 0) + 1), a), {}),
  styles: await st('s => s.doc.styles.map(x => ({ name: x.name, type: x.type }))'),
  checks, errors, findings,
};
writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(summary, null, 2));
log('layers', summary.layers, JSON.stringify(summary.types));
log('errors', JSON.stringify(errors));
log(`checks: ${checks.filter((c) => c.ok).length}/${checks.length} pass`);
await browser.close();
