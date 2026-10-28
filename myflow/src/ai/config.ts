import { create } from 'zustand';

export type ProviderId = 'anthropic' | 'openai' | 'gemini';

export const PROVIDERS: { id: ProviderId; name: string; label: string; defaultModel: string; keyHint: string; keyUrl: string }[] = [
  { id: 'anthropic', name: 'Claude', label: 'Anthropic Claude', defaultModel: 'claude-opus-5-5', keyHint: 'sk-ant-…', keyUrl: 'https://platform.claude.com/settings/keys' },
  { id: 'openai', name: 'ChatGPT', label: 'OpenAI ChatGPT', defaultModel: 'gpt-5.6-sol', keyHint: 'sk-…', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'gemini', name: 'Gemini', label: 'Google Gemini', defaultModel: 'gemini-3.5-flash', keyHint: 'AIza…', keyUrl: 'https://aistudio.google.com/app/apikey' },
];

export interface Skill { id: string; name: string; description: string; instructions: string; }

export interface AISettings {
  provider: ProviderId;
  keys: Record<ProviderId, string>;
  models: Record<ProviderId, string>;
  availableModels: Record<ProviderId, string[]>;
  remember: boolean;
  guidelines: string;
  skills: Skill[];
  includeScreenshot: boolean;
}

const STORAGE = 'myflow:ai';
const SESSION_KEYS = 'myflow:ai-keys';

const defaults: AISettings = {
  provider: 'anthropic',
  keys: { anthropic: '', openai: '', gemini: '' },
  models: { anthropic: 'claude-opus-5-5', openai: 'gpt-5.6-sol', gemini: 'gemini-3.5-flash' },
  availableModels: { anthropic: [], openai: [], gemini: [] },
  remember: true,
  guidelines: '',
  skills: [
    {
      id: 'skill-mobile',
      name: 'mobile-screen',
      description: 'Build a polished iPhone screen',
      instructions: 'Create a 393×852 frame (iPhone 16). Use a vertical auto layout with 24px side padding, 8px spacing grid, a clear type scale (32/20/16/14), at least one primary button and realistic content. Verify with a screenshot when done.',
    },
    {
      id: 'skill-a11y',
      name: 'a11y-fix',
      description: 'Fix accessibility issues in the selection',
      instructions: 'Inspect the selection. Raise text contrast to WCAG AA (4.5:1 for body, 3:1 for ≥24px), make tap targets at least 44×44, and give layers meaningful names. Explain what you changed.',
    },
  ],
  includeScreenshot: true,
};

function load(): AISettings {
  try {
    const raw = localStorage.getItem(STORAGE);
    const s = raw ? { ...defaults, ...JSON.parse(raw) } as AISettings : { ...defaults };
    if (!s.remember) {
      const sk = sessionStorage.getItem(SESSION_KEYS);
      s.keys = sk ? { ...defaults.keys, ...JSON.parse(sk) } : { ...defaults.keys };
    }
    s.keys = { ...defaults.keys, ...s.keys };
    s.models = { ...defaults.models, ...s.models };
    s.availableModels = { ...defaults.availableModels, ...s.availableModels };
    return s;
  } catch {
    return { ...defaults };
  }
}

function persist(s: AISettings) {
  try {
    const toSave = s.remember ? s : { ...s, keys: { anthropic: '', openai: '', gemini: '' } };
    localStorage.setItem(STORAGE, JSON.stringify(toSave));
    if (!s.remember) sessionStorage.setItem(SESSION_KEYS, JSON.stringify(s.keys));
    else sessionStorage.removeItem(SESSION_KEYS);
  } catch { /* storage unavailable */ }
}

interface AIStore extends AISettings {
  set: (p: Partial<AISettings>) => void;
  setKey: (p: ProviderId, key: string) => void;
  setModel: (p: ProviderId, model: string) => void;
}

export const useAI = create<AIStore>((set, get) => ({
  ...load(),
  set: (p) => { set(p); persist(snapshot(get())); },
  setKey: (p, key) => { set({ keys: { ...get().keys, [p]: key.trim() } }); persist(snapshot(get())); },
  setModel: (p, model) => { set({ models: { ...get().models, [p]: model.trim() } }); persist(snapshot(get())); },
}));

function snapshot(s: AIStore): AISettings {
  const { provider, keys, models, availableModels, remember, guidelines, skills, includeScreenshot } = s;
  return { provider, keys, models, availableModels, remember, guidelines, skills, includeScreenshot };
}

export interface ActiveConfig { provider: ProviderId; apiKey: string; model: string; }

export function activeConfig(): ActiveConfig | null {
  const s = useAI.getState();
  const apiKey = s.keys[s.provider];
  if (!apiKey) return null;
  return { provider: s.provider, apiKey, model: s.models[s.provider] || PROVIDERS.find((p) => p.id === s.provider)!.defaultModel };
}

export function providerName(id: ProviderId) {
  return PROVIDERS.find((p) => p.id === id)!.name;
}
