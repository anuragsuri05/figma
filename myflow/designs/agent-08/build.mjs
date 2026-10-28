// Agent 08 - 3-screen mobile onboarding flow, fully prototyped. Built only through the My Flow UI.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('designs/agent-08');
const BASE = 'http://localhost:5390';
const log = (...a) => console.log('[a08]', ...a);
const checks = [];
const check = (name, ok, note = '') => { checks.push({ name, ok: !!ok, note }); log(ok ? 'PASS' : 'FAIL', name, note); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|Failed to load resource/.test(m.text())) errors.push(m.text()); });

const st = (fn) => page.evaluate(`(() => { const s = window.__myflow.get(); return (${fn})(s); })()`);
const allNodes = () => st('s => Object.values(s.doc.nodes)');
const sel = () => st('s => s.selection.map(id => s.doc.nodes[id])');
const wait = (ms) => page.waitForTimeout(ms);
let Z = 0.8;
async function view(fx, fy = 0, zoom = 0.8) { Z = zoom; await page.evaluate(([fx, fy, z]) => window.__myflow.get().setState({ zoom: z, panX: 330 - fx * z, panY: 70 - fy * z }), [fx, fy, zoom]); await wait(60); }
const ws = (x, y) => st(`s => ({ x: ${x} * s.zoom + s.panX, y: ${y} * s.zoom + s.panY })`);
async function drag(a, b) { await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 }); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up(); }
async function setField(id, v) { const f = page.getByTestId(id).first(); await f.click(); await f.fill(String(v)); await f.press('Enter'); await wait(30); }
async function rename(name) {
  const row = page.locator('[data-testid="layers-section"] .layer.sel').first();
  await row.scrollIntoViewIfNeeded();
  await row.dblclick();
  await page.getByTestId('layer-rename-input').fill(name);
  await page.getByTestId('layer-rename-input').press('Enter');
  await wait(30);
}
async function blurAll() { await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); }

// absolute-world draw of a shape (key) and then exact local props
async function shape(key, abs, local, o = {}) {
  await blurAll();
  await page.keyboard.press(key);
  const a = await ws(abs.x, abs.y);
  const b = await ws(abs.x + Math.max(abs.w, 30), abs.y + Math.max(abs.h, 30));
  await drag(a, b);
  await wait(40);
  await applyProps(local, o);
  return (await sel())[0];
}
async function applyProps(local, o = {}) {
  if (local.w !== undefined) await setField('prop-w', local.w);
  if (local.h !== undefined) await setField('prop-h', local.h);
  if (local.x !== undefined) await setField('prop-x', local.x);
  if (local.y !== undefined) await setField('prop-y', local.y);
  if (o.radius !== undefined) await setField('prop-radius', o.radius);
  if (o.fill) await setField('fills-hex-0', o.fill);
  if (o.opacity !== undefined) await setField('prop-opacity', o.opacity);
  if (o.shadow) await page.getByTestId('add-effect').click();
  if (o.name) await rename(o.name);
}
async function text(absX, absY, str, local, o = {}) {
  await blurAll();
  await page.keyboard.press('t');
  const p = await ws(absX, absY);
  await page.mouse.click(p.x, p.y);
  await wait(60);
  await page.keyboard.type(str);
  await page.keyboard.press('Escape');
  await wait(60);
  const s = await sel();
  if (!s.length || s[0].type !== 'TEXT') log('WARN text not selected after Escape', str, s.map((x) => x.type));
  if (o.size) await setField('font-size', o.size);
  if (o.weight) { await page.getByTestId('font-weight').selectOption(String(o.weight)); await wait(30); }
  if (o.color) await setField('fills-hex-0', o.color);
  if (local.w !== undefined) await setField('prop-w', local.w);
  if (o.align) { await page.getByTestId(`text-align-${o.align}`).click(); await wait(30); }
  if (o.lh) await setField('line-height', o.lh);
  if (local.x !== undefined) await setField('prop-x', local.x);
  if (local.y !== undefined) await setField('prop-y', local.y);
  if (o.name) await rename(o.name);
  return (await sel())[0];
}

