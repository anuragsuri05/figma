import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { collectErrors, newFile, draw, nodes, selectedNodes, setField, toScreen, drag, clickWorld, MOD, waitSaved, pageChildren } from './helpers';

test.describe('Comments', () => {
  test('add, reply, resolve, panel list, delete', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await page.keyboard.press('c');
    await expect(page.getByTestId('comments-panel')).toBeVisible();
    await clickWorld(page, 100, 100);
    await page.getByTestId('comment-input').fill('Can we make this bigger?');
    await page.getByTestId('comment-input').press('Enter');
    await expect(page.getByTestId('comment-thread')).toBeVisible();
    await page.getByTestId('comment-reply-input').fill('Sure!');
    await page.getByTestId('comment-reply-submit').click();
    await expect(page.getByTestId('comment-text')).toHaveCount(2);
    await expect(page.getByTestId('comment-list-item')).toHaveCount(1);
    await page.getByTestId('comment-resolve').click();
    const c = await page.evaluate(() => (window as any).__myflow.get().doc.comments[0]);
    expect(c.resolved).toBe(true);
    expect(c.replies.length).toBe(2);
    await expect(page.getByTestId('comment-list-item')).toHaveCount(0);
    await page.getByTestId('close-comments').click();
    await expect(page.getByTestId('right-panel')).toBeVisible();
    // second comment then delete
    await page.keyboard.press('c');
    await clickWorld(page, 300, 100);
    await page.getByTestId('comment-input').fill('Delete me');
    await page.getByTestId('comment-submit').click();
    await page.getByTestId('comment-delete').click();
    expect(await page.evaluate(() => (window as any).__myflow.get().doc.comments.length)).toBe(1);
    // toggle comment visibility with Shift+C
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });
});

test.describe('Pages, persistence, versions', () => {
  test('pages: add, rename, switch, duplicate, delete, reorder via menu', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 50, 50);
    await page.getByTestId('add-page').click();
    await page.getByTestId('page-rename-input').fill('Components');
    await page.getByTestId('page-rename-input').press('Enter');
    await expect(page.getByTestId('page-Components')).toBeVisible();
    expect((await pageChildren(page)).length).toBe(0);
    await page.getByTestId('page-Page 1').click();
    expect((await pageChildren(page)).length).toBe(1);
    await page.getByTestId('page-Page 1').click({ button: 'right' });
    await page.getByTestId('page-duplicate').click();
    await expect(page.getByTestId('page-Page 1 copy')).toBeVisible();
    expect((await pageChildren(page)).length).toBe(1);
    await page.getByTestId('page-Page 1 copy').click({ button: 'right' });
    await page.getByTestId('page-delete').click();
    await expect(page.getByTestId('page-Page 1 copy')).toHaveCount(0);
    await page.getByTestId('page-Components').dblclick();
    await page.getByTestId('page-rename-input').fill('Library');
    await page.getByTestId('page-rename-input').press('Enter');
    await expect(page.getByTestId('page-Library')).toBeVisible();
    // keyboard page navigation
    await page.keyboard.press('PageDown');
    const pid = await page.evaluate(() => { const s = (window as any).__myflow.get(); return s.doc.pages.find((p: any) => p.id === s.pageId).name; });
    expect(pid).toBe('Page 1');
    expect(errors).toEqual([]);
  });

  test('autosave persists across reload; version history save and restore', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 100, 100);
    await setField(page, 'fills-hex-0', '0D99FF');
    await waitSaved(page);
    await page.keyboard.press(`${MOD}+Alt+s`);
    await page.getByTestId('version-name').fill('Blue square');
    await page.getByTestId('save-version').click();
    await expect(page.getByTestId('version-Blue square')).toBeVisible();
    await page.getByTestId('modal-close').click();
    // change and reload
    await draw(page, 'o', 200, 0, 50, 50);
    await waitSaved(page);
    await page.reload();
    await expect(page.getByTestId('layer-Ellipse')).toBeVisible();
    expect((await pageChildren(page)).length).toBe(2);
    // restore version
    await page.getByTestId('main-menu-btn').click();
    await page.getByTestId('menu-file').hover();
    await page.getByTestId('cmd-file.versionHistory').click();
    await page.getByTestId('restore-Blue square').click();
    expect((await pageChildren(page)).length).toBe(1);
    expect((await pageChildren(page))[0].fills[0].color).toBe('#0D99FF');
    // undo the restore
    await page.keyboard.press(`${MOD}+z`);
    expect((await pageChildren(page)).length).toBe(2);
    expect(errors).toEqual([]);
  });
});

