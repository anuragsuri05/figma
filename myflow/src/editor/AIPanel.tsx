import React, { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { S, useEditor } from '../store/editor';
import { useAI, PROVIDERS, activeConfig, providerName, type ProviderId, type Skill } from '../ai/config';
import { createSession, listModels, chooseModel, AIError, type ChatSession, type Part } from '../ai/providers';
import { AGENT_TOOLS, executeTool, agentSystemPrompt, selectionNote, screenshotOf } from '../ai/tools';
import { aiRenameLayers, aiText, aiMakePrototype, aiReview, aiGenerateCode, aiMakeApp, aiIllustration, NeedsSetup, type TextMode } from '../ai/actions';
import { IconButton, Modal, Select } from './ui';
import { I } from './icons';
import { uid } from '../model/defaults';

/* ================================================================ agent store */

export interface ChatStep { id: string; tool: string; label: string; done: boolean; error?: boolean }
export interface ChatMessage { id: string; role: 'user' | 'assistant' | 'error' | 'info'; text: string; steps?: ChatStep[] }

interface AgentState {
  open: boolean;
  messages: ChatMessage[];
  running: boolean;
  modal: 'settings' | 'make' | 'code' | null;
  draft: string;
  set: (p: Partial<AgentState>) => void;
}

export const useAgent = create<AgentState>((set) => ({ open: false, messages: [], running: false, modal: null, draft: '', set: (p) => set(p) }));

let session: { key: string; chat: ChatSession } | null = null;
let controller: AbortController | null = null;

function sessionKey() {
  const s = useAI.getState();
  return `${s.provider}|${s.models[s.provider]}|${s.keys[s.provider].slice(-6)}|${s.guidelines.length}|${s.skills.map((k) => k.name).join(',')}`;
}

function push(m: Omit<ChatMessage, 'id'>) {
  const msg = { ...m, id: uid('msg') };
  useAgent.setState((st) => ({ messages: [...st.messages, msg] }));
  return msg.id;
}

function patchMsg(id: string, fn: (m: ChatMessage) => ChatMessage) {
  useAgent.setState((st) => ({ messages: st.messages.map((m) => (m.id === id ? fn(m) : m)) }));
}

function stepLabel(tool: string, input: Record<string, unknown>): string {
  const spec = input.spec as { name?: string } | undefined;
  switch (tool) {
    case 'get_canvas': return input.node_id ? 'Inspecting layer' : 'Reading the canvas';
    case 'get_screenshot': return 'Looking at the design';
    case 'create_design': return `Creating “${spec?.name ?? 'design'}”`;
    case 'update_nodes': return `Updating ${(input.updates as unknown[])?.length ?? 0} layer(s)`;
    case 'delete_nodes': return `Deleting ${(input.ids as unknown[])?.length ?? 0} layer(s)`;
    case 'move_nodes': return 'Moving layers';
    case 'arrange': return `Arranging: ${String(input.action).replace(/_/g, ' ')}`;
    case 'create_instance': return 'Placing component instance';
    case 'select_nodes': return 'Selecting result';
    case 'add_prototype_link': return 'Wiring prototype';
    case 'create_variables': return `Creating variables “${String(input.collection)}”`;
    case 'bind_variable': return 'Binding variable';
    case 'create_style': return `Creating style “${String(input.name)}”`;
    case 'add_comment': return 'Adding a comment';
    case 'add_page': return `Adding page “${String(input.name)}”`;
  }
  return tool;
}

export function openAgent(draft?: string) {
  useAgent.setState({ open: true, ...(draft !== undefined ? { draft } : {}) });
  S().setState({ commentsPanel: false, tool: S().tool === 'COMMENT' ? 'MOVE' : S().tool });
}

export function stopAgent() { controller?.abort(); }

/** Send a message to the design agent (multi-turn, tool-using). */
export async function runAgent(text: string) {
  const cfg = activeConfig();
  openAgent('');
  if (!cfg) { useAgent.setState({ modal: 'settings' }); push({ role: 'info', text: 'Connect Claude, ChatGPT or Gemini with your API key to use the agent.' }); return; }
  if (useAgent.getState().running) return;
  const ai = useAI.getState();
  if (!session || session.key !== sessionKey()) session = { key: sessionKey(), chat: createSession(cfg, agentSystemPrompt(ai.guidelines, ai.skills), AGENT_TOOLS) };
  push({ role: 'user', text });
  const parts: Part[] = [];
  if (ai.includeScreenshot && S().selection.length) {
    try { const shot = await screenshotOf(S().selection[0]); if (shot.image) parts.push({ type: 'image', ...shot.image }); } catch { /* ignore */ }
  }
  parts.push({ type: 'text', text: `${selectionNote()}\n\n${text}` });
  const msgId = push({ role: 'assistant', text: '', steps: [] });
  controller = new AbortController();
  useAgent.setState({ running: true });
  S().begin();
  try {
    await session.chat.send(parts, {
      signal: controller.signal,
      onText: (d) => patchMsg(msgId, (m) => ({ ...m, text: m.text + d })),
      onToolCall: (tool, input) => patchMsg(msgId, (m) => ({ ...m, steps: [...(m.steps ?? []), { id: uid('st'), tool, label: stepLabel(tool, input), done: false }] })),
      onToolResult: (_tool, out) => patchMsg(msgId, (m) => {
        const steps = [...(m.steps ?? [])];
        const i = steps.map((x) => x.done).lastIndexOf(false);
        if (i >= 0) steps[i] = { ...steps[i], done: true, error: out.text.startsWith('Error') };
        return { ...m, steps };
      }),
      executeTool,
      maxSteps: 40,
    });
  } catch (err) {
    const e = err as Error;
    if (e.message === 'Stopped' || controller.signal.aborted) push({ role: 'info', text: 'Stopped.' });
    else {
      push({ role: 'error', text: e.message });
      if (e instanceof AIError && e.kind === 'auth') useAgent.setState({ modal: 'settings' });
      // conversation state may be inconsistent after an error — start fresh next time
      session = null;
    }
  } finally {
    S().end();
    useAgent.setState({ running: false });
    controller = null;
  }
}

/** Run a one-shot AI action and report its result in the panel. */
export async function runAction(label: string, fn: (signal: AbortSignal) => Promise<string>) {
  openAgent();
  if (!activeConfig()) { useAgent.setState({ modal: 'settings' }); push({ role: 'info', text: 'Connect an AI provider to use AI actions.' }); return; }
  if (useAgent.getState().running) return;
  push({ role: 'user', text: label });
  controller = new AbortController();
  useAgent.setState({ running: true });
  const msgId = push({ role: 'assistant', text: '', steps: [{ id: uid('st'), tool: 'action', label: `${label}…`, done: false }] });
  try {
    const result = await fn(controller.signal);
    patchMsg(msgId, (m) => ({ ...m, text: result, steps: m.steps?.map((s) => ({ ...s, done: true })) }));
  } catch (err) {
    patchMsg(msgId, (m) => ({ ...m, steps: m.steps?.map((s) => ({ ...s, done: true, error: true })) }));
    if (err instanceof NeedsSetup) useAgent.setState({ modal: 'settings' });
    push({ role: (err as Error).message === 'Stopped' ? 'info' : 'error', text: (err as Error).message });
  } finally {
    useAgent.setState({ running: false });
    controller = null;
  }
}

export const AI_ACTIONS = {
  rename: () => runAction('Rename layers', aiRenameLayers),
  text: (mode: TextMode, label: string, language?: string) => runAction(label, (sig) => aiText(mode, { language, signal: sig })),
  translate: () => {
    const lang = window.prompt('Translate to which language?', 'Spanish');
    if (lang) void runAction(`Translate to ${lang}`, (sig) => aiText('translate', { language: lang, signal: sig }));
  },
  prototype: () => runAction('Make prototype', aiMakePrototype),
  critique: () => runAction('Design critique', (sig) => aiReview('critique', sig)),
  a11y: () => runAction('Accessibility review', (sig) => aiReview('accessibility', sig)),
  illustration: (kind: 'illustration' | 'icon') => {
    const p = window.prompt(kind === 'icon' ? 'Describe the icon' : 'Describe the illustration', kind === 'icon' ? 'shopping bag' : 'a person working on a laptop in a cozy room');
    if (p) void runAction(kind === 'icon' ? `Make icon: ${p}` : `Make illustration: ${p}`, (sig) => aiIllustration(p, kind, sig));
  },
  firstDraft: () => openAgent('Design a '),
  make: () => { if (!activeConfig()) { openAgent(); useAgent.setState({ modal: 'settings' }); return; } useAgent.setState({ modal: 'make' }); },
  code: () => { if (!activeConfig()) { openAgent(); useAgent.setState({ modal: 'settings' }); return; } useAgent.setState({ modal: 'code' }); },
  settings: () => useAgent.setState({ modal: 'settings' }),
};

/* ================================================================ panel */

const SUGGESTIONS = [
  { label: 'First draft: login screen', prompt: 'Design a modern mobile login screen for a fintech app with email, password, social sign-in and a sign-up link.' },
  { label: 'First draft: dashboard', prompt: 'Design a desktop analytics dashboard with a sidebar, KPI cards, a chart card and a recent orders table.' },
  { label: 'First draft: pricing page', prompt: 'Design a desktop pricing page with three plans, a monthly/yearly toggle and an FAQ section.' },
];

const QUICK: { label: string; run: () => void; testId: string }[] = [
  { label: 'Rename layers', run: () => AI_ACTIONS.rename(), testId: 'ai-quick-rename' },
  { label: 'Realistic content', run: () => AI_ACTIONS.text('realistic', 'Replace with realistic content'), testId: 'ai-quick-realistic' },
  { label: 'Rewrite', run: () => AI_ACTIONS.text('rewrite', 'Rewrite text'), testId: 'ai-quick-rewrite' },
  { label: 'Shorten', run: () => AI_ACTIONS.text('shorten', 'Shorten text'), testId: 'ai-quick-shorten' },
  { label: 'Translate', run: () => AI_ACTIONS.translate(), testId: 'ai-quick-translate' },
  { label: 'Make prototype', run: () => AI_ACTIONS.prototype(), testId: 'ai-quick-prototype' },
  { label: 'Critique', run: () => AI_ACTIONS.critique(), testId: 'ai-quick-critique' },
  { label: 'Accessibility', run: () => AI_ACTIONS.a11y(), testId: 'ai-quick-a11y' },
  { label: 'Code', run: () => AI_ACTIONS.code(), testId: 'ai-quick-code' },
  { label: 'Make app', run: () => AI_ACTIONS.make(), testId: 'ai-quick-make' },
  { label: 'Illustration', run: () => AI_ACTIONS.illustration('illustration'), testId: 'ai-quick-illustration' },
  { label: 'Icon', run: () => AI_ACTIONS.illustration('icon'), testId: 'ai-quick-icon' },
];

export function AIPanel() {
  const messages = useAgent((s) => s.messages);
  const running = useAgent((s) => s.running);
  const draft = useAgent((s) => s.draft);
  const provider = useAI((s) => s.provider);
  const model = useAI((s) => s.models[s.provider]);
  const hasKey = useAI((s) => !!s.keys[s.provider]);
  const skills = useAI((s) => s.skills);
  const includeShot = useAI((s) => s.includeScreenshot);
  const selCount = useEditor((s) => s.selection.length);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const send = () => {
    const t = draft.trim();
    if (!t || running) return;
    useAgent.setState({ draft: '' });
    void runAgent(t);
  };
  const slashMatches = draft.startsWith('/') && !draft.includes(' ') ? skills.filter((k) => k.name.startsWith(draft.slice(1))) : [];

  return (
    <div className="panel right ai-panel" data-testid="ai-panel" style={{ zIndex: 21 }}>
      <div className="right-top">
        <span className="ai-badge"><I name="actions" size={14} /></span>
        <div className="grow" style={{ minWidth: 0 }}>
          <b>My Flow Agent</b>
          <div className="faint" style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-testid="ai-model-label">{hasKey ? `${providerName(provider)} · ${model}` : 'Not connected'}</div>
        </div>
        <IconButton icon="plus" tip="New chat" onClick={() => { session = null; useAgent.setState({ messages: [] }); }} testId="ai-new-chat" />
        <IconButton icon="more" tip="AI settings" onClick={() => useAgent.setState({ modal: 'settings' })} testId="ai-settings-btn" />
        <IconButton icon="close" tip="Close agent" onClick={() => useAgent.setState({ open: false })} testId="ai-close" />
      </div>
      <div className="panel-scroll ai-messages" ref={listRef}>
        {!hasKey ? (
          <div className="ai-onboard" data-testid="ai-onboarding">
            <b>Bring your own AI</b>
            <p className="muted">Connect Claude, ChatGPT or Gemini with your API key to unlock the design agent, first drafts, auto-prototyping, critiques, code generation, Make and more. Your key stays in this browser and is sent only to the provider you choose.</p>
            <button className="btn primary" onClick={() => useAgent.setState({ modal: 'settings' })} data-testid="ai-connect">Connect a provider</button>
          </div>
        ) : messages.length === 0 ? (
          <div className="ai-onboard">
            <b>What should we design?</b>
            <p className="muted">Ask for a new screen, or select layers and ask for changes. Type <code>/</code> for skills.</p>
            {SUGGESTIONS.map((s) => <button key={s.label} className="ai-chip" onClick={() => void runAgent(s.prompt)} data-testid={`ai-suggest-${s.label}`}>{s.label}</button>)}
          </div>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={`ai-msg ${m.role}`} data-testid={`ai-msg-${m.role}`}>
            {m.steps?.length ? (
              <div className="ai-steps">
                {m.steps.map((s) => (
                  <div key={s.id} className={'ai-step' + (s.done ? ' done' : '') + (s.error ? ' err' : '')} data-testid="ai-step">
                    <span className="dot">{s.done ? (s.error ? '!' : '✓') : <span className="spin" />}</span>{s.label}
                  </div>
                ))}
              </div>
            ) : null}
            {m.text ? <div className="ai-text">{m.text}</div> : m.role === 'assistant' && running ? <div className="faint">Thinking…</div> : null}
          </div>
        ))}
      </div>
      {hasKey ? (
        <div className="ai-quick" data-testid="ai-quick">
          {QUICK.map((q) => <button key={q.label} className="ai-chip small" onClick={q.run} disabled={running} data-testid={q.testId}>{q.label}</button>)}
        </div>
      ) : null}
      <div className="ai-input">
        {slashMatches.length ? (
          <div className="ai-slash" data-testid="ai-slash">
            {slashMatches.map((k) => <button key={k.id} onClick={() => useAgent.setState({ draft: `/${k.name} ` })}><b>/{k.name}</b> <span className="faint">{k.description}</span></button>)}
          </div>
        ) : null}
        <textarea ref={inputRef} rows={3} value={draft} placeholder={selCount ? `Ask about the ${selCount} selected layer${selCount > 1 ? 's' : ''}…` : 'Describe a design or a change…'}
          onChange={(e) => useAgent.setState({ draft: e.target.value })} data-testid="ai-input"
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <label className="checkbox faint" title="Attach a screenshot of the selection so the model can see it"><input type="checkbox" checked={includeShot} onChange={(e) => useAI.getState().set({ includeScreenshot: e.target.checked })} /> Send selection image</label>
          {running
            ? <button className="btn small" onClick={stopAgent} data-testid="ai-stop">Stop</button>
            : <button className="btn primary small" onClick={send} disabled={!draft.trim()} data-testid="ai-send">Send ↵</button>}
        </div>
      </div>
    </div>
  );
}

