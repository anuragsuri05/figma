// Designer Agent 01 — Mobile Login & Sign-up, built only through the My Flow UI.
import { chromium } from '@playwright/test';
import { writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('designs/agent-01');
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
const checks = [];
const notes = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const note = (s) => { notes.push(s); console.log('NOTE', s); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|picsum|Failed to load resource/.test(m.text())) errors.push(m.text()); });

// ---------- helpers
const st = (fn) => page.evaluate(`(() => { const s = window.__myflow.get(); return (${fn})(s); })()`);
const allNodes = () => st('s => Object.values(s.doc.nodes)');
const sel = () => st('s => s.selection.map(id => s.doc.nodes[id])');
const sel0 = async () => (await sel())[0];
const byId = (id) => st(`s => s.doc.nodes[${JSON.stringify(id)}]`);
const byName = async (name) => (await allNodes()).find((n) => n.name === name);
const view = (zoom, panX, panY) => page.evaluate(([z, x, y]) => window.__myflow.get().setState({ zoom: z, panX: x, panY: y }), [zoom, panX, panY]);
const toScreen = (x, y) => st(`s => ({ x: ${x} * s.zoom + s.panX, y: ${y} * s.zoom + s.panY })`);
async function drag(a, b) {
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
}
async function draw(key, x, y, w, h) {
  await page.keyboard.press(key);
  await drag(await toScreen(x, y), await toScreen(x + w, y + h));
}
async function setField(id, v) {
  const f = page.getByTestId(id).first();
  await f.click(); await f.fill(String(v)); await f.press('Enter');
}
async function geom(x, y, w, h) {
  if (x != null) await setField('prop-x', x);
  if (y != null) await setField('prop-y', y);
  if (w != null) await setField('prop-w', w);
  if (h != null) await setField('prop-h', h);
}
async function rename(name) {
  const row = page.locator('.layer.sel').first();
  await row.scrollIntoViewIfNeeded();
  await row.dblclick();
  await page.getByTestId('layer-rename-input').fill(name);
  await page.getByTestId('layer-rename-input').press('Enter');
}
async function pick(name, shift = false) {
  const row = page.getByTestId(`layer-${name}`).first();
  if (!(await row.count())) {
    // expand collapsed ancestors in the layers panel (top-down)
    const chain = await st(`s => { const n = Object.values(s.doc.nodes).find(x => x.name === ${JSON.stringify(name)}); const out = []; let p = n && n.parentId; while (p) { out.unshift(s.doc.nodes[p].name); p = s.doc.nodes[p].parentId; } return out; }`);
    for (const a of chain) {
      const childVisible = async () => (await row.count()) > 0;
      if (await childVisible()) break;
      const tw = page.getByTestId(`twisty-${a}`).first();
      const svgDown = await tw.evaluate((el) => el.closest('.layer')?.nextElementSibling?.getAttribute('style')?.match(/padding-left: (\d+)/)?.[1]).catch(() => null);
      const myPad = await tw.evaluate((el) => el.closest('.layer')?.getAttribute('style')?.match(/padding-left: (\d+)/)?.[1]).catch(() => null);
      if (!(svgDown && myPad && Number(svgDown) > Number(myPad))) { note(`Layers panel: had to expand "${a}" manually to reach "${name}"`); await tw.click(); }
    }
  }
  await row.scrollIntoViewIfNeeded();
  await row.click({ modifiers: shift ? ['Shift'] : [] });
}
async function text(x, y, chars, { size = 16, weight = '400', color = '101828', name } = {}) {
  await page.keyboard.press('t');
  const p = await toScreen(x, y);
  await page.mouse.click(p.x, p.y);
  await page.keyboard.type(chars);
  await page.keyboard.press('Escape');
  await setField('font-size', size);
  await page.getByTestId('font-weight').selectOption(weight);
  await setField('fills-hex-0', color);
  if (name) await rename(name);
  return sel0();
}
async function stroke(hex, weight = 1) {
  await page.getByTestId('add-strokes').click();
  await setField('strokes-hex-0', hex);
  await setField('stroke-weight', weight);
}
async function selectOption(id, v) { await page.getByTestId(id).first().selectOption(v); }
async function presetIphone16() {
  await page.getByTestId('frame-presets').click();
  await page.getByTestId('menu-phone').hover();
  await page.getByText('iPhone 16  393×852').click();
}

