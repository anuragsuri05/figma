// Agent 07 — Instagram post + story set for a coffee brand ("Ember & Oak").
// Built entirely through the My Flow UI with Playwright.
import { chromium } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('designs/agent-07');
const URL = 'http://localhost:5390';
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

const checks = [];
const findings = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const note = (s) => { findings.push(s); console.log('NOTE  ' + s); };

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });

/* ------------------------------------------------------------------ generated photo */
// Render a top-down latte photo on a scratch canvas (not the app) and grab its PNG bytes.
async function makePhoto(w, h, seed) {
  const p = await context.newPage();
  await p.setContent('<canvas id="c"></canvas>');
  const dataUrl = await p.evaluate(({ w, h, seed }) => {
    let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const c = document.getElementById('c'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    // walnut table planks
    const plank = h / 5;
    for (let i = 0; i < 6; i++) {
      const lg = g.createLinearGradient(0, i * plank, 0, (i + 1) * plank);
      const base = [[92, 58, 36], [104, 66, 41], [86, 53, 33], [98, 62, 38], [110, 70, 44], [90, 56, 35]][i];
      lg.addColorStop(0, `rgb(${base.map((v) => v + 10).join(',')})`);
      lg.addColorStop(1, `rgb(${base.map((v) => v - 12).join(',')})`);
      g.fillStyle = lg; g.fillRect(0, i * plank, w, plank);
      for (let k = 0; k < 40; k++) {
        g.strokeStyle = `rgba(40,22,12,${0.05 + rnd() * 0.12})`; g.lineWidth = 1 + rnd() * 2.5;
        const y0 = i * plank + rnd() * plank; g.beginPath(); g.moveTo(0, y0);
        for (let x = 0; x <= w; x += 60) g.lineTo(x, y0 + Math.sin(x / (80 + rnd() * 90) + k) * 4);
        g.stroke();
      }
      g.fillStyle = 'rgba(25,12,6,0.55)'; g.fillRect(0, (i + 1) * plank - 3, w, 4);
    }
    const cx = w * 0.5, cy = h * 0.52, R = Math.min(w, h) * 0.36;
    // soft light from top-left
    const light = g.createRadialGradient(w * 0.2, h * 0.1, 10, w * 0.2, h * 0.1, w);
    light.addColorStop(0, 'rgba(255,220,170,0.35)'); light.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = light; g.fillRect(0, 0, w, h);
    // saucer shadow + saucer
    g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 60; g.shadowOffsetX = 24; g.shadowOffsetY = 30;
    g.fillStyle = '#EDE6DC'; g.beginPath(); g.arc(cx, cy, R * 1.32, 0, Math.PI * 2); g.fill(); g.restore();
    const sg = g.createRadialGradient(cx - R * 0.4, cy - R * 0.4, R * 0.2, cx, cy, R * 1.32);
    sg.addColorStop(0, '#FBF8F3'); sg.addColorStop(1, '#D9D0C4');
    g.fillStyle = sg; g.beginPath(); g.arc(cx, cy, R * 1.32, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(150,135,118,0.35)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R * 1.12, 0, Math.PI * 2); g.stroke();
    // handle
    g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 18; g.shadowOffsetX = 8; g.shadowOffsetY = 10;
    g.fillStyle = '#F6F2EC'; g.beginPath(); g.ellipse(cx + R * 1.12, cy + R * 0.12, R * 0.3, R * 0.16, 0.35, 0, Math.PI * 2); g.fill(); g.restore();
    // cup
    g.save(); g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 30; g.shadowOffsetX = 12; g.shadowOffsetY = 16;
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill(); g.restore();
    const cg = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R); cg.addColorStop(0, '#FFFFFF'); cg.addColorStop(1, '#E4DDD3');
    g.fillStyle = cg; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    // coffee
    const r2 = R * 0.84;
    const kg = g.createRadialGradient(cx, cy, r2 * 0.1, cx, cy, r2);
    kg.addColorStop(0, '#B97A45'); kg.addColorStop(0.65, '#94582D'); kg.addColorStop(0.92, '#5E3418'); kg.addColorStop(1, '#3E200E');
    g.fillStyle = kg; g.beginPath(); g.arc(cx, cy, r2, 0, Math.PI * 2); g.fill();
    // crema speckle
    for (let i = 0; i < 900; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * r2 * 0.95;
      g.fillStyle = `rgba(${rnd() > 0.5 ? '232,190,140' : '90,50,22'},${0.1 + rnd() * 0.2})`;
      g.beginPath(); g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1 + rnd() * 3, 0, Math.PI * 2); g.fill();
    }
    // latte-art rosetta heart
    g.save(); g.translate(cx, cy + r2 * 0.05);
    g.fillStyle = 'rgba(250,240,225,0.95)';
    for (let i = 0; i < 6; i++) {
      const k = 1 - i * 0.14, yy = -r2 * 0.05 + i * r2 * 0.1;
      g.beginPath(); g.moveTo(0, yy + r2 * 0.42 * k);
      g.bezierCurveTo(-r2 * 0.75 * k, yy + r2 * 0.0, -r2 * 0.45 * k, yy - r2 * 0.55 * k, 0, yy - r2 * 0.22 * k);
      g.bezierCurveTo(r2 * 0.45 * k, yy - r2 * 0.55 * k, r2 * 0.75 * k, yy, 0, yy + r2 * 0.42 * k);
      g.fill();
      g.fillStyle = i % 2 ? 'rgba(250,240,225,0.95)' : 'rgba(165,108,62,0.9)';
    }
    g.strokeStyle = 'rgba(250,240,225,0.9)'; g.lineWidth = r2 * 0.03; g.beginPath(); g.moveTo(0, -r2 * 0.55); g.lineTo(0, r2 * 0.55); g.stroke();
    g.restore();
    // highlight on coffee
    const hg = g.createRadialGradient(cx - r2 * 0.45, cy - r2 * 0.5, 2, cx - r2 * 0.45, cy - r2 * 0.5, r2 * 0.45);
    hg.addColorStop(0, 'rgba(255,255,255,0.28)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hg; g.beginPath(); g.arc(cx, cy, r2, 0, Math.PI * 2); g.fill();
    // coffee beans
    for (let i = 0; i < 14; i++) {
      let bx, by;
      do { bx = rnd() * w; by = rnd() * h; } while (Math.hypot(bx - cx, by - cy) < R * 1.45);
      g.save(); g.translate(bx, by); g.rotate(rnd() * Math.PI);
      g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 8; g.shadowOffsetX = 4; g.shadowOffsetY = 5;
      const bg = g.createRadialGradient(-6, -6, 2, 0, 0, 30); bg.addColorStop(0, '#6B3A1E'); bg.addColorStop(1, '#2B140A');
      g.fillStyle = bg; g.beginPath(); g.ellipse(0, 0, 26, 18, 0, 0, Math.PI * 2); g.fill();
      g.shadowColor = 'transparent'; g.strokeStyle = '#1A0B04'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-20, 0); g.bezierCurveTo(-6, -7, 6, 7, 20, 0); g.stroke();
      g.restore();
    }
    return c.toDataURL('image/png');
  }, { w, h, seed });
  await p.close();
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