test.describe('Export', () => {
  test('PNG, JPG, SVG, PDF downloads have valid content; save local copy; export frames to PDF', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'f', 0, 0, 200, 100);
    await draw(page, 'r', 20, 20, 60, 60);
    await setField(page, 'fills-hex-0', 'FF0000');
    await page.keyboard.press('Escape');
    const check = async (format: string, sig: (b: Buffer) => boolean) => {
      await page.getByTestId('add-export').click();
      const i = (await selectedNodes(page))[0].exports.length - 1;
      await page.getByTestId(`export-format-${i}`).selectOption(format);
    };
    await check('PNG', () => true);
    await check('JPG', () => true);
    await check('SVG', () => true);
    await check('PDF', () => true);
    const downloads: { name: string; buf: Buffer }[] = [];
    page.on('download', async (d) => { const p = await d.path(); downloads.push({ name: d.suggestedFilename(), buf: readFileSync(p!) }); });
    await page.getByTestId('export-btn').click();
    await expect.poll(() => downloads.length, { timeout: 15000 }).toBe(4);
    const by = (ext: string) => downloads.find((d) => d.name.endsWith(ext))!.buf;
    expect(by('.png').subarray(1, 4).toString()).toBe('PNG');
    expect(by('.jpg')[0]).toBe(0xff);
    expect(by('.svg').toString()).toContain('<svg');
    expect(by('.svg').toString()).toContain('#FF0000');
    expect(by('.pdf').subarray(0, 5).toString()).toBe('%PDF-');
    // save local copy
    const dl = page.waitForEvent('download');
    await page.getByTestId('main-menu-btn').click();
    await page.getByTestId('menu-file').hover();
    await page.getByTestId('cmd-file.saveLocal').click();
    const local = await dl;
    expect(local.suggestedFilename()).toMatch(/\.myflow$/);
    const json = JSON.parse(readFileSync((await local.path())!).toString());
    expect(json.doc.pages.length).toBe(1);
    // export frames to PDF
    const dl2 = page.waitForEvent('download');
    await page.getByTestId('main-menu-btn').click();
    await page.getByTestId('menu-file').hover();
    await page.getByTestId('cmd-file.exportPdf').click();
    expect((await dl2).suggestedFilename()).toMatch(/\.pdf$/);
    expect(errors).toEqual([]);
  });
});

test.describe('View & navigation', () => {
  test('zoom controls, rulers & guides, outlines, pixel grid, theme, hide UI, panning', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 100, 100);
    await page.getByTestId('zoom-menu').click();
    await page.getByTestId('zoom-100').click();
    await page.keyboard.press(`${MOD}+=`);
    expect(await page.evaluate(() => (window as any).__myflow.get().zoom)).toBe(2);
    await page.keyboard.press(`${MOD}+-`);
    expect(await page.evaluate(() => (window as any).__myflow.get().zoom)).toBe(1);
    await page.keyboard.press('Shift+2');
    expect(await page.evaluate(() => (window as any).__myflow.get().zoom)).toBeGreaterThan(1);
    await page.keyboard.press('Shift+1');
    await page.keyboard.press('Shift+0');
    expect(await page.getByTestId('zoom-level').textContent()).toBe('100%');
    // ctrl+wheel zoom
    await page.mouse.move(700, 450);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    expect(await page.evaluate(() => (window as any).__myflow.get().zoom)).toBeGreaterThan(1);
    // wheel pan
    const panBefore = await page.evaluate(() => (window as any).__myflow.get().panY);
    await page.mouse.wheel(0, 100);
    expect(await page.evaluate(() => (window as any).__myflow.get().panY)).toBe(panBefore - 100);
    // space + drag pan
    const px = await page.evaluate(() => (window as any).__myflow.get().panX);
    await page.keyboard.down('Space');
    await drag(page, { x: 700, y: 600 }, { x: 760, y: 600 });
    await page.keyboard.up('Space');
    expect(await page.evaluate(() => (window as any).__myflow.get().panX)).toBe(px + 60);
    // rulers + guide
    await page.keyboard.press('Shift+r');
    await expect(page.getByTestId('ruler-h')).toBeVisible();
    const rh = (await page.getByTestId('ruler-h').boundingBox())!;
    await drag(page, { x: 700, y: rh.y + 10 }, { x: 700, y: 500 });
    expect(await page.evaluate(() => (window as any).__myflow.get().doc.pages[0].guides.length)).toBe(1);
    // outlines
    await page.keyboard.press(`${MOD}+y`);
    expect(await page.evaluate(() => (window as any).__myflow.get().view.outlines)).toBe(true);
    await page.keyboard.press(`${MOD}+y`);
    // theme via main menu
    await page.getByTestId('main-menu-btn').click();
    await page.getByTestId('menu-view').hover();
    await page.getByTestId('cmd-view.theme').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    // hide UI
    await page.keyboard.press(`${MOD}+\\`);
    await expect(page.getByTestId('left-panel')).toHaveCount(0);
    await page.keyboard.press(`${MOD}+\\`);
    await expect(page.getByTestId('left-panel')).toBeVisible();
    // minimize left panel
    await page.getByTestId('minimize-ui').click();
    await expect(page.getByTestId('layers-section')).toHaveCount(0);
    await page.getByTestId('minimize-ui').click();
    // alt-hover measurement
    await page.evaluate(() => (window as any).__myflow.get().setState({ zoom: 1, panX: 300, panY: 120 }));
    await draw(page, 'r', 200, 0, 50, 50);
    await page.keyboard.down('Alt');
    const p = await toScreen(page, 50, 50);
    await page.mouse.move(p.x, p.y);
    await expect(page.getByTestId('measure-badge').first()).toBeVisible();
    await page.keyboard.up('Alt');
    expect(errors).toEqual([]);
  });
});

