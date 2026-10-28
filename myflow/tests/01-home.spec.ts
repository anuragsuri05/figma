import { test, expect } from '@playwright/test';
import { collectErrors, newFile, waitSaved, draw, nodes } from './helpers';

test.describe('File browser (home)', () => {
  test('create, rename, star, duplicate, trash, restore and delete files', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page.getByTestId('empty-files')).toBeVisible();
    // create a design file and draw something so it has content
    await page.getByTestId('new-design-file').click();
    await expect(page.getByTestId('editor')).toBeVisible();
    await expect(page.getByTestId('file-name')).toHaveText('Untitled');
    // rename inside editor
    await page.getByTestId('file-name').click();
    await page.getByTestId('file-name-input').fill('Alpha');
    await page.getByTestId('file-name-input').press('Enter');
    await expect(page.getByTestId('file-name')).toHaveText('Alpha');
    await page.evaluate(() => (window as any).__myflow.get().setState({ zoom: 1, panX: 300, panY: 120 }));
    await draw(page, 'r', 0, 0, 120, 80);
    await waitSaved(page);
    // back to files via main menu
    await page.getByTestId('main-menu-btn').click();
    await page.getByTestId('cmd-file.back').click();
    await expect(page.getByTestId('home')).toBeVisible();
    await expect(page.getByTestId('file-Alpha')).toBeVisible();
    // rename from home
    await page.getByTestId('file-more-Alpha').click();
    await page.getByTestId('file-rename').click();
    await page.getByTestId('file-rename-input').fill('Beta');
    await page.getByTestId('file-rename-input').press('Enter');
    await expect(page.getByTestId('file-Beta')).toBeVisible();
    // star
    await page.getByTestId('file-more-Beta').click();
    await page.getByTestId('file-star').click();
    await page.getByTestId('nav-starred').click();
    await expect(page.getByTestId('file-Beta')).toBeVisible();
    await page.getByTestId('nav-recents').click();
    // duplicate
    await page.getByTestId('file-more-Beta').click();
    await page.getByTestId('file-duplicate').click();
    await expect(page.getByTestId('file-Beta (Copy)')).toBeVisible();
    // duplicated file keeps content
    await page.getByTestId('file-Beta (Copy)').click();
    await expect(page.getByTestId('layer-Rectangle')).toBeVisible();
    await page.goto('/');
    // trash + restore + delete forever
    await page.getByTestId('file-more-Beta (Copy)').click();
    await page.getByTestId('file-trash').click();
    await expect(page.getByTestId('file-Beta (Copy)')).toHaveCount(0);
    await page.getByTestId('nav-trash').click();
    await expect(page.getByTestId('file-Beta (Copy)')).toBeVisible();
    await page.getByTestId('file-Beta (Copy)').click({ button: 'right' });
    await page.getByTestId('file-restore').click();
    await page.getByTestId('nav-recents').click();
    await expect(page.getByTestId('file-Beta (Copy)')).toBeVisible();
    await page.getByTestId('file-more-Beta (Copy)').click();
    await page.getByTestId('file-trash').click();
    await page.getByTestId('nav-trash').click();
    await page.getByTestId('file-more-Beta (Copy)').click();
    await page.getByTestId('file-delete-forever').click();
    await expect(page.getByTestId('file-Beta (Copy)')).toHaveCount(0);
    // search + list view
    await page.getByTestId('nav-recents').click();
    await page.getByTestId('home-search').fill('zzz');
    await expect(page.getByTestId('file-Beta')).toHaveCount(0);
    await page.getByTestId('home-search').fill('bet');
    await expect(page.getByTestId('file-Beta')).toBeVisible();
    await page.getByTestId('list-view').click();
    await expect(page.getByTestId('file-row-Beta')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('templates create editable files', async ({ page }) => {
    const errors = collectErrors(page);
    for (const t of ['mobile', 'landing', 'ds'] as const) {
      await newFile(page, t);
      const all = await nodes(page);
      expect(all.length).toBeGreaterThan(4);
    }
    await page.goto('/');
    await expect(page.getByTestId('file-Mobile app')).toBeVisible();
    await expect(page.getByTestId('file-Landing page')).toBeVisible();
    await expect(page.getByTestId('file-Design system')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('create menu, theme toggle and import of a .myflow file', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); // dark by default
    await page.getByTestId('home-theme').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByTestId('home-theme').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByTestId('create-btn').click();
    await page.getByTestId('create-design').click();
    await expect(page.getByTestId('editor')).toBeVisible();
    await page.goto('/');
    const doc = {
      format: 'myflow', version: 1,
      doc: { id: 'x', name: 'Imported doc', pages: [{ id: 'p1', name: 'Page 1', children: [], background: '#F5F5F5', flowStarts: [], guides: [], prototypeDevice: 'NONE', prototypeBackground: '#1E1E1E' }], nodes: {}, styles: [], collections: [], variables: [], comments: [] },
    };
    const chooser = page.waitForEvent('filechooser');
    await page.getByTestId('import-file').click();
    await (await chooser).setFiles({ name: 'test.myflow', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
    await expect(page.getByTestId('file-name')).toHaveText('Imported doc');
    expect(errors).toEqual([]);
  });
});