const photo = await makePhoto(1200, 1200, 7);
writeFileSync(path.join(OUT, 'photo-generated.png'), photo);

/* ------------------------------------------------------------------ app helpers */
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|Failed to load resource/.test(m.text())) errors.push(m.text()); });

const S = (fn) => page.evaluate(`(() => { const s = window.__myflow.get(); return (${fn})(s); })()`);
const nodes = () => S('s => Object.values(s.doc.nodes)');
const byName = async (name) => (await nodes()).find((n) => n.name === name);
const selected = () => S('s => s.selection.map(id => s.doc.nodes[id])');
const view = (zoom, panX, panY) => page.evaluate(([z, x, y]) => window.__myflow.get().setState({ zoom: z, panX: x, panY: y }), [zoom, panX, panY]);
const scr = async (x, y) => S(`s => ({ x: ${x} * s.zoom + s.panX, y: ${y} * s.zoom + s.panY })`);
const wait = (ms = 120) => page.waitForTimeout(ms);
async function drag(a, b, mods = []) {
  for (const m of mods) await page.keyboard.down(m);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
  for (const m of mods) await page.keyboard.up(m);
  await wait();
}
async function drawW(key, x, y, w, h) { await page.keyboard.press(key); await drag(await scr(x, y), await scr(x + w, y + h)); }
async function field(id, v) { const f = page.getByTestId(id).first(); await f.click(); await f.fill(String(v)); await f.press('Enter'); await wait(60); }
async function geom(x, y, w, h) { if (w != null) await field('prop-w', w); if (h != null) await field('prop-h', h); await field('prop-x', x); await field('prop-y', y); }
async function layer(name, opts = {}) { await page.getByTestId(`layer-${name}`).first().click(opts); await wait(80); }
async function rename(oldName, newName) {
  await page.getByTestId(`layer-${oldName}`).first().dblclick();
  await page.getByTestId('layer-rename-input').fill(newName);
  await page.getByTestId('layer-rename-input').press('Enter');
  await wait(80);
}
async function renameSelected(newName) {
  const n = (await selected())[0];
  await rename(n.name, newName);
}
async function textLines(x, y, lines) {
  await page.keyboard.press('t');
  const p = await scr(x, y); await page.mouse.click(p.x, p.y); await wait();
  for (let i = 0; i < lines.length; i++) { if (i) await page.keyboard.press('Enter'); await page.keyboard.type(lines[i]); }
  await page.keyboard.press('Escape'); await wait();
}
async function textStyle({ family, weight, size, color, ls, lh, align }) {
  if (family) await page.getByTestId('font-family').selectOption(family);
  if (weight) await page.getByTestId('font-weight').selectOption(String(weight));
  if (size) await field('font-size', size);
  if (lh != null) await field('line-height', lh);
  if (ls != null) await field('letter-spacing', ls);
  if (align) await page.getByTestId(`text-align-${align}`).first().click();
  if (color) await field('fills-hex-0', color);
}
async function placeImage(x, y, w, h) {
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press(`${MOD}+Shift+k`);
  await (await chooser).setFiles({ name: 'latte.png', mimeType: 'image/png', buffer: photo });
  await wait(250);
  await drag(await scr(x, y), await scr(x + w, y + h));
  await page.waitForTimeout(500);
}
async function shot(name) { await page.screenshot({ path: path.join(OUT, name) }); }
async function menuCmd(menu, cmd) {
  await page.getByTestId('main-menu-btn').click();
  await page.getByTestId(`menu-${menu}`).hover();
  await page.getByTestId(`cmd-${cmd}`).click();
}