// ---------- open & name file
await page.goto('http://localhost:5390/');
await page.getByTestId('new-design-file').click();
await page.getByTestId('canvas').waitFor();
await page.waitForTimeout(300);
await page.getByTestId('file-name').click();
await page.getByTestId('file-name-input').fill('Flowly — Login & Sign-up');
await page.getByTestId('file-name-input').press('Enter');
check('File renamed via left-panel file name', (await page.getByTestId('file-name').textContent())?.includes('Flowly'));

await view(0.8, 280, 50);

// ---------- Login frame (iPhone 16 preset)
await draw('f', 0, 0, 200, 200);
await presetIphone16();
let login = await sel0();
check('iPhone 16 preset → 393×852', login.width === 393 && login.height === 852, `${login.width}×${login.height}`);
await rename('Login');
await setField('fills-hex-0', 'FFFFFF');

// ---------- Main component: Button/Primary (built off-canvas to the right)
await draw('f', 900, 420, 345, 52);
await rename('Button/Primary');
await setField('fills-hex-0', '4F46E5');
await setField('prop-radius', 12);
await text(1040, 446, 'Button', { size: 16, weight: '600', color: 'FFFFFF', name: 'Label' });
await pick('Button/Primary');
await page.keyboard.press('Shift+a');
let b = await sel0();
check('Shift+A adds auto layout to button frame', b.layout.mode !== 'NONE', b.layout.mode);
await page.getByTestId('al-horizontal').click().catch(() => {});
await page.getByTestId('al-align-4').click();
await setField('al-pad-h', 24);
await setField('al-pad-v', 16);
await selectOption('sizing-H', 'FIXED');
await setField('prop-w', 345);
await page.keyboard.press(`${MOD}+Alt+k`);
let comp = await sel0();
check('⌘⌥K turns button into COMPONENT', comp.type === 'COMPONENT', comp.type);
check('Component hug height = 16+lineheight+16', comp.sizingV === 'HUG', `sizingV=${comp.sizingV} h=${comp.height}`);
await page.getByTestId('component-description').fill('Primary call-to-action button').catch(() => {});
await page.getByTestId('component-description').blur().catch(() => {});

// ---------- Login contents (placed loosely, then auto layout tidies them)
await pick('Login');
await page.keyboard.press('Escape');
// logo mark
await draw('o', 24, 72, 44, 44);
await setField('fills-hex-0', '4F46E5');
await rename('Logo mark');
await text(82, 94, 'Flowly', { size: 22, weight: '700', color: '101828', name: 'Logo text' });
// headings
await text(24, 165, 'Welcome back', { size: 30, weight: '700', color: '101828', name: 'Heading' });
await text(24, 205, 'Sign in to pick up where your flow left off.', { size: 15, weight: '400', color: '667085', name: 'Subheading' });
// email field
await draw('f', 24, 240, 345, 52);
await rename('Email field');
await setField('fills-hex-0', 'FFFFFF');
await setField('prop-radius', 12);
await stroke('D0D5DD', 1);
await text(44, 266, 'you@example.com', { size: 15, color: '98A2B3', name: 'Email placeholder' });
// password field
await draw('f', 24, 310, 345, 52);
await rename('Password field');
await setField('fills-hex-0', 'FFFFFF');
await setField('prop-radius', 12);
await stroke('D0D5DD', 1);
await text(44, 336, 'Password', { size: 15, color: '98A2B3', name: 'Password placeholder' });
// forgot password
await text(24, 384, 'Forgot password?', { size: 14, weight: '600', color: '4F46E5', name: 'Forgot password' });

// ---------- Instance of the button: drag from Assets panel into Login
await page.getByTestId('tab-assets').click();
await page.getByTestId('asset-Button/Primary').dragTo(page.getByTestId('canvas'), { targetPosition: await toScreen(196, 436) });
let inst = await sel0();
check('Dragging asset creates INSTANCE inside Login', inst?.type === 'INSTANCE' && inst.parentId === login.id, `${inst?.type} parent=${inst?.parentId === login.id ? 'Login' : inst?.parentId}`);
await page.getByTestId('tab-file').click();
await geom(24, 410);
await rename('Sign in button');

// divider row: line — "or" — line
await draw('l', 24, 500, 150, 0);
await rename('Divider left');
await setField('strokes-hex-0', 'E4E7EC');
await text(188, 500, 'or', { size: 13, color: '98A2B3', name: 'Divider label' });
await draw('l', 219, 500, 150, 0);
await rename('Divider right');
await setField('strokes-hex-0', 'E4E7EC');

