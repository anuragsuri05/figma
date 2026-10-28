import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Smoke-tests the packaged desktop app (release/mac/My Flow.app on Intel,
 * release/mac-arm64 on Apple Silicon). Run: npx playwright test -c playwright.desktop.config.ts
 */
const arch = os.arch() === 'arm64' ? 'mac-arm64' : 'mac';
const exe = path.resolve(`release/${arch}/My Flow.app/Contents/MacOS/My Flow`);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'myflow-desktop-'));

async function launch(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({ executablePath: exe, args: [`--user-data-dir=${userData}`] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

test.describe.configure({ mode: 'serial' });

test('packaged app launches, edits, persists across relaunch', async () => {
  test.skip(!fs.existsSync(exe), `build first: ${exe}`);
  let { app, page } = await launch();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await expect(page.getByTestId('home')).toBeVisible();
  expect(await page.evaluate(() => location.origin)).toBe('myflow://app');
  expect(await page.title()).toBe('My Flow');
  expect(await app.evaluate(({ app: a }) => a.getName())).toBe('My Flow');
  // create a file and draw
  await page.getByTestId('new-design-file').click();
  await expect(page.getByTestId('editor')).toBeVisible();
  await page.evaluate(() => (window as any).__myflow.get().setState({ zoom: 1, panX: 400, panY: 200 }));
  await page.keyboard.press('r');
  await page.mouse.move(450, 250); await page.mouse.down(); await page.mouse.move(600, 350, { steps: 5 }); await page.mouse.up();
  await expect(page.getByTestId('layer-Rectangle')).toBeVisible();
  // copy / paste through the same native commands the Edit menu roles call (webContents.copy/paste)
  const roles = await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.items.find((i) => i.label === 'Edit')!.submenu!.items.map((i) => i.role));
  expect(roles).toEqual(['cut', 'copy', 'paste']);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.copy());
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.paste());
  await expect.poll(() => page.evaluate(() => (window as any).__myflow.get().doc.pages[0].children.length)).toBe(2);
  // in-app shortcuts are not swallowed by the native menu (⌘R = rename layer, not reload)
  await page.keyboard.press('Meta+r');
  await expect(page.getByTestId('rename-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  // AI panel opens in the desktop app too
  await page.keyboard.press('Meta+j');
  await expect(page.getByTestId('ai-panel')).toBeVisible();
  await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 5000 });
  expect(errors).toEqual([]);
  await app.close();
  // relaunch: the file is still there (IndexedDB in the app's own profile)
  ({ app, page } = await launch());
  await expect(page.getByTestId('file-Untitled')).toBeVisible();
  await app.close();
});

test('external links open in the browser, not inside the app', async () => {
  test.skip(!fs.existsSync(exe), 'build first');
  const { app, page } = await launch();
  const opened = await app.evaluate(({ shell }) => { const calls: string[] = []; (shell as any).openExternal = async (u: string) => { calls.push(u); }; (globalThis as any).__calls = calls; return true; });
  expect(opened).toBe(true);
  await page.evaluate(() => window.open('https://example.com/docs', '_blank'));
  await expect.poll(() => app.evaluate(() => (globalThis as any).__calls)).toEqual(['https://example.com/docs']);
  expect(app.windows().length).toBe(1);
  await app.close();
});

test('DMG contains the app and an Applications shortcut', async () => {
  const dmg = fs.readdirSync('release').find((f) => f.endsWith(`-mac-${os.arch() === 'arm64' ? 'arm64' : 'x64'}.dmg`));
  test.skip(!dmg, 'no dmg');
  const out = execSync(`hdiutil attach -nobrowse -readonly "release/${dmg}"`).toString();
  const mount = out.trim().split('\n').pop()!.split('\t').pop()!.trim();
  try {
    expect(fs.existsSync(path.join(mount, 'My Flow.app'))).toBe(true);
    expect(fs.lstatSync(path.join(mount, 'Applications')).isSymbolicLink()).toBe(true);
  } finally {
    execSync(`hdiutil detach "${mount}" -quiet`);
  }
});
