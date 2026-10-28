/**
 * Provider adapters: one interface over Anthropic Claude, OpenAI ChatGPT and Google Gemini.
 * All calls go straight from the browser to the provider with the user's own key (no backend).
 * SDKs are loaded lazily so they don't weigh down the editor bundle.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';
import type { Content, Part as GPart } from '@google/genai';
import type { ActiveConfig, ProviderId } from './config';

export type Part = { type: 'text'; text: string } | { type: 'image'; mediaType: 'image/png' | 'image/jpeg'; data: string };

export interface ToolSpec {
  name: string;
  description: string;
  parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export interface ToolOutput { text: string; image?: { mediaType: 'image/png' | 'image/jpeg'; data: string } }

export interface RunHandlers {
  onText?: (delta: string) => void;
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  onToolResult?: (name: string, out: ToolOutput) => void;
  executeTool: (name: string, input: Record<string, unknown>) => Promise<ToolOutput>;
  signal?: AbortSignal;
  maxSteps?: number;
}

export class AIError extends Error {
  constructor(message: string, readonly kind: 'auth' | 'rate' | 'refusal' | 'network' | 'model' | 'other' = 'other') { super(message); }
}

/* -------------------------------------------------------------- helpers */

const CLAUDE_FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-fable-5-1', 'claude-opus-5', 'claude-sonnet-5-5']);
const claudeSupportsEffort = (m: string) => /^claude-(opus-5|fable|mythos|sonnet-5|haiku-5|opus-4-[678])/.test(m);

/** Minimal JSON-schema validation of tool inputs (required keys + top-level types). */
export function validateInput(spec: ToolSpec, input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'input must be an object';
  const obj = input as Record<string, unknown>;
  for (const k of spec.parameters.required ?? []) if (!(k in obj)) return `missing required field "${k}"`;
  for (const [k, v] of Object.entries(obj)) {
    const p = spec.parameters.properties[k] as { type?: string } | undefined;
    if (!p?.type || v === undefined || v === null) continue;
    const t = Array.isArray(v) ? 'array' : typeof v;
    const ok = p.type === t || (p.type === 'integer' && typeof v === 'number') || (p.type === 'number' && typeof v === 'number');
    if (!ok) return `field "${k}" should be ${p.type}`;
  }
  return null;
}

function mapError(provider: ProviderId, err: unknown): AIError {
  if (err instanceof AIError) return err;
  const e = err as { status?: number; name?: string; message?: string };
  if (e?.name === 'AbortError' || e?.name === 'APIUserAbortError') return new AIError('Stopped', 'other');
  const status = e?.status;
  const msg = e?.message ?? String(err);
  if (status === 401 || status === 403) return new AIError(`${provider === 'anthropic' ? 'Claude' : provider === 'openai' ? 'OpenAI' : 'Gemini'} rejected the API key (${status}). Check it in AI settings.`, 'auth');
  if (status === 429) return new AIError('Rate limited by the provider — wait a moment and try again.', 'rate');
  if (status === 404) return new AIError(`Model not found (${msg}). Pick another model in AI settings.`, 'model');
  if (/API key not valid|API_KEY_INVALID/i.test(msg)) return new AIError('Gemini rejected the API key. Check it in AI settings.', 'auth');
  if (/Failed to fetch|NetworkError|Connection error/i.test(msg)) return new AIError('Network error — check your connection.', 'network');
  return new AIError(msg, 'other');
}

/* -------------------------------------------------------------- Claude */

