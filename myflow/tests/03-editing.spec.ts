import { test, expect } from '@playwright/test';
import { collectErrors, newFile, draw, nodes, selectedNodes, selection, toScreen, drag, pageChildren, clickWorld, nodeByName, MOD } from './helpers';

test.describe('Selecting & transforming', () => {
  test('select, move (with snapping), resize handles, rotate, nudge', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 100, 100);
    // move by dragging
    await drag(page, await toScreen(page, 50, 50), await toScreen(page, 150, 90));
    let r = (await selectedNodes(page))[0];
    expect([r.x, r.y]).toEqual([100, 40]);
    // resize from SE handle
    const se = page.getByTestId('handle-se');
    const box = (await se.boundingBox())!;
    await drag(page, { x: box.x + 4, y: box.y + 4 }, { x: box.x + 54, y: box.y + 24 });
    r = (await selectedNodes(page))[0];
    expect([r.width, r.height]).toEqual([150, 120]);
    // shift resize keeps aspect ratio
    const se2 = (await page.getByTestId('handle-se').boundingBox())!;
    await drag(page, { x: se2.x + 4, y: se2.y + 4 }, { x: se2.x + 154, y: se2.y + 10 }, { modifiers: ['Shift'] });
    r = (await selectedNodes(page))[0];
    expect(Math.round((r.width / r.height) * 100) / 100).toBe(1.25);
    // rotation via the panel
    await page.getByTestId('prop-rotation').fill('45');
    await page.getByTestId('prop-rotation').press('Enter');
    expect((await selectedNodes(page))[0].rotation).toBe(45);
    await page.getByTestId('prop-rotation').fill('0');
    await page.getByTestId('prop-rotation').press('Enter');
    // nudge
    const before = (await selectedNodes(page))[0];
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    const after = (await selectedNodes(page))[0];
    expect(after.x - before.x).toBe(1);
    expect(after.y - before.y).toBe(10);
    // snapping: second rect dragged near first snaps its left edge
    await draw(page, 'r', 400, 400, 50, 50);
    const first = await nodeByName(page, 'Rectangle');
    const target = await toScreen(page, first.x + 25 + 3, 425 - 200);
    await drag(page, await toScreen(page, 425, 425), target);
    const moved = (await selectedNodes(page))[0];
    expect(moved.x).toBe(first.x);
    expect(errors).toEqual([]);
  });

  test('marquee, shift-click, select all, deselect, delete, undo/redo', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 50, 50);
    await draw(page, 'o', 100, 0, 50, 50);
    await draw(page, 'r', 200, 0, 50, 50);
    await page.keyboard.press('Escape');
    expect(await selection(page)).toEqual([]);
    await drag(page, await toScreen(page, -20, -20), await toScreen(page, 160, 80));
    expect((await selection(page)).length).toBe(2);
    await clickWorld(page, 225, 25, { modifiers: ['Shift'] });
    expect((await selection(page)).length).toBe(3);
    await clickWorld(page, 125, 25, { modifiers: ['Shift'] });
    expect((await selection(page)).length).toBe(2);
    await clickWorld(page, 500, 500);
    expect(await selection(page)).toEqual([]);
    await page.keyboard.press(`${MOD}+a`);
    expect((await selection(page)).length).toBe(3);
    await page.keyboard.press('Backspace');
    expect((await pageChildren(page)).length).toBe(0);
    await page.keyboard.press(`${MOD}+z`);
    expect((await pageChildren(page)).length).toBe(3);
    await page.keyboard.press(`${MOD}+Shift+z`);
    expect((await pageChildren(page)).length).toBe(0);
    await page.keyboard.press(`${MOD}+z`);
    // undo/redo via main menu
    await page.getByTestId('main-menu-btn').click();
    await page.getByTestId('menu-edit').hover();
    await page.getByTestId('cmd-edit.undo').click();
    expect((await pageChildren(page)).length).toBe(2);
    expect(errors).toEqual([]);
  });

  test('duplicate, alt-drag duplicate, copy/paste, cut', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 80, 80);
    await page.keyboard.press(`${MOD}+d`);
    expect((await pageChildren(page)).length).toBe(2);
    await drag(page, await toScreen(page, 40, 40), await toScreen(page, 240, 40), { modifiers: ['Alt'] });
    const kids = await pageChildren(page);
    expect(kids.length).toBe(3);
    expect(kids.some((k) => k.x === 200)).toBe(true);
    await page.keyboard.press(`${MOD}+c`);
    await page.keyboard.press(`${MOD}+v`);
    await expect.poll(async () => (await pageChildren(page)).length).toBe(4);
    await page.keyboard.press(`${MOD}+x`);
    await expect.poll(async () => (await pageChildren(page)).length).toBe(3);
    await page.keyboard.press(`${MOD}+v`);
    await expect.poll(async () => (await pageChildren(page)).length).toBe(4);
    // paste into selected frame
    await draw(page, 'f', 0, 300, 300, 300);
    await page.keyboard.press(`${MOD}+v`);
    await expect.poll(async () => (await nodes(page)).filter((n) => n.parentId && n.type === 'RECTANGLE').length).toBe(1);
    expect(errors).toEqual([]);
  });

  test('group / ungroup, frame selection, boolean ops, mask, flatten', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 80, 80);
    await draw(page, 'o', 40, 40, 80, 80);
    await page.keyboard.press(`${MOD}+a`);
    await page.keyboard.press(`${MOD}+g`);
    let g = (await selectedNodes(page))[0];
    expect(g.type).toBe('GROUP');
    expect([g.x, g.y, g.width, g.height]).toEqual([0, 0, 120, 120]);
    await page.keyboard.press(`${MOD}+Shift+g`);
    expect((await selection(page)).length).toBe(2);
    await page.keyboard.press(`${MOD}+Alt+g`);
    expect((await selectedNodes(page))[0].type).toBe('FRAME');
    await page.keyboard.press(`${MOD}+Shift+g`);
    // boolean via panel buttons
    await page.getByTestId('bool-subtract').click();
    g = (await selectedNodes(page))[0];
    expect(g.type).toBe('BOOLEAN_OPERATION');
    expect(g.booleanOp).toBe('SUBTRACT');
    await page.keyboard.press(`${MOD}+Shift+g`);
    for (const [key, op] of [['Alt+Shift+u', 'UNION'], ['Alt+Shift+i', 'INTERSECT'], ['Alt+Shift+e', 'EXCLUDE']] as const) {
      await page.keyboard.press(key);
      expect((await selectedNodes(page))[0].booleanOp).toBe(op);
      await page.keyboard.press(`${MOD}+Shift+g`);
    }
    // mask
    await page.keyboard.press(`Control+${MOD}+m`);
    const masked = (await selectedNodes(page))[0];
    expect(masked.type).toBe('GROUP');
    const kids = (await nodes(page)).filter((n) => n.parentId === masked.id);
    expect(kids.some((k) => k.isMask)).toBe(true);
    await page.keyboard.press(`${MOD}+Shift+g`);
    // flatten rectangle into vector
    await page.keyboard.press('Escape');
    await clickWorld(page, 10, 10);
    await page.keyboard.press(`${MOD}+e`);
    expect((await selectedNodes(page))[0].type).toBe('VECTOR');
    expect(errors).toEqual([]);
  });

  test('align, distribute, tidy, flip, arrange order', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 40, 40);
    await draw(page, 'r', 100, 60, 40, 40);
    await draw(page, 'r', 300, 20, 40, 40);
    await page.keyboard.press(`${MOD}+a`);
    await page.keyboard.press('Alt+s');
    let ns = await pageChildren(page);
    expect(new Set(ns.map((n) => n.y + n.height))).toEqual(new Set([100]));
    await page.getByTestId('align-top').click();
    ns = await pageChildren(page);
    expect(new Set(ns.map((n) => n.y))).toEqual(new Set([60]));
    await page.getByTestId('dist-h').click();
    ns = (await pageChildren(page)).sort((a, b) => a.x - b.x);
    expect(ns[1].x - (ns[0].x + 40)).toBeCloseTo(ns[2].x - (ns[1].x + 40), 3);
    await page.getByTestId('align-left').click();
    ns = await pageChildren(page);
    expect(new Set(ns.map((n) => n.x))).toEqual(new Set([0]));
    await page.getByTestId('tidy').click();
    await page.getByTestId('flip-h').click();
    expect((await selectedNodes(page)).every((n) => n.flipX)).toBe(true);
    await page.keyboard.press('Shift+v');
    expect((await selectedNodes(page)).every((n) => n.flipY)).toBe(true);
    // arrange: send first to front
    await page.keyboard.press('Escape');
    const firstId = (await pageChildren(page))[0].id;
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), firstId);
    await page.keyboard.press(`${MOD}+Alt+]`);
    ns = await pageChildren(page);
    expect(ns[ns.length - 1].id).toBe(firstId);
    await page.keyboard.press(`${MOD}+[`);
    ns = await pageChildren(page);
    expect(ns[ns.length - 2].id).toBe(firstId);
    expect(errors).toEqual([]);
  });

  test('layers panel: rename, hide, lock, expand, reorder by drag, search, context menu', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'f', 0, 0, 300, 300);
    await draw(page, 'r', 20, 20, 50, 50);
    await draw(page, 'o', 100, 100, 50, 50);
    // rename via double-click
    await page.getByTestId('layer-Rectangle').dblclick();
    await page.getByTestId('layer-rename-input').fill('Box');
    await page.getByTestId('layer-rename-input').press('Enter');
    await expect(page.getByTestId('layer-Box')).toBeVisible();
    // hide + lock buttons
    await page.getByTestId('layer-Box').hover();
    await page.getByTestId('visibility-Box').click();
    expect((await nodeByName(page, 'Box')).visible).toBe(false);
    await page.getByTestId('visibility-Box').click();
    await page.getByTestId('lock-Box').click();
    expect((await nodeByName(page, 'Box')).locked).toBe(true);
    await page.getByTestId('lock-Box').click();
    // reorder: drag Box above Ellipse (inside frame)
    const box = (await page.getByTestId('layer-Box').boundingBox())!;
    const ell = (await page.getByTestId('layer-Ellipse').boundingBox())!;
    await drag(page, { x: box.x + 60, y: box.y + box.height / 2 }, { x: ell.x + 60, y: ell.y + 3 });
    const frame = (await nodes(page)).find((n) => n.type === 'FRAME')!;
    const order = (await nodes(page)).find((n) => n.id === frame.id)!.children;
    const boxId = (await nodeByName(page, 'Box')).id;
    expect(order[order.length - 1]).toBe(boxId);
    // collapse/expand
    await page.getByTestId(`twisty-${frame.name}`).click();
    await expect(page.getByTestId('layer-Box')).toHaveCount(0);
    await page.getByTestId(`twisty-${frame.name}`).click();
    await expect(page.getByTestId('layer-Box')).toBeVisible();
    // search layers
    await page.getByTestId('layer-search-btn').click();
    await page.getByTestId('layer-search').fill('ell');
    await expect(page.getByTestId('layer-Ellipse')).toBeVisible();
    await expect(page.getByTestId('layer-Box')).toHaveCount(0);
    await page.getByTestId('layer-search-btn').click();
    // context menu from layer
    await page.getByTestId('layer-Box').click({ button: 'right' });
    await expect(page.getByTestId('layer-menu')).toBeVisible();
    await page.getByTestId('cmd-obj.hide').click();
    expect((await nodeByName(page, 'Box')).visible).toBe(false);
    // canvas context menu
    await clickWorld(page, 600, 600, { button: 'right' });
    await expect(page.getByTestId('context-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });

  test('deep select with double click, Enter/Shift+Enter, Esc to parent, Tab siblings', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'f', 0, 0, 300, 300);
    await draw(page, 'r', 20, 20, 50, 50);
    await draw(page, 'r', 100, 20, 50, 50);
    await page.keyboard.press(`${MOD}+a`);
    await page.keyboard.press(`${MOD}+g`);
    const group = (await selectedNodes(page))[0];
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    // click selects the group (child of top-level frame)
    await clickWorld(page, 30, 30);
    expect(await selection(page)).toEqual([group.id]);
    // double click goes deeper
    await clickWorld(page, 30, 30, { clickCount: 2 });
    const inner = (await selectedNodes(page))[0];
    expect(inner.type).toBe('RECTANGLE');
    // Tab → sibling
    await page.keyboard.press('Tab');
    expect((await selectedNodes(page))[0].id).not.toBe(inner.id);
    // Shift+Enter → parent
    await page.keyboard.press('Shift+Enter');
    expect(await selection(page)).toEqual([group.id]);
    // Enter → children
    await page.keyboard.press('Enter');
    expect((await selection(page)).length).toBe(2);
    // Esc → parent
    await page.keyboard.press('Escape');
    expect(await selection(page)).toEqual([group.id]);
    // cmd+click deep selects
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await clickWorld(page, 110, 30, { modifiers: ['ControlOrMeta'] });
    expect((await selectedNodes(page))[0].type).toBe('RECTANGLE');
    expect(errors).toEqual([]);
  });

  test('number keys set opacity; lock and hide shortcuts', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 80, 80);
    await page.keyboard.press('5');
    expect((await selectedNodes(page))[0].opacity).toBe(0.5);
    await page.waitForTimeout(700);
    await page.keyboard.press('0');
    expect((await selectedNodes(page))[0].opacity).toBe(1);
    await page.keyboard.press(`${MOD}+Shift+h`);
    expect((await nodeByName(page, 'Rectangle')).visible).toBe(false);
    await page.keyboard.press(`${MOD}+Shift+h`);
    await page.keyboard.press(`${MOD}+Shift+l`);
    expect((await nodeByName(page, 'Rectangle')).locked).toBe(true);
    // locked layers cannot be selected on canvas
    await clickWorld(page, 40, 40);
    expect(await selection(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
});
