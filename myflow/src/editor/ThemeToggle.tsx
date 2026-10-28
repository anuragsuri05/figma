import React from 'react';
import { useEditor, S } from '../store/editor';
import { I } from './icons';

export function toggleTheme() {
  const cur = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  S().setPrefs({ theme: cur === 'dark' ? 'light' : 'dark' });
}

export function ThemeToggle({ testId = 'theme-toggle' }: { testId?: string }) {
  const theme = useEditor((s) => s.prefs.theme);
  const dark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <button className="icon-btn" data-tip={dark ? 'Switch to light theme' : 'Switch to dark theme'} aria-label="Toggle theme" data-testid={testId} onClick={toggleTheme}>
      <I name={dark ? 'sun' : 'moon'} size={16} />
    </button>
  );
}

