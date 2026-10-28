import React from 'react';

type P = { size?: number; className?: string; style?: React.CSSProperties };
const S = (d: React.ReactNode, vb = 24) => ({ size = 24, className, style }: P) => (
  <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    {d}
  </svg>
);

export const Icon = {
  move: S(<path d="M7 5l11 6.2-4.9 1.1L11 17 7 5z" fill="currentColor" stroke="none" />),
  hand: S(<path d="M9 11V6.5a1.25 1.25 0 012.5 0V11m0-5.5V5a1.25 1.25 0 012.5 0v6m0-5a1.25 1.25 0 012.5 0v6m0-3.5a1.25 1.25 0 012.5 0V15a5 5 0 01-5 5h-1.2a5 5 0 01-3.8-1.8L6 15.2a1.3 1.3 0 011.9-1.7L9 14.5" />),
  scale: S(<><path d="M5 19L19 5" /><path d="M13 5h6v6" /><path d="M5 13v6h6" /></>),
  frame: S(<><path d="M8 4v16M16 4v16M4 8h16M4 16h16" /></>),
  section: S(<><rect x="4" y="6" width="16" height="13" rx="1.5" /><rect x="4" y="3.5" width="7" height="3" rx="1" fill="currentColor" stroke="none" /></>),
  slice: S(<><path d="M5 19L19 5" /><path d="M5 5h8M5 5v8" strokeDasharray="2 2" /></>),
  rect: S(<rect x="5" y="5" width="14" height="14" rx="1" />),
  line: S(<path d="M5 19L19 5" />),
  arrow: S(<><path d="M5 19L19 5" /><path d="M11 5h8v8" /></>),
  ellipse: S(<circle cx="12" cy="12" r="7" />),
  polygon: S(<path d="M12 5l7.5 13h-15z" />),
  star: S(<path d="M12 4.5l2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 16.3l-4.6 2.5.9-5.2L4.5 10l5.2-.7z" />),
  image: S(<><rect x="4.5" y="5.5" width="15" height="13" rx="1.5" /><circle cx="9" cy="10" r="1.5" /><path d="M19.5 15l-4-4-8 7.5" /></>),
  pen: S(<><path d="M12 19l7-7-3-3-7 7-1 4z" /><path d="M14 7l3 3" /><circle cx="10.5" cy="13.5" r="1" /></>),
  pencil: S(<><path d="M5 19l1.2-4L16 5.2a1.6 1.6 0 012.3 0l.5.5a1.6 1.6 0 010 2.3L9 17.8z" /></>),
  text: S(<><path d="M6 6h12M12 6v13M9.5 19h5" /></>),
  comment: S(<path d="M12 4.5a7.5 7.5 0 00-6.6 11L4.5 19.5l4-1a7.5 7.5 0 103.5-14z" />),
  actions: S(<><path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z" /><path d="M18 15l.7 1.8 1.8.7-1.8.7L18 20l-.7-1.8-1.8-.7 1.8-.7z" /></>),
  code: S(<><path d="M9 8l-4 4 4 4M15 8l4 4-4 4" /></>),
  chevronDown: S(<path d="M8 10l4 4 4-4" />),
  chevronRight: S(<path d="M10 8l4 4-4 4" />),
  plus: S(<path d="M12 6v12M6 12h12" />),
  minus: S(<path d="M6 12h12" />),
  close: S(<path d="M7 7l10 10M17 7L7 17" />),
  eye: S(<><path d="M3.5 12S6.5 6.5 12 6.5 20.5 12 20.5 12 17.5 17.5 12 17.5 3.5 12 3.5 12z" /><circle cx="12" cy="12" r="2.5" /></>),
  eyeOff: S(<><path d="M3.5 12S6.5 6.5 12 6.5c1.5 0 2.8.4 3.9 1M20.5 12s-3 5.5-8.5 5.5c-1.5 0-2.8-.4-3.9-1" /><path d="M5 19L19 5" /></>),
  lock: S(<><rect x="6.5" y="11" width="11" height="8" rx="1.5" /><path d="M9 11V8.5a3 3 0 016 0V11" /></>),
  unlock: S(<><rect x="6.5" y="11" width="11" height="8" rx="1.5" /><path d="M9 11V8.5a3 3 0 015.8-1" /></>),
  play: S(<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />),
  more: S(<><circle cx="6" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="18" cy="12" r="1" fill="currentColor" /></>),
  search: S(<><circle cx="11" cy="11" r="5.5" /><path d="M15 15l4 4" /></>),
  component: S(<path d="M12 4l3 3-3 3-3-3zM12 14l3 3-3 3-3-3zM7 9l3 3-3 3-3-3zM17 9l3 3-3 3-3-3z" />),
  componentFill: S(<path d="M12 4l3 3-3 3-3-3zM12 14l3 3-3 3-3-3zM7 9l3 3-3 3-3-3zM17 9l3 3-3 3-3-3z" fill="currentColor" />),
  instance: S(<path d="M12 4.5l7.5 7.5-7.5 7.5L4.5 12z" />),
  group: S(<><path d="M5 8V5h3M16 5h3v3M19 16v3h-3M8 19H5v-3" /></>),
  vector: S(<><path d="M6 18C9 6 15 6 18 18" /><rect x="4.5" y="16.5" width="3" height="3" /><rect x="16.5" y="16.5" width="3" height="3" /></>),
  autoLayoutV: S(<><rect x="6" y="5" width="12" height="5" rx="1" /><rect x="6" y="14" width="12" height="5" rx="1" /></>),
  autoLayoutH: S(<><rect x="5" y="6" width="5" height="12" rx="1" /><rect x="14" y="6" width="5" height="12" rx="1" /></>),
  wrap: S(<><rect x="5" y="5" width="5" height="5" rx="1" /><rect x="14" y="5" width="5" height="5" rx="1" /><rect x="5" y="14" width="5" height="5" rx="1" /></>),
  boolUnion: S(<path d="M5 5h9v5h5v9h-9v-5H5z" fill="currentColor" fillOpacity={0.3} />),
  boolSubtract: S(<><path d="M5 5h9v5h-4v4H5z" fill="currentColor" fillOpacity={0.3} /><path d="M10 10h9v9h-9z" /></>),
  boolIntersect: S(<><path d="M5 5h9v9H5zM10 10h9v9h-9z" /><path d="M10 10h4v4h-4z" fill="currentColor" /></>),
  boolExclude: S(<><path d="M5 5h9v5h-4v4H5zM14 10h5v9h-9v-5h4z" fill="currentColor" fillOpacity={0.3} /><path d="M10 10h4v4h-4z" /></>),
  mask: S(<><rect x="4.5" y="4.5" width="15" height="15" rx="2" /><circle cx="12" cy="12" r="4" fill="currentColor" /></>),
  alignLeft: S(<><path d="M5 4v16" /><rect x="8" y="7" width="10" height="4" rx="1" /><rect x="8" y="13" width="6" height="4" rx="1" /></>),
  alignHCenter: S(<><path d="M12 4v16" /><rect x="6" y="7" width="12" height="4" rx="1" /><rect x="8" y="13" width="8" height="4" rx="1" /></>),
  alignRight: S(<><path d="M19 4v16" /><rect x="6" y="7" width="10" height="4" rx="1" /><rect x="10" y="13" width="6" height="4" rx="1" /></>),
  alignTop: S(<><path d="M4 5h16" /><rect x="7" y="8" width="4" height="10" rx="1" /><rect x="13" y="8" width="4" height="6" rx="1" /></>),
  alignVCenter: S(<><path d="M4 12h16" /><rect x="7" y="6" width="4" height="12" rx="1" /><rect x="13" y="8" width="4" height="8" rx="1" /></>),
  alignBottom: S(<><path d="M4 19h16" /><rect x="7" y="6" width="4" height="10" rx="1" /><rect x="13" y="10" width="4" height="6" rx="1" /></>),
  distH: S(<><path d="M5 4v16M19 4v16" /><rect x="10" y="8" width="4" height="8" rx="1" /></>),
  distV: S(<><path d="M4 5h16M4 19h16" /><rect x="8" y="10" width="8" height="4" rx="1" /></>),
  tidy: S(<><rect x="5" y="5" width="5" height="5" rx="1" /><rect x="14" y="5" width="5" height="5" rx="1" /><rect x="5" y="14" width="5" height="5" rx="1" /><rect x="14" y="14" width="5" height="5" rx="1" /></>),
  rotate: S(<><path d="M18 12a6 6 0 11-2-4.5" /><path d="M18 5v3h-3" /></>),
  flipH: S(<><path d="M12 4v16" strokeDasharray="2 2" /><path d="M9 7L4 17h5zM15 7l5 10h-5z" /></>),
  flipV: S(<><path d="M4 12h16" strokeDasharray="2 2" /><path d="M7 9L17 4v5zM7 15l10 5v-5z" /></>),
  corner: S(<path d="M6 18V11a5 5 0 015-5h7" />),
  corners: S(<><path d="M5 9V7a2 2 0 012-2h2M15 5h2a2 2 0 012 2v2M19 15v2a2 2 0 01-2 2h-2M9 19H7a2 2 0 01-2-2v-2" /></>),
  opacity: S(<><circle cx="12" cy="12" r="7" /><path d="M12 5a7 7 0 010 14z" fill="currentColor" /></>),
  styles: S(<><circle cx="8" cy="8" r="2.5" /><circle cx="16" cy="8" r="2.5" /><circle cx="8" cy="16" r="2.5" /><circle cx="16" cy="16" r="2.5" /></>),
  variable: S(<><path d="M12 4.5l6.5 3.75v7.5L12 19.5l-6.5-3.75v-7.5z" /><circle cx="12" cy="12" r="2" /></>),
  link: S(<><path d="M10 14a3.5 3.5 0 005 0l3-3a3.5 3.5 0 00-5-5l-1 1" /><path d="M14 10a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 005 5l1-1" /></>),
  unlink: S(<><path d="M10 14a3.5 3.5 0 005 0l3-3a3.5 3.5 0 00-5-5" /><path d="M14 10a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 005 5" /><path d="M4 4l16 16" /></>),
  grid: S(<><path d="M4 9h16M4 15h16M9 4v16M15 4v16" /></>),
  columns: S(<><rect x="5" y="5" width="3" height="14" /><rect x="10.5" y="5" width="3" height="14" /><rect x="16" y="5" width="3" height="14" /></>),
  rows: S(<><rect x="5" y="5" width="14" height="3" /><rect x="5" y="10.5" width="14" height="3" /><rect x="5" y="16" width="14" height="3" /></>),
  page: S(<><path d="M7 4.5h7l4 4V19.5H7z" /><path d="M14 4.5v4h4" /></>),
  export: S(<><path d="M12 15V5M8 9l4-4 4 4" /><path d="M5 14v5h14v-5" /></>),
  share: S(<><circle cx="7" cy="12" r="2" /><circle cx="17" cy="7" r="2" /><circle cx="17" cy="17" r="2" /><path d="M9 11l6-3M9 13l6 3" /></>),
  history: S(<><path d="M5 12a7 7 0 107-7c-2.5 0-4.5 1.3-5.7 3" /><path d="M5 5v3.5h3.5M12 8v4l3 2" /></>),
  check: S(<path d="M6 12.5l4 4 8-9" />),
  dot: S(<circle cx="12" cy="12" r="2" fill="currentColor" />),
  effect: S(<><circle cx="12" cy="12" r="6" /><path d="M12 6a6 6 0 016 6" strokeWidth={2.5} /></>),
  sun: S(<><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></>),
  moon: S(<path d="M19 14.5A7.5 7.5 0 019.5 5a7.5 7.5 0 109.5 9.5z" />),
  home: S(<><path d="M5 11l7-6 7 6v8h-5v-5h-4v5H5z" /></>),
  clock: S(<><circle cx="12" cy="12" r="7.5" /><path d="M12 8v4l2.5 2" /></>),
  file: S(<><path d="M7 4.5h7l4 4V19.5H7z" /></>),
  trash: S(<><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></>),
  starIcon: S(<path d="M12 4.5l2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 16.3l-4.6 2.5.9-5.2L4.5 10l5.2-.7z" />),
  starFill: S(<path d="M12 4.5l2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 16.3l-4.6 2.5.9-5.2L4.5 10l5.2-.7z" fill="currentColor" />),
  users: S(<><circle cx="9" cy="9" r="3" /><path d="M3.5 18.5a5.5 5.5 0 0111 0" /><circle cx="16.5" cy="8.5" r="2.5" /><path d="M15 13.5a4.5 4.5 0 015.5 4.5" /></>),
  book: S(<><path d="M5 5.5A1.5 1.5 0 016.5 4H19v14H6.5A1.5 1.5 0 005 19.5z" /><path d="M5 19.5A1.5 1.5 0 006.5 21H19v-3" /></>),
  plugin: S(<><path d="M9 4.5h6v3a1.5 1.5 0 003 0V9h1.5v6H18a1.5 1.5 0 000 3v1.5H6V9h3V7.5" /></>),
  layers: S(<><path d="M12 4l8 4-8 4-8-4z" /><path d="M4 12l8 4 8-4M4 16l8 4 8-4" /></>),
  assets: S(<><rect x="5" y="5" width="6" height="6" rx="1" /><rect x="13" y="5" width="6" height="6" rx="1" /><rect x="5" y="13" width="6" height="6" rx="1" /><circle cx="16" cy="16" r="3" /></>),
  panel: S(<><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M9 5v14" /></>),
  sidebarR: S(<><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M15 5v14" /></>),
  info: S(<><circle cx="12" cy="12" r="7.5" /><path d="M12 11v5M12 8v.5" /></>),
  measure: S(<><path d="M4 16l12-12 4 4-12 12z" /><path d="M8 12l2 2M11 9l1.5 1.5M14 6l2 2" /></>),
  annotate: S(<><path d="M5 5h14v10H11l-4 4v-4H5z" /><path d="M9 9h6M9 12h4" /></>),
  hug: S(<><path d="M8 7l-3 5 3 5M16 7l3 5-3 5" /></>),
  fill: S(<><path d="M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3" /></>),
  fixed: S(<><path d="M5 8v8M19 8v8M5 12h14" /></>),
  padding: S(<><rect x="4.5" y="4.5" width="15" height="15" rx="1" /><rect x="8.5" y="8.5" width="7" height="7" rx="1" strokeDasharray="2 1.5" /></>),
  gapH: S(<><rect x="4" y="6" width="5" height="12" rx="1" /><rect x="15" y="6" width="5" height="12" rx="1" /><path d="M11 12h2" /></>),
  gapV: S(<><rect x="6" y="4" width="12" height="5" rx="1" /><rect x="6" y="15" width="12" height="5" rx="1" /><path d="M12 11v2" /></>),
  angle: S(<><path d="M5 19h14M5 19L16 8" /><path d="M10 19a5 5 0 00-1.5-3.5" /></>),
  dashed: S(<path d="M4 12h3M10 12h4M17 12h3" />),
  stroke: S(<rect x="5" y="5" width="14" height="14" rx="1" strokeWidth={2.5} />),
  target: S(<><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /></>),
  flow: S(<><path d="M7 6.5v11l9-5.5z" fill="currentColor" /></>),
  menu: S(<path d="M5 8h14M5 12h14M5 16h14" />),
  logo: ({ size = 20 }: P) => (
    <svg width={size} height={size} viewBox="0 0 32 32" data-testid="app-logo" aria-label="My Flow">
      <defs>
        <linearGradient id="mf-logo-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A259FF" />
          <stop offset="0.55" stopColor="#0D99FF" />
          <stop offset="1" stopColor="#0ACF83" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#mf-logo-g)" />
      <path d="M8.5 23V9.5h2.6L16 16.4l4.9-6.9h2.6V23h-3v-8.3L16 20.9l-4.5-6.2V23z" fill="#fff" />
    </svg>
  ),
};

export type IconName = keyof typeof Icon;

export function I({ name, size = 24, className, style }: { name: IconName; size?: number; className?: string; style?: React.CSSProperties }) {
  const C = Icon[name];
  return <C size={size} className={className} style={style} />;
}
