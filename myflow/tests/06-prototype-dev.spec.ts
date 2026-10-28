import { test, expect } from '@playwright/test';
import { collectErrors, newFile, draw, nodes, selectedNodes, setField, toScreen, drag, nodeByName, MOD, clickWorld } from './helpers';

test.describe('Prototyping', () => {
  test('connect frames by dragging the noodle, configure, present and navigate', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'f', 0, 0, 300, 400);
    const a = (await selectedNodes(page))[0];
    await draw(page, 'r', 50, 50, 120, 50);
    const btn = (await selectedNodes(page))[0];
    await draw(page, 'f', 400, 0, 300, 400);
    const b = (await selectedNodes(page))[0];
    await page.getByTestId('tab-prototype').click();
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), btn.id);
    const h = (await page.getByTestId('noodle-handle').boundingBox())!;
    await drag(page, { x: h.x + h.width / 2, y: h.y + h.height / 2 }, await toScreen(page, 550, 200));
    let n = (await nodes(page)).find((x) => x.id === btn.id)!;
    expect(n.reactions.length).toBe(1);
    expect(n.reactions[0].destinationId).toBe(b.id);
    await expect(page.getByTestId('noodle')).toHaveCount(1);
    // flow starting point got created automatically
    expect(await page.evaluate(() => (window as any).__myflow.get().doc.pages[0].flowStarts.length)).toBe(1);
    // configure animation
    await page.getByTestId('reaction-toggle-0').click();
    await page.getByTestId('animation-0').selectOption('SMART_ANIMATE');
    await page.getByTestId('easing-0').selectOption('EASE_IN_OUT');
    await setField(page, 'duration-0', '250');
    n = (await nodes(page)).find((x) => x.id === btn.id)!;
    expect(n.reactions[0].animation).toBe('SMART_ANIMATE');
    // back interaction on frame B
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), b.id);
    await page.getByTestId('add-interaction').click();
    await page.getByTestId('action-0').selectOption('BACK');
    // overflow setting
    await page.getByTestId('overflow').selectOption('VERTICAL');
    // present
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), a.id);
    await page.getByTestId('present-btn').click();
    await expect(page.getByTestId('present')).toBeVisible();
    await expect(page.getByTestId('present-frame-name')).toHaveText(a.name);
    const screen = page.getByTestId('present-screen');
    const sb = (await screen.boundingBox())!;
    const scale = sb.width / 300;
    await page.mouse.click(sb.x + 100 * scale, sb.y + 70 * scale);
    await expect(page.getByTestId('present-frame-name')).toHaveText(b.name);
    // click on B triggers BACK
    const sb2 = (await page.getByTestId('present-screen').boundingBox())!;
    await page.mouse.click(sb2.x + 20, sb2.y + 20);
    await expect(page.getByTestId('present-frame-name')).toHaveText(a.name);
    // next/prev/restart controls
    await page.getByTestId('present-next').click();
    await expect(page.getByTestId('present-frame-name')).toHaveText(b.name);
    await page.getByTestId('present-restart').click();
    await expect(page.getByTestId('present-frame-name')).toHaveText(a.name);
    await page.getByTestId('present-fit').selectOption('actual');
    await page.getByTestId('present-close').click();
    await expect(page.getByTestId('editor')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('overlays, after-delay and interactive component hover', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page, 'mobile');
    // template has an interactive Button (hover → Hover variant) and smart-animate navigation
    await page.getByTestId('present-btn').click();
    await expect(page.getByTestId('present-frame-name')).toHaveText('Home');
    const screen = (await page.getByTestId('present-screen').boundingBox())!;
    const scale = screen.width / 393;
    // hover the button instance → variant changes to Hover
    const inst = (await page.evaluate(() => Object.values((window as any).__myflow.get().doc.nodes).find((n: any) => n.type === 'INSTANCE' && n.parentId))) as any;
    await page.mouse.move(screen.x + (inst.x + 10) * scale, screen.y + (inst.y + 10) * scale);
    await expect.poll(async () => page.locator('[data-testid="present-screen"] [data-id]').count()).toBeGreaterThan(3);
    // click → navigates to Details with smart animate
    await page.mouse.click(screen.x + (inst.x + 10) * scale, screen.y + (inst.y + 10) * scale);
    await expect(page.getByTestId('present-frame-name')).toHaveText('Details');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('editor')).toBeVisible();
    await expect(page.getByTestId('layer-Home')).toBeVisible();
    await page.waitForTimeout(250);
    // build an overlay + after delay
    await page.evaluate(() => { const s = (window as any).__myflow.get(); s.setState({ zoom: 1, panX: -200, panY: 400 }); });
    await draw(page, 'f', 950, -200, 200, 120);
    const modal = (await selectedNodes(page))[0];
    const home = await nodeByName(page, 'Home');
    await page.getByTestId('tab-prototype').click();
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), home.id);
    await page.getByTestId('add-interaction').click();
    const idx = (await selectedNodes(page))[0].reactions.length - 1;
    await page.getByTestId(`trigger-${idx}`).selectOption('AFTER_DELAY');
    await setField(page, `delay-${idx}`, '200');
    await page.getByTestId(`action-${idx}`).selectOption('OPEN_OVERLAY');
    await page.getByTestId(`destination-${idx}`).selectOption(modal.id);
    await page.getByTestId('present-btn').click();
    await expect(page.getByTestId('present-overlay')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('flow starting points panel and prototype settings', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'f', 0, 0, 200, 200);
    await page.getByTestId('tab-prototype').click();
    await page.getByTestId('add-flow').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('flow-Flow 1')).toBeVisible();
    await page.getByTestId('proto-device').selectOption('IPHONE_16');
    await setField(page, 'proto-bg', '333333');
    const pg = await page.evaluate(() => (window as any).__myflow.get().doc.pages[0]);
    expect([pg.prototypeDevice, pg.prototypeBackground]).toEqual(['IPHONE_16', '#333333']);
    await page.getByTestId('present-flow-Flow 1').click();
    await expect(page.getByTestId('present')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('Dev Mode', () => {
  test('inspect, code languages, ready for dev, annotations, asset export', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'f', 0, 0, 300, 200);
    await page.keyboard.press('Shift+a');
    await setField(page, 'prop-radius', '16');
    const frame = (await selectedNodes(page))[0];
    await page.keyboard.press('Shift+d');
    await expect(page.getByTestId('dev-panel')).toBeVisible();
    await expect(page.getByTestId('code-block')).toContainText('border-radius: 16px');
    await expect(page.getByTestId('code-block')).toContainText('display: flex');
    for (const [lang, txt] of [['TAILWIND', 'rounded-[16px]'], ['SWIFTUI', 'cornerRadius(16)'], ['COMPOSE', 'RoundedCornerShape']] as const) {
      await page.getByTestId('code-lang').selectOption(lang);
      await expect(page.getByTestId('code-block')).toContainText(txt);
    }
    await page.getByTestId('dev-status').selectOption('READY');
    expect((await nodes(page)).find((n) => n.id === frame.id)!.devStatus).toBe('READY');
    await expect(page.getByTestId('ready-status')).toBeVisible();
    await page.getByTestId('annotation-input').fill('Use 16px radius token');
    await page.getByTestId('annotation-input').press('Enter');
    await expect(page.getByTestId('annotation-text')).toHaveText('Use 16px radius token');
    const dl = page.waitForEvent('download');
    await page.getByTestId('dev-export-SVG').click();
    expect((await dl).suggestedFilename()).toMatch(/\.svg$/);
    await page.getByTestId('copy-code').click();
    await expect(page.getByTestId('toast')).toContainText('Copied');
    // design edits are blocked in dev mode
    const before = (await nodes(page)).length;
    await page.keyboard.press('r');
    await drag(page, await toScreen(page, 500, 500), await toScreen(page, 600, 600));
    expect((await nodes(page)).length).toBe(before);
    await page.getByTestId('mode-design').click();
    await expect(page.getByTestId('tab-design')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('Variables, modes & styles', () => {
  test('create collection, variables, modes; bind fill; switch mode on frame', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await page.getByTestId('open-variables-btn').click();
    await expect(page.getByTestId('variables-modal')).toBeVisible();
    await page.getByTestId('create-variable').click();
    await page.getByTestId('create-var-color').click();
    await expect(page.getByTestId('var-row-color-1')).toBeVisible();
    await page.getByTestId('var-value-color-1-Mode 1').fill('FF0000');
    await page.getByTestId('var-value-color-1-Mode 1').press('Enter');
    await page.getByTestId('add-mode').click();
    await page.getByTestId('var-value-color-1-Mode 2').fill('0000FF');
    await page.getByTestId('var-value-color-1-Mode 2').press('Enter');
    await page.getByTestId('create-variable').click();
    await page.getByTestId('create-var-number').click();
    await page.getByTestId('modal-close').click();
    // bind to a rectangle fill via the styles/variables menu
    await draw(page, 'f', 0, 0, 300, 300);
    const frame = (await selectedNodes(page))[0];
    await draw(page, 'r', 20, 20, 100, 100);
    await page.getByTestId('fills-styles-btn').click();
    await page.getByTestId('apply-var-color-1').click();
    let r = (await selectedNodes(page))[0];
    expect(r.fills[0].variableId).toBeTruthy();
    expect(r.fills[0].color).toBe('#FF0000');
    await expect(page.getByTestId('fills-var-chip')).toBeVisible();
    // switch mode on the frame
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), frame.id);
    const modeSel = page.getByTestId('mode-select-Collection');
    const opts = await modeSel.locator('option').allTextContents();
    await modeSel.selectOption({ label: opts.find((o) => o === 'Mode 2')! });
    r = (await nodes(page)).find((n) => n.id === r.id)!;
    expect(r.fills[0].color).toBe('#0000FF');
    // edit variable value in modal → bound layers update
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.getByTestId('open-variables-btn').click();
    await page.getByTestId('var-value-color-1-Mode 2').fill('00FF00');
    await page.getByTestId('var-value-color-1-Mode 2').press('Enter');
    await page.getByTestId('modal-close').click();
    r = (await nodes(page)).find((n) => n.id === r.id)!;
    expect(r.fills[0].color).toBe('#00FF00');
    expect(errors).toEqual([]);
  });

  test('color styles: create from fill, apply, edit propagates, detach, delete', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 80, 80);
    await setField(page, 'fills-hex-0', 'FF7262');
    await page.getByTestId('fills-styles-btn').click();
    await page.getByTestId('create-style-from-fills').click();
    await expect(page.getByTestId('fills-style-chip')).toBeVisible();
    const styleName = await page.evaluate(() => (window as any).__myflow.get().doc.styles[0].name);
    await draw(page, 'r', 200, 0, 80, 80);
    await page.getByTestId('fills-styles-btn').click();
    await page.getByTestId(`apply-style-${styleName}`).click();
    expect((await selectedNodes(page))[0].fills[0].color).toBe('#FF7262');
    // edit style in styles modal
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.getByTestId(`style-row-${styleName}`).locator('button').click();
    await expect(page.getByTestId('styles-modal')).toBeVisible();
    await page.getByTestId('styles-modal').getByTestId('hex-input').fill('00FF00');
    await page.getByTestId('styles-modal').getByTestId('hex-input').press('Enter');
    await page.getByTestId('modal-close').click();
    const rects = (await nodes(page)).filter((n) => n.type === 'RECTANGLE');
    expect(rects.every((r) => r.fills[0].color === '#00FF00')).toBe(true);
    // detach on one
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), rects[0].id);
    await page.getByTestId('detach-fills-style').click();
    await expect(page.getByTestId('fills-hex-0')).toBeVisible();
    // effect style + delete style
    await page.getByTestId('add-effect').click();
    await page.getByTestId('effect-styles-btn').click();
    await page.getByTestId('create-effect-style').click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.getByTestId(`style-row-${styleName}`).locator('button').click();
    await page.getByTestId('delete-style').click();
    expect(await page.evaluate(() => (window as any).__myflow.get().doc.styles.length)).toBe(1);
    expect(errors).toEqual([]);
  });
});
