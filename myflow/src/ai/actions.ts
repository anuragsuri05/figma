import { S, currentDoc, currentPage, setProps, addComment, screenToWorld, zoomToSelection } from '../store/editor';
import { activeConfig } from './config';
import { complete, completeJSON, AIError, type Part } from './providers';
import { canvasContext, descendantTexts, nodeSummary, screenshotOf } from './tools';
import { createNode, imagePaint, reaction as newReaction, uid } from '../model/defaults';
import { descendants, absRect } from '../model/tree';
import { svgDataUrl } from './spec';
import type { Reaction } from '../model/types';

export class NeedsSetup extends Error { constructor() { super('Connect an AI provider first.'); } }

function cfgOrThrow() {
  const cfg = activeConfig();
  if (!cfg) throw new NeedsSetup();
  return cfg;
}

const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const arr = (items: unknown) => ({ type: 'array', items });
const str = { type: 'string' };

function targetIds(): string[] {
  const s = S();
  return s.selection.length ? s.selection : currentPage().children;
}

/* ---------------------------------------------------------------- rename layers */

export async function aiRenameLayers(signal?: AbortSignal): Promise<string> {
  const cfg = cfgOrThrow();
  const doc = currentDoc();
  const roots = targetIds();
  const budget = { n: 300 };
  const tree = roots.map((id) => nodeSummary(doc, id, 10, budget));
  const res = await completeJSON<{ renames: { id: string; name: string }[] }>(cfg, {
    system: 'You name design layers like a tidy senior designer: short, semantic, Title Case or slash-grouped (e.g. "Header", "Nav / Item", "Primary button", "Avatar"). Text layers may keep their content as the name if it is short. Never rename to generic names like "Frame 3" or "Rectangle".',
    parts: [{ type: 'text', text: `Suggest better names for these layers. Return only layers whose name should change.\n${JSON.stringify(tree)}` }],
    schema: obj({ renames: arr(obj({ id: str, name: str })) }),
    signal,
  });
  const valid = (res.renames ?? []).filter((r) => doc.nodes[r.id] && r.name?.trim());
  S().begin();
  for (const r of valid) setProps([r.id], { name: r.name.trim().slice(0, 60) });
  S().end();
  return `Renamed ${valid.length} layer${valid.length === 1 ? '' : 's'}.`;
}

/* ---------------------------------------------------------------- text actions */

export type TextMode = 'rewrite' | 'shorten' | 'lengthen' | 'translate' | 'fix' | 'friendly' | 'formal' | 'realistic';

const TEXT_INSTRUCTIONS: Record<TextMode, string> = {
  rewrite: 'Rewrite each text to be clearer and more compelling, keeping roughly the same length and meaning.',
  shorten: 'Shorten each text substantially while keeping its meaning. UI copy should be concise.',
  lengthen: 'Expand each text with more useful detail, about 1.5–2× longer.',
  translate: 'Translate each text into the target language. Keep brand names, numbers and placeholders.',
  fix: 'Fix spelling, grammar and punctuation only. Do not change wording otherwise.',
  friendly: 'Rewrite each text in a warm, friendly, conversational tone.',
  formal: 'Rewrite each text in a professional, formal tone.',
  realistic: 'Replace placeholder or generic text (lorem ipsum, "Title", "Text", "Button", "Name", sample numbers) with realistic, specific, context-appropriate content for this design. Keep each text a similar length so the layout still fits. Make names, prices, dates and numbers varied and believable.',
};

export async function aiText(mode: TextMode, opts: { language?: string; signal?: AbortSignal } = {}): Promise<string> {
  const cfg = cfgOrThrow();
  const doc = currentDoc();
  const texts = descendantTexts(targetIds()).slice(0, 200);
  if (!texts.length) return 'Select layers that contain text first.';
  const context = mode === 'realistic' ? `Design context (for meaning): ${JSON.stringify(targetIds().slice(0, 5).map((id) => nodeSummary(doc, id, 4, { n: 120 })))}\n\n` : '';
  const res = await completeJSON<{ texts: { id: string; text: string }[] }>(cfg, {
    system: `You edit UI copy inside a design tool. ${TEXT_INSTRUCTIONS[mode]}${mode === 'translate' ? ` Target language: ${opts.language || 'Spanish'}.` : ''} Preserve line breaks where they matter. Return every text you were given, by id.`,
    parts: [{ type: 'text', text: `${context}Texts:\n${JSON.stringify(texts.map((t) => ({ id: t.id, layer: t.name, text: t.text!.characters })))}` }],
    schema: obj({ texts: arr(obj({ id: str, text: str })) }),
    signal: opts.signal,
  });
  const valid = (res.texts ?? []).filter((t) => doc.nodes[t.id]?.text && typeof t.text === 'string');
  S().begin();
  for (const t of valid) setProps([t.id], (n) => { if (n.text) n.text.characters = t.text; });
  S().end();
  return `Updated ${valid.length} text layer${valid.length === 1 ? '' : 's'}.`;
}

/* ---------------------------------------------------------------- make prototype */

