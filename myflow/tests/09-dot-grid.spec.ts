import { test, expect } from '@playwright/test';
import { collectErrors, newFile, MOD } from './helpers';

test('dot grid on the board: on by default, follows zoom/pan, toggles from menus and shortcut', async ({ page }) => {
  const errors = collectErrors(page);
  await newFile(page);
  const canvas = page.getByTestId('canvas');
  await expect(canvas).toHaveAttribute('data-dotgrid', 'on');
  const bg = () => canvas.evaluate((el) => ({ img: el.style.backgroundImage, size: el.style.backgroundSize, pos: el.style.backgroundPosition }));
  const a = await bg();
  expect(a.img).toContain('radial-gradient');
  expect(a.size).toBe('24px 24px');
  // zoom changes dot spacing
  await page.keyboard.press(`${MOD}+=`);
  expect((await bg()).size).toBe('48px 48px');
  // pan moves dots
  const before = (await bg()).pos;
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, 10);
  expect((await bg()).pos).not.toBe(before);
  // toggle via shortcut and zoom menu
  await page.keyboard.press('Shift+;');
  await expect(canvas).toHaveAttribute('data-dotgrid', 'off');
  expect((await bg()).img).toBe('');
  await page.getByTestId('zoom-menu').click();
  await page.getByTestId('zoom-dot-grid').click();
  await expect(canvas).toHaveAttribute('data-dotgrid', 'on');
  // main menu → View → Dot grid
  await page.getByTestId('main-menu-btn').click();
  await page.getByTestId('menu-view').hover();
  await page.getByTestId('cmd-view.dotGrid').click();
  await expect(canvas).toHaveAttribute('data-dotgrid', 'off');
  expect(errors).toEqual([]);
});
