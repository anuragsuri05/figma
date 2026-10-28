import { test, expect } from '@playwright/test';
import { collectErrors, newFile, draw, nodes, selectedNodes, setField, toScreen, drag, nodeByName, MOD, clickWorld, pageChildren } from './helpers';

test.describe('Auto layout', () => {
  test('wrap selection, direction, gap, padding, alignment, hug/fill, wrap, remove', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 60, 40);
    await draw(page, 'r', 0, 60, 60, 40);
    await draw(page, 'r', 0, 120, 60, 40);
    await page.keyboard.press(`${MOD}+a`);
    await page.keyboard.press('Shift+a');
    let f = (await selectedNodes(page))[0];
    expect(f.type).toBe('FRAME');
    expect(f.layout.mode).toBe('VERTICAL');
    expect(f.layout.gap).toBe(20);
    expect([f.sizingH, f.sizingV]).toEqual(['HUG', 'HUG']);
    expect(f.height).toBe(160);
    // horizontal
    await page.getByTestId('al-horizontal').click();
    f = (await selectedNodes(page))[0];
    expect(f.layout.mode).toBe('HORIZONTAL');
    expect([f.width, f.height]).toEqual([220, 40]);
    // gap and padding
    await setField(page, 'al-gap', '8');
    await setField(page, 'al-pad-h', '16');
    await setField(page, 'al-pad-v', '12');
    f = (await selectedNodes(page))[0];
    expect([f.width, f.height]).toEqual([3 * 60 + 2 * 8 + 32, 40 + 24]);
    const kids = (await nodes(page)).filter((n) => n.parentId === f.id).sort((a, b) => a.x - b.x);
    expect(kids.map((k) => k.x)).toEqual([16, 84, 152]);
    // fixed width + space between
    await page.getByTestId('sizing-H').selectOption('FIXED');
    await setField(page, 'prop-w', '400');
    await page.getByTestId('al-spacing-mode').selectOption('auto');
    let k2 = (await nodes(page)).filter((n) => n.parentId === f.id).sort((a, b) => a.x - b.x);
    expect(k2[2].x + k2[2].width).toBe(400 - 16);
    await page.getByTestId('al-spacing-mode').selectOption('packed');
    // alignment grid: bottom-right (index 8)
    await page.getByTestId('sizing-V').selectOption('FIXED');
    await setField(page, 'prop-h', '100');
    await page.getByTestId('al-align-8').click();
    f = (await selectedNodes(page))[0];
    expect([f.layout.alignMain, f.layout.alignCross]).toEqual(['MAX', 'MAX']);
    k2 = (await nodes(page)).filter((n) => n.parentId === f.id);
    expect(k2.every((k) => k.y === 100 - 12 - 40)).toBe(true);
    // child fill container
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), k2[0].id);
    await page.getByTestId('sizing-H').selectOption('FILL');
    const filled = (await selectedNodes(page))[0];
    expect(filled.sizingH).toBe('FILL');
    expect(filled.width).toBe(400 - 32 - 16 - 120);
    // absolute position
    await page.getByTestId('absolute-position').locator('input').check();
    expect((await selectedNodes(page))[0].absolutePosition).toBe(true);
    await page.getByTestId('absolute-position').locator('input').uncheck();
    // wrap mode
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), f.id);
    await page.getByTestId('al-wrap').click();
    expect((await selectedNodes(page))[0].layout.mode).toBe('WRAP');
    // remove auto layout
    await page.keyboard.press('Alt+Shift+a');
    expect((await selectedNodes(page))[0].layout.mode).toBe('NONE');
    expect(errors).toEqual([]);
  });

  test('reorder children by dragging inside auto layout and with arrow keys', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 50, 50);
    await draw(page, 'o', 70, 0, 50, 50);
    await draw(page, 'r', 140, 0, 50, 50);
    await page.keyboard.press(`${MOD}+a`);
    await page.keyboard.press('Shift+a');
    const f = (await selectedNodes(page))[0];
    expect(f.layout.mode).toBe('HORIZONTAL');
    const order0 = (await nodes(page)).find((n) => n.id === f.id)!.children;
    // drag ellipse (middle) to the end
    const ell = (await nodes(page)).find((n) => n.type === 'ELLIPSE')!;
    await page.keyboard.press('Escape');
    await clickWorld(page, f.x + ell.x + 25, f.y + ell.y + 25);
    expect((await selectedNodes(page))[0].id).toBe(ell.id);
    await drag(page, await toScreen(page, f.x + ell.x + 25, f.y + ell.y + 25), await toScreen(page, f.x + f.width - 5, f.y + 25));
    let order = (await nodes(page)).find((n) => n.id === f.id)!.children;
    expect(order[order.length - 1]).toBe(ell.id);
    // arrow left moves it back one slot
    await page.keyboard.press('ArrowLeft');
    order = (await nodes(page)).find((n) => n.id === f.id)!.children;
    expect(order[1]).toBe(ell.id);
    expect(order0.length).toBe(3);
    // drag out of the frame → becomes top-level
    await drag(page, await toScreen(page, f.x + 95, f.y + 25), await toScreen(page, 400, 400));
    expect((await nodeByName(page, 'Ellipse')).parentId).toBe(null);
    expect(errors).toEqual([]);
  });
});