/* ------------------------------------------------------------------ open file */
await page.goto(URL);
await page.getByTestId('new-design-file').click();
await page.getByTestId('editor').waitFor();
await wait(300);
await page.getByTestId('file-name').click();
await page.getByTestId('file-name-input').fill('Ember & Oak — IG Set');
await page.getByTestId('file-name-input').press('Enter');
check('File renamed through file-name field', (await page.getByTestId('file-name').innerText()).includes('Ember'));

/* ================================================================== POST FRAME */
await view(0.5, 330, 70);
await drawW('f', 0, 0, 400, 400);
await page.getByTestId('frame-presets').click();
await page.getByTestId('menu-social-media').hover();
await page.getByText('Instagram post  1080×1350').click();
await wait();
let f = (await selected())[0];
check('Frame preset Social media → Instagram post = 1080×1350', f.width === 1080 && f.height === 1350, `${f.width}×${f.height}`);
await field('prop-x', 0); await field('prop-y', 0);
await field('fills-hex-0', 'F3E8D8');
await renameSelected('IG Post');

// decorative dark disc top-right (clipped by frame)
await drawW('o', 600, 60, 200, 200);
await geom(560, -260, 760, 760);
await field('fills-hex-0', '3A2216');
await renameSelected('Deco disc');

// warm accent ring bottom-left
await drawW('o', 60, 1100, 150, 150);
await geom(840, 1130, 440, 440);
await field('fills-hex-0', 'D9A066');
await renameSelected('Accent disc');

// circle that will become the photo mask (must be below the image)
await drawW('o', 180, 220, 300, 300);
await geom(150, 200, 700, 700);
await field('fills-hex-0', '000000');
await renameSelected('Photo circle');

// generated photo, dragged in over the circle
await placeImage(160, 220, 400, 400);
let img = (await selected())[0];
check('Generated PNG placed as image fill (⌘⇧K + drag)', img && img.fills[0]?.type === 'IMAGE', img?.name);
await geom(150, 200, 700, 700);
await renameSelected('Latte photo');

