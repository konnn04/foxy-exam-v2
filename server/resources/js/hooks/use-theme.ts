import { useState, useEffect, useCallback } from 'react';
import { THEME_STORAGE_KEY, THEME_MODES, ThemeMode } from '../constants/theme';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode;
      if (saved === THEME_MODES.LIGHT || saved === THEME_MODES.DARK) {
        return saved;
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches 
        ? THEME_MODES.DARK 
        : THEME_MODES.LIGHT;
    }
    return THEME_MODES.DARK;
  });

  const applyTheme = useCallback((mode: ThemeMode) => {
    const root = document.documentElement;
    if (mode === THEME_MODES.DARK) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    applyTheme(mode);
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    const next = theme === THEME_MODES.DARK ? THEME_MODES.LIGHT : THEME_MODES.DARK;
    setTheme(next);
  }, [theme, setTheme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  return { theme, setTheme, toggleTheme, isDark: theme === THEME_MODES.DARK };
}