async function claudeClient(cfg: ActiveConfig) {
  const { default: AnthropicSDK } = await import('@anthropic-ai/sdk');
  return new AnthropicSDK({ apiKey: cfg.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

function claudeExtras(model: string, effort: 'low' | 'medium' | 'high') {
  const extra: Record<string, unknown> = {};
  if (claudeSupportsEffort(model)) extra.output_config = { effort };
  if (CLAUDE_FALLBACK_MODELS.has(model)) { extra.betas = ['server-side-fallback-2026-07-01']; extra.fallbacks = 'default'; }
  return extra;
}

function claudeParts(parts: Part[]): Anthropic.Beta.BetaContentBlockParam[] {
  return parts.map((p) => (p.type === 'text'
    ? { type: 'text' as const, text: p.text }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: p.mediaType, data: p.data } }));
}

class ClaudeSession {
  private history: Anthropic.Beta.BetaMessageParam[] = [];
  constructor(private cfg: ActiveConfig, private system: string, private tools: ToolSpec[]) {}

  async send(parts: Part[], h: RunHandlers): Promise<string> {
    const client = await claudeClient(this.cfg);
    this.history.push({ role: 'user', content: claudeParts(parts) });
    const tools = this.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters, eager_input_streaming: true }));
    let finalText = '';
    let jsonRetries = 0;
    for (let step = 0; step < (h.maxSteps ?? 40); step++) {
      const stream = client.beta.messages.stream({
        model: this.cfg.model,
        max_tokens: 64000,
        system: this.system,
        tools: tools as Anthropic.Beta.BetaTool[],
        messages: this.history,
        ...claudeExtras(this.cfg.model, 'high'),
      } as Anthropic.Beta.Messages.MessageCreateParamsStreaming, { signal: h.signal });
      stream.on('text', (d) => { finalText += d; h.onText?.(d); });
      let message: Anthropic.Beta.BetaMessage;
      try {
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (err) {
        const { default: AnthropicSDK } = await import('@anthropic-ai/sdk');
        if (err instanceof AnthropicSDK.APIError || h.signal?.aborted || jsonRetries++ >= 2) throw mapError('anthropic', err);
        continue; // unparseable streamed tool input: re-issue the turn
      }
      if (message.stop_reason === 'refusal') throw new AIError('Claude declined this request.', 'refusal');
      const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (message.stop_reason === 'pause_turn') { this.history.push({ role: 'assistant', content: message.content }); continue; }
      if (!toolUses.length || message.stop_reason === 'end_turn') {
        this.history.push({ role: 'assistant', content: message.content });
        return finalText;
      }
      if (message.stop_reason === 'max_tokens') throw new AIError('The response was cut off (max tokens). Try a smaller request.', 'other');
      this.history.push({ role: 'assistant', content: message.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const spec = this.tools.find((t) => t.name === tu.name);
        const input = tu.input as Record<string, unknown>;
        const invalid = spec ? validateInput(spec, input) : `unknown tool ${tu.name}`;
        if (invalid) { results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: JSON.stringify({ INVALID_JSON: invalid }) }); continue; }
        h.onToolCall?.(tu.name, input);
        const out = await h.executeTool(tu.name, input).catch((e: Error) => ({ text: `Error: ${e.message}` } as ToolOutput));
        h.onToolResult?.(tu.name, out);
        const content: Anthropic.Beta.BetaToolResultBlockParam['content'] = [{ type: 'text', text: out.text }];
        if (out.image) content.push({ type: 'image', source: { type: 'base64', media_type: out.image.mediaType, data: out.image.data } });
        results.push({ type: 'tool_result', tool_use_id: tu.id, content, is_error: out.text.startsWith('Error:') || undefined });
      }
      this.history.push({ role: 'user', content: results });
      finalText = '';
    }
    throw new AIError('Stopped after too many steps.', 'other');
  }
}

/* -------------------------------------------------------------- OpenAI */