// ---------- open app, new file, rename ----------
await page.goto(BASE + '/');
await page.getByTestId('new-design-file').click();
await page.getByTestId('editor').waitFor();
await wait(300);
await page.getByTestId('file-name').click();
await page.getByTestId('file-name-input').fill('Habitly Onboarding');
await page.getByTestId('file-name-input').press('Enter');

const W = 393, H = 852, GAP = 80;
const FX = [0, W + GAP, 2 * (W + GAP)];
const MODAL = { x: 3 * (W + GAP), y: 0, w: 320, h: 300 };
const C = { bg: 'FFF8F1', ink: '1E1B4B', muted: '6B7280', primary: '4F46E5', dot: 'D6D3E8', white: 'FFFFFF' };

// ---------- frames ----------
const frameIds = [];
await view(0, 0, 0.35);
for (let i = 0; i < 3; i++) {
  await blurAll();
  await page.keyboard.press('f');
  await drag(await ws(FX[i], 0), await ws(FX[i] + 300, 600));
  await applyProps({ x: FX[i], y: 0, w: W, h: H }, { fill: C.bg, name: `Onboarding ${i + 1}` });
  frameIds.push((await sel())[0].id);
}
await blurAll();
await page.keyboard.press('f');
await drag(await ws(MODAL.x, 0), await ws(MODAL.x + 250, 250));
await applyProps({ x: MODAL.x, y: 0, w: MODAL.w, h: MODAL.h }, { fill: C.white, radius: 28, name: 'Welcome' });
const modalId = (await sel())[0].id;
log('frames', frameIds, modalId);

// ---------- screen content ----------
const screens = [
  { title: 'Track every habit', body: 'Check off daily rituals in one tap and\nsee your whole day at a glance.', blob: 'E0E7FF' },
  { title: 'Build real streaks', body: 'Small wins add up. Watch your streak\ngrow and keep the momentum going.', blob: 'FFE4D6' },
  { title: 'Reach your goals', body: 'Set a target, follow your plan and\ncelebrate every milestone you hit.', blob: 'D1FAE5' },
];
const dotX = [174 - 4, 196 - 4, 218 - 4];
const ids = { next: [], skip: [], back: [], get: null, letsgo: null };

