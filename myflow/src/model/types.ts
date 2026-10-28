export type NodeType =
  | 'FRAME'
  | 'GROUP'
  | 'SECTION'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'POLYGON'
  | 'STAR'
  | 'LINE'
  | 'VECTOR'
  | 'TEXT'
  | 'COMPONENT'
  | 'COMPONENT_SET'
  | 'INSTANCE'
  | 'BOOLEAN_OPERATION'
  | 'SLICE';

export type BlendMode =
  | 'PASS_THROUGH' | 'NORMAL' | 'DARKEN' | 'MULTIPLY' | 'COLOR_BURN' | 'LIGHTEN' | 'SCREEN'
  | 'COLOR_DODGE' | 'OVERLAY' | 'SOFT_LIGHT' | 'HARD_LIGHT' | 'DIFFERENCE' | 'EXCLUSION'
  | 'HUE' | 'SATURATION' | 'COLOR' | 'LUMINOSITY';

export interface GradientStop { offset: number; color: string; }

export type PaintType = 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE';

export interface Paint {
  id: string;
  type: PaintType;
  visible: boolean;
  opacity: number; // 0..1
  color: string; // hex for SOLID
  blendMode?: BlendMode;
  stops?: GradientStop[];
  angle?: number; // gradient angle in degrees
  imageSrc?: string;
  scaleMode?: 'FILL' | 'FIT' | 'TILE' | 'CROP';
  variableId?: string; // bound color variable
  styleId?: string;
}

export type EffectType = 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';

export interface Effect {
  id: string;
  type: EffectType;
  visible: boolean;
  color: string;
  opacity: number;
  x: number;
  y: number;
  blur: number;
  spread: number;
}

export type ConstraintH = 'LEFT' | 'RIGHT' | 'LEFT_RIGHT' | 'CENTER' | 'SCALE';
export type ConstraintV = 'TOP' | 'BOTTOM' | 'TOP_BOTTOM' | 'CENTER' | 'SCALE';
export type Sizing = 'FIXED' | 'HUG' | 'FILL';
export type LayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'WRAP';
export type AlignMain = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
export type AlignCross = 'MIN' | 'CENTER' | 'MAX';

export interface AutoLayout {
  mode: LayoutMode;
  gap: number;
  counterGap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  alignMain: AlignMain;
  alignCross: AlignCross;
  reverseZ?: boolean;
}

export interface LayoutGrid {
  id: string;
  pattern: 'GRID' | 'COLUMNS' | 'ROWS';
  visible: boolean;
  size: number; // grid size
  count: number;
  gutter: number;
  margin: number;
  color: string;
  opacity: number;
}

export interface VectorPoint {
  x: number;
  y: number;
  // handles relative to point
  inX?: number; inY?: number; outX?: number; outY?: number;
}

export interface TextProps {
  characters: string;
  fontFamily: string;
  fontWeight: number;
  italic: boolean;
  fontSize: number;
  lineHeight: number | 'AUTO'; // px
  letterSpacing: number; // percent
  paragraphSpacing: number;
  textAlign: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  verticalAlign: 'TOP' | 'CENTER' | 'BOTTOM';
  autoResize: 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'NONE' | 'TRUNCATE';
  decoration: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
  textCase: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
  listType: 'NONE' | 'BULLET' | 'NUMBER';
  link?: string;
}

export type Trigger = 'ON_CLICK' | 'ON_HOVER' | 'ON_PRESS' | 'ON_DRAG' | 'MOUSE_ENTER' | 'MOUSE_LEAVE' | 'AFTER_DELAY' | 'KEY';
export type ActionType = 'NAVIGATE' | 'CHANGE_TO' | 'BACK' | 'SCROLL_TO' | 'OPEN_OVERLAY' | 'SWAP_OVERLAY' | 'CLOSE_OVERLAY' | 'OPEN_URL' | 'SET_VARIABLE';
export type AnimationType = 'INSTANT' | 'DISSOLVE' | 'SMART_ANIMATE' | 'MOVE_IN' | 'MOVE_OUT' | 'PUSH' | 'SLIDE_IN' | 'SLIDE_OUT';
export type Easing = 'LINEAR' | 'EASE_IN' | 'EASE_OUT' | 'EASE_IN_OUT' | 'EASE_IN_BACK' | 'EASE_OUT_BACK' | 'GENTLE' | 'QUICK' | 'BOUNCY' | 'SLOW';

export interface Reaction {
  id: string;
  trigger: Trigger;
  delay?: number;
  key?: string;
  action: ActionType;
  destinationId?: string | null;
  url?: string;
  variableId?: string;
  variableValue?: string;
  animation: AnimationType;
  direction?: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';
  duration: number;
  easing: Easing;
  overlayPosition?: 'CENTER' | 'TOP_LEFT' | 'TOP_CENTER' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_CENTER' | 'BOTTOM_RIGHT';
  closeOnOutside?: boolean;
  overlayBackground?: boolean;
}

