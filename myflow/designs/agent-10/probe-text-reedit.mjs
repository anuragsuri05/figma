// Probe: with the Text tool, click on an existing text layer and type — do the keystrokes land?
import { chromium } from '@playwright/test';
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://localhost:5390/'); await p.getByTestId('new-design-file').click(); await p.getByTestId('editor').waitFor();
await p.evaluate(() => window.__myflow.get().setState({ zoom: 1, panX: 300, panY: 120 }));
await p.keyboard.press('t'); await p.mouse.click(400, 300); await p.keyboard.type('Hello'); await p.keyboard.press('Escape');
const st = () => p.evaluate(() => { const s = window.__myflow.get(); return { editing: s.editingTextId, texts: Object.values(s.doc.nodes).filter(n => n.text).map(n => n.text.characters) }; });
console.log('after create', await st());
await p.keyboard.press('t'); await p.mouse.click(410, 300); await p.waitForTimeout(100);
console.log('after T-click on existing', await st(), 'focused:', await p.evaluate(() => document.activeElement?.tagName));
await p.keyboard.type(' world'); await p.keyboard.press('Escape');
console.log('after typing', await st());
await b.close();