// Google secondary button: second instance + overrides
await page.getByTestId('tab-assets').click();
await page.getByTestId('asset-Button/Primary').dragTo(page.getByTestId('canvas'), { targetPosition: await toScreen(196, 546) });
await page.getByTestId('tab-file').click();
await geom(24, 520);
await rename('Google button');
await setField('fills-hex-0', 'FFFFFF');
await stroke('D0D5DD', 1);

// spacer that will push the footer to the bottom (fill container vertically)
await draw('f', 24, 640, 345, 40);
await rename('Spacer');
await setField('fills-hex-0', 'FFFFFF');
// footer
await text(24, 760, "Don't have an account? Sign up", { size: 14, color: '667085', name: 'Footer' });
await page.getByTestId('text-align-center').click().catch(() => {});

// ---------- text overrides on instances (double-click into the instance)
async function editInstanceText(instName, newText) {
  const n = await byName(instName);
  const ab = await st(`s => { let n = s.doc.nodes['${n.id}']; let x = n.x, y = n.y; let p = n.parentId; while (p) { const pn = s.doc.nodes[p]; x += pn.x; y += pn.y; p = pn.parentId; } return { x, y }; }`);
  const p = await toScreen(ab.x + n.width / 2, ab.y + n.height / 2);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  for (let i = 0; i < 4; i++) {
    await page.mouse.dblclick(p.x, p.y);
    if (await page.getByTestId('text-editor').count()) break;
  }
  const editing = await page.getByTestId('text-editor').count();
  if (!editing) return false;
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.type(newText);
  await page.keyboard.press('Escape');
  return true;
}
const ok1 = await editInstanceText('Sign in button', 'Sign in');
const signId = (await byName('Sign in button')).id;
const signKid = (await allNodes()).find((x) => x.parentId === signId);
check('Text override on instance (double-click → type)', ok1 && signKid?.text?.characters === 'Sign in', `chars="${signKid?.text?.characters}" overrides=${JSON.stringify(signKid?.overrides)}`);
const ok2 = await editInstanceText('Google button', 'Continue with Google');
const gId = (await byName('Google button')).id;
const gKid = (await allNodes()).find((x) => x.parentId === gId);
if (ok2) { await setField('fills-hex-0', '344054'); }
check('Second instance overrides (text, fill, stroke)', gKid?.text?.characters === 'Continue with Google', `chars="${gKid?.text?.characters}"`);

// ---------- Logo row and divider row: horizontal auto layout (hug)
await pick('Logo mark'); await pick('Logo text', true);
await page.keyboard.press('Shift+a');
await rename('Logo');
await setField('al-gap', 10);
await page.getByTestId('al-align-3').click();
let logo = await sel0();
check('Logo row: horizontal auto layout, hug×hug', logo.layout.mode === 'HORIZONTAL' && logo.sizingH === 'HUG' && logo.sizingV === 'HUG', `${logo.layout.mode} ${logo.sizingH}/${logo.sizingV} ${logo.width}×${logo.height}`);

await pick('Divider left'); await pick('Divider label', true); await pick('Divider right', true);
await page.keyboard.press('Shift+a');
await rename('Divider');
await setField('al-gap', 12);
await page.getByTestId('al-align-3').click();
let div = await sel0();
check('Divider row: horizontal auto layout', div.layout.mode === 'HORIZONTAL', `${div.layout.mode} ${div.width}×${div.height}`);

// ---------- Vertical auto layout on the Login frame itself
await pick('Login');
await page.keyboard.press('Shift+a');
login = await sel0();
check('Login: vertical auto layout', login.layout.mode === 'VERTICAL', `${login.layout.mode} gap=${login.layout.gap}`);
await setField('al-gap', 16);
await setField('al-pad-h', 24);
await setField('al-pad-t', 72).catch(async () => { await setField('al-pad-v', 72); });
await selectOption('sizing-H', 'FIXED');
await selectOption('sizing-V', 'FIXED');
await geom(null, null, 393, 852);
login = await sel0();
check('Login: gap 16, padding 24/72, fixed 393×852', login.layout.gap === 16 && login.layout.paddingLeft === 24 && login.layout.paddingTop === 72 && login.width === 393 && login.height === 852,
  `gap=${login.layout.gap} pad=${login.layout.paddingLeft}/${login.layout.paddingTop} ${login.width}×${login.height} order=${(await Promise.all(login.children.map(byId))).map((n) => n.name).join(' › ')}`);

