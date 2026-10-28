// Agent 09 — Weather widgets (glass) + developer handoff, built through the My Flow UI.
import { chromium } from '@playwright/test';
import { writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('designs/agent-09');
mkdirSync(OUT, { recursive: true });
const STOP = process.env.STOP || '';
const log = (...a) => console.log('[agent09]', ...a);
const findings = [];
const note = (s) => { findings.push(s); log('NOTE:', s); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|picsum|Failed to load resource/.test(m.text())) errors.push(m.text()); });

const st = (fn) => page.evaluate(`(() => { const s = window.__myflow.get(); return (${fn})(s); })()`);
const sel = () => st('s => s.selection');
const node = (id) => st(`s => s.doc.nodes[${JSON.stringify(id)}]`);
const blur = () => page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
const wait = (ms) => page.waitForTimeout(ms);
let canvasBox;

async function view(cx, cy, zoom = 1) {
  await page.evaluate(({ cx, cy, zoom, b }) => {
    window.__myflow.get().setState({ zoom, panX: b.x + b.width / 2 - cx * zoom, panY: b.y + b.height / 2 - cy * zoom });
  }, { cx, cy, zoom, b: canvasBox });
  await wait(40);
}
async function toScreen(x, y) { return st(`s => ({ x: ${x} * s.zoom + s.panX, y: ${y} * s.zoom + s.panY })`); }
async function drag(a, b) {
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
}
async function setField(testId, value) {
  const f = page.getByTestId(testId).first();
  await f.click(); await f.fill(String(value)); await f.press('Enter');
  await wait(30);
}
async function pickTool(tool) {
  await blur();
  if (tool === 'star' || tool === 'polygon') {
    await page.getByTestId('tool-caret-shape').click();
    await page.getByTestId(`tool-menu-${tool}`).click();
  } else await page.keyboard.press(tool);
}
/** Draw a shape whose top-left is (ax, ay) in absolute world coords, then set exact geometry via the panel. */
async function shape(tool, ax, ay, w, h, rel) {
  await view(ax + w / 2, ay + h / 2, 1);
  await pickTool(tool);
  const a = await toScreen(ax, ay), b = await toScreen(ax + Math.max(w, 16), ay + Math.max(h, 16));
  await drag(a, b);
  const id = (await sel())[0];
  await setField('prop-w', w); await setField('prop-h', h);
  if (rel) { await setField('prop-x', rel.x); await setField('prop-y', rel.y); }
  return id;
}
async function fill(hex, opacity) {
  await setField('fills-hex-0', hex);
  if (opacity !== undefined) await setField('fills-opacity-0', opacity);
}
/** Create a text by clicking with the Text tool; style it and place it at parent-relative (rx, ry). */
async function text(str, ax, ay, rx, ry, { size = 14, weight = 400, color = 'FFFFFF', op } = {}) {
  await view(ax + 60, ay + 10, 1);
  await pickTool('t');
  const p = await toScreen(ax + 2, ay + 8);
  await page.mouse.click(p.x, p.y);
  await page.getByTestId('text-editor').waitFor();
  await page.keyboard.type(str);
  await page.keyboard.press('Escape');
  const id = (await sel())[0];
  await page.getByTestId('font-family').selectOption('Inter');
  await page.getByTestId('font-weight').selectOption(String(weight));
  await setField('font-size', size);
  await fill(color, op);
  await setField('prop-x', rx); await setField('prop-y', ry);
  return id;
}
async function revealRow(id) {
  if (await page.locator(`[data-layer="${id}"]`).count()) return;
  const chain = await st(`s => { const out = []; let n = s.doc.nodes[${JSON.stringify(id)}]; while (n && n.parentId) { out.unshift(n.parentId); n = s.doc.nodes[n.parentId]; } return out; }`);
  for (const a of chain) {
    if (await page.locator(`[data-layer="${id}"]`).count()) return;
    const r = page.locator(`[data-layer="${a}"]`);
    if (!(await r.count())) continue;
    const kids = await st(`s => s.doc.nodes[${JSON.stringify(a)}].children`);
    if (kids.length && !(await page.locator(`[data-layer="${kids[0]}"]`).count())) await r.locator('.twisty').click();
  }
}
async function selectRows(ids) {
  await blur();
  for (const id of ids) await revealRow(id);
  for (let i = 0; i < ids.length; i++) {
    const row = page.locator(`[data-layer="${ids[i]}"]`);
    await row.scrollIntoViewIfNeeded();
    await row.click(i === 0 ? {} : { modifiers: ['Meta'] });
  }
  await wait(40);
  const s = await sel();
  if (s.length !== ids.length || !ids.every((x) => s.includes(x))) throw new Error(`selectRows mismatch: want ${ids} got ${s}`);
}
async function rename(id, name) {
  const row = page.locator(`[data-layer="${id}"]`);
  await row.scrollIntoViewIfNeeded();
  await row.locator('span.name').dblclick();
  const inp = page.getByTestId('layer-rename-input');
  await inp.fill(name); await inp.press('Enter');
  await wait(30);
}
async function addShadowAndBlur({ shadow = true, bgBlur = 40 } = {}) {
  let i = 0;
  if (shadow) {
    await page.getByTestId('add-effect').click();
    await page.getByTestId(`effect-settings-${i}`).click();
    await setField('effect-y', 16); await setField('effect-blur', 40);
    await page.keyboard.press('Escape');
    i++;
  }
  await page.getByTestId('add-effect').click();
  await page.getByTestId(`effect-type-${i}`).selectOption('BACKGROUND_BLUR');
  await page.getByTestId(`effect-settings-${i}`).click();
  await setField('effect-blur', bgBlur);
  await page.keyboard.press('Escape');
}
async function glass(id, radius = 28) {
  await fill('FFFFFF', 18);
  await setField('prop-radius', radius);
  await page.getByTestId('add-strokes').click();
  await setField('strokes-hex-0', 'FFFFFF');
  await setField('strokes-opacity-0', 30);
  await setField('stroke-weight', 1);
  await addShadowAndBlur();
}
async function autoLayout(ids) {
  await selectRows(ids);
  await page.keyboard.press('Shift+A');
  await wait(60);
  return (await sel())[0];
}
async function sun(ax, ay, size, parentAbs) {
  // star rays + ellipse core
  const starId = await shape('star', ax, ay, size, size, { x: ax - parentAbs.x, y: ay - parentAbs.y });
  await setField('point-count', 12);
  await setField('star-ratio', 72);
  await fill('FFB238');
  const core = Math.round(size * 0.56), off = (size - core) / 2;
  const coreId = await shape('o', ax + off, ay + off, core, core, { x: ax + off - parentAbs.x, y: ay + off - parentAbs.y });
  await fill('FFE27A');
  await selectRows([starId, coreId]);
  await page.keyboard.press('Meta+g');
  const g = (await sel())[0];
  await rename(g, 'Sun');
  return g;
}
async function cloud(ax, ay, w, h, parentAbs, name = 'Cloud') {
  // 3 puffs + base, unioned
  const parts = [
    [0.00, 0.30, 0.38, 0.62],
    [0.22, 0.00, 0.50, 0.82],
    [0.56, 0.22, 0.42, 0.66],
    [0.04, 0.52, 0.92, 0.48],
  ];
  const ids = [];
  for (const [px, py, pw, ph] of parts) {
    const x = Math.round(ax + px * w), y = Math.round(ay + py * h), ww = Math.round(pw * w), hh = Math.round(ph * h);
    ids.push(await shape('o', x, y, ww, hh, { x: x - parentAbs.x, y: y - parentAbs.y }));
  }
  await selectRows(ids);
  await page.keyboard.press('Alt+Shift+U');
  await wait(60);
  const u = (await sel())[0];
  const un = await node(u);
  if (un.type !== 'BOOLEAN_OPERATION' || un.booleanOp !== 'UNION') note(`Union shortcut produced ${un.type}/${un.booleanOp}`);
  await fill('FFFFFF', 96);
  await rename(u, name);
  return u;
}