for (let i = 0; i < 3; i++) {
  const fx = FX[i];
  await view(fx, 0, 0.8);
  const s = screens[i];
  // illustration backdrop blob
  await shape('o', { x: fx + 60, y: 160, w: 260, h: 260 }, { x: 46, y: 130, w: 300, h: 300 }, { fill: s.blob, name: 'Blob' });
  await shape('o', { x: fx + 300, y: 140, w: 40, h: 40 }, { x: 300, y: 128, w: 44, h: 44 }, { fill: i === 0 ? 'FBBF24' : i === 1 ? '34D399' : 'FF7A59', name: 'Accent dot' });
  await shape('o', { x: fx + 40, y: 380, w: 30, h: 30 }, { x: 52, y: 392, w: 24, h: 24 }, { fill: i === 0 ? 'FF7A59' : i === 1 ? '4F46E5' : 'FBBF24', name: 'Accent dot small' });

  if (i === 0) {
    // checklist card
    await shape('r', { x: fx + 110, y: 190, w: 170, h: 220 }, { x: 101, y: 180, w: 190, h: 210 }, { fill: C.white, radius: 22, shadow: true, name: 'Card' });
    for (let r = 0; r < 3; r++) {
      const y = 214 + r * 56;
      await shape('o', { x: fx + 125, y: y + 4, w: 30, h: 30 }, { x: 121, y, w: 28, h: 28 }, { fill: r < 2 ? '34D399' : 'E5E7EB', name: `Check ${r + 1}` });
      await shape('r', { x: fx + 170, y: y + 6, w: 90, h: 30 }, { x: 161, y: y + 4, w: r === 1 ? 80 : 108, h: 8 }, { fill: r < 2 ? 'C7D2FE' : 'E5E7EB', radius: 4, name: `Line ${r + 1}` });
      await shape('r', { x: fx + 170, y: y + 14, w: 60, h: 30 }, { x: 161, y: y + 18, w: 60, h: 6 }, { fill: 'EEF0F4', radius: 3, name: `Sub ${r + 1}` });
    }
  } else if (i === 1) {
    // streak bar chart card
    await shape('r', { x: fx + 100, y: 190, w: 190, h: 210 }, { x: 91, y: 180, w: 210, h: 210 }, { fill: C.white, radius: 22, shadow: true, name: 'Card' });
    const hs = [50, 80, 66, 112, 140];
    for (let b = 0; b < 5; b++) {
      const h = hs[b];
      await shape('r', { x: fx + 118 + b * 36, y: 280, w: 30, h: 60 }, { x: 113 + b * 36, y: 360 - h, w: 24, h }, { fill: b === 4 ? 'FF7A59' : 'FFC4AE', radius: 8, name: `Bar ${b + 1}` });
    }
    await shape('o', { x: fx + 120, y: 196, w: 40, h: 40 }, { x: 113, y: 196, w: 36, h: 36 }, { fill: 'FFF1EA', name: 'Flame bg' });
    await text(fx + 220, 300, '7', { x: 125, y: 199 }, { size: 22, weight: 700, color: 'FF7A59', name: 'Streak num' });
    await text(fx + 220, 330, 'day streak', { x: 157, y: 205 }, { size: 14, weight: 600, color: C.ink, name: 'Streak label' });
  } else {
    // target
    await shape('o', { x: fx + 110, y: 190, w: 170, h: 170 }, { x: 96, y: 180, w: 200, h: 200 }, { fill: C.white, shadow: true, name: 'Ring 1' });
    await shape('o', { x: fx + 140, y: 220, w: 110, h: 110 }, { x: 126, y: 210, w: 140, h: 140 }, { fill: '34D399', name: 'Ring 2' });
    await shape('o', { x: fx + 160, y: 240, w: 70, h: 70 }, { x: 156, y: 240, w: 80, h: 80 }, { fill: C.white, name: 'Ring 3' });
    await shape('o', { x: fx + 180, y: 260, w: 30, h: 30 }, { x: 180, y: 264, w: 32, h: 32 }, { fill: '059669', name: 'Bullseye' });
    await shape('r', { x: fx + 200, y: 150, w: 60, h: 30 }, { x: 196, y: 186, w: 96, h: 8 }, { fill: C.ink, radius: 4, name: 'Arrow shaft' });
    await shape('r', { x: fx + 290, y: 150, w: 30, h: 30 }, { x: 278, y: 176, w: 22, h: 28 }, { fill: 'FF7A59', radius: 4, name: 'Arrow fletch' });
  }

  // copy
  await text(fx + 40, 470, s.title, { w: 329, x: 32, y: 470 }, { size: 28, weight: 700, color: C.ink, align: 'center', name: 'Title' });
  await text(fx + 40, 530, s.body, { w: 329, x: 32, y: 518 }, { size: 16, weight: 400, color: C.muted, align: 'center', lh: 24, name: 'Body' });

  // pagination dots (shared names so Smart animate matches them)
  for (let d = 0; d < 3; d++) {
    await shape('o', { x: fx + 140 + d * 40, y: 640, w: 30, h: 30 }, { x: dotX[d], y: 664, w: 8, h: 8 }, { fill: C.dot, name: `Dot ${d + 1}` });
  }
  await shape('r', { x: fx + 150, y: 600, w: 40, h: 30 }, { x: dotX[i] - 6, y: 664, w: 20, h: 8 }, { fill: C.primary, radius: 4, name: 'Active dot' });

  // primary button (frame) with label
  await blurAll();
  await page.keyboard.press('f');
  await drag(await ws(fx + 40, 740), await ws(fx + 340, 790));
  await applyProps({ x: 32, y: 736, w: 329, h: 56 }, { fill: C.primary, radius: 16, name: i < 2 ? 'Next' : 'Get started' });
  const btn = (await sel())[0];
  if (i < 2) ids.next.push(btn.id); else ids.get = btn.id;
  const label = i < 2 ? 'Next' : 'Get started';
  await text(fx + 150, 755, label, { w: 329, x: 0, y: 17 }, { size: 17, weight: 600, color: C.white, align: 'center', name: 'Label' });

  // Skip (screens 1-2)
  if (i < 2) {
    await blurAll();
    await page.keyboard.press('f');
    await drag(await ws(fx + 300, 56), await ws(fx + 370, 96));
    await applyProps({ x: 305, y: 58, w: 64, h: 36 }, { fill: 'EEF0FF', radius: 18, name: 'Skip' });
    ids.skip.push((await sel())[0].id);
    await text(fx + 320, 70, 'Skip', { w: 64, x: 0, y: 9 }, { size: 15, weight: 600, color: C.primary, align: 'center', name: 'Skip label' });
  }
  // Back (screens 2-3)
  if (i > 0) {
    await blurAll();
    await page.keyboard.press('f');
    await drag(await ws(fx + 20, 56), await ws(fx + 70, 100));
    await applyProps({ x: 24, y: 58, w: 36, h: 36 }, { fill: 'EEF0FF', radius: 18, name: 'Back' });
    ids.back.push((await sel())[0].id);
    await text(fx + 35, 70, '‹', { w: 36, x: 0, y: 1 }, { size: 26, weight: 600, color: C.primary, align: 'center', name: 'Back icon' });
  }
  // brand mark top-left on screen 1
  if (i === 0) {
    await text(fx + 30, 66, 'habitly', { x: 28, y: 64 }, { size: 20, weight: 800, color: C.primary, name: 'Logo' });
  }
}

