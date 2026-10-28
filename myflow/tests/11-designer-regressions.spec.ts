import { test, expect } from '@playwright/test';
import { collectErrors, newFile, draw, nodes, selectedNodes, setField, toScreen, drag, clickWorld, nodeByName, MOD, selection } from './helpers';

/** Regression tests for bugs reported by the 10 designer agents (designs/agent-XX/report.md). */

test('agent-10: Text tool click on existing text opens it for editing', async ({ page }) => {
  const errors = collectErrors(page);
  await newFile(page);
  await page.keyboard.press('t');
  await clickWorld(page, 0, 0);
  await page.keyboard.type('Hello');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('t');
  await clickWorld(page, 10, 0);
  await expect(page.getByTestId('text-editor')).toBeVisible();
  await page.keyboard.press('End');
  await page.keyboard.type(' world');
  await page.keyboard.press('Escape');
  expect((await nodes(page)).filter((n) => n.type === 'TEXT').map((n) => n.text!.characters)).toEqual(['Hello world']);
  expect((await nodes(page)).some((n) => n.type === 'ELLIPSE' || n.type === 'RECTANGLE')).toBe(false);
  expect(errors).toEqual([]);
});

test('agent-07: paste properties carries blend mode', async ({ page }) => {
  await newFile(page);
  await draw(page, 'r', 0, 0, 80, 80);
  await page.getByTestId('prop-blend').selectOption('MULTIPLY');
  await setField(page, 'prop-opacity', '35');
  await page.keyboard.press(`${MOD}+Alt+c`);
  await draw(page, 'r', 200, 0, 80, 80);
  await page.keyboard.press(`${MOD}+Alt+v`);
  const n = (await selectedNodes(page))[0] as any;
  expect([n.blendMode, n.opacity]).toEqual(['MULTIPLY', 0.35]);
});

test('agent-01/02: Shift+A keeps preset size & Fill sizing; wrapped frames do not clip', async ({ page }) => {
  await newFile(page);
  await draw(page, 'f', 0, 0, 393, 852);
  const phone = (await selectedNodes(page))[0];
  await draw(page, 'r', 20, 20, 100, 40);
  await page.evaluate((id) => (window as any).__myflow.get().select([id]), phone.id);
  await page.keyboard.press('Shift+a');
  let f = (await nodes(page)).find((n) => n.id === phone.id)!;
  expect(f.layout.mode).not.toBe('NONE');
  expect([f.width, f.height, f.sizingH, f.sizingV]).toEqual([393, 852, 'FIXED', 'FIXED']);
  // a small frame (button) hugs its content instead
  await draw(page, 'f', 600, 600, 345, 52);
  const small = (await selectedNodes(page))[0];
  await draw(page, 'r', 620, 610, 60, 20);
  await page.evaluate((id) => (window as any).__myflow.get().select([id]), small.id);
  await page.keyboard.press('Shift+a');
  const sm = (await nodes(page)).find((n) => n.id === small.id)!;
  expect([sm.sizingH, sm.sizingV]).toEqual(['HUG', 'HUG']);
  // shadows not clipped in wrapped auto layout
  await draw(page, 'r', 500, 0, 50, 50);
  await draw(page, 'r', 600, 0, 50, 50);
  await clickWorld(page, 525, 25);
  await clickWorld(page, 625, 25, { modifiers: ['Shift'] });
  await page.keyboard.press('Shift+a');
  f = (await selectedNodes(page))[0];
  expect((f as any).clipContent).toBe(false);
  expect(f.name).toMatch(/^Frame \d+$/);
});

test('agent-04: editing the fill of several layers at once', async ({ page }) => {
  await newFile(page);
  await draw(page, 'r', 0, 0, 50, 50);
  await draw(page, 'r', 100, 0, 50, 50);
  await page.keyboard.press(`${MOD}+a`);
  await setField(page, 'fills-hex-0', 'FF00AA');
  const rects = (await nodes(page)).filter((n) => n.type === 'RECTANGLE');
  expect(rects.every((r) => r.fills[0].color === '#FF00AA')).toBe(true);
});

test('agent-04: applying a text style keeps the layer resize mode', async ({ page }) => {
  await newFile(page);
  await page.keyboard.press('t');
  await drag(page, await toScreen(page, 0, 0), await toScreen(page, 120, 30));
  await page.keyboard.type('Paragraph text that wraps');
  await page.keyboard.press('Escape');
  await page.getByTestId('text-styles-btn').click();
  await page.getByTestId('create-text-style').click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('t');
  await clickWorld(page, 0, 200);
  await page.keyboard.type('Product');
  await page.keyboard.press('Escape');
  await page.getByTestId('text-styles-btn').click();
  await page.locator('.menu-item', { hasText: 'Text style 1' }).click();
  const t = (await selectedNodes(page))[0];
  expect(t.text!.autoResize).toBe('WIDTH_AND_HEIGHT');
});