test.describe('Components & variants', () => {
  test('create component, insert instance, propagate main edits, override, reset, detach, go to main', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 120, 40);
    await page.keyboard.press(`${MOD}+Alt+k`);
    const comp = (await selectedNodes(page))[0];
    expect(comp.type).toBe('COMPONENT');
    await expect(page.getByTestId('component-section')).toBeVisible();
    await page.getByTestId('component-description').fill('A button');
    await page.getByTestId('component-description').blur();
    // instance via assets panel
    await page.getByTestId('tab-assets').click();
    await page.getByTestId(`asset-${comp.name}`).click();
    let inst = (await selectedNodes(page))[0];
    expect(inst.type).toBe('INSTANCE');
    expect(inst.mainComponentId).toBe(comp.id);
    expect(inst.children.length).toBe(1);
    // duplicating a component creates an instance (Figma behavior)
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), comp.id);
    await page.keyboard.press(`${MOD}+d`);
    const inst2 = (await selectedNodes(page))[0];
    expect(inst2.type).toBe('INSTANCE');
    // edit main child fill → instances update
    const mainChild = (await nodes(page)).find((n) => n.parentId === comp.id)!;
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), mainChild.id);
    await setField(page, 'fills-hex-0', 'AA00FF');
    const instKids = (await nodes(page)).filter((n) => n.parentId === inst.id);
    expect(instKids[0].fills[0].color).toBe('#AA00FF');
    // override inside instance survives main edit
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), instKids[0].id);
    await setField(page, 'fills-hex-0', '00AA00');
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), mainChild.id);
    await setField(page, 'prop-radius', '8');
    let ik = (await nodes(page)).find((n) => n.parentId === inst.id)!;
    expect(ik.fills[0].color).toBe('#00AA00');
    expect(ik.cornerRadius).toBe(8);
    // reset instance
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), inst.id);
    await page.getByTestId('reset-instance').click();
    ik = (await nodes(page)).find((n) => n.parentId === inst.id)!;
    expect(ik.fills[0].color).toBe('#AA00FF');
    // go to main
    await page.getByTestId('go-to-main').click();
    expect((await selectedNodes(page))[0].id).toBe(comp.id);
    // detach
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), inst.id);
    await page.getByTestId('detach-instance').click();
    inst = (await selectedNodes(page))[0];
    expect(inst.type).toBe('FRAME');
    expect(errors).toEqual([]);
  });

  test('variants: combine, add variant, switch variant on instance, swap instance', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 100, 40);
    await page.keyboard.press(`${MOD}+Alt+k`);
    await draw(page, 'o', 0, 100, 40, 40);
    await page.keyboard.press(`${MOD}+Alt+k`);
    await page.keyboard.press(`${MOD}+a`);
    await page.getByTestId('combine-variants').click();
    const set = (await selectedNodes(page))[0];
    expect(set.type).toBe('COMPONENT_SET');
    const variants = (await nodes(page)).filter((n) => n.parentId === set.id);
    expect(variants.map((v) => v.name).sort()).toEqual(['Property 1=Default', 'Property 1=Variant2']);
    await page.getByTestId('add-variant').click();
    expect((await nodes(page)).filter((n) => n.parentId === set.id).length).toBe(3);
    // instance of default variant
    const def = variants.find((v) => v.name.endsWith('Default'))!;
    await page.evaluate((id) => { const s = (window as any).__myflow.get(); s.select([id]); }, def.id);
    await page.keyboard.press(`${MOD}+c`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press(`${MOD}+v`);
    await expect.poll(async () => (await selectedNodes(page))[0]?.type).toBe('INSTANCE');
    const inst = (await selectedNodes(page))[0];
    await expect(page.getByTestId('variant-prop-Property 1')).toBeVisible();
    await page.getByTestId('variant-select-Property 1').selectOption('Variant2');
    const after = (await nodes(page)).find((n) => n.id === inst.id)!;
    expect(after.mainComponentId).toBe(variants.find((v) => v.name.endsWith('Variant2'))!.id);
    expect((await nodes(page)).find((n) => n.parentId === inst.id)!.type).toBe('ELLIPSE');
    // swap via menu
    await page.getByTestId('swap-instance').click();
    await page.getByTestId('menu-search').fill('Default');
    await page.locator('.menu-item', { hasText: 'Default' }).first().click();
    expect((await nodes(page)).find((n) => n.id === inst.id)!.mainComponentId).toBe(def.id);
    expect(errors).toEqual([]);
  });

  test('drag component from assets onto a frame', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 60, 60);
    await page.keyboard.press(`${MOD}+Alt+k`);
    const comp = (await selectedNodes(page))[0];
    await draw(page, 'f', 200, 0, 300, 300);
    const frame = (await selectedNodes(page))[0];
    await page.getByTestId('tab-assets').click();
    const target = await toScreen(page, 350, 150);
    await page.getByTestId(`asset-${comp.name}`).dragTo(page.getByTestId('canvas'), { targetPosition: target });
    const inst = (await nodes(page)).find((n) => n.type === 'INSTANCE')!;
    expect(inst.parentId).toBe(frame.id);
    expect(errors).toEqual([]);
  });
});

