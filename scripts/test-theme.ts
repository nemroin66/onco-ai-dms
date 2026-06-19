import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  applyTheme,
  DEFAULT_THEME_MODE,
  parseThemeMode,
  persistThemeMode,
  readStoredThemeMode,
  resolveThemeMode,
  THEME_STORAGE_KEY,
} from "../src/lib/theme.js";

assert.equal(parseThemeMode("system"), "system");
assert.equal(parseThemeMode("light"), "light");
assert.equal(parseThemeMode("dark"), "dark");
assert.equal(parseThemeMode("invalid"), DEFAULT_THEME_MODE);
assert.equal(parseThemeMode(null), DEFAULT_THEME_MODE);

assert.equal(resolveThemeMode("system", true), "dark");
assert.equal(resolveThemeMode("system", false), "light");
assert.equal(resolveThemeMode("dark", false), "dark");
assert.equal(resolveThemeMode("light", true), "light");

const storedValues = new Map<string, string>();
const storage = {
  getItem: (key: string) => storedValues.get(key) ?? null,
  setItem: (key: string, value: string) => storedValues.set(key, value),
};

persistThemeMode("system", storage);
assert.equal(storedValues.get(THEME_STORAGE_KEY), "system");
assert.equal(readStoredThemeMode(storage), "system");

assert.equal(readStoredThemeMode({ getItem: () => "unsupported" }), DEFAULT_THEME_MODE);
assert.doesNotThrow(() => readStoredThemeMode({ getItem: () => { throw new Error("blocked"); } }));
assert.doesNotThrow(() => persistThemeMode("dark", { setItem: () => { throw new Error("blocked"); } }));

const classes = new Set<string>();
const target = {
  classList: {
    toggle: (token: string, force?: boolean) => {
      if (force) classes.add(token);
      else classes.delete(token);
      return Boolean(force);
    },
  },
  dataset: {} as DOMStringMap,
  style: { colorScheme: "" },
};

assert.equal(applyTheme("system", true, target), "dark");
assert.equal(classes.has("dark"), true);
assert.equal(target.dataset.themeMode, "system");
assert.equal(target.dataset.resolvedTheme, "dark");
assert.equal(target.style.colorScheme, "dark");

assert.equal(applyTheme("light", true, target), "light");
assert.equal(classes.has("dark"), false);
assert.equal(target.dataset.themeMode, "light");
assert.equal(target.dataset.resolvedTheme, "light");
assert.equal(target.style.colorScheme, "light");

const initScript = readFileSync(new URL("../public/theme-init.js", import.meta.url), "utf8");

function runThemeInitializer(storedMode: string | null, prefersDark: boolean) {
  const initialClasses = new Set<string>();
  const documentElement = {
    classList: {
      toggle: (token: string, force?: boolean) => {
        if (force) initialClasses.add(token);
        else initialClasses.delete(token);
      },
    },
    dataset: {} as Record<string, string>,
    style: { colorScheme: "" },
  };

  runInNewContext(initScript, {
    document: { documentElement },
    window: {
      localStorage: { getItem: () => storedMode },
      matchMedia: () => ({ matches: prefersDark }),
    },
  });

  return { documentElement, initialClasses };
}

const systemDark = runThemeInitializer("system", true);
assert.equal(systemDark.initialClasses.has("dark"), true);
assert.equal(systemDark.documentElement.dataset.themeMode, "system");
assert.equal(systemDark.documentElement.dataset.resolvedTheme, "dark");
assert.equal(systemDark.documentElement.style.colorScheme, "dark");

const invalidStoredMode = runThemeInitializer("sepia", true);
assert.equal(invalidStoredMode.initialClasses.has("dark"), false);
assert.equal(invalidStoredMode.documentElement.dataset.themeMode, DEFAULT_THEME_MODE);
assert.equal(invalidStoredMode.documentElement.dataset.resolvedTheme, "light");

console.log("Theme tests passed");
