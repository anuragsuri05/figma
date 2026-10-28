import type { DocumentData, SceneNode, Reaction } from '../model/types';
import {
  S, currentDoc, currentPage, setProps, groupSelection, ungroupSelection, frameSelection, addAutoLayout, removeAutoLayout,
  createComponent, combineAsVariants, duplicateSelection, useAsMask, flattenSelection, reorder, createInstance, addComment,
  addPage, goToPage, zoomToSelection, addCollection, addVariable, setVariableValue, createStyle, screenToWorld,
} from '../store/editor';
import { absPos, absRect, descendants, getPageOf, removeNode, reparent, visualAbsRect, unionRects } from '../model/tree';
import { reaction as newReaction, uid } from '../model/defaults';
import { rasterize } from '../render/export';
import { buildSpec, applyProps, resolveImage, type Spec } from './spec';
import type { ToolOutput, ToolSpec } from './providers';
import type { Skill } from './config';

/* -------------------------------------------------------------- context */

function hexOf(n: SceneNode) {
  const f = n.fills.find((p) => p.visible);
  if (!f) return undefined;
  if (f.type === 'SOLID') return f.opacity < 1 ? `${f.color}/${Math.round(f.opacity * 100)}%` : f.color;
  if (f.type === 'IMAGE') return 'image';
  return f.type.toLowerCase().replace('gradient_', '') + '-gradient';
}

export function nodeSummary(doc: DocumentData, id: string, depth: number, budget: { n: number }): Record<string, unknown> | null {
  const n = doc.nodes[id];
  if (!n || budget.n <= 0) return null;
  budget.n--;
  const o: Record<string, unknown> = { id: n.id, type: n.type.toLowerCase(), name: n.name, x: Math.round(n.x), y: Math.round(n.y), w: Math.round(n.width), h: Math.round(n.height) };
  const fill = hexOf(n); if (fill) o.fill = fill;
  if (n.strokes.some((s) => s.visible)) o.stroke = `${n.strokeWeight}px ${n.strokes[0].color}`;
  if (n.cornerRadius) o.radius = n.cornerRadius;
  if (!n.visible) o.hidden = true;
  if (n.opacity < 1) o.opacity = n.opacity;
  if (n.effects.length) o.effects = n.effects.map((e) => e.type.toLowerCase());
  if (n.text) { o.text = n.text.characters.slice(0, 200); o.font = `${n.text.fontFamily} ${n.text.fontWeight} ${n.text.fontSize}`; }
  if (n.layout.mode !== 'NONE' && (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE')) {
    o.layout = { mode: n.layout.mode.toLowerCase(), gap: n.layout.gap, padding: [n.layout.paddingTop, n.layout.paddingRight, n.layout.paddingBottom, n.layout.paddingLeft], align: n.layout.alignMain.toLowerCase(), crossAlign: n.layout.alignCross.toLowerCase() };
    o.sizing = { h: n.sizingH.toLowerCase(), v: n.sizingV.toLowerCase() };
  }
  if (n.mainComponentId) o.componentId = n.mainComponentId;
  if (n.reactions.length) o.links = n.reactions.map((r) => ({ to: r.destinationId, action: r.action.toLowerCase(), trigger: r.trigger.toLowerCase() }));
  if (n.children.length) {
    if (depth <= 0) o.childCount = n.children.length;
    else o.children = n.children.map((c) => nodeSummary(doc, c, depth - 1, budget)).filter(Boolean);
  }
  return o;
}

export function canvasContext(opts: { nodeId?: string; depth?: number } = {}) {
  const s = S();
  const doc = currentDoc();
  const page = currentPage();
  const budget = { n: 400 };
  const tl = screenToWorld(0, 0), br = screenToWorld(s.viewport.width, s.viewport.height);
  if (opts.nodeId) {
    if (!doc.nodes[opts.nodeId]) return { error: `node ${opts.nodeId} not found` };
    const ap = absPos(doc, opts.nodeId);
    return { absolute: { x: Math.round(ap.x), y: Math.round(ap.y) }, node: nodeSummary(doc, opts.nodeId, opts.depth ?? 8, budget) };
  }
  return {
    file: doc.name,
    page: page.name,
    pages: doc.pages.map((p) => p.name),
    viewport: { x: Math.round(tl.x), y: Math.round(tl.y), width: Math.round(br.x - tl.x), height: Math.round(br.y - tl.y) },
    selection: s.selection,
    components: Object.values(doc.nodes).filter((n) => n.type === 'COMPONENT').slice(0, 50).map((n) => ({ id: n.id, name: n.name })),
    variables: doc.variables.slice(0, 50).map((v) => ({ name: v.name, type: v.type.toLowerCase() })),
    styles: doc.styles.slice(0, 50).map((st) => ({ name: st.name, type: st.type.toLowerCase() })),
    layers: page.children.map((c) => nodeSummary(doc, c, opts.depth ?? 3, budget)).filter(Boolean),
    truncated: budget.n <= 0 || undefined,
  };
}

export async function screenshotOf(nodeId?: string): Promise<ToolOutput> {
  const doc = currentDoc();
  let id = nodeId;
  if (!id) id = S().selection[0];
  if (!id) id = currentPage().children.find((c) => doc.nodes[c]?.visible);
  if (!id || !doc.nodes[id]) return { text: 'Nothing to screenshot — the page is empty.' };
  const n = doc.nodes[id];
  const scale = Math.min(2, 1024 / Math.max(1, n.width, n.height));
  const { blob } = await rasterize(doc, id, scale, 'image/png', '#FFFFFF');
  const data = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r((fr.result as string).split(',')[1]); fr.readAsDataURL(blob); });
  return { text: `Screenshot of "${n.name}" (${Math.round(n.width)}×${Math.round(n.height)}, shown at ${Math.round(scale * 100)}%).`, image: { mediaType: 'image/png', data } };
}