// select circle + photo via layers panel and Use as mask (⌃⌘M)
await layer('Photo circle');
await layer('Latte photo', { modifiers: ['Shift'] });
await page.keyboard.press(`Control+${MOD}+m`);
await wait();
let g = (await selected())[0];
let kids = (await nodes()).filter((n) => n.parentId === g?.id);
check('Use as mask (⌃⌘M) on circle + photo → masked group', g?.type === 'GROUP' && kids.some((k) => k.isMask && k.name === 'Photo circle'), `group "${g?.name}", children: ${kids.map((k) => k.name + (k.isMask ? '[mask]' : '')).join(', ')}`);
await renameSelected('Photo (masked)');

// brand logo text
await textLines(70, 70, ['EMBER & OAK']);
await textStyle({ family: 'Montserrat', weight: 800, size: 40, ls: 18, color: '2A1810' });
await field('prop-x', 70); await field('prop-y', 70);
await renameSelected('Logo');
await textLines(70, 125, ['COFFEE ROASTERS · EST. 2014']);
await textStyle({ family: 'Montserrat', weight: 500, size: 20, ls: 20, color: '8A5A3B' });
await field('prop-x', 72); await field('prop-y', 124);
await renameSelected('Logo tagline');

// headline
await textLines(70, 960, ['Brewed bold.', 'Sipped slow.']);
await textStyle({ family: 'Playfair Display', weight: 800, size: 118, lh: 124, color: '2A1810' });
await field('prop-x', 66); await field('prop-y', 950);
await renameSelected('Headline');

// subcopy
await textLines(70, 1220, ['The new Maple Oat Latte — in all stores this week.']);
await textStyle({ family: 'Inter', weight: 500, size: 32, color: '5B3A28' });
await field('prop-x', 72); await field('prop-y', 1222);
await renameSelected('Subcopy');

// promo badge: star + text, rotated
await page.keyboard.press('Escape');
await page.getByTestId('tool-caret-shape').click();
await page.getByTestId('tool-menu-star').click();
await drag(await scr(760, 200), await scr(900, 340));
let star = (await selected())[0];
check('Star tool creates STAR node', star?.type === 'STAR');
await geom(740, 150, 290, 290);
await field('point-count', 14);
await field('star-ratio', 82);
await field('fills-hex-0', 'D2462A');
await renameSelected('Badge star');
await textLines(800, 240, ['20%', 'OFF']);
await textStyle({ family: 'Montserrat', weight: 900, size: 64, lh: 62, align: 'center', color: 'FFF4E6' });
let bt = (await selected())[0];
await field('prop-x', 740 + (290 - bt.width) / 2); await field('prop-y', 150 + (290 - bt.height) / 2);
await renameSelected('Badge text');
await layer('Badge star', { modifiers: ['Shift'] });
await page.keyboard.press(`${MOD}+g`);
await wait();
await renameSelected('Promo badge');
await field('prop-rotation', -14);
let badge = await byName('Promo badge');
check('Rotation on badge group (prop-rotation −14°)', badge && Math.round(badge.rotation) === -14, `rotation=${badge?.rotation}`);

// lock background decoration, hide a draft layer
await layer('Deco disc');
await page.getByTestId('layer-Deco disc').hover();
await page.getByTestId('lock-Deco disc').click();
check('Lock via layers panel (Deco disc)', (await byName('Deco disc')).locked === true);
{
  // locked layer should not be selectable on canvas
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  const p = await scr(1060, 20); await page.mouse.click(p.x, p.y); await wait();
  const s = await selected();
  check('Locked layer not selectable on canvas', !s.some((n) => n.name === 'Deco disc'), `selected: ${s.map((n) => n.name).join(',') || 'none'}`);
}
// semi-transparent overlay with Multiply — drawn last (on top), then reordered in layers panel
await drawW('r', 10, 10, 300, 300);
await geom(0, 0, 1080, 1350);
await field('fills-hex-0', 'E0A060');
await field('prop-opacity', 35);
await page.getByTestId('prop-blend').selectOption('MULTIPLY');
await renameSelected('Warm overlay');
let ov = await byName('Warm overlay');
check('Overlay rectangle: blend Multiply + opacity 35%', ov.blendMode === 'MULTIPLY' && Math.abs(ov.opacity - 0.35) < 1e-6, `blend=${ov.blendMode}, opacity=${ov.opacity}`);