// ---------- Welcome modal content ----------
await view(MODAL.x, 0, 1);
await shape('o', { x: MODAL.x + 120, y: 30, w: 70, h: 70 }, { x: 124, y: 32, w: 72, h: 72 }, { fill: 'D1FAE5', name: 'Badge' });
await text(MODAL.x + 140, 50, '✓', { w: 72, x: 124, y: 48 }, { size: 32, weight: 700, color: '059669', align: 'center', name: 'Badge check' });
await text(MODAL.x + 30, 125, 'Welcome aboard!', { w: 280, x: 20, y: 124 }, { size: 22, weight: 700, color: C.ink, align: 'center', name: 'Modal title' });
await text(MODAL.x + 30, 165, 'Your first habit is waiting.\nLet’s make today count.', { w: 280, x: 20, y: 162 }, { size: 15, color: C.muted, align: 'center', lh: 22, name: 'Modal body' });
await blurAll();
await page.keyboard.press('f');
await drag(await ws(MODAL.x + 30, 225), await ws(MODAL.x + 290, 280));
await applyProps({ x: 24, y: 228, w: 272, h: 48 }, { fill: C.primary, radius: 14, name: 'Lets go' });
ids.letsgo = (await sel())[0].id;
await text(MODAL.x + 140, 240, 'Let’s go', { w: 272, x: 0, y: 14 }, { size: 16, weight: 600, color: C.white, align: 'center', name: 'Lets go label' });
await blurAll();
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');

// structural check
{
  const ns = await allNodes();
  const byId = Object.fromEntries(ns.map((n) => [n.id, n]));
  const orphans = ns.filter((n) => n.type !== 'FRAME' && !n.parentId);
  check('All shapes/text nested inside their frames', orphans.length === 0, orphans.map((o) => o.name).join(','));
  const labelsOk = [...ids.next, ids.get].every((id) => byId[id].children.length === 1 && byId[byId[id].children[0]].type === 'TEXT');
  check('Button labels nested in button frames', labelsOk);
  log('node count', ns.length);
}

