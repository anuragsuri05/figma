import { test, expect, type Page, type Route } from '@playwright/test';
import { collectErrors, newFile, draw, nodes, selectedNodes, MOD, clickWorld } from './helpers';

/**
 * AI agent end-to-end tests. Provider HTTP APIs are mocked at the network layer, so the real
 * Anthropic / OpenAI / Google SDK adapters run unmodified (streaming, tool calls, tool results).
 */

type Block = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown };

function claudeSSE(content: Block[], stop: string) {
  const ev = (type: string, data: unknown) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  let out = ev('message_start', { type: 'message_start', message: { id: `msg_${Math.random().toString(36).slice(2)}`, type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } });
  content.forEach((b, i) => {
    if (b.type === 'text') {
      out += ev('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } });
      out += ev('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: b.text } });
    } else {
      out += ev('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
      out += ev('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } });
    }
    out += ev('content_block_stop', { type: 'content_block_stop', index: i });
  });
  out += ev('message_delta', { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 20 } });
  out += ev('message_stop', { type: 'message_stop' });
  return out;
}

interface Captured { url: string; headers: Record<string, string>; body: any }

async function mockClaude(page: Page, turns: { content: Block[]; stop: string }[] | ((body: any) => { content: Block[]; stop: string }), status = 200) {
  const reqs: Captured[] = [];
  let i = 0;
  await page.route('https://api.anthropic.com/**', async (route: Route) => {
    const r = route.request();
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() });
    if (r.url().includes('/v1/models')) return route.fulfill({ status, headers: cors(), contentType: 'application/json', body: JSON.stringify(status === 200 ? { data: [{ id: 'claude-opus-5-5', type: 'model', display_name: 'Claude Opus 5.5', created_at: '2026-09-01T00:00:00Z' }, { id: 'claude-sonnet-5-5', type: 'model', display_name: 'Claude Sonnet 5.5', created_at: '2026-09-01T00:00:00Z' }], has_more: false, first_id: 'claude-opus-5-5', last_id: 'claude-sonnet-5-5' } : { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
    const body = r.postDataJSON();
    reqs.push({ url: r.url(), headers: r.headers(), body });
    if (status !== 200) return route.fulfill({ status, headers: cors(), contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
    const t = typeof turns === 'function' ? turns(body) : turns[Math.min(i++, turns.length - 1)];
    return route.fulfill({ status: 200, headers: { ...cors(), 'content-type': 'text/event-stream' }, body: claudeSSE(t.content, t.stop) });
  });
  return reqs;
}

const cors = () => ({ 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' });

async function connect(page: Page, provider: 'anthropic' | 'openai' | 'gemini', extra: Record<string, unknown> = {}) {
  await page.addInitScript(([p, x]) => {
    if (window.top !== window) return; // skip sandboxed preview iframes
    localStorage.setItem('myflow:ai', JSON.stringify({ provider: p, keys: { anthropic: 'sk-ant-test', openai: 'sk-test', gemini: 'AIza-test' }, remember: true, includeScreenshot: false, ...x }));
  }, [provider, extra] as const);
}

const LOGIN_SPEC = {
  type: 'frame', name: 'Login', width: 393, height: 852, fill: '#FFFFFF',
  layout: { mode: 'vertical', gap: 16, padding: [80, 24, 40, 24] },
  children: [
    { type: 'text', name: 'Title', text: 'Welcome back', fontSize: 32, fontWeight: 700, color: '#111827' },
    { type: 'text', text: 'Sign in to continue', fontSize: 16, color: '#6B7280' },
    { type: 'frame', name: 'Email field', sizing: { h: 'fill' }, height: 52, radius: 12, stroke: { color: '#D0D5DD', weight: 1 }, layout: { mode: 'horizontal', padding: [0, 16], crossAlign: 'center' }, children: [{ type: 'text', text: 'you@example.com', color: '#9CA3AF' }] },
    { type: 'frame', name: 'Sign in button', sizing: { h: 'fill' }, height: 52, radius: 12, fill: '#4F46E5', layout: { mode: 'horizontal', align: 'center', crossAlign: 'center' }, children: [{ type: 'text', text: 'Sign in', color: '#FFFFFF', fontWeight: 600 }] },
    { type: 'icon', name: 'Lock icon', svg: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" stroke="#111" fill="none"/></svg>' },
  ],
};

test.describe('AI agent — provider setup', () => {
  test('connect Claude through settings: test key lists models, persists, switch providers', async ({ page }) => {
    const errors = collectErrors(page);
    await mockClaude(page, []);
    await page.route('https://api.openai.com/**', (route) => route.fulfill({ status: 200, headers: cors(), contentType: 'application/json', body: JSON.stringify({ object: 'list', data: [{ id: 'gpt-5.6-sol', object: 'model', created: 1, owned_by: 'openai' }, { id: 'gpt-5.6-luna', object: 'model', created: 1, owned_by: 'openai' }, { id: 'whisper-1', object: 'model', created: 1, owned_by: 'openai' }] }) }));
    await newFile(page);
    await page.getByTestId('tool-agent').click();
    await expect(page.getByTestId('ai-panel')).toBeVisible();
    await expect(page.getByTestId('ai-onboarding')).toBeVisible();
    await page.getByTestId('ai-connect').click();
    await expect(page.getByTestId('ai-settings')).toBeVisible();
    await page.getByTestId('ai-key-anthropic').fill('sk-ant-my-key');
    await page.getByTestId('ai-test-anthropic').click();
    await expect(page.getByTestId('ai-status-anthropic')).toContainText('Connected — 2 models');
    await expect(page.getByTestId('ai-model-anthropic')).toHaveValue('claude-opus-5-5');
    // ChatGPT key + test chooses an available model, filters non-chat models
    await page.getByTestId('ai-key-openai').fill('sk-openai');
    await page.getByTestId('ai-test-openai').click();
    await expect(page.getByTestId('ai-status-openai')).toContainText('2 models');
    await page.getByTestId('ai-settings-done').click();
    await expect(page.getByTestId('ai-model-label')).toHaveText('Claude · claude-opus-5-5');
    await expect(page.getByTestId('ai-input')).toBeVisible();
    // persists across reload
    await page.reload();
    await page.keyboard.press(`${MOD}+j`);
    await expect(page.getByTestId('ai-model-label')).toHaveText('Claude · claude-opus-5-5');
    // switch active provider
    await page.getByTestId('ai-settings-btn').click();
    await page.getByTestId('ai-use-openai').check();
    await page.getByTestId('ai-settings-done').click();
    await expect(page.getByTestId('ai-model-label')).toHaveText('ChatGPT · gpt-5.6-sol');
    expect(errors).toEqual([]);
  });

  test('bad key shows a clear error and opens settings', async ({ page }) => {
    await connect(page, 'anthropic');
    await mockClaude(page, [], 401);
    await newFile(page);
    await page.keyboard.press(`${MOD}+j`);
    await page.getByTestId('ai-input').fill('Design a login screen');
    await page.getByTestId('ai-send').click();
    await expect(page.getByTestId('ai-msg-error')).toContainText('rejected the API key');
    await expect(page.getByTestId('ai-settings')).toBeVisible();
  });
});

test.describe('AI agent — tool use with each provider', () => {
  test('Claude: builds a design with tools, checks a screenshot, streams a summary, one-step undo', async ({ page }) => {
    const errors = collectErrors(page);
    await connect(page, 'anthropic', { guidelines: 'Brand color is #4F46E5.' });
    const reqs = await mockClaude(page, [
      { content: [{ type: 'text', text: 'Creating the login screen. ' }, { type: 'tool_use', id: 'tu_1', name: 'create_design', input: { spec: LOGIN_SPEC } }], stop: 'tool_use' },
      { content: [{ type: 'tool_use', id: 'tu_2', name: 'get_screenshot', input: {} }], stop: 'tool_use' },
      { content: [{ type: 'text', text: 'I designed a clean login screen with an email field and a primary Sign in button.' }], stop: 'end_turn' },
    ]);
    await newFile(page);
    await page.keyboard.press(`${MOD}+j`);
    await page.getByTestId('ai-input').fill('Design a login screen');
    await page.getByTestId('ai-input').press('Enter');
    await expect(page.locator('[data-testid="ai-msg-assistant"]').last()).toContainText('clean login screen', { timeout: 15000 });
    await expect(page.getByTestId('ai-step')).toHaveCount(2);
    // design really exists on the canvas, with auto layout and fill sizing
    const all = await nodes(page);
    const frame = all.find((n) => n.name === 'Login')!;
    expect(frame).toBeTruthy();
    expect([frame.width, frame.height, frame.layout.mode]).toEqual([393, 852, 'VERTICAL']);
    const btn = all.find((n) => n.name === 'Sign in button')!;
    expect(btn.parentId).toBe(frame.id);
    expect(btn.width).toBe(393 - 48);
    expect(btn.fills[0].color).toBe('#4F46E5');
    expect(all.find((n) => n.name === 'Lock icon')!.fills[0].type).toBe('IMAGE');
    // API contract
    expect(reqs.length).toBe(3);
    const first = reqs[0];
    expect(first.headers['x-api-key']).toBe('sk-ant-test');
    expect(first.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(first.headers['anthropic-beta']).toContain('server-side-fallback-2026-07-01');
    expect(first.body.model).toBe('claude-opus-5-5');
    expect(first.body.fallbacks).toBe('default');
    expect(first.body.stream).toBe(true);
    expect(first.body.system).toContain('Brand color is #4F46E5.');
    expect(first.body.tools.map((t: any) => t.name)).toContain('create_design');
    expect(first.body.tools.every((t: any) => t.eager_input_streaming === true)).toBe(true);
    const toolResult = reqs[1].body.messages.at(-1).content[0];
    expect(toolResult.type).toBe('tool_result');
    expect(toolResult.tool_use_id).toBe('tu_1');
    expect(JSON.parse(toolResult.content[0].text).root_id).toBe(frame.id);
    const shot = reqs[2].body.messages.at(-1).content[0];
    expect(shot.content.some((c: any) => c.type === 'image' && c.source.media_type === 'image/png')).toBe(true);
    // second message continues the same conversation
    expect(reqs[2].body.messages.length).toBe(5);
    // the whole run undoes in one step
    await page.getByTestId('ai-close').click();
    await page.locator('body').click({ position: { x: 700, y: 450 } });
    await page.keyboard.press('Escape');
    await page.keyboard.press(`${MOD}+z`);
    expect((await nodes(page)).length).toBe(0);
    expect(errors).toEqual([]);
  });

  test('ChatGPT: reads the canvas and updates layers via function calls', async ({ page }) => {
    const errors = collectErrors(page);
    await connect(page, 'openai');
    const reqs: Captured[] = [];
    let turn = 0;
    await newFile(page);
    await draw(page, 'r', 0, 0, 100, 100);
    const rect = (await selectedNodes(page))[0];
    await page.route('https://api.openai.com/**', async (route) => {
      const r = route.request();
      if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() });
      const body = r.postDataJSON();
      reqs.push({ url: r.url(), headers: r.headers(), body });
      const t = turn++;
      const message = t === 0
        ? { role: 'assistant', content: null, refusal: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_canvas', arguments: '{}' } }] }
        : t === 1
          ? { role: 'assistant', content: null, refusal: null, tool_calls: [{ id: 'call_2', type: 'function', function: { name: 'update_nodes', arguments: JSON.stringify({ updates: [{ id: rect.id, props: { fill: '#FF5722', radius: 16, name: 'Accent card' } }] }) } }] }
          : { role: 'assistant', content: 'Made the card orange with rounded corners.', refusal: null };
      return route.fulfill({ status: 200, headers: cors(), contentType: 'application/json', body: JSON.stringify({ id: `chatcmpl-${t}`, object: 'chat.completion', created: 1, model: 'gpt-5.6-sol', choices: [{ index: 0, message, finish_reason: t < 2 ? 'tool_calls' : 'stop' }] }) });
    });
    await page.keyboard.press(`${MOD}+j`);
    await page.getByTestId('ai-input').fill('Make the selected card orange and rounded');
    await page.getByTestId('ai-send').click();
    await expect(page.locator('[data-testid="ai-msg-assistant"]').last()).toContainText('orange', { timeout: 15000 });
    const n = (await nodes(page)).find((x) => x.id === rect.id)!;
    expect([n.fills[0].color, n.cornerRadius, n.name]).toEqual(['#FF5722', 16, 'Accent card']);
    expect(reqs[0].headers.authorization).toBe('Bearer sk-test');
    expect(reqs[0].body.tools.map((t: any) => t.function.name)).toContain('update_nodes');
    expect(reqs[0].body.messages[0].role).toBe('system');
    expect(reqs[0].body.messages[1].content.at(-1).text).toContain('Selected: Rectangle');
    const toolMsg = reqs[1].body.messages.find((m: any) => m.role === 'tool');
    expect(JSON.parse(toolMsg.content).layers[0].id).toBe(rect.id);
    expect(errors).toEqual([]);
  });

  test('Gemini: function calling creates a design and returns function responses', async ({ page }) => {
    const errors = collectErrors(page);
    await connect(page, 'gemini');
    const reqs: Captured[] = [];
    let turn = 0;
    await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
      const r = route.request();
      if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() });
      const body = r.postDataJSON();
      reqs.push({ url: r.url(), headers: r.headers(), body });
      const t = turn++;
      const parts = t === 0
        ? [{ functionCall: { id: 'fc_1', name: 'create_design', args: { spec: { type: 'frame', name: 'Pricing card', width: 320, fill: '#FFFFFF', radius: 16, shadow: true, layout: { mode: 'vertical', gap: 12, padding: 24 }, children: [{ type: 'text', text: 'Pro', fontSize: 20, fontWeight: 600 }, { type: 'text', text: '$12/mo', fontSize: 36, fontWeight: 700 }] } } }, thoughtSignature: 'c2ln' }]
        : [{ text: 'Added a Pro pricing card.' }];
      return route.fulfill({ status: 200, headers: cors(), contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP', index: 0 }], modelVersion: 'gemini-3.5-flash' }) });
    });
    await newFile(page);
    await page.keyboard.press(`${MOD}+j`);
    await page.getByTestId('ai-input').fill('Add a pricing card');
    await page.getByTestId('ai-send').click();
    await expect(page.locator('[data-testid="ai-msg-assistant"]').last()).toContainText('Pro pricing card', { timeout: 15000 });
    const card = (await nodes(page)).find((n) => n.name === 'Pricing card')!;
    expect(card.effects[0].type).toBe('DROP_SHADOW');
    expect(card.width).toBe(320);
    expect(reqs[0].url).toContain('gemini-3.5-flash:generateContent');
    expect(reqs[0].headers['x-goog-api-key']).toBe('AIza-test');
    expect(reqs[0].body.tools[0].functionDeclarations.map((f: any) => f.name)).toContain('create_design');
    const last = reqs[1].body.contents.at(-1);
    expect(last.parts[0].functionResponse.name).toBe('create_design');
    // model turn kept verbatim (thought signature preserved)
    expect(reqs[1].body.contents.at(-2).parts[0].thoughtSignature).toBe('c2ln');
    expect(errors).toEqual([]);
  });
});

test.describe('AI quick actions', () => {
  test('rename layers, realistic content, translate, shorten', async ({ page }) => {
    const errors = collectErrors(page);
    await connect(page, 'anthropic');
    await newFile(page);
    await draw(page, 'f', 0, 0, 300, 200);
    await page.keyboard.press('t');
    await clickWorld(page, 20, 20);
    await page.keyboard.type('Title');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    const all0 = await nodes(page);
    const frame = all0.find((n) => n.type === 'FRAME')!;
    const text = all0.find((n) => n.type === 'TEXT')!;
    const reqs = await mockClaude(page, (body) => {
      const sys = body.system as string;
      if (sys.includes('name design layers')) return { content: [{ type: 'text', text: JSON.stringify({ renames: [{ id: frame.id, name: 'Profile card' }] }) }], stop: 'end_turn' };
      if (sys.includes('Target language')) return { content: [{ type: 'text', text: JSON.stringify({ texts: [{ id: text.id, text: 'Hola Ana' }] }) }], stop: 'end_turn' };
      if (sys.includes('Shorten')) return { content: [{ type: 'text', text: JSON.stringify({ texts: [{ id: text.id, text: 'Ana' }] }) }], stop: 'end_turn' };
      return { content: [{ type: 'text', text: JSON.stringify({ texts: [{ id: text.id, text: 'Ana García' }] }) }], stop: 'end_turn' };
    });
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), frame.id);
    await page.keyboard.press(`${MOD}+j`);
    await page.getByTestId('ai-quick-rename').click();
    await expect(page.locator('[data-testid="ai-msg-assistant"]').last()).toContainText('Renamed 1 layer');
    expect((await nodes(page)).find((n) => n.id === frame.id)!.name).toBe('Profile card');
    expect(reqs[0].body.output_config.format.type).toBe('json_schema');
    await page.getByTestId('ai-quick-realistic').click();
    await expect(page.locator('[data-testid="ai-msg-assistant"]').last()).toContainText('Updated 1 text layer');
    expect((await nodes(page)).find((n) => n.id === text.id)!.text!.characters).toBe('Ana García');
    page.once('dialog', (d) => d.accept('Spanish'));
    await page.getByTestId('ai-quick-translate').click();
    await expect.poll(async () => (await nodes(page)).find((n) => n.id === text.id)!.text!.characters).toBe('Hola Ana');
    await page.getByTestId('ai-quick-shorten').click();
    await expect.poll(async () => (await nodes(page)).find((n) => n.id === text.id)!.text!.characters).toBe('Ana');
    // each action is one undo step
    await page.getByTestId('ai-close').click();
    await page.keyboard.press(`${MOD}+z`);
    expect((await nodes(page)).find((n) => n.id === text.id)!.text!.characters).toBe('Hola Ana');
    expect(errors).toEqual([]);
  });

  test('make prototype, critique comments, accessibility review', async ({ page }) => {
    const errors = collectErrors(page);
    await connect(page, 'anthropic');
    await newFile(page);
    await draw(page, 'f', 0, 0, 300, 400);
    await draw(page, 'r', 20, 300, 260, 48);
    await draw(page, 'f', 400, 0, 300, 400);
    const all = await nodes(page);
    const [a, b] = all.filter((n) => n.type === 'FRAME').sort((x, y) => x.x - y.x);
    const btn = all.find((n) => n.type === 'RECTANGLE')!;
    await mockClaude(page, (body) => {
      const sys = body.system as string;
      if (sys.includes('prototyping expert')) return { content: [{ type: 'text', text: JSON.stringify({ links: [{ from_id: btn.id, to_id: b.id, animation: 'push', reason: 'CTA' }], start_id: a.id }) }], stop: 'end_turn' };
      return { content: [{ type: 'text', text: JSON.stringify({ summary: 'Solid structure; the CTA needs more contrast.', issues: [{ node_id: btn.id, severity: 'high', title: 'Low contrast button', detail: 'Grey on white is 1.4:1.' }, { node_id: a.id, severity: 'low', title: 'Add a heading', detail: 'The screen has no title.' }] }) }], stop: 'end_turn' };
    });
    await page.keyboard.press('Escape');
    await page.keyboard.press(`${MOD}+j`);
    await page.getByTestId('ai-quick-prototype').click();
    await expect(page.locator('[data-testid="ai-msg-assistant"]').last()).toContainText('Added 1 prototype connection');
    const linked = (await nodes(page)).find((n) => n.id === btn.id)!;
    expect(linked.reactions[0]).toMatchObject({ destinationId: b.id, animation: 'PUSH' });
    await page.evaluate((id) => (window as any).__myflow.get().select([id]), a.id);
    await page.getByTestId('ai-quick-critique').click();
    await expect(page.locator('[data-testid="ai-msg-assistant"]').last()).toContainText('Pinned 2 comments');
    const comments = await page.evaluate(() => (window as any).__myflow.get().doc.comments);
    expect(comments.length).toBe(2);
    expect(comments[0].replies[0].text).toContain('Low contrast button');
    await page.getByTestId('ai-quick-a11y').click();
    await expect(page.locator('[data-testid="ai-msg-assistant"]').last()).toContainText('CTA needs more contrast');
    expect(errors).toEqual([]);
  });

  test('generate code, Make app preview with iteration, illustration', async ({ page }) => {
    const errors = collectErrors(page);
    await connect(page, 'anthropic');
    await newFile(page);
    await draw(page, 'f', 0, 0, 300, 200);
    let makeCalls = 0;
    const reqs = await mockClaude(page, (body) => {
      const sys = body.system as string;
      if (sys.includes('front-end engineer')) return { content: [{ type: 'text', text: '```tsx\nexport function Card() {\n  return <div className="rounded-xl bg-white p-6" />;\n}\n```' }], stop: 'end_turn' };
      if (sys.includes('single-file web apps')) { makeCalls++; return { content: [{ type: 'text', text: `\`\`\`html\n<!doctype html><html><body><h1 id="t">${makeCalls === 1 ? 'Habit tracker' : 'Habit tracker (dark)'}</h1><button onclick="t.textContent='clicked'">Add</button></body></html>\n\`\`\`` }], stop: 'end_turn' }; }
      return { content: [{ type: 'text', text: '<svg viewBox="0 0 800 600"><rect width="800" height="600" fill="#EEF2FF"/><circle cx="400" cy="300" r="120" fill="#6366F1"/><script>alert(1)</script></svg>' }], stop: 'end_turn' };
    });
    await page.keyboard.press(`${MOD}+j`);
    await page.getByTestId('ai-quick-code').click();
    await expect(page.getByTestId('ai-code')).toBeVisible();
    await page.getByTestId('ai-code-go').click();
    await expect(page.getByTestId('ai-code-output')).toContainText('export function Card()');
    expect(reqs[0].body.messages[0].content.some((c: any) => c.type === 'image')).toBe(true);
    await page.getByTestId('modal-close').click();
    // Make: build + iterate in a sandboxed iframe
    await page.getByTestId('ai-quick-make').click();
    await page.getByTestId('ai-make-prompt').fill('A habit tracker');
    await page.getByTestId('ai-make-go').click();
    const frame = page.frameLocator('[data-testid="ai-make-preview"]');
    await expect(frame.locator('#t')).toHaveText('Habit tracker');
    await frame.locator('button').click();
    await expect(frame.locator('#t')).toHaveText('clicked');
    expect(await page.getByTestId('ai-make-preview').getAttribute('sandbox')).not.toContain('allow-same-origin');
    await page.getByTestId('ai-make-prompt').fill('Add dark mode');
    await page.getByTestId('ai-make-go').click();
    await expect(frame.locator('#t')).toHaveText('Habit tracker (dark)');
    expect(JSON.stringify(reqs.at(-1)!.body.messages)).toContain('Current app code');
    const dl = page.waitForEvent('download');
    await page.getByTestId('ai-make-download').click();
    expect((await dl).suggestedFilename()).toBe('myflow-make-app.html');
    await page.getByTestId('modal-close').click();
    // illustration inserted as an image layer, scripts stripped
    page.once('dialog', (d) => d.accept('a calm abstract scene'));
    await page.getByTestId('ai-quick-illustration').click();
    await expect.poll(async () => (await nodes(page)).some((n) => n.name.startsWith('Illustration'))).toBe(true);
    const ill = (await nodes(page)).find((n) => n.name.startsWith('Illustration'))!;
    expect(ill.fills[0].type).toBe('IMAGE');
    const src = await page.evaluate((id) => (window as any).__myflow.get().doc.nodes[id].fills[0].imageSrc, ill.id);
    expect(decodeURIComponent(src)).not.toContain('<script');
    expect(errors).toEqual([]);
  });

  test('skills and guidelines: slash menu and system prompt', async ({ page }) => {
    await connect(page, 'anthropic');
    const reqs = await mockClaude(page, [{ content: [{ type: 'text', text: 'Done.' }], stop: 'end_turn' }]);
    await newFile(page);
    await page.keyboard.press(`${MOD}+j`);
    await page.getByTestId('ai-settings-btn').click();
    await page.getByTestId('ai-tab-guidelines').click();
    await page.getByTestId('ai-guidelines').fill('Use 12px radius on cards.');
    await page.getByTestId('ai-tab-skills').click();
    await page.getByTestId('ai-add-skill').click();
    await page.getByTestId('ai-skill-name').last().fill('hero');
    await page.getByTestId('ai-skill-instructions').last().fill('Build a landing hero with a headline and two CTAs.');
    await page.getByTestId('ai-settings-done').click();
    await page.getByTestId('ai-input').fill('/he');
    await expect(page.getByTestId('ai-slash')).toContainText('/hero');
    await page.getByTestId('ai-slash').locator('button').first().click();
    await expect(page.getByTestId('ai-input')).toHaveValue('/hero ');
    await page.getByTestId('ai-input').fill('/hero for a coffee brand');
    await page.getByTestId('ai-send').click();
    await expect(page.locator('[data-testid="ai-msg-assistant"]').last()).toContainText('Done.');
    expect(reqs[0].body.system).toContain('Use 12px radius on cards.');
    expect(reqs[0].body.system).toContain('/hero');
    expect(reqs[0].body.system).toContain('Build a landing hero');
  });

  test('AI commands are reachable from the main menu and quick actions', async ({ page }) => {
    await newFile(page);
    await page.getByTestId('main-menu-btn').click();
    await page.getByTestId('menu-ai').hover();
    await expect(page.getByTestId('cmd-ai.make')).toBeVisible();
    await page.getByTestId('cmd-ai.settings').click();
    await expect(page.getByTestId('ai-settings')).toBeVisible();
    await page.getByTestId('ai-settings-done').click();
    await page.keyboard.press(`${MOD}+k`);
    await page.getByTestId('quick-actions-input').fill('accessibility review');
    await expect(page.getByTestId('qa-Accessibility review')).toBeVisible();
  });
});
