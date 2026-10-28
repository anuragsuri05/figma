import { test, expect } from '@playwright/test';
import { collectErrors, newFile, draw, selectedNodes, setField, nodes, drag, toScreen } from './helpers';

test.describe('Design panel properties', () => {
  test('position, size, rotation, opacity, blend, radius, corners, smoothing', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 100, 100);
    await setField(page, 'prop-x', '25');
    await setField(page, 'prop-y', '30');
    await setField(page, 'prop-w', '200');
    await setField(page, 'prop-h', '50*2');
    let n = (await selectedNodes(page))[0];
    expect([n.x, n.y, n.width, n.height]).toEqual([25, 30, 200, 100]);
    await setField(page, 'prop-x', '+10');
    expect((await selectedNodes(page))[0].x).toBe(35);
    await setField(page, 'prop-rotation', '30');
    expect((await selectedNodes(page))[0].rotation).toBe(30);
    await setField(page, 'prop-opacity', '40');
    expect((await selectedNodes(page))[0].opacity).toBe(0.4);
    await page.getByTestId('prop-blend').selectOption('MULTIPLY');
    expect((await selectedNodes(page))[0]).toMatchObject({ blendMode: 'MULTIPLY' });
    await setField(page, 'prop-radius', '12');
    expect((await selectedNodes(page))[0].cornerRadius).toBe(12);
    await page.getByTestId('independent-corners').click();
    await setField(page, 'corner-2', '30');
    n = (await selectedNodes(page))[0] as any;
    expect((n as any).corners).toEqual([12, 12, 30, 12]);
    await setField(page, 'corner-smoothing', '60');
    expect((await selectedNodes(page))[0]).toMatchObject({ cornerSmoothing: 0.6 });
    // lock aspect ratio
    await page.getByTestId('lock-aspect').click();
    await setField(page, 'prop-w', '400');
    n = (await selectedNodes(page))[0];
    expect(n.height).toBe(200);
    // flips & rotate 90 buttons
    await page.getByTestId('rotate-90').click();
    await page.getByTestId('flip-v').click();
    expect((await selectedNodes(page))[0].flipY).toBe(true);
    // visibility from appearance
    await page.getByTestId('appearance-visibility').click();
    expect((await selectedNodes(page))[0].visible).toBe(false);
    expect(errors).toEqual([]);
  });

  test('fills: hex, add, remove, toggle, opacity, gradient, image types, color picker', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 100, 100);
    await setField(page, 'fills-hex-0', 'FF0000');
    expect((await selectedNodes(page))[0].fills[0].color).toBe('#FF0000');
    await setField(page, 'fills-opacity-0', '50');
    expect((await selectedNodes(page))[0].fills[0].opacity).toBe(0.5);
    await page.getByTestId('add-fills').click();
    expect((await selectedNodes(page))[0].fills.length).toBe(2);
    await page.getByTestId('fills-visible-1').click();
    expect((await selectedNodes(page))[0].fills[1].visible).toBe(false);
    await page.getByTestId('remove-fills-1').click();
    expect((await selectedNodes(page))[0].fills.length).toBe(1);
    // color picker: change type to linear gradient
    await page.getByTestId('fills-swatch-0').click();
    await expect(page.getByTestId('paint-picker')).toBeVisible();
    await page.getByTestId('hex-input').fill('00FF00');
    await page.getByTestId('hex-input').press('Enter');
    expect((await selectedNodes(page))[0].fills[0].color).toBe('#00FF00');
    // drag in saturation/value square
    const sv = (await page.getByTestId('cp-sv').boundingBox())!;
    await page.mouse.click(sv.x + sv.width * 0.5, sv.y + sv.height * 0.5);
    expect((await selectedNodes(page))[0].fills[0].color).not.toBe('#00FF00');
    for (const t of ['GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND']) {
      await page.getByTestId('paint-type').selectOption(t);
      expect((await selectedNodes(page))[0].fills[0].type).toBe(t);
    }
    await expect(page.getByTestId('gradient-editor')).toBeVisible();
    const bar = (await page.getByTestId('grad-bar').boundingBox())!;
    await page.mouse.click(bar.x + bar.width / 2, bar.y + bar.height / 2);
    expect(((await selectedNodes(page))[0].fills[0] as any).stops.length).toBe(3);
    await page.getByTestId('paint-type').selectOption('IMAGE');
    await expect(page.getByTestId('image-editor')).toBeVisible();
    await page.getByTestId('paint-type').selectOption('SOLID');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('paint-picker')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('strokes: add, weight, align, dash, caps on lines', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 100, 100);
    await page.getByTestId('add-strokes').click();
    let n = (await selectedNodes(page))[0];
    expect(n.strokes.length).toBe(1);
    await setField(page, 'stroke-weight', '4');
    await page.getByTestId('stroke-align').selectOption('OUTSIDE');
    n = (await selectedNodes(page))[0];
    expect([n.strokeWeight, n.strokeAlign]).toEqual([4, 'OUTSIDE']);
    await page.getByTestId('stroke-more').click();
    await page.getByTestId('stroke-style').selectOption('DASH');
    await setField(page, 'dash-length', '10');
    expect(((await selectedNodes(page))[0] as any).strokeDash).toEqual([10, 4]);
    await page.keyboard.press('Escape');
    await draw(page, 'l', 0, 200, 150, 0);
    await page.getByTestId('end-cap').selectOption('TRIANGLE');
    await page.getByTestId('start-cap').selectOption('CIRCLE');
    n = (await selectedNodes(page))[0];
    expect([n.startCap, n.endCap]).toEqual(['CIRCLE', 'TRIANGLE']);
    // swap fill & stroke shortcut
    await draw(page, 'r', 300, 0, 50, 50);
    await page.keyboard.press('Shift+x');
    n = (await selectedNodes(page))[0];
    expect(n.fills.length).toBe(0);
    expect(n.strokes.length).toBe(1);
    expect(errors).toEqual([]);
  });

  test('effects and layout grids', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'f', 0, 0, 300, 300);
    await page.getByTestId('add-effect').click();
    let n = (await selectedNodes(page))[0];
    expect(n.effects[0].type).toBe('DROP_SHADOW');
    await page.getByTestId('effect-settings-0').click();
    await setField(page, 'effect-blur', '20');
    await setField(page, 'effect-y', '8');
    await page.keyboard.press('Escape');
    for (const t of ['INNER_SHADOW', 'LAYER_BLUR', 'BACKGROUND_BLUR']) {
      await page.getByTestId('effect-type-0').selectOption(t);
      expect((await selectedNodes(page))[0].effects[0].type).toBe(t);
    }
    await page.getByTestId('remove-effect-0').click();
    expect((await selectedNodes(page))[0].effects.length).toBe(0);
    await page.getByTestId('add-grid').click();
    await page.getByTestId('grid-settings-0').click();
    await page.getByTestId('grid-pattern').selectOption('COLUMNS');
    await setField(page, 'grid-count', '12');
    await page.keyboard.press('Escape');
    n = (await selectedNodes(page))[0];
    expect(n.layoutGrids[0].pattern).toBe('COLUMNS');
    await expect(page.locator('[data-grid="1"]')).toHaveCount(1);
    // toggle layout grids view
    await page.keyboard.press('Control+g');
    await expect(page.locator('[data-grid="1"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('constraints, frame presets, clip content, shape-specific controls, export settings', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'f', 0, 0, 200, 200);
    await page.getByTestId('frame-presets').click();
    await page.getByTestId('menu-phone').hover();
    await page.getByText('iPhone 16  393×852').click();
    let f = (await selectedNodes(page))[0];
    expect([f.width, f.height]).toEqual([393, 852]);
    await page.getByTestId('clip-content').uncheck();
    expect((await selectedNodes(page))[0]).toMatchObject({ clipContent: false });
    await draw(page, 'r', 293, 20, 80, 40);
    await page.getByTestId('constraint-h').selectOption('RIGHT');
    await page.getByTestId('constraint-v').selectOption('TOP_BOTTOM');
    const rect = (await selectedNodes(page))[0];
    // resize the parent frame → child follows constraints
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), f.id);
    await setField(page, 'prop-w', '493');
    await setField(page, 'prop-h', '952');
    const r2 = (await nodes(page)).find((n) => n.id === rect.id)!;
    expect(r2.x).toBe(393);
    expect(r2.height).toBe(140);
    // ellipse arc & polygon count
    await draw(page, 'o', 600, 0, 100, 100);
    await setField(page, 'arc-sweep', '50');
    expect(((await selectedNodes(page))[0] as any).arcSweep).toBe(180);
    await page.keyboard.press('Escape');
    await page.getByTestId('tool-caret-shape').click();
    await page.getByTestId('tool-menu-polygon').click();
    await drag(page, await toScreen(page, 600, 300), await toScreen(page, 700, 400));
    await setField(page, 'point-count', '6');
    expect(((await selectedNodes(page))[0] as any).pointCount).toBe(6);
    // export settings
    await draw(page, 'r', 800, 0, 50, 50);
    await page.getByTestId('add-export').click();
    await page.getByTestId('add-export').click();
    await page.getByTestId('export-format-1').selectOption('SVG');
    const n = (await selectedNodes(page))[0];
    expect(n.exports.map((e) => e.format)).toEqual(['PNG', 'SVG']);
    await page.getByTestId('export-preview-toggle').click();
    await expect(page.getByTestId('export-preview')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('selection colors replace across children, page background', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'f', 0, 0, 300, 300);
    await draw(page, 'r', 10, 10, 50, 50);
    await draw(page, 'r', 100, 10, 50, 50);
    const frame = (await nodes(page)).find((n) => n.type === 'FRAME')!;
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), frame.id);
    await expect(page.getByTestId('selection-colors')).toBeVisible();
    const chip = page.getByTestId('sel-color-#D9D9D9').locator('input');
    await chip.fill('123456');
    await chip.press('Enter');
    const rects = (await nodes(page)).filter((n) => n.type === 'RECTANGLE');
    expect(rects.every((r) => r.fills[0].color === '#123456')).toBe(true);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await setField(page, 'page-bg-input', '222222');
    expect(await page.evaluate(() => (window as any).__myflow.get().doc.pages[0].background)).toBe('#222222');
    expect(errors).toEqual([]);
  });
});
