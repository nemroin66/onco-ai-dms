import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import {
  applyTheme,
  parseThemeMode,
  persistThemeMode,
  readStoredThemeMode,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "../lib/theme";

interface ThemeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function getSystemPreference(): MediaQueryList {
  return window.matchMedia("(prefers-color-scheme: dark)");
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => readStoredThemeMode(getStorage()));

  const setThemeMode = useCallback((mode: ThemeMode) => {
    persistThemeMode(mode, getStorage());
    applyTheme(mode, getSystemPreference().matches, document.documentElement);
    setThemeModeState(mode);
  }, []);

  useEffect(() => {
    const systemPreference = getSystemPreference();
    const syncTheme = () => applyTheme(themeMode, systemPreference.matches, document.documentElement);
    const handleSystemChange = () => {
      if (themeMode === "system") syncTheme();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      setThemeModeState(parseThemeMode(event.newValue));
    };

    syncTheme();
    systemPreference.addEventListener("change", handleSystemChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      systemPreference.removeEventListener("change", handleSystemChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [themeMode]);

  const value = useMemo(() => ({ themeMode, setThemeMode }), [setThemeMode, themeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