// reorder: drag "Warm overlay" row to just above "Photo (masked)" (below texts & badge)
{
  const post = await byName('IG Post');
  const before = (await S(`s => s.doc.nodes['${post.id}'].children.map(id => s.doc.nodes[id].name)`));
  const a = (await page.getByTestId('layer-Warm overlay').boundingBox());
  const b = (await page.getByTestId('layer-Photo (masked)').boundingBox());
  await drag({ x: a.x + 70, y: a.y + a.height / 2 }, { x: b.x + 70, y: b.y + 3 });
  const after = (await S(`s => s.doc.nodes['${post.id}'].children.map(id => s.doc.nodes[id].name)`));
  const iO = after.indexOf('Warm overlay'), iP = after.indexOf('Photo (masked)');
  check('Layers panel drag reorder (overlay moved directly above photo, below text)', iO === iP + 1 && iO < after.indexOf('Headline'), `before=[${before.join(' | ')}] after=[${after.join(' | ')}]`);
}

// draft alt-headline text that we hide
await textLines(70, 1290, ['ALT: Slow mornings, bold cups']);
await textStyle({ size: 24, color: '2A1810' });
await renameSelected('Draft headline (alt)');
await page.getByTestId('layer-Draft headline (alt)').hover();
await page.getByTestId('visibility-Draft headline (alt)').click();
check('Hide via layers panel eye (Draft headline)', (await byName('Draft headline (alt)')).visible === false);

await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
await shot('step-post.png');

/* ================================================================== STORY FRAME */
await view(0.38, 330 - 1200 * 0.38, 60);
await drawW('f', 1250, 100, 400, 400);
await page.getByTestId('frame-presets').click();
await page.getByTestId('menu-social-media').hover();
await page.getByText('Instagram story  1080×1920').click();
await wait();
f = (await selected())[0];
check('Frame preset Social media → Instagram story = 1080×1920', f.width === 1080 && f.height === 1920, `${f.width}×${f.height}`);
await field('prop-x', 1200); await field('prop-y', 0);
await field('fills-hex-0', '24140C');
await renameSelected('IG Story');
const SX = 1200;

// rounded rectangle mask shape
await drawW('r', SX + 100, 330, 300, 300);
await geom(80, 300, 920, 1060);
await field('prop-radius', 56);
await renameSelected('Story photo shape');
await placeImage(SX + 120, 340, 300, 300);
await geom(80, 300, 920, 1060);
await renameSelected('Story latte photo');
// flip the photo horizontally (Shift+H) for a mirrored composition
await page.keyboard.press('Shift+h');
let sp = await byName('Story latte photo');
check('Flip horizontal (Shift+H) on story photo', sp.flipX === true);
await layer('Story photo shape');
await layer('Story latte photo', { modifiers: ['Shift'] });
await page.getByTestId('use-mask').click(); // panel button variant of Use as mask
await wait();
g = (await selected())[0];
kids = (await nodes()).filter((n) => n.parentId === g?.id);
check('Use as mask (panel button) with rounded rectangle', g?.type === 'GROUP' && kids.some((k) => k.isMask), kids.map((k) => k.name + (k.isMask ? '[mask]' : '')).join(', '));
await renameSelected('Story photo (masked)');

// overlay gradient band at photo bottom: copy/paste properties from post overlay
await drawW('r', SX + 100, 1100, 300, 100);
await geom(80, 300, 920, 1060);
await renameSelected('Story overlay');
await layer('Warm overlay');
await page.keyboard.press(`${MOD}+Alt+c`);
await wait();
await layer('Story overlay');
await page.keyboard.press(`${MOD}+Alt+v`);
await wait();
{
  const so = await byName('Story overlay');
  const okFill = so.fills[0]?.color?.toUpperCase() === '#E0A060' && Math.abs(so.opacity - 0.35) < 1e-6;
  check('Copy/paste properties (⌘⌥C/⌘⌥V) overlay → fill + opacity', okFill, `fill=${so.fills[0]?.color}, opacity=${so.opacity}`);
  check('Copy/paste properties carries blend mode', so.blendMode === 'MULTIPLY', `blendMode=${so.blendMode ?? 'undefined'}`);
  if (so.blendMode !== 'MULTIPLY') { await page.getByTestId('prop-blend').selectOption('MULTIPLY'); }
}
await field('prop-opacity', 45);
await field('fills-hex-0', 'B86B34');
// drag the overlay row INTO the masked group so the mask clips it too
{
  const a = await page.getByTestId('layer-Story overlay').boundingBox();
  const b = await page.getByTestId('layer-Story photo (masked)').boundingBox();
  await drag({ x: a.x + 70, y: a.y + a.height / 2 }, { x: b.x + 70, y: b.y + b.height / 2 });
  const so = await byName('Story overlay'), grp = await byName('Story photo (masked)');
  check('Layers panel drag INTO masked group (overlay clipped by rounded mask)', so.parentId === grp.id, `parent=${so.parentId === grp.id ? 'Story photo (masked)' : so.parentId}`);
}