export async function aiMakePrototype(signal?: AbortSignal): Promise<string> {
  const cfg = cfgOrThrow();
  const doc = currentDoc();
  const page = currentPage();
  const frames = page.children.flatMap((id) => (doc.nodes[id]?.type === 'SECTION' ? doc.nodes[id].children : [id])).filter((id) => ['FRAME', 'INSTANCE'].includes(doc.nodes[id]?.type));
  if (frames.length < 2) return 'Add at least two frames to the page to wire a prototype.';
  const budget = { n: 350 };
  const tree = frames.map((id) => nodeSummary(doc, id, 6, budget));
  const res = await completeJSON<{ links: { from_id: string; to_id: string; animation: string; reason: string }[]; start_id: string }>(cfg, {
    system: 'You are a prototyping expert. Given app screens, connect interactive elements (buttons, links, tabs, cards, back arrows) to the screens they should open. Use smart_animate between similar screens, push or slide_in for forward navigation, and dissolve otherwise. Only link layers that clearly look interactive. Pick the most likely starting screen.',
    parts: [{ type: 'text', text: `Screens:\n${JSON.stringify(tree)}` }],
    schema: obj({ links: arr(obj({ from_id: str, to_id: str, animation: str, reason: str })), start_id: str }),
    signal,
  });
  const links = (res.links ?? []).filter((l) => doc.nodes[l.from_id] && doc.nodes[l.to_id] && l.from_id !== l.to_id);
  S().begin();
  for (const l of links) {
    const anim = String(l.animation ?? '').toUpperCase();
    const r: Reaction = { ...newReaction(l.to_id), animation: (['INSTANT', 'DISSOLVE', 'SMART_ANIMATE', 'MOVE_IN', 'PUSH', 'SLIDE_IN'].includes(anim) ? anim : 'SMART_ANIMATE') as Reaction['animation'], duration: 300, easing: 'EASE_IN_OUT' };
    setProps([l.from_id], (n) => { n.reactions = [...n.reactions.filter((x) => x.destinationId !== l.to_id), r]; });
  }
  const start = doc.nodes[res.start_id] && frames.includes(res.start_id) ? res.start_id : frames[0];
  if (!currentPage().flowStarts.length) S().update((d) => { d.pages.find((p) => p.id === S().pageId)!.flowStarts.push({ id: uid('fl'), nodeId: start, name: 'Flow 1' }); });
  S().end();
  S().setState({ rightTab: 'prototype' });
  return `Added ${links.length} prototype connection${links.length === 1 ? '' : 's'}. Press ▶ Present to try it.`;
}

/* ---------------------------------------------------------------- critique / accessibility */

export async function aiReview(kind: 'critique' | 'accessibility', signal?: AbortSignal): Promise<string> {
  const cfg = cfgOrThrow();
  const doc = currentDoc();
  const s = S();
  const target = s.selection[0] ?? currentPage().children.find((c) => ['FRAME', 'COMPONENT', 'INSTANCE'].includes(doc.nodes[c]?.type));
  if (!target) return 'Select a frame to review.';
  const shot = await screenshotOf(target);
  const parts: Part[] = [];
  if (shot.image) parts.push({ type: 'image', ...shot.image });
  parts.push({ type: 'text', text: `Layer tree of the design (ids for pinning comments):\n${JSON.stringify(nodeSummary(doc, target, 8, { n: 300 }))}` });
  const res = await completeJSON<{ summary: string; issues: { node_id: string; severity: string; title: string; detail: string }[] }>(cfg, {
    system: kind === 'accessibility'
      ? 'You are an accessibility auditor (WCAG 2.2 AA). Check text contrast (4.5:1 body, 3:1 large), touch target size (44×44), text size, hierarchy and labelling, color-only meaning, and focus/keyboard concerns. Report concrete, actionable issues tied to specific layers.'
      : 'You are a senior product designer giving a design critique. Evaluate visual hierarchy, layout and spacing consistency, typography, color, alignment, clarity of the primary action and copy. Be specific and actionable; mention what works too in the summary.',
    parts,
    schema: obj({ summary: str, issues: arr(obj({ node_id: str, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, title: str, detail: str })) }),
    signal,
  });
  const issues = (res.issues ?? []).slice(0, 15);
  S().begin();
  const prevActive = S().activeCommentId;
  issues.forEach((iss, i) => {
    const nid = doc.nodes[iss.node_id] ? iss.node_id : target;
    const r = absRect(currentDoc(), nid);
    addComment(r.x + r.width - 4, r.y + 4 + i * 2, `🤖 ${iss.severity === 'high' ? '🔴' : iss.severity === 'medium' ? '🟠' : '🟡'} ${iss.title}\n${iss.detail}`, nid);
  });
  S().setState({ activeCommentId: prevActive, draftComment: null });
  S().end();
  return `${res.summary ?? ''}\n\n${issues.length ? `Pinned ${issues.length} comment${issues.length === 1 ? '' : 's'} on the canvas:\n${issues.map((i) => `• ${i.title}`).join('\n')}` : 'No issues found.'}`.trim();
}

/* ---------------------------------------------------------------- code generation */