/* -------------------------------------------------------------- tool specs */

const SPEC_DOC = `A design spec is a JSON tree. Each node: {type, name, ...props, children?}.
types: frame | text | rect | ellipse | line | star | polygon | icon (with "svg") | image (photo placeholder; "image": short description) | component.
props: width, height, x, y (only when parent has no layout), fill ("#hex", "#hex/50%", "linear-gradient(135deg, #a 0%, #b 100%)" or "none"),
stroke ({color, weight, align}), radius (number or [tl,tr,br,bl]), shadow (true or {x,y,blur,spread,color,opacity}), blur, backgroundBlur, opacity, clip,
layout ({mode: vertical|horizontal|wrap|none, gap, padding: n | [v,h] | [t,r,b,l], align: start|center|end|space-between, crossAlign: start|center|end}),
sizing ({h: fixed|hug|fill, v: fixed|hug|fill}) — use fill for children that should stretch inside an auto-layout parent,
text props: text, fontSize, fontWeight (100–900), fontFamily (Inter, Roboto, Poppins, Montserrat, Lato, Playfair Display, Source Code Pro), color, textAlign, lineHeight (px or multiplier), letterSpacing (%), decoration, textCase, list (bullet|number),
svg: inline <svg> markup for icons (24×24 viewBox, stroke icons preferred).`;

