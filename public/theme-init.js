(function initializeTheme() {
  var allowedModes = ["system", "light", "dark"];
  var mode = "light";

  try {
    var storedMode = window.localStorage.getItem("theme");
    if (allowedModes.indexOf(storedMode) !== -1) mode = storedMode;
  } catch (_) {
    // Keep the light default when storage is unavailable.
  }

  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  var resolvedTheme = mode === "system" ? (prefersDark ? "dark" : "light") : mode;
  var root = document.documentElement;

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.themeMode = mode;
  root.dataset.resolvedTheme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
})();
