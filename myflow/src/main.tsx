import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useEditor } from './store/editor';
import './styles.css';

// test/debug hook: read editor state from the browser console or e2e tests
(window as unknown as { __myflow: unknown }).__myflow = { get: () => useEditor.getState() };

createRoot(document.getElementById('root')!).render(<App />);