async function openaiClient(cfg: ActiveConfig) {
  const { default: OpenAISDK } = await import('openai');
  return new OpenAISDK({ apiKey: cfg.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

function openaiParts(parts: Part[]): OpenAI.Chat.ChatCompletionContentPart[] {
  return parts.map((p) => (p.type === 'text'
    ? { type: 'text' as const, text: p.text }
    : { type: 'image_url' as const, image_url: { url: `data:${p.mediaType};base64,${p.data}` } }));
}

class OpenAISession {
  private history: OpenAI.Chat.ChatCompletionMessageParam[];
  constructor(private cfg: ActiveConfig, system: string, private tools: ToolSpec[]) {
    this.history = [{ role: 'system', content: system }];
  }

  async send(parts: Part[], h: RunHandlers): Promise<string> {
    const client = await openaiClient(this.cfg);
    this.history.push({ role: 'user', content: openaiParts(parts) });
    const tools: OpenAI.Chat.ChatCompletionTool[] = this.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
    for (let step = 0; step < (h.maxSteps ?? 40); step++) {
      let resp: OpenAI.Chat.ChatCompletion;
      try {
        resp = await client.chat.completions.create({ model: this.cfg.model, messages: this.history, tools }, { signal: h.signal });
      } catch (err) { throw mapError('openai', err); }
      const choice = resp.choices[0];
      const msg = choice.message;
      if (msg.refusal) throw new AIError(msg.refusal, 'refusal');
      this.history.push(msg as OpenAI.Chat.ChatCompletionMessageParam);
      if (msg.content) h.onText?.(msg.content);
      const calls = (msg.tool_calls ?? []).filter((c): c is OpenAI.Chat.ChatCompletionMessageFunctionToolCall => c.type === 'function');
      if (!calls.length) return msg.content ?? '';
      const images: Part[] = [];
      for (const c of calls) {
        const spec = this.tools.find((t) => t.name === c.function.name);
        let input: Record<string, unknown> = {};
        let invalid: string | null = null;
        try { input = JSON.parse(c.function.arguments || '{}'); } catch { invalid = 'arguments were not valid JSON'; }
        invalid = invalid ?? (spec ? validateInput(spec, input) : `unknown tool ${c.function.name}`);
        if (invalid) { this.history.push({ role: 'tool', tool_call_id: c.id, content: `Error: ${invalid}` }); continue; }
        h.onToolCall?.(c.function.name, input);
        const out = await h.executeTool(c.function.name, input).catch((e: Error) => ({ text: `Error: ${e.message}` } as ToolOutput));
        h.onToolResult?.(c.function.name, out);
        this.history.push({ role: 'tool', tool_call_id: c.id, content: out.text });
        if (out.image) images.push({ type: 'text', text: `Screenshot returned by ${c.function.name}:` }, { type: 'image', ...out.image });
      }
      // tool messages can't carry images, so attach screenshots as a follow-up user message
      if (images.length) this.history.push({ role: 'user', content: openaiParts(images) });
    }
    throw new AIError('Stopped after too many steps.', 'other');
  }
}

/* -------------------------------------------------------------- Gemini */

async function geminiClient(cfg: ActiveConfig) {
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey: cfg.apiKey });
}

function geminiParts(parts: Part[]): GPart[] {
  return parts.map((p) => (p.type === 'text' ? { text: p.text } : { inlineData: { mimeType: p.mediaType, data: p.data } }));
}

class GeminiSession {
  private history: Content[] = [];
  constructor(private cfg: ActiveConfig, private system: string, private tools: ToolSpec[]) {}

  async send(parts: Part[], h: RunHandlers): Promise<string> {
    const ai = await geminiClient(this.cfg);
    this.history.push({ role: 'user', parts: geminiParts(parts) });
    const functionDeclarations = this.tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters }));
    for (let step = 0; step < (h.maxSteps ?? 40); step++) {
      let resp;
      try {
        resp = await ai.models.generateContent({
          model: this.cfg.model,
          contents: this.history,
          config: { systemInstruction: this.system, tools: [{ functionDeclarations }], abortSignal: h.signal },
        });
      } catch (err) { throw mapError('gemini', err); }
      const content = resp.candidates?.[0]?.content;
      if (!content) {
        const reason = resp.promptFeedback?.blockReason ?? resp.candidates?.[0]?.finishReason;
        throw new AIError(`Gemini returned no content${reason ? ` (${reason})` : ''}.`, reason ? 'refusal' : 'other');
      }
      // keep the model turn exactly as returned (preserves thought signatures)
      this.history.push({ role: 'model', parts: content.parts ?? [] });
      const text = (content.parts ?? []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
      if (text) h.onText?.(text);
      const calls = resp.functionCalls ?? [];
      if (!calls.length) return text;
      const responses: GPart[] = [];
      const images: GPart[] = [];
      for (const fc of calls) {
        const name = fc.name ?? '';
        const spec = this.tools.find((t) => t.name === name);
        const input = (fc.args ?? {}) as Record<string, unknown>;
        const invalid = spec ? validateInput(spec, input) : `unknown tool ${name}`;
        let out: ToolOutput;
        if (invalid) out = { text: `Error: ${invalid}` };
        else {
          h.onToolCall?.(name, input);
          out = await h.executeTool(name, input).catch((e: Error) => ({ text: `Error: ${e.message}` } as ToolOutput));
          h.onToolResult?.(name, out);
        }
        responses.push({ functionResponse: { id: fc.id, name, response: { result: out.text } } });
        if (out.image) images.push({ text: `Screenshot returned by ${name}:` }, { inlineData: { mimeType: out.image.mediaType, data: out.image.data } });
      }
      this.history.push({ role: 'user', parts: [...responses, ...images] });
    }
    throw new AIError('Stopped after too many steps.', 'other');
  }
}

/* -------------------------------------------------------------- public API */

export interface ChatSession { send(parts: Part[], h: RunHandlers): Promise<string> }

export function createSession(cfg: ActiveConfig, system: string, tools: ToolSpec[]): ChatSession {
  if (cfg.provider === 'anthropic') return new ClaudeSession(cfg, system, tools);
  if (cfg.provider === 'openai') return new OpenAISession(cfg, system, tools);
  return new GeminiSession(cfg, system, tools);
}