export async function aiGenerateCode(framework: string, signal?: AbortSignal): Promise<string> {
  const cfg = cfgOrThrow();
  const doc = currentDoc();
  const id = S().selection[0];
  if (!id) throw new AIError('Select a frame or layer to generate code for.', 'other');
  const shot = await screenshotOf(id);
  const parts: Part[] = [];
  if (shot.image) parts.push({ type: 'image', ...shot.image });
  parts.push({ type: 'text', text: `Generate ${framework} code for this design. Layer tree:\n${JSON.stringify(nodeSummary(doc, id, 12, { n: 500 }))}` });
  const text = await complete(cfg, {
    system: `You are a senior front-end engineer converting designs to production code. Output only the code in a single fenced code block, no explanation. Match the design closely (layout from auto layout as flexbox, spacing, colors, typography, radii, shadows). Use semantic, accessible markup and sensible component/prop names.${/react/i.test(framework) ? ' Use a single React function component with Tailwind CSS classes.' : ''}`,
    parts, signal, effort: 'medium',
  });
  const m = text.match(/```[\w-]*\n([\s\S]*?)```/);
  return (m ? m[1] : text).trim();
}

/* ---------------------------------------------------------------- make (prompt → app) */

export async function aiMakeApp(prompt: string, previousHtml: string | null, useSelection: boolean, signal?: AbortSignal): Promise<string> {
  const cfg = cfgOrThrow();
  const parts: Part[] = [];
  if (useSelection && S().selection[0]) {
    const shot = await screenshotOf(S().selection[0]);
    if (shot.image) parts.push({ type: 'image', ...shot.image }, { type: 'text', text: 'Use this design from the canvas as the visual reference.' });
  }
  if (previousHtml) parts.push({ type: 'text', text: `Current app code:\n\`\`\`html\n${previousHtml}\n\`\`\`` });
  parts.push({ type: 'text', text: previousHtml ? `Change request: ${prompt}` : `Build this app: ${prompt}` });
  const text = await complete(cfg, {
    system: 'You build working, polished single-file web apps (like Figma Make). Output one complete HTML document in a single ```html code block: inline CSS and JavaScript only, no external network requests except fonts from Google Fonts. The app must be fully interactive with realistic sample data and state kept in memory. Make it responsive and visually refined. When given current code and a change request, return the full updated document.',
    parts, signal, effort: 'medium',
  });
  const m = text.match(/```html\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/);
  const html = (m ? m[1] : text).trim();
  if (!/<(html|body|div|main)/i.test(html)) throw new AIError('The model did not return an HTML app. Try rephrasing.', 'other');
  return html;
}

/* ---------------------------------------------------------------- illustration / icon */

export async function aiIllustration(prompt: string, kind: 'illustration' | 'icon', signal?: AbortSignal): Promise<string> {
  const cfg = cfgOrThrow();
  const text = await complete(cfg, {
    system: kind === 'icon'
      ? 'You draw crisp UI icons as SVG. Output only one <svg> element with viewBox="0 0 24 24", stroke-based (stroke="currentColor" replaced by #1E1E1E, stroke-width 2, round caps/joins, fill none), no text, no scripts.'
      : 'You are an illustrator who draws flat vector illustrations as SVG. Output only one <svg> element with a viewBox (around 800×600), using shapes and gradients, a cohesive limited palette, no text, no external references, no scripts.',
    parts: [{ type: 'text', text: prompt }],
    signal, effort: 'medium',
  });
  const m = text.match(/<svg[\s\S]*<\/svg>/i);
  if (!m) throw new AIError('The model did not return an SVG. Try again.', 'other');
  const svg = m[0].replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '');
  const vb = svg.match(/viewBox="[\d.\s-]+\s([\d.]+)\s([\d.]+)"/);
  let w = vb ? +vb[1] : 400, h = vb ? +vb[2] : 300;
  const k = kind === 'icon' ? 48 / Math.max(w, h) : Math.min(1, 480 / Math.max(w, h));
  w = Math.round(w * k); h = Math.round(h * k);
  const s = S();
  const c = screenToWorld(s.viewport.width / 2, s.viewport.height / 2);
  const parent = s.selection.length === 1 && ['FRAME', 'COMPONENT'].includes(currentDoc().nodes[s.selection[0]]?.type) ? s.selection[0] : null;
  const node = createNode('RECTANGLE', { name: `${kind === 'icon' ? 'Icon' : 'Illustration'} / ${prompt.slice(0, 30)}`, width: w, height: h, fills: [imagePaint(svgDataUrl(svg))] });
  s.update((d) => {
    if (parent) {
      const pr = absRect(d, parent);
      node.x = Math.round((pr.width - w) / 2); node.y = Math.round((pr.height - h) / 2); node.parentId = parent;
      d.nodes[parent].children.push(node.id);
    } else {
      node.x = Math.round(c.x - w / 2); node.y = Math.round(c.y - h / 2);
      d.pages.find((p) => p.id === s.pageId)!.children.push(node.id);
    }
    d.nodes[node.id] = node;
  });
  s.select([node.id]);
  setTimeout(zoomToSelection, 0);
  return `Added an ${kind} to the canvas.`;
}

export { canvasContext, descendants };