test('agent-05: number variables can be bound to radius, gap and padding from the UI', async ({ page }) => {
  await newFile(page);
  await page.getByTestId('open-variables-btn').click();
  await page.getByTestId('create-variable').click();
  await page.getByTestId('create-var-number').click();
  await page.getByTestId('var-value-number-1-Mode 1').fill('14');
  await page.getByTestId('var-value-number-1-Mode 1').press('Enter');
  await page.getByTestId('modal-close').click();
  await draw(page, 'f', 0, 0, 200, 200);
  await page.getByTestId('bind-cornerRadius').click();
  await page.getByTestId('bind-var-number-1').click();
  expect((await selectedNodes(page))[0].cornerRadius).toBe(14);
  await expect(page.getByTestId('bound-cornerRadius')).toBeVisible();
  await page.keyboard.press('Shift+a');
  await page.getByTestId('bind-gap').click();
  await page.getByTestId('bind-var-number-1').click();
  await page.getByTestId('bind-padding').click();
  await page.getByTestId('bind-var-number-1').click();
  const f = (await selectedNodes(page))[0];
  expect([f.layout.gap, f.layout.paddingLeft, f.layout.paddingTop]).toEqual([14, 14, 14]);
  await page.getByTestId('unbind-cornerRadius').click();
  await expect(page.getByTestId('prop-radius')).toBeVisible();
});

test('agent-06: pen paths drawn inside a frame become its children', async ({ page }) => {
  await newFile(page);
  await draw(page, 'f', 0, 0, 300, 300);
  const frame = (await selectedNodes(page))[0];
  await page.keyboard.press('p');
  await clickWorld(page, 50, 50);
  await clickWorld(page, 150, 50);
  await clickWorld(page, 100, 150);
  await clickWorld(page, 50, 50);
  const v = (await nodes(page)).find((n) => n.type === 'VECTOR')!;
  expect(v.parentId).toBe(frame.id);
  expect([Math.round(v.x), Math.round(v.y)]).toEqual([50, 50]);
});

