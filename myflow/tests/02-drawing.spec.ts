import { test, expect } from '@playwright/test';
import { collectErrors, newFile, draw, nodes, selectedNodes, toScreen, drag, pageChildren, clickWorld, MOD } from './helpers';

test.describe('Drawing tools', () => {
  test('every shape tool via keyboard shortcuts', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 100, 60);
    let sel = await selectedNodes(page);
    expect(sel[0].type).toBe('RECTANGLE');
    expect(sel[0].width).toBe(100);
    expect(sel[0].height).toBe(60);
    await draw(page, 'o', 150, 0, 80, 80);
    expect((await selectedNodes(page))[0].type).toBe('ELLIPSE');
    await draw(page, 'l', 0, 120, 100, 0);
    sel = await selectedNodes(page);
    expect(sel[0].type).toBe('LINE');
    expect(sel[0].width).toBeCloseTo(100, 0);
    await draw(page, 'Shift+L', 0, 160, 100, 30);
    sel = await selectedNodes(page);
    expect(sel[0].endCap).toBe('ARROW');
    await draw(page, 'f', 300, 0, 200, 150);
    sel = await selectedNodes(page);
    expect(sel[0].type).toBe('FRAME');
    expect(sel[0].name).toMatch(/^Frame/);
    await draw(page, 'Shift+S', 600, -50, 300, 300);
    expect((await selectedNodes(page))[0].type).toBe('SECTION');
    await draw(page, 's', 0, 300, 50, 50);
    expect((await selectedNodes(page))[0].type).toBe('SLICE');
    // tool returns to move after drawing
    expect(await page.evaluate(() => (window as any).__myflow.get().tool)).toBe('MOVE');
    expect(errors).toEqual([]);
  });

  test('toolbar dropdowns: polygon, star, and shift-constrained square', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await page.getByTestId('tool-caret-shape').click();
    await page.getByTestId('tool-menu-polygon').click();
    let a = await toScreen(page, 0, 0), b = await toScreen(page, 100, 100);
    await drag(page, a, b);
    expect((await selectedNodes(page))[0].type).toBe('POLYGON');
    await page.getByTestId('tool-caret-shape').click();
    await page.getByTestId('tool-menu-star').click();
    a = await toScreen(page, 150, 0); b = await toScreen(page, 250, 100);
    await drag(page, a, b);
    expect((await selectedNodes(page))[0].type).toBe('STAR');
    // shift → square
    await page.keyboard.press('r');
    a = await toScreen(page, 0, 200); b = await toScreen(page, 120, 260);
    await drag(page, a, b, { modifiers: ['Shift'] });
    const sq = (await selectedNodes(page))[0];
    expect(sq.width).toBe(sq.height);
    // region tools from dropdown
    await page.getByTestId('tool-caret-region').click();
    await page.getByTestId('tool-menu-frame').click();
    a = await toScreen(page, 400, 0); b = await toScreen(page, 500, 100);
    await drag(page, a, b);
    expect((await selectedNodes(page))[0].type).toBe('FRAME');
    // move dropdown: hand & scale tools selectable
    await page.getByTestId('tool-caret-move').click();
    await page.getByTestId('tool-menu-hand').click();
    expect(await page.evaluate(() => (window as any).__myflow.get().tool)).toBe('HAND');
    await page.getByTestId('tool-caret-move').click();
    await page.getByTestId('tool-menu-scale').click();
    expect(await page.evaluate(() => (window as any).__myflow.get().tool)).toBe('SCALE');
    expect(errors).toEqual([]);
  });

  test('click without drag creates default 100×100 shapes; frames wrap contained layers', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await page.keyboard.press('r');
    await clickWorld(page, 10, 10);
    const r = (await selectedNodes(page))[0];
    expect([r.width, r.height]).toEqual([100, 100]);
    // frame drawn around the rectangle wraps it
    await draw(page, 'f', -20, -20, 200, 200);
    const frame = (await selectedNodes(page))[0];
    const rect = (await nodes(page)).find((n) => n.type === 'RECTANGLE')!;
    expect(rect.parentId).toBe(frame.id);
    // drawing inside a frame nests the new shape
    await draw(page, 'o', 120, 120, 30, 30);
    const el = (await selectedNodes(page))[0];
    expect(el.parentId).toBe(frame.id);
    expect(errors).toEqual([]);
  });

  test('text tool: click for auto width, drag for fixed width', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await page.keyboard.press('t');
    await clickWorld(page, 0, 0);
    await expect(page.getByTestId('text-editor')).toBeVisible();
    await page.keyboard.type('Hello My Flow');
    await page.keyboard.press('Escape');
    let t = (await nodes(page)).find((n) => n.type === 'TEXT')!;
    expect(t.text!.characters).toBe('Hello My Flow');
    expect(t.text!.autoResize).toBe('WIDTH_AND_HEIGHT');
    expect(t.width).toBeGreaterThan(60);
    expect(t.name).toBe('Hello My Flow');
    // drag → fixed width that wraps
    await page.keyboard.press('t');
    const a = await toScreen(page, 0, 100), b = await toScreen(page, 80, 130);
    await drag(page, a, b);
    await page.keyboard.type('This text should wrap onto several lines');
    await page.keyboard.press('Escape');
    t = (await selectedNodes(page))[0];
    expect(t.text!.autoResize).toBe('HEIGHT');
    expect(t.width).toBe(80);
    expect(t.height).toBeGreaterThan(40);
    // empty text is discarded
    await page.keyboard.press('t');
    await clickWorld(page, 300, 300);
    await page.keyboard.press('Escape');
    expect((await nodes(page)).filter((n) => n.type === 'TEXT').length).toBe(2);
    // double-click edits existing text
    await page.keyboard.press('Escape');
    await clickWorld(page, 20, 8, { clickCount: 2 });
    await expect(page.getByTestId('text-editor')).toBeVisible();
    await page.keyboard.press(`${MOD}+a`);
    await page.keyboard.type('Edited');
    await page.keyboard.press('Escape');
    expect((await nodes(page)).some((n) => n.text?.characters === 'Edited')).toBe(true);
    expect(errors).toEqual([]);
  });

  test('pen tool builds a closed vector; pencil draws a freehand stroke', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await page.keyboard.press('p');
    await clickWorld(page, 0, 0);
    await clickWorld(page, 100, 0);
    await clickWorld(page, 50, 80);
    await clickWorld(page, 0, 0); // close
    let v = (await nodes(page)).find((n) => n.type === 'VECTOR')!;
    expect(v.points!.length).toBe(3);
    expect(v.closed).toBe(true);
    expect(Math.round(v.width)).toBe(100);
    // open path finished with Enter
    await page.keyboard.press('p');
    await clickWorld(page, 200, 0);
    await clickWorld(page, 300, 50);
    await page.keyboard.press('Enter');
    v = (await selectedNodes(page))[0];
    expect(v.closed).toBe(false);
    expect(v.points!.length).toBe(2);
    // pencil
    await page.keyboard.press('Shift+P');
    const pts = [[0, 200], [30, 230], [60, 210], [90, 250], [120, 220]];
    const s0 = await toScreen(page, pts[0][0], pts[0][1]);
    await page.mouse.move(s0.x, s0.y);
    await page.mouse.down();
    for (const [x, y] of pts.slice(1)) { const s = await toScreen(page, x, y); await page.mouse.move(s.x, s.y, { steps: 4 }); }
    await page.mouse.up();
    v = (await selectedNodes(page))[0];
    expect(v.type).toBe('VECTOR');
    expect(v.points!.length).toBeGreaterThan(2);
    // vector edit mode via Enter, drag a point
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('vpoint-0')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });

  test('place image via file chooser', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press(`${MOD}+Shift+k`);
    await (await chooser).setFiles({ name: 'pic.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByTestId('toast')).toContainText('place');
    await clickWorld(page, 50, 50);
    await expect.poll(async () => (await pageChildren(page)).length).toBe(1);
    const img = (await pageChildren(page))[0];
    expect(img.fills[0].type).toBe('IMAGE');
    expect(errors).toEqual([]);
  });
});