// fields: padding inside via auto layout on the field frames
for (const n of ['Email field', 'Password field']) {
  await pick(n);
  await page.keyboard.press('Shift+a');
  await setField('al-pad-h', 16);
  await setField('al-pad-v', 16);
  await page.getByTestId('al-align-3').click().catch(() => {});
}
// children fill width
for (const n of ['Subheading', 'Email field', 'Password field', 'Forgot password', 'Sign in button', 'Divider', 'Google button', 'Spacer', 'Footer']) {
  await pick(n);
  await selectOption('sizing-H', 'FILL');
}
await pick('Spacer'); await selectOption('sizing-V', 'FILL');
const spacer = await byName('Spacer');
check('Spacer: fill container vertically pushes footer to bottom', spacer.sizingV === 'FILL' && spacer.height > 40, `h=${spacer.height}`);
// does adding auto layout to a FILL child keep FILL? (Figma keeps it)
await pick('Email field'); await page.keyboard.press('Alt+Shift+a'); await selectOption('sizing-H', 'FILL'); await page.keyboard.press('Shift+a');
const ef = await byName('Email field');
if (ef.sizingH !== 'FILL') note(`Shift+A on a frame that is FILL inside its auto-layout parent resets its width sizing to HUG (got ${ef.sizingH}, w=${ef.width})`);
await selectOption('sizing-H', 'FILL'); await setField('al-pad-h', 16); await setField('al-pad-v', 16); await page.getByTestId('al-align-3').click().catch(() => {});
for (const n of ['Divider left', 'Divider right']) { await pick(n); await selectOption('sizing-H', 'FILL'); }
// push the footer to the bottom: give the divider extra space via a spacer? use larger gap before "Forgot"
await pick('Forgot password');
await page.getByTestId('text-align-right').click().catch(() => {});
const kids = await Promise.all((await byName('Login')).children.map(byId));
const fillKids = kids.filter((k) => k.sizingH === 'FILL').map((k) => `${k.name}:${k.width}`);
check('Children use FILL width (393-48=345)', kids.filter((k) => k.sizingH === 'FILL').every((k) => k.width === 345), fillKids.join(', '));
const email = await byName('Email field');
check('Email field: radius 12, 1px stroke, hug height with padding', email.cornerRadius === 12 && email.strokes.length === 1 && email.strokeWeight === 1, `r=${email.cornerRadius} strokes=${email.strokes.length}@${email.strokeWeight} ${email.sizingV} h=${email.height}`);

// ---------- Home frame
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
await draw('f', 480, 0, 200, 200);
await presetIphone16();
await rename('Home');
await setField('fills-hex-0', 'F9FAFB');
await draw('o', 480 + 24, 64, 44, 44);
await setField('fills-hex-0', '4F46E5');
await rename('Logo mark');
await text(480 + 78, 86, 'Flowly', { size: 22, weight: '700', color: '101828', name: 'Home logo text' });
await text(480 + 24, 150, 'Good morning', { size: 30, weight: '700', color: '101828', name: 'Home heading' });
await text(480 + 24, 192, 'You have 3 tasks in your flow today.', { size: 15, color: '667085', name: 'Home sub' });
await draw('r', 480 + 24, 220, 345, 160);
await setField('fills-hex-0', '4F46E5');
await setField('prop-radius', 20);
await rename('Hero card');
await text(480 + 48, 262, 'Today', { size: 14, weight: '600', color: 'C7D2FE', name: 'Card kicker' });
await text(480 + 48, 296, 'Design review at 3:00 PM', { size: 20, weight: '700', color: 'FFFFFF', name: 'Card title' });
await text(480 + 48, 340, '3 of 5 tasks done', { size: 14, color: 'E0E7FF', name: 'Card meta' });
for (const [i, label] of ['Write onboarding copy', 'Review login flow', 'Ship release notes'].entries()) {
  const y = 404 + i * 76;
  await draw('r', 480 + 24, y, 345, 64);
  await setField('fills-hex-0', 'FFFFFF');
  await setField('prop-radius', 14);
  await stroke('EAECF0', 1);
  await rename(`Task ${i + 1}`);
  await draw('o', 480 + 44, y + 22, 20, 20);
  await setField('fills-hex-0', i === 0 ? '12B76A' : 'E4E7EC');
  await rename(`Check ${i + 1}`);
  await text(480 + 78, y + 32, label, { size: 15, weight: '500', color: '101828', name: `Task label ${i + 1}` });
}
const home = await byName('Home');
check('Home frame created (393×852)', home.width === 393 && home.height === 852, `${home.width}×${home.height} children=${home.children.length}`);

