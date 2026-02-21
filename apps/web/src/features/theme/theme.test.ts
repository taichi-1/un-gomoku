import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  applyThemeToDocument,
  detectInitialTheme,
  normalizeTheme,
  persistTheme,
  THEME_STORAGE_KEY,
} from "@/features/theme/theme";

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  } as Storage;
}

function createDocumentMock() {
  const classes = new Set<string>();
  return {
    documentElement: {
      dataset: {} as Record<string, string>,
      classList: {
        toggle: (className: string, force?: boolean) => {
          const shouldSet = force ?? !classes.has(className);
          if (shouldSet) {
            classes.add(className);
          } else {
            classes.delete(className);
          }
          return classes.has(className);
        },
        contains: (className: string) => classes.has(className),
      },
      style: {
        colorScheme: "",
      },
    },
  };
}

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: createMemoryStorage(),
      matchMedia: (query: string) => ({
        media: query,
        matches: false,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: createDocumentMock(),
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: originalWindow,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: originalDocument,
  });
});

describe("theme", () => {
  test("normalizeTheme accepts only light/dark", () => {
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("dark")).toBe("dark");
    expect(normalizeTheme("LIGHT")).toBeNull();
    expect(normalizeTheme("foo")).toBeNull();
  });

  test("detectInitialTheme prefers localStorage value", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(detectInitialTheme()).toBe("light");
  });

  test("detectInitialTheme falls back to OS setting when storage is empty", () => {
    window.matchMedia = () =>
      ({
        media: "(prefers-color-scheme: dark)",
        matches: true,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList;
    expect(detectInitialTheme()).toBe("dark");
  });

  test("detectInitialTheme ignores invalid storage values", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    window.matchMedia = () =>
      ({
        media: "(prefers-color-scheme: dark)",
        matches: false,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList;
    expect(detectInitialTheme()).toBe("light");
  });

  test("persistTheme stores selected theme", () => {
    persistTheme("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  test("applyThemeToDocument updates dataset, class and colorScheme", () => {
    applyThemeToDocument("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");

    applyThemeToDocument("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});
