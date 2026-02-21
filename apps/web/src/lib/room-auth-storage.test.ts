import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  clearRoomAuth,
  getRoomAuth,
  saveRoomAuth,
} from "@/lib/room-auth-storage";

const ROOM_AUTH_STORAGE_KEY = "ungomoku.room_auth.v1";

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
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
      sessionStorage: createMemoryStorage(),
    },
  });
});

afterEach(() => {
  if (typeof originalWindow === "undefined") {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    return;
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: originalWindow,
  });
});

describe("room-auth-storage", () => {
  test("stores room auth in sessionStorage", () => {
    saveRoomAuth("abc123", {
      playerId: "player1",
      playerToken: "token-1",
    });

    expect(getRoomAuth("ABC123")).toEqual({
      playerId: "player1",
      playerToken: "token-1",
    });
    expect(window.localStorage.getItem(ROOM_AUTH_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(ROOM_AUTH_STORAGE_KEY)).not.toBeNull();
  });

  test("clearRoomAuth removes the stored token", () => {
    saveRoomAuth("ABC123", {
      playerId: "player2",
      playerToken: "token-2",
    });
    clearRoomAuth("abc123");

    expect(getRoomAuth("ABC123")).toBeNull();
    expect(window.sessionStorage.getItem(ROOM_AUTH_STORAGE_KEY)).toBe("{}");
  });
});