// logo (centered)
await textLines(SX + 300, 120, ['EMBER & OAK']);
await textStyle({ family: 'Montserrat', weight: 800, size: 44, ls: 18, color: 'F3E8D8' });
let lg = (await selected())[0];
await field('prop-x', Math.round((1080 - lg.width) / 2)); await field('prop-y', 150);
await renameSelected('Story logo');
await textLines(SX + 300, 230, ['COFFEE ROASTERS']);
await textStyle({ family: 'Montserrat', weight: 500, size: 22, ls: 30, color: 'D9A066' });
lg = (await selected())[0];
await field('prop-x', Math.round((1080 - lg.width) / 2)); await field('prop-y', 216);
await renameSelected('Story tagline');

// story headline: paste text properties from post headline, then recolor
await textLines(SX + 80, 1420, ['Your new', 'morning ritual.']);
await renameSelected('Story headline');
await layer('Headline');
await page.keyboard.press(`${MOD}+Alt+c`);
await layer('Story headline');
await page.keyboard.press(`${MOD}+Alt+v`);
await wait();
{
  const sh = await byName('Story headline'); const ph = await byName('Headline');
  check('Copy/paste properties text style (Headline → Story headline)', sh.text.fontSize === ph.text.fontSize && sh.text.fontFamily === ph.text.fontFamily && sh.text.fontWeight === ph.text.fontWeight && sh.text.characters.startsWith('Your new'),
    `size=${sh.text.fontSize}, family=${sh.text.fontFamily}, weight=${sh.text.fontWeight}, chars kept="${sh.text.characters.replace(/\n/g, ' / ')}"`);
}
await field('fills-hex-0', 'F3E8D8');
await field('prop-x', 80); await field('prop-y', 1420);

await textLines(SX + 80, 1700, ['Maple Oat Latte · 20% off all week']);
await textStyle({ family: 'Inter', weight: 500, size: 34, color: 'D9C3A8' });
await field('prop-x', 84); await field('prop-y', 1690);
await renameSelected('Story subcopy');

// CTA pill
await drawW('r', SX + 300, 1780, 300, 80);
await geom(300, 1776, 480, 96);
await field('prop-radius', 48);
await field('fills-hex-0', 'F3E8D8');
await renameSelected('CTA pill');
await textLines(SX + 400, 1800, ['Order ahead  →']);
await textStyle({ family: 'Montserrat', weight: 700, size: 32, color: '24140C' });
lg = (await selected())[0];
await field('prop-x', Math.round(300 + (480 - lg.width) / 2)); await field('prop-y', Math.round(1776 + (96 - lg.height) / 2));
await renameSelected('CTA label');

// badge: copy from post and paste into the story frame
await layer('Promo badge');
await page.keyboard.press(`${MOD}+c`);
await layer('IG Story');
await page.keyboard.press(`${MOD}+v`);
await wait(200);
let pasted = (await selected())[0];
const storyId = (await byName('IG Story')).id;
check('Copy/paste badge into story frame (⌘C, select frame, ⌘V)', pasted?.parentId === storyId, `pasted "${pasted?.name}" parent=${pasted?.parentId === storyId ? 'IG Story' : pasted?.parentId}`);
await field('prop-x', 700); await field('prop-y', 230);
await field('prop-rotation', 12);
await renameSelected('Story badge');
// flip the story badge's star vertically just to exercise flip-v on a star (symmetric, harmless)
await page.keyboard.press('Escape');

// lock the photo in the story, hide nothing else
await page.getByTestId('layer-Story photo (masked)').hover();
await page.getByTestId('lock-Story photo (masked)').click();
check('Lock via layers panel (Story photo)', (await byName('Story photo (masked)')).locked === true);