/** Single request. With `json`, the reply is a JSON object matching the schema. */
export async function complete(cfg: ActiveConfig, opts: { system: string; parts: Part[]; json?: Record<string, unknown>; signal?: AbortSignal; effort?: 'low' | 'medium' | 'high' }): Promise<string> {
  const effort = opts.effort ?? 'low';
  try {
    if (cfg.provider === 'anthropic') {
      const client = await claudeClient(cfg);
      const extra = claudeExtras(cfg.model, effort);
      if (opts.json) extra.output_config = { ...(extra.output_config as object ?? {}), format: { type: 'json_schema', schema: opts.json } };
      const stream = client.beta.messages.stream({
        model: cfg.model, max_tokens: 32000, system: opts.system,
        messages: [{ role: 'user', content: claudeParts(opts.parts) }], ...extra,
      } as Anthropic.Beta.Messages.MessageCreateParamsStreaming, { signal: opts.signal });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') throw new AIError('Claude declined this request.', 'refusal');
      return msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('');
    }
    if (cfg.provider === 'openai') {
      const client = await openaiClient(cfg);
      const system = opts.json ? `${opts.system}\n\nRespond with a single JSON object matching this JSON schema:\n${JSON.stringify(opts.json)}` : opts.system;
      const resp = await client.chat.completions.create({
        model: cfg.model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: openaiParts(opts.parts) }],
        ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
      }, { signal: opts.signal });
      const m = resp.choices[0].message;
      if (m.refusal) throw new AIError(m.refusal, 'refusal');
      return m.content ?? '';
    }
    const ai = await geminiClient(cfg);
    const resp = await ai.models.generateContent({
      model: cfg.model,
      contents: [{ role: 'user', parts: geminiParts(opts.parts) }],
      config: {
        systemInstruction: opts.json ? `${opts.system}\n\nRespond with a single JSON object matching this JSON schema:\n${JSON.stringify(opts.json)}` : opts.system,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
        abortSignal: opts.signal,
      },
    });
    return resp.text ?? '';
  } catch (err) {
    throw mapError(cfg.provider, err);
  }
}

export async function completeJSON<T>(cfg: ActiveConfig, opts: { system: string; parts: Part[]; schema: Record<string, unknown>; signal?: AbortSignal }): Promise<T> {
  const text = await complete(cfg, { ...opts, json: opts.schema });
  return parseJSONLoose<T>(text);
}

export function parseJSONLoose<T>(text: string): T {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t) as T; } catch { /* try to extract */ }
  const start = t.indexOf('{'), end = t.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1)) as T;
  throw new AIError('The model did not return valid JSON. Try again.', 'other');
}

/** Lists chat-capable models for the key; also validates the key. */
export async function listModels(cfg: ActiveConfig): Promise<string[]> {
  try {
    if (cfg.provider === 'anthropic') {
      const client = await claudeClient(cfg);
      const out: string[] = [];
      for await (const m of client.models.list()) out.push(m.id);
      return out;
    }
    if (cfg.provider === 'openai') {
      const client = await openaiClient(cfg);
      const out: string[] = [];
      for await (const m of client.models.list()) out.push(m.id);
      return out.filter((id) => /^(gpt|o\d|chatgpt)/.test(id) && !/(audio|realtime|transcribe|tts|image|search|embedding|moderation|instruct)/.test(id)).sort().reverse();
    }
    const ai = await geminiClient(cfg);
    const out: string[] = [];
    const pager = await ai.models.list();
    for await (const m of pager) {
      if (!m.name) continue;
      if (m.supportedActions && !m.supportedActions.includes('generateContent')) continue;
      const id = m.name.replace(/^models\//, '');
      if (/^gemini/.test(id) && !/(tts|image|embedding|audio|live)/.test(id)) out.push(id);
    }
    return out.sort().reverse();
  } catch (err) {
    throw mapError(cfg.provider, err);
  }
}

/** Pick the configured model if available, else the best match from the list. */
export function chooseModel(provider: ProviderId, wanted: string, available: string[]): string {
  if (!available.length || available.includes(wanted)) return wanted;
  const prefs: Record<ProviderId, RegExp[]> = {
    anthropic: [/^claude-opus-5-5$/, /^claude-opus-5/, /^claude-sonnet-5-5$/, /^claude-sonnet/, /^claude/],
    openai: [/^gpt-6/, /^gpt-5\.6-sol/, /^gpt-5\.\d/, /^gpt-5/, /^gpt/],
    gemini: [/^gemini-3\.5-(pro|flash)$/, /^gemini-3/, /^gemini-2\.5-pro/, /^gemini/],
  };
  for (const re of prefs[provider]) {
    const hit = available.find((m) => re.test(m));
    if (hit) return hit;
  }
  return available[0];
}