// ---------- prototype wiring ----------
await page.getByTestId('tab-prototype').click();
async function selectLayerById(id) {
  // select via the layers panel row (expand ancestors if needed)
  let row = page.locator(`[data-testid="layers-section"] [data-layer="${id}"]`);
  if (!(await row.count())) {
    // expand parents through twisty clicks
    const chain = await st(`s => { const out=[]; let n=s.doc.nodes['${id}']; while(n && n.parentId){ out.unshift(n.parentId); n=s.doc.nodes[n.parentId]; } return out; }`);
    for (const pid of chain) {
      const r = page.locator(`[data-testid="layers-section"] [data-layer="${pid}"]`);
      const exp = await page.locator(`[data-testid="layers-section"] [data-layer="${pid}"] .twisty svg`).count();
      const kidVisible = await page.locator(`[data-testid="layers-section"] [data-layer="${(await st(`s => s.doc.nodes['${pid}'].children[0]`))}"]`).count();
      if (exp && !kidVisible) await r.locator('.twisty').click();
    }
    row = page.locator(`[data-testid="layers-section"] [data-layer="${id}"]`);
  }
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await wait(50);
}
async function addInteraction(nodeId, cfg) {
  await selectLayerById(nodeId);
  const before = (await sel())[0].reactions.length;
  await page.getByTestId('add-interaction').click();
  const i = before;
  await wait(50);
  if (!(await page.getByTestId(`trigger-${i}`).count())) await page.getByTestId(`reaction-toggle-${i}`).click();
  if (cfg.trigger) await page.getByTestId(`trigger-${i}`).selectOption(cfg.trigger);
  if (cfg.delay) await setField(`delay-${i}`, cfg.delay);
  if (cfg.action) await page.getByTestId(`action-${i}`).selectOption(cfg.action);
  if (cfg.dest) await page.getByTestId(`destination-${i}`).selectOption(cfg.dest);
  const box = page.getByTestId(`reaction-${i}`);
  if (cfg.closeOutside) await box.getByLabel('Close when clicking outside').check();
  if (cfg.overlayBg) await box.getByLabel('Add background behind overlay').check();
  if (cfg.anim) await page.getByTestId(`animation-${i}`).selectOption(cfg.anim);
  if (cfg.dir) await box.locator('.seg button', { hasText: cfg.dir }).click();
  if (cfg.easing) await page.getByTestId(`easing-${i}`).selectOption(cfg.easing);
  if (cfg.duration) await setField(`duration-${i}`, cfg.duration);
  const r = (await sel())[0].reactions[i];
  log('reaction', (await sel())[0].name, JSON.stringify(r));
  return r;
}

const rx = {};
rx.next1 = await addInteraction(ids.next[0], { action: 'NAVIGATE', dest: frameIds[1], anim: 'SMART_ANIMATE', easing: 'EASE_IN_OUT', duration: 350 });
rx.next2 = await addInteraction(ids.next[1], { action: 'NAVIGATE', dest: frameIds[2], anim: 'SMART_ANIMATE', easing: 'EASE_IN_OUT', duration: 350 });
rx.skip1 = await addInteraction(ids.skip[0], { action: 'NAVIGATE', dest: frameIds[2], anim: 'SLIDE_IN', dir: '←', easing: 'EASE_OUT', duration: 300 });
rx.skip2 = await addInteraction(ids.skip[1], { action: 'NAVIGATE', dest: frameIds[2], anim: 'SLIDE_IN', dir: '←', easing: 'EASE_OUT', duration: 300 });
rx.get = await addInteraction(ids.get, { action: 'OPEN_OVERLAY', dest: modalId, closeOutside: true, overlayBg: true, anim: 'DISSOLVE', easing: 'EASE_OUT', duration: 250 });
rx.back2 = await addInteraction(ids.back[0], { action: 'BACK', anim: 'SMART_ANIMATE', easing: 'EASE_IN_OUT', duration: 300 });
rx.back3 = await addInteraction(ids.back[1], { action: 'BACK', anim: 'SMART_ANIMATE', easing: 'EASE_IN_OUT', duration: 300 });
rx.letsgo = await addInteraction(ids.letsgo, { action: 'CLOSE_OVERLAY' });
rx.delay = await addInteraction(frameIds[0], { trigger: 'AFTER_DELAY', delay: 1500, action: 'NAVIGATE', dest: frameIds[1], anim: 'SMART_ANIMATE', easing: 'EASE_IN_OUT', duration: 350 });