await page.keyboard.press('Escape'); await page.keyboard.press('Escape');

/* ------------------------------------------------------------------ overview */
await view(0.36, 290, 60);
await page.mouse.move(1150, 820);
await wait(300);
await shot('canvas.png');

/* ------------------------------------------------------------------ exports */
const saveDl = (dl, name) => dl.saveAs(path.join(OUT, name)).then(() => name);
async function exportFrame(frameName, outBase) {
  await layer(frameName);
  await page.getByTestId('add-export').click();
  await page.getByTestId('add-export').click();
  await page.getByTestId('export-format-1').selectOption('JPG');
  const dls = [];
  const h = (d) => dls.push(d);
  page.on('download', h);
  await page.getByTestId('export-btn').click();
  for (let i = 0; i < 50 && dls.length < 2; i++) await wait(200);
  page.off('download', h);
  const res = [];
  for (const d of dls) {
    const sug = d.suggestedFilename();
    const ext = sug.split('.').pop();
    const p = path.join(OUT, `${outBase}.${ext}`);
    await d.saveAs(p);
    res.push({ sug, p, buf: readFileSync(p) });
  }
  return res;
}
const postEx = await exportFrame('IG Post', 'design');
const storyEx = await exportFrame('IG Story', 'story');
const pngDims = (b) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });
const pp = postEx.find((r) => r.p.endsWith('.png')), pj = postEx.find((r) => r.p.endsWith('.jpg'));
const sp2 = storyEx.find((r) => r.p.endsWith('.png')), sj = storyEx.find((r) => r.p.endsWith('.jpg'));
check('Export post PNG via Export button', pp && pp.buf.subarray(1, 4).toString() === 'PNG', pp ? `${pp.sug} ${JSON.stringify(pngDims(pp.buf))}` : 'missing');
check('Export post JPG via Export button', pj && pj.buf[0] === 0xff && pj.buf[1] === 0xd8, pj?.sug ?? 'missing');
check('Export story PNG via Export button', sp2 && sp2.buf.subarray(1, 4).toString() === 'PNG', sp2 ? `${sp2.sug} ${JSON.stringify(pngDims(sp2.buf))}` : 'missing');
check('Export story JPG via Export button', sj && sj.buf[0] === 0xff && sj.buf[1] === 0xd8, sj?.sug ?? 'missing');

// save local copy
{
  const dl = page.waitForEvent('download');
  await menuCmd('file', 'file.saveLocal');
  const d = await dl;
  await d.saveAs(path.join(OUT, 'design.myflow'));
  const json = JSON.parse(readFileSync(path.join(OUT, 'design.myflow'), 'utf8'));
  const ns = Object.values(json.doc.nodes);
  check('Save local copy (.myflow) via Main menu → File', d.suggestedFilename().endsWith('.myflow') && ns.some((n) => n.isMask) && ns.some((n) => n.blendMode === 'MULTIPLY'), `${d.suggestedFilename()}, ${ns.length} nodes`);
}

/* ------------------------------------------------------------------ summary state */
const all = await nodes();
const summary = {
  nodeCount: all.length,
  byType: all.reduce((a, n) => ((a[n.type] = (a[n.type] || 0) + 1), a), {}),
  tree: await S(`s => { const out = []; const walk = (id, d) => { const n = s.doc.nodes[id]; out.push('  '.repeat(d) + n.name + ' [' + n.type + (n.isMask ? ',mask' : '') + (n.locked ? ',locked' : '') + (!n.visible ? ',hidden' : '') + (n.blendMode && n.blendMode !== 'PASS_THROUGH' && n.blendMode !== 'NORMAL' ? ',' + n.blendMode : '') + (n.opacity !== 1 ? ',op=' + n.opacity : '') + (n.rotation ? ',rot=' + n.rotation : '') + (n.flipX ? ',flipX' : '') + ']'); n.children.forEach(c => walk(c, d + 1)); }; s.doc.pages.find(p => p.id === s.pageId).children.forEach(id => walk(id, 0)); return out; }`),
  errors,
};
writeFileSync(path.join(OUT, 'checks.json'), JSON.stringify({ checks, findings, summary }, null, 2));
console.log(summary.tree.join('\n'));
console.log('errors:', errors);
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed`);
await browser.close();
