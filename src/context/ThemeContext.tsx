import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'prism-theme';

const ThemeContext = createContext<ThemeContextType | null>(null);

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  // Default to light for anyone who hasn't explicitly chosen a theme. We no
  // longer follow the OS `prefers-color-scheme`; an explicit toggle is the only
  // way to land on dark, and that choice is persisted.
  return stored === 'light' || stored === 'dark' ? stored : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [hasStoredPreference, setHasStoredPreference] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    if (typeof window === 'undefined') return;
    if (hasStoredPreference) {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } else {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    }
  }, [theme, hasStoredPreference]);

  const setThemeWithPreference = useCallback((nextTheme: Theme) => {
    setHasStoredPreference(true);
    setTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setHasStoredPreference(true);
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme: setThemeWithPreference,
      toggleTheme,
    }),
    [setThemeWithPreference, theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