export interface ExportSetting {
  id: string;
  scale: number;
  suffix: string;
  format: 'PNG' | 'JPG' | 'SVG' | 'PDF';
}

export interface Annotation { id: string; text: string; }

export interface SceneNode {
  id: string;
  type: NodeType;
  name: string;
  parentId: string | null; // null => page root (page stores order)
  children: string[];
  x: number; // relative to parent
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipX?: boolean;
  flipY?: boolean;
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
  locked: boolean;
  fills: Paint[];
  strokes: Paint[];
  strokeWeight: number;
  strokeAlign: 'INSIDE' | 'CENTER' | 'OUTSIDE';
  strokeDash: number[];
  strokeCap: 'NONE' | 'ROUND' | 'SQUARE';
  startCap?: 'NONE' | 'ARROW' | 'CIRCLE' | 'TRIANGLE';
  endCap?: 'NONE' | 'ARROW' | 'CIRCLE' | 'TRIANGLE';
  cornerRadius: number;
  corners?: [number, number, number, number] | null; // tl tr br bl
  cornerSmoothing: number;
  effects: Effect[];
  constraintH: ConstraintH;
  constraintV: ConstraintV;
  clipContent: boolean;
  layout: AutoLayout;
  sizingH: Sizing;
  sizingV: Sizing;
  minW?: number; maxW?: number; minH?: number; maxH?: number;
  absolutePosition?: boolean; // ignore auto layout
  layoutGrids: LayoutGrid[];
  isMask: boolean;
  // shapes
  pointCount?: number; // polygon/star
  innerRadius?: number; // star ratio 0..1
  arcStart?: number; arcSweep?: number; arcInner?: number; // ellipse arc (deg, deg, 0..1)
  points?: VectorPoint[];
  closed?: boolean;
  booleanOp?: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE';
  text?: TextProps;
  // components
  componentDescription?: string;
  mainComponentId?: string; // for instances
  sourceId?: string; // for nodes inside instances: id of matching node in main
  overrides?: string[]; // overridden keys within instance
  variantProps?: Record<string, string>; // derived from name in component sets
  // prototype
  reactions: Reaction[];
  overflow: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'BOTH';
  scrollBehavior: 'SCROLLS' | 'FIXED' | 'STICKY';
  exports: ExportSetting[];
  devStatus?: 'READY' | 'COMPLETED' | null;
  annotations?: Annotation[];
  variableModes?: Record<string, string>; // collectionId -> modeId
  boundVars?: Partial<Record<'cornerRadius' | 'gap' | 'padding' | 'width' | 'height' | 'opacity' | 'characters' | 'visible', string>>;
  textStyleId?: string;
  effectStyleId?: string;
  fillStyleId?: string;
  strokeStyleId?: string;
  gridStyleId?: string;
}

export interface Guide { id: string; axis: 'X' | 'Y'; offset: number; }

export interface FlowStart { id: string; nodeId: string; name: string; description?: string; }

export interface Page {
  id: string;
  name: string;
  children: string[];
  background: string;
  flowStarts: FlowStart[];
  guides: Guide[];
  prototypeDevice: string;
  prototypeBackground: string;
}

export interface StyleDef {
  id: string;
  type: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
  name: string;
  description?: string;
  fills?: Paint[];
  text?: Partial<TextProps>;
  effects?: Effect[];
  grids?: LayoutGrid[];
}

export type VariableType = 'COLOR' | 'NUMBER' | 'STRING' | 'BOOLEAN';

export interface VariableCollection { id: string; name: string; modes: { id: string; name: string }[]; }

export interface Variable {
  id: string;
  collectionId: string;
  name: string;
  type: VariableType;
  values: Record<string, string | number | boolean | { alias: string }>; // modeId -> value
  description?: string;
}

export interface CommentReply { id: string; author: string; text: string; createdAt: number; }

export interface CommentThread {
  id: string;
  pageId: string;
  x: number; // absolute canvas coords
  y: number;
  nodeId?: string;
  resolved: boolean;
  replies: CommentReply[];
  createdAt: number;
}

export interface DocumentData {
  id: string;
  name: string;
  pages: Page[];
  nodes: Record<string, SceneNode>;
  styles: StyleDef[];
  collections: VariableCollection[];
  variables: Variable[];
  comments: CommentThread[];
}

export interface FileMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  starred: boolean;
  trashed: boolean;
  thumbnail?: string;
  project: string; // 'Drafts' or project name
}

export interface VersionEntry {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  auto: boolean;
  doc: DocumentData;
}

export type ToolId =
  | 'MOVE' | 'HAND' | 'SCALE'
  | 'FRAME' | 'SECTION' | 'SLICE'
  | 'RECTANGLE' | 'LINE' | 'ARROW' | 'ELLIPSE' | 'POLYGON' | 'STAR' | 'IMAGE'
  | 'PEN' | 'PENCIL'
  | 'TEXT' | 'COMMENT';