try {
  // ------------------------------------------------------------- new file
  await page.goto('http://localhost:5390/');
  await page.getByTestId('new-design-file').click();
  await page.getByTestId('canvas').waitFor();
  await wait(300);
  canvasBox = await page.getByTestId('canvas').boundingBox();
  await page.getByTestId('file-name').click();
  await page.getByTestId('file-name-input').fill('Weather Widgets — Glass');
  await page.getByTestId('file-name-input').press('Enter');

  // ------------------------------------------------------------- section + background frame
  await view(460, 280, 0.6);
  await blur();
  await page.keyboard.press('Shift+S');
  await drag(await toScreen(-80, -120), await toScreen(1162, 700));
  const sectionId = (await sel())[0];
  log('section', (await node(sectionId)).type);
  await setField('prop-w', 1242); await setField('prop-h', 820);
  await rename(sectionId, 'Weather Widgets – Handoff');

  await blur();
  await page.keyboard.press('f');
  await drag(await toScreen(0, 0), await toScreen(1082, 600));
  const bgId = (await sel())[0];
  await setField('prop-x', 80); await setField('prop-y', 120); // relative to section
  await setField('prop-w', 1082); await setField('prop-h', 600);
  await setField('prop-radius', 32);
  await rename(bgId, 'Widgets Canvas');
  log('bg parent is section:', (await node(bgId)).parentId === sectionId);
  // gradient fill
  await page.getByTestId('fills-swatch-0').click();
  await page.getByTestId('paint-type').selectOption('GRADIENT_LINEAR');
  await page.getByTestId('grad-stop-0').click();
  await page.getByTestId('hex-input').fill('3F5EFB'); await page.getByTestId('hex-input').press('Enter');
  await page.getByTestId('grad-stop-1').click();
  await page.getByTestId('hex-input').fill('C450D8'); await page.getByTestId('hex-input').press('Enter');
  const angle = page.locator('[data-testid="gradient-editor"] input').first();
  await angle.click(); await angle.fill('135'); await angle.press('Enter');
  await page.keyboard.press('Escape');
  const bgFill = (await node(bgId)).fills[0];
  log('bg fill', JSON.stringify(bgFill));
  if (bgFill.stops?.[0]?.color?.toUpperCase() !== '#3F5EFB' || bgFill.stops?.[1]?.color?.toUpperCase() !== '#C450D8') note('Gradient stop colors did not apply as typed: ' + JSON.stringify(bgFill.stops));
  const BG = { x: 0, y: 0 };

  // decorative colour blobs (layer blur) so the glass has something to blur
  for (const [x, y, w, c] of [[-60, 330, 380, 'FF8FB1'], [780, -120, 420, '5EE7F2'], [440, 150, 240, 'FFD36E']]) {
    const sx = Math.max(x, 4), sy = Math.max(y, 4);
    await shape('o', sx, sy, w, w, { x, y });
    await fill(c, 85);
    await page.getByTestId('add-effect').click();
    await page.getByTestId('effect-type-0').selectOption('LAYER_BLUR');
    await page.getByTestId('effect-settings-0').click();
    await setField('effect-blur', 120);
    await page.keyboard.press('Escape');
    await rename((await sel())[0], 'Glow ' + c);
  }

  await text('Weather', 60, 36, 60, 36, { size: 30, weight: 700 });
  await text('Glass widgets · Small, Medium & Large', 60, 80, 60, 80, { size: 14, weight: 500, op: 78 });

  // ------------------------------------------------------------- SMALL widget
  const SM = { x: 60, y: 226 };
  await view(SM.x + 85, SM.y + 85, 1); await blur(); await page.keyboard.press('f');
  await drag(await toScreen(SM.x, SM.y), await toScreen(SM.x + 170, SM.y + 170));
  const smallId = (await sel())[0];
  await setField('prop-x', SM.x); await setField('prop-y', SM.y); await setField('prop-w', 170); await setField('prop-h', 170);
  await glass(smallId);
  await rename(smallId, 'Widget / Small');
  await text('Cupertino', SM.x + 16, SM.y + 16, 16, 16, { size: 14, weight: 600 });
  await text('72°', SM.x + 14, SM.y + 40, 14, 36, { size: 46, weight: 300 });
  await text('Sunny', SM.x + 16, SM.y + 116, 16, 116, { size: 13, weight: 600 });
  await text('H:78°  L:58°', SM.x + 16, SM.y + 138, 16, 137, { size: 13, weight: 500, op: 80 });
  await sun(SM.x + 116, SM.y + 14, 40, SM);

  // ------------------------------------------------------------- MEDIUM widget
  const MD = { x: 262, y: 226 };
  await view(MD.x + 182, MD.y + 85, 1); await blur(); await page.keyboard.press('f');
  await drag(await toScreen(MD.x, MD.y), await toScreen(MD.x + 364, MD.y + 170));
  const medId = (await sel())[0];
  await setField('prop-x', MD.x); await setField('prop-y', MD.y); await setField('prop-w', 364); await setField('prop-h', 170);
  await glass(medId);
  await rename(medId, 'Widget / Medium');
  await text('Cupertino', MD.x + 18, MD.y + 16, 18, 16, { size: 15, weight: 600 });
  await text('68°', MD.x + 16, MD.y + 40, 16, 34, { size: 54, weight: 300 });
  await text('Partly Cloudy', MD.x + 18, MD.y + 116, 18, 116, { size: 13, weight: 600 });
  await text('H:74°  L:55°', MD.x + 18, MD.y + 138, 18, 137, { size: 13, weight: 500, op: 80 });
  const mSun = await sun(MD.x + 252, MD.y + 18, 60, MD);
  const mCloud = await cloud(MD.x + 222, MD.y + 56, 110, 70, MD);
  await selectRows([mSun, mCloud]);
  await page.keyboard.press('Meta+g');
  await rename((await sel())[0], 'Icon / Partly Cloudy');

  // ------------------------------------------------------------- LARGE widget
  const LG = { x: 658, y: 120 };
  await view(LG.x + 182, LG.y + 191, 1); await blur(); await page.keyboard.press('f');
  await drag(await toScreen(LG.x, LG.y), await toScreen(LG.x + 364, LG.y + 382));
  const largeId = (await sel())[0];
  await setField('prop-x', LG.x); await setField('prop-y', LG.y); await setField('prop-w', 364); await setField('prop-h', 382);
  await glass(largeId);
  await rename(largeId, 'Widget / Large');

  const pin = await shape('polygon', LG.x + 20, LG.y + 24, 11, 11, { x: 20, y: 24 });
  await setField('point-count', 3);
  await fill('FFFFFF');
  await rename(pin, 'Location');
  const city = await text('San Francisco', LG.x + 38, LG.y + 18, 38, 18, { size: 17, weight: 600 });
  const temp = await text('64°', LG.x + 20, LG.y + 46, 20, 44, { size: 60, weight: 300 });
  const cond = await text('Mostly Cloudy', LG.x + 20, LG.y + 120, 20, 120, { size: 14, weight: 600 });
  const hilo = await text('H:68°  L:52°', LG.x + 20, LG.y + 142, 20, 141, { size: 14, weight: 500, op: 80 });
  const lSun = await sun(LG.x + 268, LG.y + 18, 54, LG);
  const lCloud = await cloud(LG.x + 220, LG.y + 50, 124, 78, LG);
  await selectRows([lSun, lCloud]);
  await page.keyboard.press('Meta+g');
  const lIcon = (await sel())[0];
  await rename(lIcon, 'Icon / Mostly Cloudy');
  const divider = await shape('r', LG.x + 20, LG.y + 178, 324, 1, { x: 20, y: 178 });
  await fill('FFFFFF', 30);
  await rename(divider, 'Divider');
  const fLabel = await text('5-DAY FORECAST', LG.x + 20, LG.y + 192, 20, 192, { size: 11, weight: 700, op: 70 });

  const days = [
    ['Mon', 'sun', '70°', '56°'], ['Tue', 'cloud', '67°', '54°'], ['Wed', 'rain', '61°', '51°'],
    ['Thu', 'sun', '72°', '57°'], ['Fri', 'cloud', '69°', '55°'],
  ];
  const cols = [];
  for (let i = 0; i < days.length; i++) {
    const [d, kind, hi, lo] = days[i];
    const cx = LG.x + 20 + i * 70, cy = LG.y + 220;
    const t1 = await text(d, cx, cy, cx - LG.x, 220, { size: 13, weight: 600 });
    let ic;
    if (kind === 'sun') { ic = await shape('star', cx + 2, cy + 24, 24, 24, { x: cx + 2 - LG.x, y: 244 }); await setField('point-count', 10); await setField('star-ratio', 70); await fill('FFC542'); }
    else { ic = await shape('o', cx + 2, cy + 24, 24, 24, { x: cx + 2 - LG.x, y: 244 }); await fill(kind === 'rain' ? '7CC4FF' : 'EEF2FF', kind === 'rain' ? 100 : 92); }
    await rename(ic, `Icon ${d}`);
    const t2 = await text(hi, cx, cy + 56, cx - LG.x, 276, { size: 15, weight: 600 });
    const t3 = await text(lo, cx, cy + 78, cx - LG.x, 298, { size: 13, weight: 500, op: 65 });
    const col = await autoLayout([t1, ic, t2, t3]);
    await page.getByTestId('al-vertical').click();
    await setField('al-gap', 9);
    await setField('al-pad-h', 0); await setField('al-pad-v', 0);
    await page.getByTestId('al-align-1').click();
    await rename(col, `Day / ${d}`);
    cols.push(col);
  }
  const row = await autoLayout(cols);
  await page.getByTestId('al-horizontal').click();
  await setField('al-pad-h', 0); await setField('al-pad-v', 0);
  await rename(row, '5-Day Forecast');
  log('row layout', JSON.stringify((await node(row)).layout));

  // header auto layout: [Location ▲ + City] → info stack → header
  const cityRow = await autoLayout([pin, city]);
  await page.getByTestId('al-horizontal').click();
  await setField('al-gap', 6); await setField('al-pad-h', 0); await setField('al-pad-v', 0);
  await page.getByTestId('al-align-3').click();
  await rename(cityRow, 'City');
  const info = await autoLayout([cityRow, temp, cond, hilo]);
  await page.getByTestId('al-vertical').click();
  await setField('al-gap', 2); await setField('al-pad-h', 0); await setField('al-pad-v', 0);
  await rename(info, 'Now');
  const header = await autoLayout([info, lIcon]);
  await page.getByTestId('al-horizontal').click();
  await setField('al-pad-h', 0); await setField('al-pad-v', 0);
  await rename(header, 'Header');

  // whole Large widget becomes a vertical auto layout card
  await selectRows([largeId]);
  await page.keyboard.press('Shift+A');
  await wait(60);
  await page.getByTestId('al-vertical').click();
  await setField('al-pad-h', 20); await setField('al-pad-v', 20); await setField('al-gap', 16);
  await page.getByTestId('sizing-H').selectOption('FIXED'); await setField('prop-w', 364);
  await page.getByTestId('sizing-V').selectOption('FIXED'); await setField('prop-h', 382);
  for (const id of [header, divider, row]) {
    await selectRows([id]);
    await page.getByTestId('sizing-H').selectOption('FILL');
    if (id === header || id === row) await page.getByTestId('al-spacing-mode').selectOption('auto');
  }
  await selectRows([divider]); await setField('prop-h', 1);
  log('large', JSON.stringify((await node(largeId)).layout), (await node(largeId)).width, (await node(largeId)).height);

  // captions under each widget
  await text('Small · 170 × 170', 60, 412, 60, 412, { size: 12, weight: 500, op: 72 });
  await text('Medium · 364 × 170', 262, 412, 262, 412, { size: 12, weight: 500, op: 72 });
  await text('Large · 364 × 382', 658, 518, 658, 518, { size: 12, weight: 500, op: 72 });

  // ------------------------------------------------------------- canvas screenshot
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await view(540, 280, 0.82);
  { const e = await toScreen(540, -170); await blur(); await page.mouse.click(e.x, e.y); }
  log('selection after empty click', JSON.stringify(await sel()));
  await wait(300);
  await page.screenshot({ path: path.join(OUT, 'canvas.png') });
  if (STOP === 'design') throw new Error('STOP after design');

  // ------------------------------------------------------------- design review comment thread
  await blur();
  await page.keyboard.press('c');
  await page.getByTestId('comments-panel').waitFor();
  const cp = await toScreen(LG.x + 300, LG.y + 330);
  await page.mouse.click(cp.x, cp.y);
  await page.getByTestId('comment-input').fill('Design review: the low temps in the 5-day row feel faint on the purple end of the gradient. Can we confirm contrast before handoff?');
  await page.getByTestId('comment-input').press('Enter');
  await page.getByTestId('comment-thread').waitFor();
  await page.getByTestId('comment-reply-input').fill('Checked: lows stay at 65% white over the glass (blur 40). Added a Dev Mode annotation so engineering keeps the token.');
  await page.getByTestId('comment-reply-submit').click();
  await wait(100);
  const cTexts = await page.getByTestId('comment-text').count();
  await page.screenshot({ path: path.join(OUT, 'comment-thread.png') });
  await page.getByTestId('comment-resolve').click();
  await wait(100);
  const comments = await st('s => s.doc.comments');
  log('comments', JSON.stringify(comments.map((c) => ({ resolved: c.resolved, replies: c.replies.length, nodeId: c.nodeId }))));
  await page.getByTestId('close-comments').click().catch(() => {});
  await page.keyboard.press('Escape');

  // ------------------------------------------------------------- Dev Mode handoff
  await blur();
  await page.keyboard.press('Shift+D');
  await page.getByTestId('dev-panel').waitFor();
  const devRes = { cTexts, comments: comments.map((c) => ({ resolved: c.resolved, replies: c.replies.length })) };
  // ready for dev: section + background frame
  for (const id of [sectionId, bgId]) {
    await selectRows([id]);
    await page.getByTestId('dev-status').selectOption('READY');
    await page.getByTestId('ready-status').waitFor();
  }
  devRes.status = { section: (await node(sectionId)).devStatus, bg: (await node(bgId)).devStatus };
  // nested widget frame: is status available?
  await selectRows([largeId]);
  devRes.widgetStatusControl = await page.getByTestId('dev-status').count();
  // two annotations on the Large widget
  for (const a of ['Glass card: fill #FFFFFF @18%, 1px #FFFFFF @30% inside stroke, background blur 40 (backdrop-filter: blur(20px)), radius 28.',
                   '5-Day Forecast is a horizontal auto layout (space-between); each day is a vertical stack, gap 9 — map to HStack / Row.']) {
    await page.getByTestId('annotation-input').fill(a);
    await page.getByTestId('annotation-input').press('Enter');
    await wait(60);
  }
  devRes.annotations = (await node(largeId)).annotations?.map((x) => x.text);
  // code in 4 languages
  devRes.code = {};
  for (const lang of ['CSS', 'TAILWIND', 'SWIFTUI', 'COMPOSE']) {
    await page.getByTestId('code-lang').selectOption(lang);
    await wait(60);
    devRes.code[lang] = await page.getByTestId('code-block').innerText();
    writeFileSync(path.join(OUT, `code-large-${lang.toLowerCase()}.txt`), devRes.code[lang]);
  }
  await page.getByTestId('code-lang').selectOption('SWIFTUI');
  await page.getByTestId('code-section').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, 'devmode-swiftui.png') });
  await page.getByTestId('code-lang').selectOption('CSS');
  await page.evaluate(() => { let el = document.querySelector('[data-testid="dev-panel"]'); while (el) { if (el.scrollHeight > el.clientHeight + 4) el.scrollTop = 0; el = el.parentElement; } });
  await page.getByTestId('code-section').scrollIntoViewIfNeeded();
  await wait(100);
  await page.screenshot({ path: path.join(OUT, 'devmode.png') });
  // also check the forecast row code
  await selectRows([row]);
  devRes.rowCss = await page.getByTestId('code-block').innerText();
  writeFileSync(path.join(OUT, 'code-forecast-row-css.txt'), devRes.rowCss);
  // asset export from Dev Mode
  devRes.assets = [];
  for (const [id, fmt] of [[largeId, 'PNG'], [largeId, 'SVG'], [lCloud, 'SVG'], [lSun, 'PNG']]) {
    await selectRows([id]);
    const dl = page.waitForEvent('download', { timeout: 15000 });
    await page.getByTestId(`dev-export-${fmt}`).click();
    const d = await dl;
    const name = 'asset-' + d.suggestedFilename().replace(/[^\w.\-]+/g, '_');
    await d.saveAs(path.join(OUT, name));
    devRes.assets.push(name);
  }
  // ready list when nothing selected
  { const e = await toScreen(540, -170); await blur(); await page.mouse.click(e.x, e.y); }
  await wait(150);
  devRes.readyListSelection = await sel();
  await page.screenshot({ path: path.join(OUT, 'devmode-ready-list.png') });
  writeFileSync(path.join(OUT, 'devmode-results.json'), JSON.stringify(devRes, null, 2));
  log('dev', JSON.stringify({ ...devRes, code: Object.fromEntries(Object.entries(devRes.code).map(([k, v]) => [k, v.length])) }));
  await page.getByTestId('mode-design').click();
  await wait(100);

  // ------------------------------------------------------------- PNG export via Export button
  await selectRows([bgId]);
  await page.getByTestId('add-export').click();
  const dl = page.waitForEvent('download', { timeout: 20000 });
  await page.getByTestId('export-btn').click();
  const d = await dl;
  await d.saveAs(path.join(OUT, 'design.png'));
  log('export', d.suggestedFilename());

  // ------------------------------------------------------------- Save local copy
  const dl2 = page.waitForEvent('download', { timeout: 15000 });
  await page.getByTestId('main-menu-btn').click();
  await page.getByTestId('menu-file').hover();
  await page.getByTestId('cmd-file.saveLocal').click();
  const d2 = await dl2;
  await d2.saveAs(path.join(OUT, 'design.myflow'));
  log('saved', d2.suggestedFilename());

  // ------------------------------------------------------------- summary stats
  const stats = await st(`s => { const ns = Object.values(s.doc.nodes); const c = {}; for (const n of ns) c[n.type] = (c[n.type]||0)+1;
    return { total: ns.length, byType: c, bgBlur: ns.filter(n => n.effects.some(e => e.type==='BACKGROUND_BLUR')).map(n=>n.name),
      layerBlur: ns.filter(n => n.effects.some(e => e.type==='LAYER_BLUR')).length,
      unions: ns.filter(n => n.type==='BOOLEAN_OPERATION').map(n => n.name + ':' + n.booleanOp + ':' + n.children.length),
      autoLayouts: ns.filter(n => n.layout && n.layout.mode !== 'NONE').map(n => n.name + ':' + n.layout.mode) }; }`);
  writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify({ stats, findings, errors }, null, 2));
  log('stats', JSON.stringify(stats));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+1');
  await wait(300);
  await page.screenshot({ path: path.join(OUT, 'canvas-fit.png') });
} catch (e) {
  console.error('FAILED', e);
  await page.screenshot({ path: path.join(OUT, 'failure.png') }).catch(() => {});
} finally {
  log('errors', JSON.stringify(errors));
  log('findings', JSON.stringify(findings));
  await browser.close();
}
