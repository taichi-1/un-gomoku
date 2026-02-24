import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { handleRoomJoin } from "./room-join";
import { createSocketAdapter } from "./room-message";
import { rehydrateRoomSockets } from "./room-socket-recovery";
import { restoreFromStorage } from "./room-storage";
import { createTestRuntime, FakeDurableObjectStorage } from "./test-helpers";

interface RecoverableFakeWebSocket extends WebSocket {
  sent: string[];
  closed: boolean;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

function createRecoverableFakeWebSocket(
  initialAttachment: unknown = null,
): RecoverableFakeWebSocket {
  const sent: string[] = [];
  let attachment = initialAttachment;
  let closed = false;
  let readyState: number = WebSocket.OPEN;
  return {
    sent,
    get closed() {
      return closed;
    },
    get readyState() {
      return readyState;
    },
    send: (data: string) => {
      sent.push(data);
    },
    close: () => {
      closed = true;
      readyState = WebSocket.CLOSED;
    },
    serializeAttachment: (value: unknown) => {
      attachment = value;
    },
    deserializeAttachment: () => attachment,
  } as unknown as RecoverableFakeWebSocket;
}

function parseEvents(sent: string[]): string[] {
  return sent.map((raw) => {
    const parsed = JSON.parse(raw) as { event: string };
    return parsed.event;
  });
}

const originalConsoleLog = console.log;

beforeEach(() => {
  console.log = () => undefined;
});

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("rehydrateRoomSockets", () => {
  test("rehydrates host socket so game.start reaches host after room recovery", async () => {
    const initial = createTestRuntime();
    initial.runtime.roomExists = true;
    initial.runtime.room.id = "ABC123";
    initial.runtime.room.tokens.set("player1", "token-1");

    const hostWs = createRecoverableFakeWebSocket();
    const hostSocket = createSocketAdapter(hostWs);
    await handleRoomJoin(initial.runtime, hostSocket, "ABC123", "token-1");

    const recovered = createTestRuntime({
      storage: initial.storage,
      webSockets: [hostWs],
    });
    await restoreFromStorage(recovered.runtime);
    rehydrateRoomSockets(
      recovered.runtime,
      recovered.runtime.state.getWebSockets?.() ?? [],
    );

    const hostEventsBeforeGuestJoin = hostWs.sent.length;
    const guestWs = createRecoverableFakeWebSocket();
    const guestSocket = createSocketAdapter(guestWs);
    await handleRoomJoin(recovered.runtime, guestSocket, "ABC123");

    const hostEvents = parseEvents(
      hostWs.sent.slice(hostEventsBeforeGuestJoin),
    );
    expect(hostEvents).toContain("game.start");
  });

  test("closes sockets with invalid attachment token during recovery", () => {
    const storage = new FakeDurableObjectStorage();
    const { runtime } = createTestRuntime({ storage });
    runtime.roomExists = true;
    runtime.room.id = "ABC123";
    runtime.room.tokens.set("player1", "token-1");

    const badTokenSocket = createRecoverableFakeWebSocket({
      roomId: "ABC123",
      playerId: "player1",
      playerToken: "invalid-token",
    });
    rehydrateRoomSockets(runtime, [badTokenSocket]);

    expect(badTokenSocket.closed).toBe(true);
    expect(runtime.room.players.size).toBe(0);
    expect(runtime.sockets.size).toBe(0);
    expect(badTokenSocket.deserializeAttachment()).toBeNull();
  });

  test("keeps only the latest socket for a duplicated player attachment", () => {
    const { runtime } = createTestRuntime();
    runtime.roomExists = true;
    runtime.room.id = "ABC123";
    runtime.room.tokens.set("player1", "token-1");

    const first = createRecoverableFakeWebSocket({
      roomId: "ABC123",
      playerId: "player1",
      playerToken: "token-1",
    });
    const second = createRecoverableFakeWebSocket({
      roomId: "ABC123",
      playerId: "player1",
      playerToken: "token-1",
    });

    rehydrateRoomSockets(runtime, [first, second]);

    expect(first.closed).toBe(true);
    expect(second.closed).toBe(false);
    expect(runtime.sockets.has(first)).toBe(false);
    expect(runtime.sockets.has(second)).toBe(true);
    expect(runtime.room.players.get("player1")).toBe(
      runtime.sockets.get(second)?.socket,
    );
  });
});
