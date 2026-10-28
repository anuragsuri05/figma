import { test, expect, type Page } from '@playwright/test';
import { collectErrors, newFile, draw, MOD } from './helpers';

/**
 * Smoke test: every main-menu command and every toolbar button can be triggered
 * against a realistic selection without throwing.
 */

async function prepare(page: Page) {
  await newFile(page, 'mobile');
  await page.route('https://picsum.photos/**', (r) => r.abort());
  await page.evaluate(() => (window as any).__myflow.get().setState({ zoom: 0.5, panX: 400, panY: 300 }));
  await draw(page, 'r', 1000, 0, 80, 80);
  await draw(page, 'o', 1100, 0, 80, 80);
  await page.keyboard.press(`${MOD}+a`);
}

const SKIP = new Set([
  'file.back', 'file.new', 'file.delete', 'file.duplicate', 'file.rename', // navigate away / native dialogs
  'proto.present', // covered in prototype tests
  'tool.image', 'file.placeImage', // opens native file chooser
]);

test('every main-menu command runs without errors', async ({ page }) => {
  test.setTimeout(420_000);
  const errors = collectErrors(page);
  page.on('dialog', (d) => d.dismiss());
  await prepare(page);
  const ids: string[] = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll('[data-testid="main-menu-btn"]').forEach(() => {});
    return out;
  });
  // collect the menu tree by opening every submenu
  await page.getByTestId('main-menu-btn').click();
  const topItems = await page.locator('[data-testid="main-menu"] .menu-item').allTextContents();
  await page.keyboard.press('Escape');
  const submenus = topItems.map((t) => t.replace(/[⌘⇧⌥⌃↩›].*$/, '').trim()).filter((t) => ['File', 'Edit', 'View', 'Object', 'Text', 'Arrange', 'Prototype', 'Plugins', 'Preferences', 'Help and account'].includes(t));
  expect(submenus.length).toBe(10);
  let ran = 0;
  for (const sub of submenus) {
    await page.getByTestId('main-menu-btn').click();
    await page.getByTestId('menu-' + sub.toLowerCase().replace(/[^a-z0-9]+/g, '-')).hover();
    const testIds = await page.locator('.menu [data-testid^="cmd-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!));
    await page.keyboard.press('Escape');
    for (const tid of testIds) {
      const id = tid.slice(4);
      if (SKIP.has(id) || ids.includes(id)) continue;
      // re-select something before each command
      await page.evaluate(() => {
        const s = (window as any).__myflow.get();
        if (s.modal) s.setState({ modal: null });
        if (s.editingTextId) s.setState({ editingTextId: null });
        if (s.mode === 'dev') s.setState({ mode: 'design' });
        s.setView({ showUI: true });
        s.setState({ commentsPanel: false, tool: 'MOVE', contextMenu: null });
        const page = s.doc.pages.find((p: any) => p.id === s.pageId) ?? s.doc.pages[0];
        if (!s.selection.length) s.select(page.children.slice(-2));
      });
      await page.getByTestId('main-menu-btn').click();
      await page.getByTestId('menu-' + sub.toLowerCase().replace(/[^a-z0-9]+/g, '-')).hover();
      const item = page.getByTestId(tid).first();
      if (!(await item.isVisible())) {
        // nested submenu ("Copy as", "Boolean groups" …) — hover parents
        const parents = page.locator('.menu .menu-item:has(.arrow)');
        const n = await parents.count();
        for (let i = 0; i < n && !(await item.isVisible()); i++) await parents.nth(i).hover();
      }
      if (await item.isVisible()) {
        const disabled = await item.evaluate((e) => e.classList.contains('disabled'));
        await item.click();
        if (!disabled) ran++;
      }
      await page.keyboard.press('Escape').catch(() => {});
      ids.push(id);
      // ensure we are still in the editor
      if (!(await page.getByTestId('editor').isVisible())) await page.goBack();
    }
  }
  expect(ran).toBeGreaterThan(80);
  expect(errors).toEqual([]);
});

test('every toolbar button and design-panel action button works', async ({ page }) => {
  const errors = collectErrors(page);
  await prepare(page);
  const toolbar = page.getByTestId('toolbar');
  const buttons = toolbar.locator('button');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const b = buttons.nth(i);
    if (!(await b.isVisible())) continue;
    const tid = await b.getAttribute('data-testid');
    if (tid === 'tool-image') continue;
    await b.click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    if (await page.getByTestId('quick-actions').isVisible().catch(() => false)) await page.getByTestId('modal-close').click();
    if (await page.locator('.menu').isVisible().catch(() => false)) await page.keyboard.press('Escape');
    await page.evaluate(() => { const s = (window as any).__myflow.get(); s.setState({ mode: 'design', tool: 'MOVE', commentsPanel: false }); });
  }
  // every icon button in the design panel on a multi-selection
  await page.keyboard.press(`${MOD}+a`);
  const panelBtns = page.getByTestId('right-panel').locator('.icon-btn');
  const n = await panelBtns.count();
  for (let i = 0; i < n; i++) {
    const b = panelBtns.nth(i);
    if (!(await b.isVisible().catch(() => false))) continue;
    await b.click({ timeout: 2000 }).catch(() => {});
    await page.keyboard.press('Escape');
    await page.evaluate(() => { const s = (window as any).__myflow.get(); if (!s.selection.length) s.select(s.doc.pages[0].children.slice(-2)); s.setState({ modal: null }); });
  }
  expect(errors).toEqual([]);
});
