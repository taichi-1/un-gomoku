import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { WS_EVENTS } from "@pkg/shared/events";
import { startOnlineConnection } from "@/features/game/lib/online-connection";
import { createInitialOnlineSnapshot } from "@/features/game/lib/online-session";
import { saveRoomAuth } from "@/lib/room-auth-storage";

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: FakeWebSocket[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];

  constructor(_url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  triggerOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  triggerMessage(message: unknown): void {
    this.onmessage?.({
      data: JSON.stringify(message),
    } as MessageEvent);
  }
}

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
const originalWebSocket = globalThis.WebSocket;

beforeEach(() => {
  FakeWebSocket.instances = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: createMemoryStorage(),
      sessionStorage: createMemoryStorage(),
      location: {
        protocol: "http:",
        host: "localhost:5173",
        origin: "http://localhost:5173",
      },
    },
  });
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    writable: true,
    value: FakeWebSocket as unknown as typeof WebSocket,
  });
});

afterEach(() => {
  if (typeof originalWindow === "undefined") {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  } else {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: originalWindow,
    });
  }

  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    writable: true,
    value: originalWebSocket,
  });
});

describe("startOnlineConnection", () => {
  test("retries once for Room is full when joining with playerToken", async () => {
    const roomId = "ABC123";
    saveRoomAuth(roomId, {
      playerId: "player1",
      playerToken: "token-1",
    });

    let snapshot = createInitialOnlineSnapshot(roomId);
    const dispose = startOnlineConnection({
      roomId,
      setSnapshot: (updater) => {
        snapshot = updater(snapshot);
      },
      setSocket: () => undefined,
      roomFullRetryDelayMs: 150,
      scheduleTimeout: (callback) => {
        callback();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
    });

    const ws = FakeWebSocket.instances.at(-1);
    if (!ws) {
      throw new Error("websocket instance was not created");
    }

    ws.triggerOpen();
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0] ?? "{}")).toEqual({
      event: WS_EVENTS.ROOM_JOIN,
      roomId,
      playerToken: "token-1",
    });

    ws.triggerMessage({
      event: WS_EVENTS.ROOM_ERROR,
      message: "Room is full",
    });

    expect(ws.sent).toHaveLength(2);
    expect(JSON.parse(ws.sent[1] ?? "{}")).toEqual({
      event: WS_EVENTS.ROOM_JOIN,
      roomId,
      playerToken: "token-1",
    });
    expect(snapshot.status).toBe("connecting");

    ws.triggerMessage({
      event: WS_EVENTS.ROOM_ERROR,
      message: "Room is full",
    });

    expect(ws.sent).toHaveLength(2);
    expect(snapshot.status).toBe("error");
    expect(snapshot.statusMessage).toBe("Room is full");

    dispose();
  });
});