export const AGENT_TOOLS: ToolSpec[] = [
  { name: 'get_canvas', description: 'Read the current page: layers tree (ids, types, names, positions, sizes, fills, text, auto layout), selection, viewport, components, variables and styles. Pass node_id to read one subtree in depth.', parameters: { type: 'object', properties: { node_id: { type: 'string' }, depth: { type: 'integer', description: 'tree depth (default 3 for page, 8 for node)' } } } },
  { name: 'get_screenshot', description: 'Render a node (default: the selection, else the first frame) to a PNG image so you can visually check the design.', parameters: { type: 'object', properties: { node_id: { type: 'string' } } } },
  { name: 'create_design', description: `Create a complete design (a screen, component or section) in one call from a nested spec. Returns the ids of created layers. ${SPEC_DOC}`, parameters: { type: 'object', properties: { spec: { type: 'object', description: 'root node of the design spec' }, parent_id: { type: 'string', description: 'existing frame to insert into (omit for a new top-level frame)' }, x: { type: 'number' }, y: { type: 'number' } }, required: ['spec'] } },
  { name: 'update_nodes', description: 'Change properties of existing layers. Each update has an id and props using the same vocabulary as the design spec (name, fill, stroke, radius, shadow, layout, sizing, text, fontSize, color, width, height, x, y, opacity, visible, ...).', parameters: { type: 'object', properties: { updates: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, props: { type: 'object' } }, required: ['id', 'props'] } } }, required: ['updates'] } },
  { name: 'delete_nodes', description: 'Delete layers by id.', parameters: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] } },
  { name: 'move_nodes', description: 'Reparent layers into another frame (parent_id) or to the page (parent_id omitted), optionally at a child index.', parameters: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } }, parent_id: { type: 'string' }, index: { type: 'integer' } }, required: ['ids'] } },
  { name: 'arrange', description: 'Structural operations on layers: group, ungroup, frame, auto_layout, remove_auto_layout, create_component, combine_as_variants, duplicate, union, subtract, intersect, exclude, mask, flatten, bring_to_front, send_to_back. Returns the resulting selection ids.', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['group', 'ungroup', 'frame', 'auto_layout', 'remove_auto_layout', 'create_component', 'combine_as_variants', 'duplicate', 'union', 'subtract', 'intersect', 'exclude', 'mask', 'flatten', 'bring_to_front', 'send_to_back'] }, ids: { type: 'array', items: { type: 'string' } } }, required: ['action', 'ids'] } },
  { name: 'create_instance', description: 'Place an instance of a component (component_id) into a parent frame or on the page.', parameters: { type: 'object', properties: { component_id: { type: 'string' }, parent_id: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } }, required: ['component_id'] } },
  { name: 'select_nodes', description: 'Select layers in the editor and optionally zoom to them, to show the user the result.', parameters: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } }, zoom: { type: 'boolean' } }, required: ['ids'] } },
  { name: 'add_prototype_link', description: 'Add a prototype interaction from a layer to a destination frame. animation: instant | dissolve | smart_animate | move_in | push | slide_in. action: navigate | open_overlay | back.', parameters: { type: 'object', properties: { from_id: { type: 'string' }, to_id: { type: 'string' }, action: { type: 'string' }, trigger: { type: 'string', description: 'on_click (default) | on_hover | after_delay' }, animation: { type: 'string' } }, required: ['from_id'] } },
  { name: 'create_variables', description: 'Create a variable collection with modes (e.g. Light/Dark) and variables. Values are given per mode name: colors as #hex, numbers as numbers.', parameters: { type: 'object', properties: { collection: { type: 'string' }, modes: { type: 'array', items: { type: 'string' } }, variables: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string', enum: ['color', 'number', 'string', 'boolean'] }, values: { type: 'object' } }, required: ['name', 'type', 'values'] } } }, required: ['collection', 'modes', 'variables'] } },
  { name: 'bind_variable', description: 'Bind a variable (by name) to a layer property: fill, stroke, cornerRadius, gap, padding, width, height, opacity. Optionally set a frame\'s mode for a collection with set_mode.', parameters: { type: 'object', properties: { node_id: { type: 'string' }, property: { type: 'string' }, variable: { type: 'string' }, set_mode: { type: 'object', properties: { collection: { type: 'string' }, mode: { type: 'string' } } } }, required: ['node_id'] } },
  { name: 'create_style', description: 'Create a reusable style from a layer: kind color (its fill), text (its typography) or effect (its effects).', parameters: { type: 'object', properties: { kind: { type: 'string', enum: ['color', 'text', 'effect'] }, name: { type: 'string' }, from_node_id: { type: 'string' } }, required: ['kind', 'name', 'from_node_id'] } },
  { name: 'add_comment', description: 'Pin a comment on the canvas (design review notes, questions).', parameters: { type: 'object', properties: { text: { type: 'string' }, node_id: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } }, required: ['text'] } },
  { name: 'add_page', description: 'Add a new page and switch to it.', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
];

/* -------------------------------------------------------------- executor */

const ok = (o: unknown): ToolOutput => ({ text: typeof o === 'string' ? o : JSON.stringify(o) });
const exists = (id?: string) => !!id && !!currentDoc().nodes[id];

function placeForNewRoot(w: number, h: number): { x: number; y: number } {
  const doc = currentDoc();
  const page = currentPage();
  const rects = page.children.filter((c) => doc.nodes[c]?.visible).map((c) => visualAbsRect(doc, c));
  if (!rects.length) {
    const s = S();
    const c = screenToWorld(s.viewport.width / 2, s.viewport.height / 2);
    return { x: Math.round(c.x - w / 2), y: Math.round(c.y - h / 2) };
  }
  const b = unionRects(rects)!;
  return { x: Math.round(b.x + b.width + 100), y: Math.round(b.y) };
}

export async function executeTool(name: string, input: Record<string, unknown>): Promise<ToolOutput> {
  const s = S();
  switch (name) {
    case 'get_canvas': return ok(canvasContext({ nodeId: input.node_id as string | undefined, depth: input.depth as number | undefined }));
    case 'get_screenshot': return screenshotOf(input.node_id as string | undefined);
    case 'create_design': {
      const spec = input.spec as Spec;
      if (!spec || typeof spec !== 'object') return ok('Error: spec must be an object');
      const parentId = exists(input.parent_id as string) ? (input.parent_id as string) : null;
      const created: { id: string; name: string }[] = [];
      const pending: { id: string; query: string }[] = [];
      let rootId = '';
      s.update((d) => {
        const doc = d as DocumentData;
        const parent = parentId ? doc.nodes[parentId] : null;
        rootId = buildSpec(doc, spec, parent, created, pending);
        if (!parent) d.pages.find((p) => p.id === s.pageId)!.children.push(rootId);
      });
      // position top-level roots after layout has sized them
      if (!parentId) {
        const r = S().doc!.nodes[rootId];
        const pos = typeof input.x === 'number' && typeof input.y === 'number' ? { x: input.x as number, y: input.y as number } : placeForNewRoot(r.width, r.height);
        S().update((d) => { d.nodes[rootId].x = pos.x; d.nodes[rootId].y = pos.y; });
      } else if (typeof input.x === 'number' || typeof input.y === 'number') {
        S().update((d) => { if (typeof input.x === 'number') d.nodes[rootId].x = input.x as number; if (typeof input.y === 'number') d.nodes[rootId].y = input.y as number; });
      }
      if (pending.length) {
        const urls = await Promise.all(pending.map((p) => { const n = S().doc!.nodes[p.id]; return resolveImage(p.query, n?.width ?? 400, n?.height ?? 300); }));
        S().update((d) => { pending.forEach((p, i) => { const n = d.nodes[p.id]; if (n) n.fills = [{ id: uid('p'), type: 'IMAGE', visible: true, opacity: 1, color: '#000000', imageSrc: urls[i], scaleMode: 'FILL' }]; }); });
      }
      S().select([rootId]);
      setTimeout(zoomToSelection, 0);
      const r = S().doc!.nodes[rootId];
      return ok({ root_id: rootId, size: [Math.round(r.width), Math.round(r.height)], created: created.slice(0, 150) });
    }
    case 'update_nodes': {
      const updates = (input.updates as { id: string; props: Record<string, unknown> }[]) ?? [];
      const missing = updates.filter((u) => !exists(u.id)).map((u) => u.id);
      const valid = updates.filter((u) => exists(u.id));
      for (const u of valid) setProps([u.id], (n) => { applyProps(n as SceneNode, u.props as Spec & Record<string, unknown>); });
      return ok({ updated: valid.length, missing: missing.length ? missing : undefined });
    }
    case 'delete_nodes': {
      const ids = ((input.ids as string[]) ?? []).filter(exists);
      s.update((d) => { for (const id of ids) removeNode(d as DocumentData, id); });
      return ok({ deleted: ids.length });
    }
    case 'move_nodes': {
      const ids = ((input.ids as string[]) ?? []).filter(exists);
      const parentId = exists(input.parent_id as string) ? (input.parent_id as string) : null;
      s.update((d) => {
        const pg = d.pages.find((p) => p.id === s.pageId)!;
        ids.forEach((id, i) => reparent(d as DocumentData, id, parentId, pg, typeof input.index === 'number' ? (input.index as number) + i : undefined));
      });
      return ok({ moved: ids.length });
    }
    case 'arrange': {
      const ids = ((input.ids as string[]) ?? []).filter(exists);
      if (!ids.length) return ok('Error: no valid ids');
      s.select(ids);
      const a = input.action as string;
      const map: Record<string, () => void> = {
        group: () => groupSelection(), ungroup: ungroupSelection, frame: () => frameSelection(), auto_layout: addAutoLayout, remove_auto_layout: removeAutoLayout,
        create_component: createComponent, combine_as_variants: combineAsVariants, duplicate: () => duplicateSelection(), union: () => groupSelection('BOOLEAN_OPERATION', 'UNION'),
        subtract: () => groupSelection('BOOLEAN_OPERATION', 'SUBTRACT'), intersect: () => groupSelection('BOOLEAN_OPERATION', 'INTERSECT'), exclude: () => groupSelection('BOOLEAN_OPERATION', 'EXCLUDE'),
        mask: useAsMask, flatten: flattenSelection, bring_to_front: () => reorder('front'), send_to_back: () => reorder('back'),
      };
      if (!map[a]) return ok(`Error: unknown action ${a}`);
      map[a]();
      return ok({ selection: S().selection.map((id) => ({ id, name: S().doc!.nodes[id]?.name, type: S().doc!.nodes[id]?.type.toLowerCase() })) });
    }
    case 'create_instance': {
      const cid = input.component_id as string;
      if (!exists(cid) || currentDoc().nodes[cid].type !== 'COMPONENT') return ok('Error: component_id must be a component');
      const parentId = exists(input.parent_id as string) ? (input.parent_id as string) : null;
      const main = currentDoc().nodes[cid];
      const pos = typeof input.x === 'number' ? { x: input.x as number, y: (input.y as number) ?? 0 } : parentId ? absPos(currentDoc(), parentId) : placeForNewRoot(main.width, main.height);
      const id = createInstance(cid, pos.x, pos.y, parentId);
      return ok({ instance_id: id });
    }
    case 'select_nodes': {
      const ids = ((input.ids as string[]) ?? []).filter(exists);
      const pg = ids[0] ? getPageOf(currentDoc(), ids[0]) : undefined;
      if (pg && pg.id !== s.pageId) s.setState({ pageId: pg.id });
      S().select(ids);
      if (input.zoom !== false) setTimeout(zoomToSelection, 0);
      return ok({ selected: ids.length });
    }
    case 'add_prototype_link': {
      const from = input.from_id as string;
      if (!exists(from)) return ok('Error: from_id not found');
      const action = String(input.action ?? 'navigate').toUpperCase();
      const to = input.to_id as string | undefined;
      if (action !== 'BACK' && !exists(to)) return ok('Error: to_id not found');
      const r: Reaction = { ...newReaction(to ?? null), action: (action === 'OPEN_OVERLAY' ? 'OPEN_OVERLAY' : action === 'BACK' ? 'BACK' : 'NAVIGATE') };
      const trig = String(input.trigger ?? 'on_click').toUpperCase();
      if (trig === 'ON_HOVER' || trig === 'AFTER_DELAY') r.trigger = trig;
      if (trig === 'AFTER_DELAY') r.delay = 1500;
      const anim = String(input.animation ?? 'smart_animate').toUpperCase();
      if (['INSTANT', 'DISSOLVE', 'SMART_ANIMATE', 'MOVE_IN', 'MOVE_OUT', 'PUSH', 'SLIDE_IN', 'SLIDE_OUT'].includes(anim)) r.animation = anim as Reaction['animation'];
      r.closeOnOutside = r.action === 'OPEN_OVERLAY';
      setProps([from], (n) => { n.reactions = [...n.reactions, r]; });
      // ensure a flow start
      const doc = currentDoc();
      const pg = getPageOf(doc, from);
      if (pg && !pg.flowStarts.length) {
        let top: SceneNode | undefined = doc.nodes[from];
        while (top?.parentId && doc.nodes[top.parentId].type !== 'SECTION') top = doc.nodes[top.parentId];
        if (top) S().update((d) => { d.pages.find((p) => p.id === pg.id)!.flowStarts.push({ id: uid('fl'), nodeId: top!.id, name: 'Flow 1' }); });
      }
      return ok({ linked: true });
    }
    case 'create_variables': {
      const colName = String(input.collection);
      const modes = (input.modes as string[])?.length ? (input.modes as string[]) : ['Mode 1'];
      let col = currentDoc().collections.find((c) => c.name === colName);
      const colId = col?.id ?? addCollection(colName);
      col = currentDoc().collections.find((c) => c.id === colId)!;
      // ensure modes
      S().update((d) => {
        const c = d.collections.find((x) => x.id === colId)!;
        modes.forEach((m, i) => {
          if (c.modes[i]) c.modes[i].name = m;
          else c.modes.push({ id: uid('m'), name: m });
        });
      });
      const created: string[] = [];
      for (const v of (input.variables as { name: string; type: string; values: Record<string, unknown> }[]) ?? []) {
        const type = (v.type ?? 'color').toUpperCase() as 'COLOR' | 'NUMBER' | 'STRING' | 'BOOLEAN';
        const existing = currentDoc().variables.find((x) => x.collectionId === colId && x.name === v.name);
        const vid = existing?.id ?? addVariable(colId, type, v.name);
        const c = currentDoc().collections.find((x) => x.id === colId)!;
        for (const m of c.modes) {
          const raw = v.values?.[m.name] ?? Object.values(v.values ?? {})[0];
          if (raw === undefined) continue;
          setVariableValue(vid, m.id, type === 'NUMBER' ? Number(raw) : type === 'BOOLEAN' ? Boolean(raw) : String(raw));
        }
        created.push(v.name);
      }
      return ok({ collection: colName, modes, variables: created });
    }
    case 'bind_variable': {
      const nodeId = input.node_id as string;
      if (!exists(nodeId)) return ok('Error: node not found');
      const doc = currentDoc();
      if (input.variable) {
        const v = doc.variables.find((x) => x.name === input.variable || x.id === input.variable);
        if (!v) return ok(`Error: variable ${String(input.variable)} not found`);
        const prop = String(input.property ?? 'fill');
        setProps([nodeId], (n) => {
          if (prop === 'fill' || prop === 'stroke') {
            const key = prop === 'fill' ? 'fills' : 'strokes';
            const list = n[key].length ? n[key] : [{ id: uid('p'), type: 'SOLID' as const, visible: true, opacity: 1, color: '#000000' }];
            list[list.length - 1] = { ...list[list.length - 1], type: 'SOLID', variableId: v.id };
            n[key] = list;
          } else {
            n.boundVars = { ...(n.boundVars ?? {}), [prop]: v.id };
          }
        });
      }
      const sm = input.set_mode as { collection?: string; mode?: string } | undefined;
      if (sm?.collection && sm.mode) {
        const c = doc.collections.find((x) => x.name === sm.collection);
        const m = c?.modes.find((x) => x.name === sm.mode);
        if (c && m) setProps([nodeId], (n) => { n.variableModes = { ...(n.variableModes ?? {}), [c.id]: m.id }; });
      }
      return ok({ bound: true });
    }
    case 'create_style': {
      const from = input.from_node_id as string;
      if (!exists(from)) return ok('Error: node not found');
      const kind = input.kind === 'text' ? 'TEXT' : input.kind === 'effect' ? 'EFFECT' : 'FILL';
      const id = createStyle(kind, from, String(input.name));
      return ok({ style_id: id });
    }
    case 'add_comment': {
      const doc = currentDoc();
      let x = input.x as number | undefined, y = input.y as number | undefined;
      const nid = input.node_id as string | undefined;
      if (exists(nid)) { const r = absRect(doc, nid!); x = r.x + r.width; y = r.y; }
      if (x === undefined || y === undefined) { const c = screenToWorld(s.viewport.width / 2, s.viewport.height / 2); x = c.x; y = c.y; }
      const prev = s.activeCommentId;
      addComment(x, y, `🤖 ${String(input.text)}`, exists(nid) ? nid : undefined);
      S().setState({ activeCommentId: prev });
      return ok({ commented: true });
    }
    case 'add_page': {
      const id = addPage(String(input.name));
      goToPage(id);
      return ok({ page_id: id });
    }
  }
  return ok(`Error: unknown tool ${name}`);
}

/* -------------------------------------------------------------- prompts */

export function agentSystemPrompt(guidelines: string, skills: Skill[]) {
  return `You are the design agent inside My Flow, a Figma-style design editor. You see and edit the user's canvas through tools, and you work like a senior product designer.

How the canvas works
- Units are px. A layer's x/y are relative to its parent. Top-level frames are screens; frames with auto layout arrange their children (gap, padding, alignment) and can hug or fill.
- Changes you make are live on the user's canvas and can be undone by the user in one step.

How to work
- New screens or sections: build the complete design with a single create_design call using nested auto layout, realistic copy (never lorem ipsum), an 8px spacing rhythm, a clear type scale and WCAG AA contrast. Use common device sizes (iPhone 393×852, desktop 1440×1024) unless asked otherwise. Use "icon" nodes with simple inline SVG for icons and "image" nodes for photos.
- Edits to existing work: read what is there first (get_canvas, with node_id for detail), then make targeted changes with update_nodes, keeping the user's style.
- After building or restyling something visual, call get_screenshot once to check the result and fix anything broken (overlaps, clipped text, poor contrast, misalignment).
- If the request is ambiguous, make a sensible choice and mention it rather than asking.
- End with a short plain-text summary of what you did (1–3 sentences). Don't repeat ids or JSON to the user.
${guidelines.trim() ? `\nTeam design guidelines (always follow these)\n${guidelines.trim()}\n` : ''}${skills.length ? `\nSkills — when the user's message starts with /<name>, follow that skill's instructions:\n${skills.map((k) => `- /${k.name}: ${k.description}\n  Instructions: ${k.instructions}`).join('\n')}\n` : ''}`;
}

export function selectionNote(): string {
  const s = S();
  const doc = currentDoc();
  const sel = s.selection.filter((id) => doc.nodes[id]);
  const page = currentPage();
  if (!sel.length) return `[Context: page "${page.name}", nothing selected, ${page.children.length} top-level layers.]`;
  return `[Context: page "${page.name}". Selected: ${sel.slice(0, 20).map((id) => `${doc.nodes[id].name} (${doc.nodes[id].type.toLowerCase()}, id ${id})`).join(', ')}.]`;
}

export function descendantTexts(ids: string[]) {
  const doc = currentDoc();
  const out: SceneNode[] = [];
  for (const id of ids) for (const d of [id, ...descendants(doc, id)]) if (doc.nodes[d]?.type === 'TEXT') out.push(doc.nodes[d]);
  return [...new Map(out.map((n) => [n.id, n])).values()];
}
