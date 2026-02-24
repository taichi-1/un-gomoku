import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  MAX_MESSAGE_BYTES,
  RATE_LIMIT_COUNT,
  ROOM_STORAGE_KEY,
} from "./config";
import {
  createSocketAdapter,
  handleRoomJoin,
  handleSocketClosed,
  handleSocketMessage,
} from "./room-socket-handlers";
import { createTestRuntime } from "./test-helpers";

interface FakeWebSocket extends WebSocket {
  sent: string[];
  closed: boolean;
}

function createFakeWebSocket(): FakeWebSocket {
  const sent: string[] = [];
  let closed = false;
  return {
    sent,
    get closed() {
      return closed;
    },
    send: (data: string) => {
      sent.push(data);
    },
    close: () => {
      closed = true;
    },
  } as unknown as FakeWebSocket;
}

function parseLastSent(ws: FakeWebSocket): {
  event?: string;
  message?: string;
} {
  const raw = ws.sent.at(-1);
  if (!raw) {
    return {};
  }
  return JSON.parse(raw) as { event?: string; message?: string };
}

const originalConsoleLog = console.log;

beforeEach(() => {
  console.log = () => undefined;
});

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("room-socket-handlers", () => {
  test("returns game.error and closes socket when message exceeds size limit", async () => {
    const { runtime } = createTestRuntime();
    const ws = createFakeWebSocket();
    const socket = createSocketAdapter(ws);
    runtime.sockets.set(ws, { socket, receivedAt: [] });

    await handleSocketMessage(runtime, ws, "x".repeat(MAX_MESSAGE_BYTES + 1));

    const message = parseLastSent(ws);
    expect(message.event).toBe("game.error");
    expect(message.message).toBe("Message too large");
    expect(ws.closed).toBe(true);
  });

  test("returns game.error and closes socket when message rate is exceeded", async () => {
    const { runtime } = createTestRuntime();
    const ws = createFakeWebSocket();
    const socket = createSocketAdapter(ws);
    runtime.sockets.set(ws, {
      socket,
      receivedAt: Array.from({ length: RATE_LIMIT_COUNT }, () => Date.now()),
    });

    await handleSocketMessage(runtime, ws, "{}");

    const message = parseLastSent(ws);
    expect(message.event).toBe("game.error");
    expect(message.message).toBe("Rate limit exceeded");
    expect(ws.closed).toBe(true);
  });

  test("does not close socket when message rate is below threshold", async () => {
    const { runtime } = createTestRuntime();
    const ws = createFakeWebSocket();
    const socket = createSocketAdapter(ws);
    runtime.sockets.set(ws, {
      socket,
      receivedAt: Array.from({ length: RATE_LIMIT_COUNT - 1 }, () =>
        Date.now(),
      ),
    });

    await handleSocketMessage(runtime, ws, "{}");

    const message = parseLastSent(ws);
    expect(message.event).toBe("game.error");
    expect(message.message).not.toBe("Rate limit exceeded");
    expect(ws.closed).toBe(false);
  });

  test("reconnect with same token replaces existing player socket", async () => {
    const { runtime } = createTestRuntime();
    runtime.roomExists = true;
    runtime.room.id = "ABC123";
    runtime.room.tokens.set("player1", "token-1");

    const oldWs = createFakeWebSocket();
    const oldSocket = createSocketAdapter(oldWs);
    oldSocket.data.roomId = "ABC123";
    oldSocket.data.playerId = "player1";
    oldSocket.data.playerToken = "token-1";
    runtime.room.players.set("player1", oldSocket);

    const newWs = createFakeWebSocket();
    const newSocket = createSocketAdapter(newWs);

    await handleRoomJoin(runtime, newSocket, "abc123", "token-1");

    expect(oldWs.closed).toBe(true);
    expect(runtime.room.players.get("player1")).toBe(newSocket);
    expect(newSocket.data.roomId).toBe("ABC123");
    expect(newSocket.data.playerId).toBe("player1");
    expect(newSocket.data.playerToken).toBe("token-1");
    expect(
      newWs.sent.some((raw) => raw.includes('"event":"room.joined"')),
    ).toBe(true);
    expect(newWs.sent.some((raw) => raw.includes('"event":"game.state"'))).toBe(
      true,
    );
  });

  test("disconnect schedules ttl and clears socket auth context", async () => {
    const { runtime, storage } = createTestRuntime();
    runtime.roomExists = true;
    runtime.room.id = "ABC123";
    runtime.room.tokens.set("player1", "token-1");

    const ws = createFakeWebSocket();
    const socket = createSocketAdapter(ws);
    socket.data.roomId = "ABC123";
    socket.data.playerId = "player1";
    socket.data.playerToken = "token-1";
    runtime.room.players.set("player1", socket);
    runtime.sockets.set(ws, { socket, receivedAt: [] });

    await handleSocketClosed(runtime, ws);

    expect(runtime.room.players.size).toBe(0);
    expect(runtime.expiresAt).not.toBeNull();
    expect(storage.alarmAt).not.toBeNull();
    expect(socket.data.roomId).toBeNull();
    expect(socket.data.playerId).toBeNull();
    expect(socket.data.playerToken).toBeNull();
    expect(await storage.get(ROOM_STORAGE_KEY)).toBeDefined();
  });
});