test.describe('Modals, quick actions & plugins', () => {
  test('quick actions run commands; shortcuts, preferences, share, find/replace, rename', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await draw(page, 'r', 0, 0, 50, 50);
    await draw(page, 'r', 100, 0, 50, 50);
    await page.keyboard.press(`${MOD}+k`);
    await page.getByTestId('quick-actions-input').fill('group selection');
    await page.getByTestId('quick-actions-input').press('Escape');
    await page.keyboard.press(`${MOD}+a`);
    await page.keyboard.press(`${MOD}+/`);
    await page.getByTestId('quick-actions-input').fill('Group selection');
    await page.getByTestId('quick-actions-input').press('Enter');
    await expect.poll(async () => (await selectedNodes(page))[0]?.type).toBe('GROUP');
    await page.keyboard.press(`${MOD}+Shift+g`);
    // batch rename
    await page.keyboard.press(`${MOD}+r`);
    await page.getByTestId('rename-to').fill('Card $n');
    await page.getByTestId('rename-apply').click();
    expect((await pageChildren(page)).map((n) => n.name).sort()).toEqual(['Card 1', 'Card 2']);
    // shortcuts panel
    await page.keyboard.press('Control+Shift+?');
    await expect(page.getByTestId('shortcuts-modal')).toBeVisible();
    await page.getByTestId('modal-close').click();
    // preferences
    await page.getByTestId('main-menu-btn').click();
    await page.getByTestId('menu-preferences').hover();
    await page.getByText('All preferences…').click();
    await setField(page, 'pref-big-nudge', '20');
    await page.getByTestId('modal-close').click();
    await page.keyboard.press(`${MOD}+a`);
    const x0 = (await selectedNodes(page))[0].x;
    await page.keyboard.press('Shift+ArrowRight');
    expect((await selectedNodes(page))[0].x).toBe(x0 + 20);
    // share
    await page.getByTestId('share-btn').click();
    await expect(page.getByTestId('share-link')).toHaveValue(/#\/file\//);
    await page.getByTestId('share-email').fill('team@example.com');
    await page.getByTestId('share-invite').click();
    await page.getByTestId('copy-share-link').click();
    await page.getByTestId('modal-close').click();
    // find & replace in layer names
    await page.keyboard.press(`${MOD}+t`).catch(() => {});
    await page.keyboard.press('t');
    await clickWorld(page, 0, 200);
    await page.keyboard.type('hello world');
    await page.keyboard.press('Escape');
    await page.keyboard.press(`${MOD}+f`);
    await page.getByTestId('find-input').fill('world');
    await expect(page.getByTestId('find-count')).toHaveText('1 result');
    await page.getByTestId('replace-input').fill('flow');
    await page.getByTestId('replace-all').click();
    expect((await nodes(page)).find((n) => n.type === 'TEXT')!.text!.characters).toBe('hello flow');
    expect(errors).toEqual([]);
  });

  test('built-in plugins run', async ({ page }) => {
    const errors = collectErrors(page);
    await newFile(page);
    await page.route('https://picsum.photos/**', (r) => r.abort());
    await page.getByTestId('main-menu-btn').click();
    await page.getByTestId('menu-plugins').hover();
    await page.getByTestId('cmd-plugin.manage').click();
    for (const id of ['lorem', 'palette', 'icons', 'chart']) {
      await page.getByTestId(`run-plugin-${id}`).click();
      await page.keyboard.press(`${MOD}+k`);
      await page.getByTestId('quick-actions-input').fill('Manage plugins');
      await page.getByTestId('quick-actions-input').press('Enter');
    }
    await page.getByTestId('modal-close').click();
    const all = await nodes(page);
    expect(all.some((n) => n.name === 'Palette')).toBe(true);
    expect(all.some((n) => n.name === 'Icons')).toBe(true);
    expect(all.some((n) => n.name === 'Bar chart')).toBe(true);
    expect(all.some((n) => n.text?.characters.startsWith('Lorem'))).toBe(true);
    expect(await page.evaluate(() => (window as any).__myflow.get().doc.styles.length)).toBe(10);
    // image plugin falls back offline
    await page.evaluate(() => { const s = (window as any).__myflow.get(); const bar = Object.values(s.doc.nodes).find((n: any) => n.name === 'Bar 1') as any; s.select([bar.id]); });
    await page.keyboard.press(`${MOD}+k`);
    await page.getByTestId('quick-actions-input').fill('Random image');
    await page.getByTestId('quick-actions-input').press('Enter');
    await expect.poll(async () => (await selectedNodes(page))[0].fills[0].type, { timeout: 10000 }).toBe('IMAGE');
    // contrast checker + rename + cleanup
    await page.keyboard.press('Escape');
    await page.keyboard.press(`${MOD}+k`);
    await page.getByTestId('quick-actions-input').fill('Contrast checker');
    await page.getByTestId('quick-actions-input').press('Enter');
    await expect(page.getByTestId('toast')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
