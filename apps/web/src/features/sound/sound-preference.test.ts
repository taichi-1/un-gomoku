import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  detectInitialSoundMuted,
  normalizeSoundMuted,
  persistSoundMuted,
  SOUND_MUTED_STORAGE_KEY,
} from "@/features/sound/sound-preference";

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

const originalWindow = globalThis.window;

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: createMemoryStorage(),
    },
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: originalWindow,
  });
});

describe("sound-preference", () => {
  test("normalizeSoundMuted accepts only true/false", () => {
    expect(normalizeSoundMuted("true")).toBe(true);
    expect(normalizeSoundMuted("false")).toBe(false);
    expect(normalizeSoundMuted("TRUE")).toBeNull();
    expect(normalizeSoundMuted("1")).toBeNull();
    expect(normalizeSoundMuted(null)).toBeNull();
  });

  test("detectInitialSoundMuted prefers localStorage", () => {
    window.localStorage.setItem(SOUND_MUTED_STORAGE_KEY, "true");
    expect(detectInitialSoundMuted()).toBe(true);
  });

  test("detectInitialSoundMuted falls back to false when storage empty", () => {
    expect(detectInitialSoundMuted()).toBe(false);
  });

  test("detectInitialSoundMuted ignores invalid storage values", () => {
    window.localStorage.setItem(SOUND_MUTED_STORAGE_KEY, "maybe");
    expect(detectInitialSoundMuted()).toBe(false);
  });

  test("persistSoundMuted stores selected state", () => {
    persistSoundMuted(true);
    expect(window.localStorage.getItem(SOUND_MUTED_STORAGE_KEY)).toBe("true");

    persistSoundMuted(false);
    expect(window.localStorage.getItem(SOUND_MUTED_STORAGE_KEY)).toBe("false");
  });
});
