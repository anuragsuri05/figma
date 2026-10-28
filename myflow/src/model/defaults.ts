import type {
  AutoLayout, DocumentData, Effect, EffectType, ExportSetting, LayoutGrid, NodeType, Page, Paint, Reaction, SceneNode, TextProps,
} from './types';

let counter = 0;
export function uid(prefix = ''): string {
  counter = (counter + 1) % 1e6;
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + counter.toString(36);
}

export function solid(color: string, opacity = 1): Paint {
  return { id: uid('p'), type: 'SOLID', visible: true, opacity, color };
}

export function gradient(type: Paint['type'] = 'GRADIENT_LINEAR'): Paint {
  return {
    id: uid('p'), type, visible: true, opacity: 1, color: '#000000', angle: 90,
    stops: [{ offset: 0, color: '#FFFFFF' }, { offset: 1, color: '#000000' }],
  };
}

export function imagePaint(src: string): Paint {
  return { id: uid('p'), type: 'IMAGE', visible: true, opacity: 1, color: '#000000', imageSrc: src, scaleMode: 'FILL' };
}

export function effect(type: EffectType): Effect {
  const blurOnly = type === 'LAYER_BLUR' || type === 'BACKGROUND_BLUR';
  return {
    id: uid('e'), type, visible: true, color: '#000000', opacity: 0.25,
    x: blurOnly ? 0 : type === 'INNER_SHADOW' ? 0 : 0,
    y: blurOnly ? 0 : 4,
    blur: 4, spread: 0,
  };
}

export function layoutGrid(pattern: LayoutGrid['pattern'] = 'GRID'): LayoutGrid {
  return {
    id: uid('g'), pattern, visible: true,
    size: 10, count: pattern === 'GRID' ? 0 : 5, gutter: 20, margin: 0,
    color: pattern === 'GRID' ? '#FF0000' : pattern === 'COLUMNS' ? '#FF0000' : '#0D99FF',
    opacity: pattern === 'GRID' ? 0.1 : 0.1,
  };
}

export function exportSetting(): ExportSetting {
  return { id: uid('x'), scale: 1, suffix: '', format: 'PNG' };
}

export function reaction(destinationId: string | null = null): Reaction {
  return {
    id: uid('r'), trigger: 'ON_CLICK', action: 'NAVIGATE', destinationId,
    animation: 'INSTANT', duration: 300, easing: 'EASE_OUT', direction: 'LEFT',
    overlayPosition: 'CENTER', closeOnOutside: true, overlayBackground: false,
  };
}

export const defaultLayout = (): AutoLayout => ({
  mode: 'NONE', gap: 10, counterGap: 10,
  paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
  alignMain: 'MIN', alignCross: 'MIN',
});

export const defaultText = (): TextProps => ({
  characters: '',
  fontFamily: 'Inter',
  fontWeight: 400,
  italic: false,
  fontSize: 16,
  lineHeight: 'AUTO',
  letterSpacing: 0,
  paragraphSpacing: 0,
  textAlign: 'LEFT',
  verticalAlign: 'TOP',
  autoResize: 'WIDTH_AND_HEIGHT',
  decoration: 'NONE',
  textCase: 'ORIGINAL',
  listType: 'NONE',
});

const TYPE_NAMES: Record<NodeType, string> = {
  FRAME: 'Frame', GROUP: 'Group', SECTION: 'Section', RECTANGLE: 'Rectangle', ELLIPSE: 'Ellipse',
  POLYGON: 'Polygon', STAR: 'Star', LINE: 'Line', VECTOR: 'Vector', TEXT: 'Text', COMPONENT: 'Component',
  COMPONENT_SET: 'Component set', INSTANCE: 'Instance', BOOLEAN_OPERATION: 'Union', SLICE: 'Slice',
};

export function typeLabel(t: NodeType) { return TYPE_NAMES[t]; }

