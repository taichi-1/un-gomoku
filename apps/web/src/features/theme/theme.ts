export const THEME_STORAGE_KEY = "ungomoku.theme";

export const SUPPORTED_THEMES = ["light", "dark"] as const;
export type ThemeMode = (typeof SUPPORTED_THEMES)[number];

export function normalizeTheme(
  value: string | null | undefined,
): ThemeMode | null {
  if (!value) {
    return null;
  }
  return value === "light" || value === "dark" ? value : null;
}

function prefersDarkScheme(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return true;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function detectInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  try {
    const fromStorage = normalizeTheme(
      window.localStorage.getItem(THEME_STORAGE_KEY),
    );
    if (fromStorage) {
      return fromStorage;
    }
  } catch {
    return prefersDarkScheme() ? "dark" : "light";
  }

  return prefersDarkScheme() ? "dark" : "light";
}

export function persistTheme(theme: ThemeMode): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    return;
  }
}

export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}
