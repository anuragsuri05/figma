import { expect, type Page } from '@playwright/test';

export const MOD = 'ControlOrMeta';

export interface NodeLite {
  id: string; type: string; name: string; parentId: string | null; children: string[];
  x: number; y: number; width: number; height: number; rotation: number; opacity: number; visible: boolean; locked: boolean;
  fills: { type: string; color: string; opacity: number; variableId?: string; visible: boolean }[];
  strokes: { type: string; color: string }[]; strokeWeight: number; strokeAlign: string; cornerRadius: number;
  effects: { type: string }[]; layout: { mode: string; gap: number; paddingLeft: number; paddingTop: number; alignMain: string; alignCross: string };
  sizingH: string; sizingV: string; text?: { characters: string; fontSize: number; fontWeight: number; textAlign: string; autoResize: string; italic: boolean; decoration: string; listType: string; textCase: string; fontFamily: string };
  mainComponentId?: string; reactions: { trigger: string; action: string; destinationId: string | null; animation: string }[];
  exports: { format: string; scale: number }[]; isMask: boolean; booleanOp?: string; flipX?: boolean; flipY?: boolean; constraintH: string; constraintV: string;
  layoutGrids: { pattern: string }[]; devStatus?: string | null; annotations?: { text: string }[]; overrides?: string[]; variableModes?: Record<string, string>;
  points?: { x: number; y: number }[]; closed?: boolean; startCap?: string; endCap?: string; absolutePosition?: boolean; componentDescription?: string;
}

export async function state<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(`(() => { const s = window.__myflow.get(); return (${fn})(s); })()`) as Promise<T>;
}

export async function nodes(page: Page): Promise<NodeLite[]> {
  return state<NodeLite[]>(page, 's => Object.values(s.doc ? s.doc.nodes : {})');
}

export async function nodeByName(page: Page, name: string): Promise<NodeLite> {
  const all = await nodes(page);
  const n = all.find((x) => x.name === name);
  if (!n) throw new Error(`node "${name}" not found. Have: ${all.map((x) => x.name).join(', ')}`);
  return n;
}

export async function selection(page: Page): Promise<string[]> {
  return state<string[]>(page, 's => s.selection');
}

export async function selectedNodes(page: Page): Promise<NodeLite[]> {
  return state<NodeLite[]>(page, 's => s.selection.map(id => s.doc.nodes[id])');
}

export async function pageChildren(page: Page): Promise<NodeLite[]> {
  return state<NodeLite[]>(page, 's => s.doc.pages.find(p => p.id === s.pageId).children.map(id => s.doc.nodes[id])');
}

export async function newFile(page: Page, template?: 'mobile' | 'landing' | 'ds') {
  await page.goto('/');
  await expect(page.getByTestId('home')).toBeVisible();
  await page.getByTestId(template ? `template-${template}` : 'new-design-file').click();
  await expect(page.getByTestId('editor')).toBeVisible();
  await expect(page.getByTestId('canvas')).toBeVisible();
  // stable viewport: zoom 100% centred on origin
  await page.waitForTimeout(150);
  await page.evaluate(() => { const s = (window as any).__myflow.get(); s.setState({ zoom: 1, panX: 300, panY: 120 }); });
}

/** world → screen point */
export async function toScreen(page: Page, x: number, y: number) {
  return state<{ x: number; y: number }>(page, `s => ({ x: ${x} * s.zoom + s.panX, y: ${y} * s.zoom + s.panY })`);
}

export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, opts: { steps?: number; modifiers?: string[] } = {}) {
  for (const m of opts.modifiers ?? []) await page.keyboard.down(m);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: opts.steps ?? 6 });
  await page.mouse.up();
  for (const m of opts.modifiers ?? []) await page.keyboard.up(m);
}

/** Draw a shape with a tool shortcut, using world coordinates. */
export async function draw(page: Page, key: string, x: number, y: number, w: number, h: number) {
  await page.keyboard.press(key);
  const a = await toScreen(page, x, y);
  const b = await toScreen(page, x + w, y + h);
  await drag(page, a, b);
}

export async function clickWorld(page: Page, x: number, y: number, opts: { modifiers?: ('Shift' | 'Alt' | 'Meta' | 'Control' | 'ControlOrMeta')[]; clickCount?: number; button?: 'left' | 'right' } = {}) {
  const p = await toScreen(page, x, y);
  for (const m of opts.modifiers ?? []) await page.keyboard.down(m);
  await page.mouse.click(p.x, p.y, { clickCount: opts.clickCount, button: opts.button });
  for (const m of opts.modifiers ?? []) await page.keyboard.up(m);
}

export async function selectByName(page: Page, name: string) {
  await page.getByTestId(`layer-${name}`).first().click();
}

export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|picsum|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return errors;
}

export async function setField(page: Page, testId: string, value: string) {
  const f = page.getByTestId(testId).first();
  await f.click();
  await f.fill(value);
  await f.press('Enter');
}

export async function waitSaved(page: Page) {
  await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 5000 });
}
