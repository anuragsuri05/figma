import { test, expect } from '@playwright/test';
import { collectErrors, newFile } from './helpers';

test('dark theme: default, editor toggle, persists across reload, all surfaces themed', async ({ page }) => {
  const errors = collectErrors(page);
  await newFile(page);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const panelBg = () => page.getByTestId('right-panel').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await panelBg()).toBe('rgb(44, 44, 44)');
  expect(await page.getByTestId('canvas').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(30, 30, 30)');
  // toggle to light from the editor
  await page.getByTestId('theme-toggle').click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  expect(await panelBg()).toBe('rgb(255, 255, 255)');
  // persists across reload (no flash: set before React mounts)
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByTestId('theme-toggle').click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  // follow system via Preferences
  await page.getByTestId('main-menu-btn').click();
  await page.getByTestId('menu-preferences').hover();
  await page.getByTestId('menu-theme').hover();
  await page.getByTestId('menu-follow-system').click();
  expect(await page.evaluate(() => (window as any).__myflow.get().prefs.theme)).toBe('system');
  expect(errors).toEqual([]);
});
