import type { DocumentData, SceneNode } from '../model/types';
import { createDocument, createNode, solid, effect, reaction, uid } from '../model/defaults';

function add(doc: DocumentData, n: SceneNode, parent: SceneNode | null) {
  doc.nodes[n.id] = n;
  n.parentId = parent?.id ?? null;
  if (parent) parent.children.push(n.id);
  else doc.pages[0].children.push(n.id);
  return n;
}

function text(chars: string, size = 16, weight = 400, color = '#1E1E1E', extra: Partial<SceneNode> = {}) {
  const t = createNode('TEXT', { name: chars.slice(0, 30), fills: [solid(color)], ...extra });
  t.text!.characters = chars;
  t.text!.fontSize = size;
  t.text!.fontWeight = weight;
  return t;
}

function autoFrame(name: string, mode: 'VERTICAL' | 'HORIZONTAL', props: Partial<SceneNode> = {}, gap = 12, pad = 16) {
  const f = createNode('FRAME', { name, fills: [], sizingH: 'HUG', sizingV: 'HUG', ...props });
  f.layout = { ...f.layout, mode, gap, paddingTop: pad, paddingBottom: pad, paddingLeft: pad, paddingRight: pad };
  return f;
}

export function mobileAppTemplate(): DocumentData {
  const doc = createDocument('tmp', 'Mobile app');
  doc.pages[0].name = 'Screens';
  // button component with variants
  const set = createNode('COMPONENT_SET', { name: 'Button', x: 0, y: -260, width: 360, height: 140, fills: [] });
  add(doc, set, null);
  const mk = (variant: string, color: string, y: number) => {
    const c = createNode('COMPONENT', { name: `State=${variant}`, x: 20, y, sizingH: 'HUG', sizingV: 'HUG', cornerRadius: 10, fills: [solid(color)] });
    c.layout = { ...c.layout, mode: 'HORIZONTAL', gap: 8, paddingTop: 12, paddingBottom: 12, paddingLeft: 24, paddingRight: 24, alignMain: 'CENTER', alignCross: 'CENTER' };
    add(doc, c, set);
    add(doc, text('Get started', 16, 600, '#FFFFFF', { name: 'Label' }), c);
    return c;
  };
  const def = mk('Default', '#0D99FF', 20);
  const hover = mk('Hover', '#007BE5', 80);
  def.reactions = [{ ...reaction(hover.id), trigger: 'ON_HOVER', action: 'CHANGE_TO', animation: 'SMART_ANIMATE', duration: 200 }];

  const home = createNode('FRAME', { name: 'Home', x: 0, y: 0, width: 393, height: 852, fills: [solid('#FFFFFF')] });
  add(doc, home, null);
  const header = autoFrame('Header', 'VERTICAL', { x: 24, y: 80, sizingH: 'FIXED', width: 345 }, 8, 0);
  add(doc, header, home);
  add(doc, text('Good morning', 14, 500, '#6B6B6B'), header);
  add(doc, text('Discover your flow', 32, 700), header);
  const card = createNode('RECTANGLE', { name: 'Hero card', x: 24, y: 200, width: 345, height: 200, cornerRadius: 20, fills: [{ ...solid('#000'), type: 'GRADIENT_LINEAR', angle: 135, stops: [{ offset: 0, color: '#A259FF' }, { offset: 1, color: '#1ABCFE' }] }], effects: [effect('DROP_SHADOW')] });
  add(doc, card, home);
  const btnInst = createNode('INSTANCE', { name: 'Button', mainComponentId: def.id, x: 24, y: 760 });
  add(doc, btnInst, home);
  const details = createNode('FRAME', { name: 'Details', x: 473, y: 0, width: 393, height: 852, fills: [solid('#F5F5F5')] });
  add(doc, details, null);
  add(doc, text('Details', 32, 700, '#1E1E1E', { x: 24, y: 80 }), details);
  const back = text('← Back', 16, 500, '#0D99FF', { x: 24, y: 40, name: 'Back' });
  add(doc, back, details);
  back.reactions = [{ ...reaction(null), action: 'BACK', animation: 'SLIDE_OUT', direction: 'RIGHT' }];
  const card2 = createNode('RECTANGLE', { name: 'Hero card', x: 0, y: 140, width: 393, height: 320, cornerRadius: 0, fills: card.fills.map((f) => ({ ...f, id: uid('p') })) });
  add(doc, card2, details);
  btnInst.reactions = [{ ...reaction(details.id), animation: 'SMART_ANIMATE', duration: 400, easing: 'EASE_IN_OUT' }];
  card.reactions = [{ ...reaction(details.id), animation: 'SMART_ANIMATE', duration: 400, easing: 'EASE_IN_OUT' }];
  doc.pages[0].flowStarts.push({ id: uid('fl'), nodeId: home.id, name: 'Onboarding' });
  return doc;
}