test.describe('Text', () => {
  test('typography controls and text shortcuts', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await page.keyboard.press('t');
    await clickWorld(page, 0, 0);
    await page.keyboard.type('Typography');
    await page.keyboard.press('Escape');
    await page.getByTestId('font-family').selectOption('Roboto');
    await setField(page, 'font-size', '32');
    await page.getByTestId('font-weight').selectOption('700');
    await setField(page, 'line-height', '40');
    await setField(page, 'letter-spacing', '2');
    let t = (await selectedNodes(page))[0].text!;
    expect([t.fontFamily, t.fontSize, t.fontWeight]).toEqual(['Roboto', 32, 700]);
    expect((await selectedNodes(page))[0].height).toBe(40);
    await page.getByTestId('text-align-center').click();
    await page.getByTestId('text-valign-bottom').click();
    await page.getByTestId('text-resize-none').click();
    t = (await selectedNodes(page))[0].text!;
    expect([t.textAlign, t.autoResize]).toEqual(['CENTER', 'NONE']);
    await page.getByTestId('type-settings').click();
    await page.getByTestId('deco-underline').click();
    await page.getByTestId('case-upper').click();
    await page.getByTestId('list-bullet').click();
    await setField(page, 'paragraph-spacing', '6');
    await page.keyboard.press('Escape');
    t = (await selectedNodes(page))[0].text!;
    expect([t.decoration, t.textCase, t.listType]).toEqual(['UNDERLINE', 'UPPER', 'BULLET']);
    // shortcuts
    await page.keyboard.press(`${MOD}+i`);
    expect((await selectedNodes(page))[0].text!.italic).toBe(true);
    await page.keyboard.press(`${MOD}+b`);
    expect((await selectedNodes(page))[0].text!.fontWeight).toBe(400);
    await page.keyboard.press(`${MOD}+Shift+.`);
    expect((await selectedNodes(page))[0].text!.fontSize).toBe(33);
    await page.keyboard.press(`${MOD}+Alt+t`);
    expect((await selectedNodes(page))[0].text!.textAlign).toBe('CENTER');
    // text style
    await page.getByTestId('text-styles-btn').click();
    await page.getByTestId('create-text-style').click();
    expect((await page.evaluate(() => (window as any).__myflow.get().doc.styles.length))).toBe(1);
    await expect(page.getByTestId('detach-text-style')).toBeVisible();
    // auto width resize toggle
    await page.getByTestId('detach-text-style').click();
    await page.getByTestId('text-resize-width_and_height').click();
    expect((await selectedNodes(page))[0].text!.autoResize).toBe('WIDTH_AND_HEIGHT');
    expect(errors).toEqual([]);
  });

  test('paste plain text creates a text layer', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await page.evaluate(() => navigator.clipboard.writeText('Pasted words'));
    await page.locator('body').click({ position: { x: 700, y: 400 } });
    await page.keyboard.press(`${MOD}+v`);
    await expect.poll(async () => (await pageChildren(page)).find((n) => n.type === 'TEXT')?.text?.characters).toBe('Pasted words');
    expect(errors).toEqual([]);
  });
});