check('Next 1 → Onboarding 2, Smart animate', rx.next1.destinationId === frameIds[1] && rx.next1.animation === 'SMART_ANIMATE');
check('Next 2 → Onboarding 3, Smart animate', rx.next2.destinationId === frameIds[2] && rx.next2.animation === 'SMART_ANIMATE');
check('Skip → Onboarding 3, Slide in', rx.skip1.destinationId === frameIds[2] && rx.skip1.animation === 'SLIDE_IN' && rx.skip2.animation === 'SLIDE_IN');
check('Get started → Open overlay Welcome (bg + close outside)', rx.get.action === 'OPEN_OVERLAY' && rx.get.destinationId === modalId && rx.get.closeOnOutside && rx.get.overlayBackground);
check('After delay 1500ms on Onboarding 1', rx.delay.trigger === 'AFTER_DELAY' && rx.delay.delay === 1500 && rx.delay.destinationId === frameIds[1]);
check('Back interactions on screens 2 and 3', rx.back2.action === 'BACK' && rx.back3.action === 'BACK');

// flow starting point on Onboarding 1 (frame still selected)
await selectLayerById(frameIds[0]);
await page.getByTestId('add-flow').click();
await wait(80);
await blurAll();
await page.keyboard.press('Escape');
await wait(80);
const flowInput = page.getByTestId('flow-Flow 1').locator('input');
let flowName = 'Flow 1';
if (await flowInput.count()) {
  await flowInput.fill('Onboarding');
  await flowInput.press('Tab');
  await wait(80);
  flowName = await st('s => s.doc.pages[0].flowStarts[0]?.name');
}
check('Named flow starting point "Onboarding"', flowName === 'Onboarding', `flowStarts[0].name=${flowName}`);

// prototype settings: device iPhone 16
await page.getByTestId('proto-device').selectOption('IPHONE_16');
await setField('proto-bg', '1B1A2E');
const pg = await st('s => ({ d: s.doc.pages[0].prototypeDevice, b: s.doc.pages[0].prototypeBackground, flows: s.doc.pages[0].flowStarts })');
check('Prototype panel: device iPhone 16 + background', pg.d === 'IPHONE_16' && pg.b === '#1B1A2E', JSON.stringify(pg));

// canvas screenshots
await view(0, 0, 0.42);
await page.evaluate(() => window.__myflow.get().setState({ panX: 260, panY: 60 }));
await wait(200);
await page.screenshot({ path: path.join(OUT, 'canvas-prototype.png') });
await page.getByTestId('tab-design').click();
await wait(200);
await page.screenshot({ path: path.join(OUT, 'canvas.png') });
await page.getByTestId('tab-prototype').click();

// ---------- PNG export of all frames ----------
const downloads = [];
let collect = false;
page.on('download', async (d) => { if (!collect) return; const p = path.join(OUT, 'multi-export', d.suggestedFilename()); fs.mkdirSync(path.dirname(p), { recursive: true }); await d.saveAs(p); downloads.push(d.suggestedFilename()); });
await page.getByTestId('tab-design').click();
const exportOne = async (id, file) => {
  await selectLayerById(id);
  const n = (await sel())[0];
  if (!n.exports.length) { await page.getByTestId('add-export').click(); await wait(40); }
  await page.getByTestId('export-scale-0').selectOption('2');
  const dl = page.waitForEvent('download', { timeout: 15000 });
  await page.getByTestId('export-btn').click();
  const d = await dl;
  await d.saveAs(path.join(OUT, file));
  return d.suggestedFilename();
};
const exported = [];
for (let i = 0; i < 3; i++) exported.push(await exportOne(frameIds[i], `onboarding-${i + 1}.png`));
exported.push(await exportOne(modalId, 'welcome-modal.png'));
fs.copyFileSync(path.join(OUT, 'onboarding-1.png'), path.join(OUT, 'design.png'));
check('PNG export of all 4 frames via Export button', exported.length === 4 && exported.every((f) => /\.png$/.test(f)), exported.join(', '));

