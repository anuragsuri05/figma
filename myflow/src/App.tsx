import React, { useEffect, useState } from 'react';
import { Home, newFile } from './home/Home';
import { Editor, useTheme, usePrefsPersistence } from './editor/Editor';
import { Present } from './present/Present';

function parseHash() {
  const h = window.location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = h.split('?');
  return { path, params: new URLSearchParams(query) };
}

export function App() {
  const [route, setRoute] = useState(parseHash());
  useTheme();
  usePrefsPersistence();
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    if (route.path === '/new') void newFile();
  }, [route.path]);
  const m = route.path.match(/^\/file\/([^/]+)(\/present)?$/);
  if (m && m[2]) return <Present key={m[1] + route.params.toString()} fileId={m[1]} startNode={route.params.get('node') ?? undefined} pageId={route.params.get('page') ?? undefined} />;
  if (m) return <Editor key={m[1]} fileId={m[1]} />;
  if (route.path === '/new') return <div className="empty" style={{ paddingTop: 120 }}>Creating file…</div>;
  return <Home />;
}