test('agent-03/05: pasted variant instance keeps text override across variant switch, named after the set', async ({ page }) => {
  const errors = collectErrors(page);
  await newFile(page);
  const descendantsOf = (iid: string) => page.evaluate((id) => {
    const s = (window as any).__myflow.get(); const out: any[] = [];
    const walk = (x: string) => { for (const c of s.doc.nodes[x].children) { out.push(s.doc.nodes[c]); walk(c); } };
    walk(id); return out;
  }, iid);
  // two components, each a frame holding a "9" label
  for (const x of [0, 200]) {
    await page.keyboard.press('t');
    await clickWorld(page, x, 0);
    await page.keyboard.type('9');
    await page.keyboard.press('Escape');
    await page.keyboard.press(`${MOD}+Alt+g`);
    await page.keyboard.press(`${MOD}+Alt+k`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  }
  const compIds = (await nodes(page)).filter((n) => n.type === 'COMPONENT').map((n) => n.id);
  expect(compIds.length).toBe(2);
  await page.evaluate((ids) => (window as any).__myflow.get().select(ids), compIds);
  await page.getByTestId('combine-variants').click();
  const set = (await selectedNodes(page))[0];
  expect(set.type).toBe('COMPONENT_SET');
  // rename the variant property key
  await page.getByTestId('variant-key-Property 1').fill('State');
  await page.getByTestId('variant-key-Property 1').press('Enter');
  const variants = (await nodes(page)).filter((n) => n.parentId === set.id);
  expect(variants.every((v) => v.name.startsWith('State='))).toBe(true);
  // copy a variant and paste → instance named after the set
  await page.evaluate((id) => (window as any).__myflow.get().select([id]), variants[0].id);
  await page.keyboard.press(`${MOD}+c`);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press(`${MOD}+v`);
  await expect.poll(async () => (await selectedNodes(page))[0]?.type).toBe('INSTANCE');
  const inst = (await selectedNodes(page))[0];
  expect(inst.name).toBe(set.name);
  // override the label text by double-clicking into the instance
  const textNode = (await descendantsOf(inst.id)).find((n: any) => n.type === 'TEXT');
  expect(textNode.sourceId).toBeTruthy();
  const abs = await page.evaluate((id) => { const s = (window as any).__myflow.get(); let x = 0, y = 0, n = s.doc.nodes[id]; while (n) { x += n.x; y += n.y; n = n.parentId ? s.doc.nodes[n.parentId] : null; } return { x, y }; }, textNode.id);
  await clickWorld(page, abs.x + 3, abs.y + 6, { clickCount: 2 });
  await clickWorld(page, abs.x + 3, abs.y + 6, { clickCount: 2 });
  await expect(page.getByTestId('text-editor')).toBeVisible();
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.type('10');
  await page.keyboard.press('Escape');
  // switch variant → override survives
  await page.evaluate((id) => (window as any).__myflow.get().select([id]), inst.id);
  const opts = await page.getByTestId('variant-select-State').locator('option').allTextContents();
  await page.getByTestId('variant-select-State').selectOption(opts[opts.length - 1]);
  const after = await descendantsOf(inst.id);
  expect((await nodes(page)).find((n) => n.id === inst.id)!.mainComponentId).toBe(variants[variants.length - 1].id);
  expect(after.find((n: any) => n.type === 'TEXT').text.characters).toBe('10');
  expect(errors).toEqual([]);
});

test('agent-09: codegen respects fill axis, opacity and blur', async ({ page }) => {
  await newFile(page);
  await draw(page, 'r', 0, 0, 100, 40);
  await draw(page, 'r', 0, 60, 100, 40);
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.press('Shift+a'); // vertical auto layout
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  const parent = (await selectedNodes(page))[0];
  const kid = (await nodes(page)).find((n) => n.parentId === parent.id)!;
  await page.evaluate((id) => (window as any).__myflow.get().select([id]), kid.id);
  await page.getByTestId('sizing-H').selectOption('FILL');
  await setField(page, 'fills-opacity-0', '18');
  await page.getByTestId('add-effect').click();
  await page.getByTestId('effect-type-0').selectOption('BACKGROUND_BLUR');
  await page.keyboard.press('Shift+d');
  await expect(page.getByTestId('code-block')).toContainText('align-self: stretch');
  await expect(page.getByTestId('code-block')).not.toContainText('flex: 1 0 0');
  await page.getByTestId('code-lang').selectOption('TAILWIND');
  await expect(page.getByTestId('code-block')).toContainText('/[0.18]');
  await expect(page.getByTestId('code-block')).toContainText('backdrop-blur-');
  await page.getByTestId('code-lang').selectOption('COMPOSE');
  await expect(page.getByTestId('code-block')).toContainText('Color(0x2E');
});

test('agent-01/02/03: zoom to fit keeps content clear of the side panels', async ({ page }) => {
  await newFile(page);
  await draw(page, 'f', 0, 0, 1440, 1024);
  await page.keyboard.press('Shift+1');
  const st = await page.evaluate(() => { const s = (window as any).__myflow.get(); return { z: s.zoom, px: s.panX, py: s.panY }; });
  const left = st.px, right = st.px + 1440 * st.z;
  const lp = (await page.getByTestId('left-panel').boundingBox())!;
  const rp = (await page.getByTestId('right-panel').boundingBox())!;
  expect(left).toBeGreaterThanOrEqual(lp.x + lp.width);
  expect(right).toBeLessThanOrEqual(rp.x);
});

test('agent-03: clicking a child of a selected top-level frame selects the child', async ({ page }) => {
  await newFile(page);
  await draw(page, 'f', 0, 0, 300, 300);
  await draw(page, 'r', 50, 50, 50, 50);
  const frame = (await nodes(page)).find((n) => n.type === 'FRAME')!;
  await page.evaluate((id) => (window as any).__myflow.get().select([id]), frame.id);
  await clickWorld(page, 75, 75);
  expect((await selectedNodes(page))[0].type).toBe('RECTANGLE');
});

test('agent-06: dragging inside a selected path over another layer moves the selection', async ({ page }) => {
  await newFile(page);
  await draw(page, 'o', 0, 0, 300, 300);
  await draw(page, 'l', 50, 150, 200, 0);
  const line = (await selectedNodes(page))[0];
  await drag(page, await toScreen(page, 150, 150), await toScreen(page, 150, 250));
  expect((await selection(page))[0]).toBe(line.id);
  const moved = (await nodes(page)).find((n) => n.id === line.id)!;
  expect(Math.round(moved.y)).toBe(250);
});

test('agent-01/08: Present skips components and overlay-only frames; flow select persists', async ({ page }) => {
  await newFile(page, 'mobile');
  await page.getByTestId('present-btn').click();
  await expect(page.getByTestId('present-frame-name')).toHaveText('Home');
  await expect(page.locator('.present-top')).toContainText('1 / 2');
  await page.getByTestId('present-next').click();
  await expect(page.getByTestId('present-frame-name')).toHaveText('Details');
  await expect(page.getByTestId('present-flow')).not.toHaveValue('');
});

test('agent-10: text layer names use the first line and follow plugin edits', async ({ page }) => {
  await newFile(page);
  await page.keyboard.press('t');
  await clickWorld(page, 0, 0);
  await page.keyboard.type('Vol.');
  await page.keyboard.press('Enter');
  await page.keyboard.type('07');
  await page.keyboard.press('Escape');
  expect((await selectedNodes(page))[0].name).toBe('Vol.');
  await page.keyboard.press(`${MOD}+k`);
  await page.getByTestId('quick-actions-input').fill('Lorem ipsum');
  await page.getByTestId('quick-actions-input').press('Enter');
  await expect.poll(async () => (await selectedNodes(page))[0]?.name).toMatch(/^Lorem/);
});

test('agent-04: style row "…" opens that specific style', async ({ page }) => {
  await newFile(page);
  await page.getByTestId('add-style').click();
  await page.getByTestId('new-color-style').click();
  await page.getByTestId('add-style').click();
  await page.getByTestId('new-color-style').click();
  await page.getByTestId('edit-style-Color style 2').click();
  await expect(page.getByTestId('style-name')).toHaveValue('Color style 2');
});