export function landingTemplate(): DocumentData {
  const doc = createDocument('tmp', 'Landing page');
  const page = createNode('FRAME', { name: 'Desktop', x: 0, y: 0, width: 1440, height: 1024, fills: [solid('#FFFFFF')] });
  page.layoutGrids = [{ id: uid('g'), pattern: 'COLUMNS', visible: true, size: 10, count: 12, gutter: 24, margin: 80, color: '#FF0000', opacity: 0.06 }];
  add(doc, page, null);
  const nav = autoFrame('Nav', 'HORIZONTAL', { x: 80, y: 32, sizingH: 'FIXED', width: 1280, fills: [] }, 32, 0);
  nav.layout.alignMain = 'SPACE_BETWEEN';
  nav.layout.alignCross = 'CENTER';
  add(doc, nav, page);
  add(doc, text('My Flow', 22, 800), nav);
  const links = autoFrame('Links', 'HORIZONTAL', {}, 32, 0);
  add(doc, links, nav);
  for (const l of ['Product', 'Pricing', 'Docs', 'Blog']) add(doc, text(l, 16, 500, '#444444'), links);
  const hero = autoFrame('Hero', 'VERTICAL', { x: 80, y: 220, sizingH: 'FIXED', width: 760 }, 24, 0);
  add(doc, hero, page);
  add(doc, text('Design, prototype and ship — together.', 64, 800, '#1E1E1E', { name: 'Headline' }), hero);
  const sub = text('My Flow is a collaborative canvas for product teams. No sign-up needed.', 20, 400, '#6B6B6B', { name: 'Subhead' });
  add(doc, sub, hero);
  const cta = autoFrame('CTA', 'HORIZONTAL', { fills: [solid('#1E1E1E')], cornerRadius: 12 }, 8, 18);
  cta.layout.paddingLeft = cta.layout.paddingRight = 28;
  add(doc, cta, hero);
  add(doc, text('Start designing', 18, 600, '#FFFFFF'), cta);
  const shape = createNode('ELLIPSE', { name: 'Blob', x: 960, y: 220, width: 400, height: 400, fills: [{ ...solid('#000'), type: 'GRADIENT_RADIAL', stops: [{ offset: 0, color: '#FF7262' }, { offset: 1, color: '#A259FF' }] }] });
  add(doc, shape, page);
  return doc;
}

export function designSystemTemplate(): DocumentData {
  const doc = createDocument('tmp', 'Design system');
  const col = { id: uid('vc'), name: 'Theme', modes: [{ id: uid('m'), name: 'Light' }, { id: uid('m'), name: 'Dark' }] };
  doc.collections.push(col);
  const bg = { id: uid('v'), collectionId: col.id, name: 'color/background', type: 'COLOR' as const, values: { [col.modes[0].id]: '#FFFFFF', [col.modes[1].id]: '#1E1E1E' } };
  const fg = { id: uid('v'), collectionId: col.id, name: 'color/text', type: 'COLOR' as const, values: { [col.modes[0].id]: '#1E1E1E', [col.modes[1].id]: '#FFFFFF' } };
  const accent = { id: uid('v'), collectionId: col.id, name: 'color/accent', type: 'COLOR' as const, values: { [col.modes[0].id]: '#0D99FF', [col.modes[1].id]: '#7CC4FA' } };
  const radius = { id: uid('v'), collectionId: col.id, name: 'radius/md', type: 'NUMBER' as const, values: { [col.modes[0].id]: 12, [col.modes[1].id]: 12 } };
  doc.variables.push(bg, fg, accent, radius);
  doc.styles.push(
    { id: uid('s'), type: 'FILL', name: 'Brand/Primary', fills: [solid('#0D99FF')] },
    { id: uid('s'), type: 'FILL', name: 'Brand/Secondary', fills: [solid('#9747FF')] },
    { id: uid('s'), type: 'TEXT', name: 'Heading/H1', text: { fontFamily: 'Inter', fontSize: 40, fontWeight: 700 } },
    { id: uid('s'), type: 'TEXT', name: 'Body/Regular', text: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400 } },
    { id: uid('s'), type: 'EFFECT', name: 'Shadow/Card', effects: [effect('DROP_SHADOW')] },
  );
  for (const mode of col.modes) {
    const f = createNode('FRAME', { name: `Card – ${mode.name}`, x: mode.name === 'Light' ? 0 : 420, y: 0, width: 360, height: 220, variableModes: { [col.id]: mode.id }, fills: [{ ...solid('#FFFFFF'), variableId: bg.id }], boundVars: { cornerRadius: radius.id } });
    f.layout = { ...f.layout, mode: 'VERTICAL', gap: 12, paddingTop: 24, paddingBottom: 24, paddingLeft: 24, paddingRight: 24 };
    add(doc, f, null);
    add(doc, text('Variables & modes', 24, 700, '#1E1E1E', { fills: [{ ...solid('#1E1E1E'), variableId: fg.id }] }), f);
    add(doc, text('This card switches theme with a mode.', 14, 400, '#1E1E1E', { fills: [{ ...solid('#1E1E1E'), variableId: fg.id }] }), f);
    const pill = createNode('RECTANGLE', { name: 'Accent', width: 120, height: 8, cornerRadius: 4, fills: [{ ...solid('#0D99FF'), variableId: accent.id }] });
    add(doc, pill, f);
  }
  return doc;
}

export const TEMPLATES = [
  { id: 'mobile', name: 'Mobile app', description: 'Screens, interactive button, prototype flow', make: mobileAppTemplate, color: '#A259FF' },
  { id: 'landing', name: 'Landing page', description: 'Auto layout + 12-column grid', make: landingTemplate, color: '#FF7262' },
  { id: 'ds', name: 'Design system', description: 'Variables, modes and styles', make: designSystemTemplate, color: '#0ACF83' },
];