export function createNode(type: NodeType, props: Partial<SceneNode> = {}): SceneNode {
  const isContainer = type === 'FRAME' || type === 'COMPONENT' || type === 'COMPONENT_SET' || type === 'INSTANCE';
  const fills: Paint[] =
    type === 'FRAME' || type === 'COMPONENT' || type === 'INSTANCE' ? [solid('#FFFFFF')]
      : type === 'SECTION' ? [solid('#FFFFFF')]
        : type === 'TEXT' ? [solid('#000000')]
          : type === 'GROUP' || type === 'LINE' || type === 'SLICE' || type === 'COMPONENT_SET' || type === 'BOOLEAN_OPERATION' ? []
            : type === 'VECTOR' ? []
              : [solid('#D9D9D9')];
  const strokes: Paint[] =
    type === 'LINE' || type === 'VECTOR' ? [solid('#000000')]
      : type === 'COMPONENT_SET' ? [solid('#9747FF')]
        : [];
  const node: SceneNode = {
    id: uid('n'),
    type,
    name: TYPE_NAMES[type],
    parentId: null,
    children: [],
    x: 0, y: 0, width: 100, height: 100,
    rotation: 0,
    opacity: 1,
    blendMode: 'PASS_THROUGH',
    visible: true,
    locked: false,
    fills,
    strokes,
    strokeWeight: 1,
    strokeAlign: type === 'LINE' || type === 'VECTOR' ? 'CENTER' : 'INSIDE',
    strokeDash: type === 'COMPONENT_SET' ? [4, 4] : [],
    strokeCap: 'NONE',
    startCap: 'NONE',
    endCap: 'NONE',
    cornerRadius: type === 'SECTION' ? 2 : type === 'COMPONENT_SET' ? 5 : 0,
    corners: null,
    cornerSmoothing: 0,
    effects: [],
    constraintH: 'LEFT',
    constraintV: 'TOP',
    clipContent: isContainer && type !== 'COMPONENT_SET',
    layout: defaultLayout(),
    sizingH: 'FIXED',
    sizingV: 'FIXED',
    layoutGrids: [],
    isMask: false,
    reactions: [],
    overflow: 'NONE',
    scrollBehavior: 'SCROLLS',
    exports: [],
    ...props,
  };
  if (type === 'POLYGON' && node.pointCount == null) node.pointCount = 3;
  if (type === 'STAR' && node.pointCount == null) { node.pointCount = 5; node.innerRadius = 0.38; }
  if (type === 'ELLIPSE') { node.arcStart ??= 0; node.arcSweep ??= 360; node.arcInner ??= 0; }
  if (type === 'TEXT' && !node.text) node.text = defaultText();
  if (type === 'BOOLEAN_OPERATION' && !node.booleanOp) node.booleanOp = 'UNION';
  return node;
}

export function createPage(name = 'Page 1'): Page {
  return {
    id: uid('pg'), name, children: [], background: '#F5F5F5', flowStarts: [], guides: [],
    prototypeDevice: 'NONE', prototypeBackground: '#1E1E1E',
  };
}

export function createDocument(id: string, name: string): DocumentData {
  return {
    id, name,
    pages: [createPage('Page 1')],
    nodes: {},
    styles: [],
    collections: [],
    variables: [],
    comments: [],
  };
}

export const FRAME_PRESETS: { group: string; items: { name: string; w: number; h: number }[] }[] = [
  {
    group: 'Phone', items: [
      { name: 'iPhone 16 Pro', w: 402, h: 874 }, { name: 'iPhone 16', w: 393, h: 852 },
      { name: 'iPhone 16 Pro Max', w: 440, h: 956 }, { name: 'iPhone SE', w: 320, h: 568 },
      { name: 'Android Compact', w: 412, h: 917 }, { name: 'Android Medium', w: 700, h: 840 },
    ],
  },
  {
    group: 'Tablet', items: [
      { name: 'iPad mini 8.3', w: 744, h: 1133 }, { name: 'iPad Pro 11"', w: 834, h: 1194 },
      { name: 'iPad Pro 12.9"', w: 1024, h: 1366 }, { name: 'Surface Pro 8', w: 1440, h: 960 },
    ],
  },
  {
    group: 'Desktop', items: [
      { name: 'MacBook Air', w: 1280, h: 832 }, { name: 'MacBook Pro 14"', w: 1512, h: 982 },
      { name: 'Desktop', w: 1440, h: 1024 }, { name: 'Wireframe', w: 1440, h: 1024 }, { name: 'TV', w: 1280, h: 720 },
    ],
  },
  {
    group: 'Presentation', items: [
      { name: 'Slide 16:9', w: 1920, h: 1080 }, { name: 'Slide 4:3', w: 1024, h: 768 },
    ],
  },
  {
    group: 'Watch', items: [
      { name: 'Apple Watch 45mm', w: 198, h: 242 }, { name: 'Apple Watch 41mm', w: 176, h: 215 },
    ],
  },
  {
    group: 'Paper', items: [
      { name: 'A4', w: 595, h: 842 }, { name: 'A5', w: 420, h: 595 }, { name: 'Letter', w: 612, h: 792 }, { name: 'Tabloid', w: 792, h: 1224 },
    ],
  },
  {
    group: 'Social media', items: [
      { name: 'Instagram post', w: 1080, h: 1350 }, { name: 'Instagram story', w: 1080, h: 1920 },
      { name: 'Twitter post', w: 1200, h: 675 }, { name: 'Facebook post', w: 1200, h: 630 }, { name: 'LinkedIn post', w: 1200, h: 627 },
    ],
  },
];

export const FONT_FAMILIES = [
  'Inter', 'Roboto', 'Poppins', 'Montserrat', 'Lato', 'Playfair Display', 'Source Code Pro',
  'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana',
];

export const FONT_WEIGHTS: { value: number; label: string }[] = [
  { value: 100, label: 'Thin' }, { value: 200, label: 'Extra Light' }, { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' }, { value: 500, label: 'Medium' }, { value: 600, label: 'Semi Bold' },
  { value: 700, label: 'Bold' }, { value: 800, label: 'Extra Bold' }, { value: 900, label: 'Black' },
];
