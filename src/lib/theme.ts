export const THEME_STORAGE_KEY = "theme";
export const DEFAULT_THEME_MODE = "light" as const;

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<ThemeMode, "system">;

interface ThemeTarget {
  classList: Pick<DOMTokenList, "toggle">;
  dataset: DOMStringMap;
  style: Pick<CSSStyleDeclaration, "colorScheme">;
}

export function parseThemeMode(value: string | null | undefined): ThemeMode {
  return value === "system" || value === "light" || value === "dark"
    ? value
    : DEFAULT_THEME_MODE;
}

export function resolveThemeMode(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  return mode === "system" ? (prefersDark ? "dark" : "light") : mode;
}

export function readStoredThemeMode(storage?: Pick<Storage, "getItem">): ThemeMode {
  if (!storage) return DEFAULT_THEME_MODE;

  try {
    return parseThemeMode(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

export function persistThemeMode(mode: ThemeMode, storage?: Pick<Storage, "setItem">): void {
  if (!storage) return;

  try {
    storage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Theme selection still applies for the current session when storage is unavailable.
  }
}

export function applyTheme(mode: ThemeMode, prefersDark: boolean, target: ThemeTarget): ResolvedTheme {
  const resolvedTheme = resolveThemeMode(mode, prefersDark);
  target.classList.toggle("dark", resolvedTheme === "dark");
  target.dataset.themeMode = mode;
  target.dataset.resolvedTheme = resolvedTheme;
  target.style.colorScheme = resolvedTheme;
  return resolvedTheme;
}