// ---------- Prototype: drag the noodle from Sign in to Home
await page.getByTestId('tab-prototype').click();
await pick('Sign in button');
const h = await page.getByTestId('noodle-handle').boundingBox();
await drag({ x: h.x + h.width / 2, y: h.y + h.height / 2 }, await toScreen(480 + 196, 600));
let sb = await byName('Sign in button');
check('Noodle drag creates reaction → Home', sb.reactions.length === 1 && sb.reactions[0].destinationId === home.id, JSON.stringify(sb.reactions.map((r) => ({ t: r.trigger, a: r.action, d: r.destinationId === home.id ? 'Home' : r.destinationId }))));
await page.getByTestId('reaction-toggle-0').click();
await selectOption('animation-0', 'SMART_ANIMATE');
await selectOption('easing-0', 'EASE_OUT').catch(() => {});
await setField('duration-0', 300).catch(() => {});
sb = await byName('Sign in button');
check('Animation = Smart animate', sb.reactions[0]?.animation === 'SMART_ANIMATE', sb.reactions[0]?.animation);
await page.screenshot({ path: path.join(OUT, 'prototype.png') });
await page.keyboard.press('Escape');

// ---------- Present
await pick('Login');
await page.getByTestId('present-btn').click();
await page.getByTestId('present').waitFor();
await page.waitForTimeout(500);
check('Present opens on Login', (await page.getByTestId('present-frame-name').textContent()) === 'Login', await page.getByTestId('present-frame-name').textContent());
await page.screenshot({ path: path.join(OUT, 'present-login.png') });
sb = await byName('Sign in button');
const scr = await page.getByTestId('present-screen').boundingBox();
const scale = scr.width / 393;
await page.mouse.click(scr.x + (sb.x + sb.width / 2) * scale, scr.y + (sb.y + sb.height / 2) * scale);
await page.waitForTimeout(900);
const after = await page.getByTestId('present-frame-name').textContent();
check('Present: clicking Sign in navigates to Home', after === 'Home', after);
await page.screenshot({ path: path.join(OUT, 'present.png') });
await page.getByTestId('present-close').click();
await page.getByTestId('editor').waitFor();

// ---------- Canvas screenshot
await page.getByTestId('tab-design').click().catch(() => {});
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
await page.keyboard.press('Shift+1');
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'zoom-to-fit.png') });
await view(0.7, 290, 150);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'canvas.png') });

// ---------- Export Login as PNG through Export button
await pick('Login');
await page.getByTestId('tab-design').click().catch(() => {});
await page.getByTestId('add-export').click();
await selectOption('export-format-0', 'PNG');
await selectOption('export-scale-0', '2').catch(() => {});
const dlP = page.waitForEvent('download');
await page.getByTestId('export-btn').click();
const dl = await dlP;
await dl.saveAs(path.join(OUT, 'design.png'));
check('PNG export download', /\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename());

// ---------- Save local copy
const dl2P = page.waitForEvent('download');
await page.getByTestId('main-menu-btn').click();
await page.getByTestId('menu-file').hover();
await page.getByTestId('cmd-file.saveLocal').click();
const dl2 = await dl2P;
await dl2.saveAs(path.join(OUT, 'design.myflow'));
check('Save local copy (.myflow)', /\.myflow$/.test(dl2.suggestedFilename()), dl2.suggestedFilename());

// ---------- Summary dump
const final = await allNodes();
const summary = {
  layers: final.length,
  components: final.filter((n) => n.type === 'COMPONENT').map((n) => n.name),
  instances: final.filter((n) => n.type === 'INSTANCE').map((n) => n.name),
  login: (await Promise.all((await byName('Login')).children.map(byId))).map((n) => ({ name: n.name, type: n.type, x: n.x, y: n.y, w: n.width, h: n.height, sizingH: n.sizingH, sizingV: n.sizingV })),
  errors,
};
writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ checks, notes, summary }, null, 2));
check('No console/page errors', errors.length === 0, errors.join(' | '));
console.log(JSON.stringify(summary, null, 2));
await browser.close();
