import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ROOM_STORAGE_KEY } from "./config";
import {
  clearExpiry,
  handleAlarm,
  persistRoomState,
  restoreFromStorage,
  scheduleExpiry,
} from "./room-storage";
import { createTestRuntime } from "./test-helpers";

const originalConsoleLog = console.log;

beforeEach(() => {
  console.log = () => undefined;
});

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("room-storage", () => {
  test("restoreFromStorage hydrates room state", async () => {
    const { runtime, storage } = createTestRuntime();
    await storage.put(ROOM_STORAGE_KEY, {
      roomId: "ABC123",
      state: {
        ...runtime.room.state,
        phase: "playing",
      },
      tokens: {
        player1: "token-1",
        player2: "token-2",
      },
      updatedAt: 1,
      emptyAt: null,
      expiresAt: Date.now() + 60_000,
    });

    await restoreFromStorage(runtime);

    expect(runtime.roomExists).toBe(true);
    expect(runtime.room.id).toBe("ABC123");
    expect(runtime.room.state.phase).toBe("playing");
    expect(runtime.room.tokens.get("player1")).toBe("token-1");
    expect(runtime.room.tokens.get("player2")).toBe("token-2");
    expect(runtime.room.candidateDrafts.player1).toEqual([]);
    expect(runtime.room.candidateDrafts.player2).toEqual([]);
  });

  test("persistRoomState writes current room record", async () => {
    const { runtime, storage } = createTestRuntime();
    runtime.roomExists = true;
    runtime.room.id = "DEF456";
    runtime.room.tokens.set("player1", "token-1");
    runtime.room.tokens.set("player2", "token-2");

    await persistRoomState(runtime);
    const saved = await storage.get<{
      roomId: string;
      tokens: { player1?: string; player2?: string };
    }>(ROOM_STORAGE_KEY);

    expect(saved?.roomId).toBe("DEF456");
    expect(saved?.tokens.player1).toBe("token-1");
    expect(saved?.tokens.player2).toBe("token-2");
  });

  test("scheduleExpiry and clearExpiry update expiration and alarms", async () => {
    const { runtime, storage } = createTestRuntime();
    runtime.roomExists = true;
    runtime.room.id = "TTL001";

    await scheduleExpiry(runtime);
    expect(runtime.expiresAt).not.toBeNull();
    expect(storage.alarmAt).not.toBeNull();

    await clearExpiry(runtime);
    expect(runtime.expiresAt).toBeNull();
    expect(runtime.room.emptyAt).toBeNull();
    expect(storage.deleteAlarmCalls).toBe(1);
  });

  test("handleAlarm clears expired room data", async () => {
    const { runtime, storage } = createTestRuntime();
    runtime.roomExists = true;
    runtime.room.id = "EXP001";
    runtime.room.tokens.set("player1", "token-1");
    runtime.expiresAt = Date.now() - 1;
    await storage.put(ROOM_STORAGE_KEY, { roomId: "EXP001" });

    await handleAlarm(runtime);

    expect(runtime.roomExists).toBe(false);
    expect(runtime.room.id).toBe("");
    expect(runtime.room.tokens.size).toBe(0);
    expect(await storage.get(ROOM_STORAGE_KEY)).toBeUndefined();
  });
});