// also try multi-select export
await selectLayerById(frameIds[0]);
for (const id of [frameIds[1], frameIds[2], modalId]) { await page.locator(`[data-testid="layers-section"] [data-layer="${id}"]`).click({ modifiers: ['ControlOrMeta'] }); }
const multiSel = (await sel()).length;
collect = true; const before = downloads.length;
if (await page.getByTestId('export-btn').count()) { await page.getByTestId('export-btn').click(); await wait(6000); }
log('multi-select export: selected', multiSel, 'downloads', downloads.length - before, downloads.slice(before));
checks.push({ name: 'Multi-select export of 4 frames in one click', ok: downloads.length - before >= 4, note: `selected ${multiSel}, got ${downloads.length - before} downloads: ${downloads.slice(before).join(', ')}` });
collect = false;
await page.keyboard.press('Escape');

// ---------- Save local copy ----------
{
  const dl = page.waitForEvent('download');
  await page.getByTestId('main-menu-btn').click();
  await page.getByTestId('menu-file').hover();
  await page.getByTestId('cmd-file.saveLocal').click();
  const d = await dl;
  await d.saveAs(path.join(OUT, 'design.myflow'));
  const json = JSON.parse(fs.readFileSync(path.join(OUT, 'design.myflow'), 'utf8'));
  const rcount = Object.values(json.doc.nodes).reduce((a, n) => a + n.reactions.length, 0);
  check('Save local copy (.myflow) contains reactions + flow', json.format === 'myflow' && rcount === 9 && json.doc.pages[0].flowStarts.length === 1, `reactions=${rcount}`);
}

