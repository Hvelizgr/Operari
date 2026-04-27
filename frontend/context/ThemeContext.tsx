'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Operari theme system.
 *
 * Three real themes — light, dark, midnight. Persists the user's
 * choice in localStorage and applies the result globally to <html>:
 *
 *   - data-theme="light|dark|midnight"  → CSS variables in globals.css
 *     and the editor stylesheet pick the right palette
 *   - class="dark" when the theme is dark or midnight  → keeps every
 *     `dark:` Tailwind utility working
 *
 * The previous implementation hardcoded `<html className="dark">` and
 * had a half-built "high contrast" toggle that nobody could discover.
 * This context replaces both: a single source of truth, an explicit
 * picker in Settings, and a quick cycle button in the editor TopBar.
 *
 * Flash-of-wrong-theme is prevented by a tiny inline script in
 * RootLayout that runs before hydration (see app/layout.tsx).
 */

export type Theme = 'light' | 'dark' | 'midnight';

const STORAGE_KEY = 'operari-theme';
const DEFAULT_THEME: Theme = 'dark';

export const THEMES: Array<{
  id: Theme;
  label: { en: string; es: string };
  description: { en: string; es: string };
}> = [
  {
    id: 'light',
    label: { en: 'Light', es: 'Claro' },
    description: {
      en: 'Bright background, ideal for daytime work.',
      es: 'Fondo claro, ideal para trabajar de día.',
    },
  },
  {
    id: 'dark',
    label: { en: 'Dark', es: 'Oscuro' },
    description: {
      en: 'Default. Easy on the eyes during a long incident.',
      es: 'Por defecto. Cómodo en incidentes largos.',
    },
  },
  {
    id: 'midnight',
    label: { en: 'Midnight', es: 'Medianoche' },
    description: {
      en: 'Pure black background with vivid accents — minimal eye strain at 3am.',
      es: 'Fondo negro puro con acentos vivos — fatiga mínima a las 3am.',
    },
  },
];

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeToDocument(theme: Theme) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.setAttribute('data-theme', theme);
  // Tailwind `dark:` utilities key off the .dark class. Light is the
  // only theme that should NOT have it.
  if (theme === 'light') {
    html.classList.remove('dark');
  } else {
    html.classList.add('dark');
  }
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'midnight') {
      return raw;
    }
  } catch {
    /* noop */
  }
  return DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  // Read on mount (after the inline script in layout.tsx already
  // applied the right class — this just syncs React state).
  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyThemeToDocument(stored);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyThemeToDocument(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* noop */
    }
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState(prev => {
      const order: Theme[] = ['light', 'dark', 'midnight'];
      const next = order[(order.indexOf(prev) + 1) % order.length];
      applyThemeToDocument(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme, cycleTheme }), [theme, setTheme, cycleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Outside the provider — happens during SSR for components
    // that read theme defensively. Return a no-op default rather
    // than throwing so the marketing pages can render.
    return {
      theme: DEFAULT_THEME,
      setTheme: () => {
        /* noop */
      },
      cycleTheme: () => {
        /* noop */
      },
    };
  }
  return ctx;
}