/* ================================================================ settings */

export function AIModals() {
  const modal = useAgent((s) => s.modal);
  const close = () => useAgent.setState({ modal: null });
  if (modal === 'settings') return <AISettings onClose={close} />;
  if (modal === 'make') return <MakeModal onClose={close} />;
  if (modal === 'code') return <CodeModal onClose={close} />;
  return null;
}

function AISettings({ onClose }: { onClose: () => void }) {
  const ai = useAI();
  const [tab, setTab] = useState<'provider' | 'guidelines' | 'skills'>('provider');
  const [status, setStatus] = useState<Record<ProviderId, string>>({ anthropic: '', openai: '', gemini: '' });
  const [testing, setTesting] = useState<ProviderId | null>(null);
  const test = async (p: ProviderId) => {
    const key = ai.keys[p];
    if (!key) { setStatus({ ...status, [p]: 'Enter a key first' }); return; }
    setTesting(p);
    setStatus({ ...status, [p]: 'Checking…' });
    try {
      const models = await listModels({ provider: p, apiKey: key, model: ai.models[p] });
      const chosen = chooseModel(p, ai.models[p], models);
      useAI.getState().set({ availableModels: { ...useAI.getState().availableModels, [p]: models } });
      useAI.getState().setModel(p, chosen);
      setStatus((st) => ({ ...st, [p]: `✓ Connected — ${models.length} models available` }));
    } catch (e) {
      setStatus((st) => ({ ...st, [p]: `✗ ${(e as Error).message}` }));
    } finally { setTesting(null); }
  };
  return (
    <Modal title="AI settings" onClose={onClose} wide testId="ai-settings">
      <div className="tabs">
        <button className={'tab' + (tab === 'provider' ? ' on' : '')} onClick={() => setTab('provider')}>Provider</button>
        <button className={'tab' + (tab === 'guidelines' ? ' on' : '')} onClick={() => setTab('guidelines')} data-testid="ai-tab-guidelines">Guidelines</button>
        <button className={'tab' + (tab === 'skills' ? ' on' : '')} onClick={() => setTab('skills')} data-testid="ai-tab-skills">Skills</button>
      </div>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tab === 'provider' ? (
          <>
            <div className="muted">Use one provider at a time. Keys are stored only in this browser and sent directly to the provider.</div>
            {PROVIDERS.map((p) => (
              <div key={p.id} className={'ai-provider' + (ai.provider === p.id ? ' on' : '')} data-testid={`ai-provider-${p.id}`}>
                <label className="row" style={{ gap: 8 }}>
                  <input type="radio" name="ai-provider" checked={ai.provider === p.id} onChange={() => ai.set({ provider: p.id })} data-testid={`ai-use-${p.id}`} />
                  <b>{p.label}</b>
                  <a className="faint" href={p.keyUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto' }}>Get a key ↗</a>
                </label>
                <div className="row">
                  <input className="input" type="password" autoComplete="off" placeholder={`API key (${p.keyHint})`} value={ai.keys[p.id]} onChange={(e) => ai.setKey(p.id, e.target.value)} onKeyDown={(e) => e.stopPropagation()} data-testid={`ai-key-${p.id}`} />
                  <button className="btn small" onClick={() => void test(p.id)} disabled={testing === p.id} data-testid={`ai-test-${p.id}`}>Test</button>
                </div>
                <div className="row">
                  <span className="muted" style={{ width: 50 }}>Model</span>
                  <input className="input" list={`models-${p.id}`} value={ai.models[p.id]} onChange={(e) => ai.setModel(p.id, e.target.value)} onKeyDown={(e) => e.stopPropagation()} data-testid={`ai-model-${p.id}`} />
                  <datalist id={`models-${p.id}`}>{ai.availableModels[p.id].map((m) => <option key={m} value={m} />)}</datalist>
                </div>
                {status[p.id] ? <div className={status[p.id].startsWith('✓') ? 'ai-ok' : status[p.id].startsWith('✗') ? 'ai-err' : 'faint'} data-testid={`ai-status-${p.id}`}>{status[p.id]}</div> : null}
              </div>
            ))}
            <label className="checkbox"><input type="checkbox" checked={ai.remember} onChange={(e) => ai.set({ remember: e.target.checked })} data-testid="ai-remember" /> Remember keys on this device (otherwise they're cleared when the tab closes)</label>
          </>
        ) : tab === 'guidelines' ? (
          <>
            <div className="muted">Rules the agent always follows — brand colors, type scale, spacing, tone of voice, component conventions.</div>
            <textarea className="input" rows={10} value={ai.guidelines} placeholder={'e.g.\n- Brand color #4F46E5, neutrals from slate\n- Inter only; 32/24/18/16/14 type scale\n- 8px spacing grid, 12px radius on cards'} onChange={(e) => ai.set({ guidelines: e.target.value })} onKeyDown={(e) => e.stopPropagation()} data-testid="ai-guidelines" />
          </>
        ) : (
          <SkillsEditor skills={ai.skills} onChange={(skills) => ai.set({ skills })} />
        )}
      </div>
      <div className="modal-footer"><button className="btn primary" onClick={onClose} data-testid="ai-settings-done">Done</button></div>
    </Modal>
  );
}

function SkillsEditor({ skills, onChange }: { skills: Skill[]; onChange: (s: Skill[]) => void }) {
  const up = (id: string, p: Partial<Skill>) => onChange(skills.map((k) => (k.id === id ? { ...k, ...p } : k)));
  return (
    <>
      <div className="muted">Skills are reusable workflows. Invoke one in the agent by typing <code>/name</code>.</div>
      {skills.map((k) => (
        <div key={k.id} className="ai-provider" data-testid={`ai-skill-${k.name}`}>
          <div className="row">
            <span className="faint">/</span>
            <input className="input" value={k.name} onChange={(e) => up(k.id, { name: e.target.value.replace(/[^a-z0-9-]/gi, '-').toLowerCase() })} onKeyDown={(e) => e.stopPropagation()} style={{ width: 160 }} data-testid="ai-skill-name" />
            <input className="input grow" value={k.description} placeholder="Short description" onChange={(e) => up(k.id, { description: e.target.value })} onKeyDown={(e) => e.stopPropagation()} />
            <IconButton icon="trash" tip="Delete skill" onClick={() => onChange(skills.filter((x) => x.id !== k.id))} />
          </div>
          <textarea className="input" rows={3} value={k.instructions} placeholder="Instructions for the agent" onChange={(e) => up(k.id, { instructions: e.target.value })} onKeyDown={(e) => e.stopPropagation()} data-testid="ai-skill-instructions" />
        </div>
      ))}
      <button className="btn" onClick={() => onChange([...skills, { id: uid('sk'), name: `skill-${skills.length + 1}`, description: '', instructions: '' }])} data-testid="ai-add-skill">+ Add skill</button>
    </>
  );
}

/* ================================================================ make (prompt → app) */

function MakeModal({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [html, setHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [useSel, setUseSel] = useState(S().selection.length > 0);
  const [showCode, setShowCode] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const go = async () => {
    if (!prompt.trim()) return;
    setBusy(true); setErr('');
    ctl.current = new AbortController();
    try {
      setHtml(await aiMakeApp(prompt.trim(), html, useSel && !html, ctl.current.signal));
      setPrompt('');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html!], { type: 'text/html' })); a.download = 'myflow-make-app.html'; a.click(); };
  const openTab = () => window.open(URL.createObjectURL(new Blob([html!], { type: 'text/html' })), '_blank');
  return (
    <Modal title={<span className="row"><I name="code" size={16} /> Make — prompt to app</span>} onClose={onClose} wide testId="ai-make">
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {html ? (
          <div className="ai-make-preview">
            {showCode ? <pre className="code-block" style={{ height: 420, overflow: 'auto', margin: 0 }} data-testid="ai-make-code">{html}</pre>
              : <iframe title="App preview" sandbox="allow-scripts allow-forms allow-modals" srcDoc={html} data-testid="ai-make-preview" />}
          </div>
        ) : <div className="empty">Describe an app and My Flow will build a working, interactive prototype in code.{S().selection.length ? ' You can use the selected design as the visual reference.' : ''}</div>}
        {err ? <div className="ai-err" data-testid="ai-make-error">{err}</div> : null}
        <textarea className="input" rows={3} value={prompt} placeholder={html ? 'Ask for a change — e.g. "add a dark mode toggle"' : 'e.g. A habit tracker with streaks, a weekly calendar and an add-habit dialog'} onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void go(); }} data-testid="ai-make-prompt" />
        <div className="row">
          {!html && S().selection.length ? <label className="checkbox"><input type="checkbox" checked={useSel} onChange={(e) => setUseSel(e.target.checked)} /> Use selected design as reference</label> : null}
          <span className="spacer" />
          {html ? <>
            <button className="btn small" onClick={() => setShowCode(!showCode)} data-testid="ai-make-toggle-code">{showCode ? 'Preview' : 'Code'}</button>
            <button className="btn small" onClick={openTab}>Open in new tab</button>
            <button className="btn small" onClick={download} data-testid="ai-make-download">Download</button>
          </> : null}
          {busy ? <button className="btn small" onClick={() => ctl.current?.abort()}>Stop</button> : null}
          <button className="btn primary" onClick={() => void go()} disabled={busy || !prompt.trim()} data-testid="ai-make-go">{busy ? 'Building…' : html ? 'Update app' : 'Build app'}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ================================================================ code generation */

function CodeModal({ onClose }: { onClose: () => void }) {
  const [fw, setFw] = useState('React + Tailwind');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const sel = useEditor((s) => s.selection[0] ? s.doc?.nodes[s.selection[0]]?.name : undefined);
  const go = async () => {
    setBusy(true); setErr('');
    try { setCode(await aiGenerateCode(fw)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal title={<span className="row"><I name="code" size={16} /> Generate code {sel ? `· ${sel}` : ''}</span>} onClose={onClose} wide testId="ai-code">
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row">
          <div style={{ width: 220 }}><Select value={fw} options={['React + Tailwind', 'HTML + CSS', 'Vue 3', 'SwiftUI', 'Jetpack Compose', 'Flutter'].map((v) => ({ value: v, label: v }))} onChange={setFw} testId="ai-code-framework" /></div>
          <span className="spacer" />
          {code ? <button className="btn small" onClick={() => { void navigator.clipboard?.writeText(code); S().toast('Code copied'); }} data-testid="ai-code-copy">Copy</button> : null}
          <button className="btn primary" onClick={() => void go()} disabled={busy || !sel} data-testid="ai-code-go">{busy ? 'Generating…' : 'Generate'}</button>
        </div>
        {!sel ? <div className="faint">Select a frame or layer on the canvas first.</div> : null}
        {err ? <div className="ai-err">{err}</div> : null}
        {code ? <pre className="code-block" style={{ maxHeight: 460, overflow: 'auto', margin: 0 }} data-testid="ai-code-output">{code}</pre> : null}
      </div>
    </Modal>
  );
}