// ---------- PRESENT ----------
await page.keyboard.press('Escape');
await page.getByTestId('tab-prototype').click();
await page.getByTestId('present-flow-Onboarding').click().catch(async () => { await page.getByTestId('present-btn').click(); });
await page.getByTestId('present').waitFor();
await page.getByTestId('present-screen').waitFor();
const frameName = () => page.getByTestId('present-frame-name').textContent();
const t0 = Date.now();
await wait(150);
await page.screenshot({ path: path.join(OUT, 'present-1.png') });
check('Present opens at flow start Onboarding 1', (await frameName()) === 'Onboarding 1');
const bezelOk = await page.evaluate(() => { const s = document.querySelector('[data-testid="present-screen"]'); return s && s.parentElement && getComputedStyle(s.parentElement).backgroundColor; });
log('bezel bg', bezelOk);
async function clickIn(lx, ly) {
  const sb = await page.getByTestId('present-screen').boundingBox();
  const sc = sb.width / W;
  await page.mouse.click(sb.x + lx * sc, sb.y + ly * sc);
}
// click Next before the 1.5s timer fires
await clickIn(196, 764);
await wait(120);
const midAnim = await page.evaluate(() => document.getAnimations().length);
log('animations running after Next click', midAnim, 'elapsed', Date.now() - t0);
await page.screenshot({ path: path.join(OUT, 'present-smart-animate-mid.png') });
await wait(500);
check('Click Next on screen 1 → Onboarding 2 (Smart animate ran)', (await frameName()) === 'Onboarding 2' && midAnim > 0, `animations=${midAnim}`);
await page.screenshot({ path: path.join(OUT, 'present-2.png') });
// Back
await clickIn(42, 76);
await wait(450);
check('Back button on screen 2 → Onboarding 1', (await frameName()) === 'Onboarding 1');
await page.screenshot({ path: path.join(OUT, 'present-back.png') });
// After delay auto-advance: just wait on screen 1
await wait(1700);
check('After delay (1500ms) auto-advances screen 1 → 2', (await frameName()) === 'Onboarding 2');
await page.screenshot({ path: path.join(OUT, 'present-after-delay.png') });
// Next on 2 → 3
await clickIn(196, 764);
await wait(500);
check('Click Next on screen 2 → Onboarding 3', (await frameName()) === 'Onboarding 3');
await page.screenshot({ path: path.join(OUT, 'present-3.png') });
// Get started → overlay
await clickIn(196, 764);
await wait(400);
const ov = await page.getByTestId('present-overlay').count();
await page.screenshot({ path: path.join(OUT, 'present-4-overlay.png') });
check('Get started opens Welcome overlay', ov === 1);
// close on outside click
await page.mouse.click(1380, 850);
await wait(250);
check('Overlay closes on outside click', (await page.getByTestId('present-overlay').count()) === 0);
// reopen and close with Let's go (Close overlay)
await clickIn(196, 764);
await wait(350);
{
  const ovs = page.locator('[data-testid="present-overlay"] [data-testid="present-screen"]');
  const b = await ovs.boundingBox();
  const sc = b.width / MODAL.w;
  await page.mouse.click(b.x + 160 * sc, b.y + 252 * sc);
  await wait(250);
  check('"Let\'s go" (Close overlay) closes the modal', (await page.getByTestId('present-overlay').count()) === 0);
}
// Back on 3 → previous (2)
await clickIn(42, 76);
await wait(450);
check('Back on screen 3 → Onboarding 2', (await frameName()) === 'Onboarding 2', await frameName());
// Skip on 2 → 3 with slide in
await clickIn(337, 76);
await wait(80);
const slideAnims = await page.evaluate(() => document.getAnimations().map((a) => a.effect && a.effect.getKeyframes && JSON.stringify(a.effect.getKeyframes()[0])).slice(0, 2));
await wait(450);
check('Skip on screen 2 → Onboarding 3 with Slide in', (await frameName()) === 'Onboarding 3' && slideAnims.some((k) => /translate/.test(k || '')), slideAnims.join(' | '));
await page.screenshot({ path: path.join(OUT, 'present-skip.png') });
// Restart with R
await page.keyboard.press('r');
await wait(200);
check('Restart (R) returns to Onboarding 1', (await frameName()) === 'Onboarding 1');
await page.screenshot({ path: path.join(OUT, 'present-restart.png') });
// Skip on 1 → 3 (before after-delay)
await clickIn(337, 76);
await wait(450);
check('Skip on screen 1 → Onboarding 3', (await frameName()) === 'Onboarding 3');
// flow selector
const flowSel = page.locator('.present-top select.present-select').first();
const opts = await flowSel.locator('option').allTextContents();
await flowSel.selectOption({ label: 'Onboarding' });
await wait(200);
check('Flow selector lists "Onboarding" and jumps to its start', opts.includes('Onboarding') && (await frameName()) === 'Onboarding 1', opts.join(','));
await page.screenshot({ path: path.join(OUT, 'present-flow-selector.png') });
// does the after-delay timer survive history reset? wait
await wait(1700);
log('after flow-select + 1.7s frame =', await frameName());
// hotspot hints
await page.getByLabel('Hotspot hints').check();
await wait(150);
await page.screenshot({ path: path.join(OUT, 'present-hotspots.png') });
await page.getByLabel('Hotspot hints').uncheck();
// keyboard arrows
await page.keyboard.press('ArrowRight');
await wait(150);
log('after ArrowRight frame =', await frameName());
// close
await page.getByTestId('present-close').click();
await page.getByTestId('editor').waitFor();
check('Close presentation returns to editor', await page.getByTestId('editor').isVisible());

fs.writeFileSync(path.join(OUT, 'checks.json'), JSON.stringify({ checks, errors, ids, frameIds, modalId }, null, 2));
log('errors', errors);
log(`${checks.filter((c) => c.ok).length}/${checks.length} passed`);
await browser.close();
