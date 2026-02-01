import { describe, expect, test } from "bun:test";
import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "../types";
import { handleRoomCreate, handleRoomJoin } from "./room.handler";

function createFakeWs(): {
  ws: ServerWebSocket<WebSocketData>;
  sent: unknown[];
} {
  const sent: unknown[] = [];
  const ws = {
    data: { roomId: null, playerId: null, playerToken: null },
    send: (data: string) => {
      sent.push(JSON.parse(data));
    },
  } as unknown as ServerWebSocket<WebSocketData>;
  return { ws, sent };
}

function findEvent(sent: unknown[], event: string) {
  return sent.find((msg) => (msg as { event?: string }).event === event);
}

describe("handleRoomJoin", () => {
  test("sends ROOM_ERROR when room is not found", () => {
    const { ws, sent } = createFakeWs();

    handleRoomJoin(ws, "NOPE");

    const msg = sent.at(-1) as { event?: string; message?: string };
    expect(msg.event).toBe("room.error");
    expect(msg.message).toBe("Room not found");
  });

  test("sends ROOM_JOINED and broadcasts GAME_START on success", () => {
    const player1 = createFakeWs();
    handleRoomCreate(player1.ws);

    const created = player1.sent.at(-1) as { event?: string; roomId?: string };
    if (!created.roomId) throw new Error("roomId not sent");

    const player2 = createFakeWs();
    handleRoomJoin(player2.ws, created.roomId);

    const joined = findEvent(player2.sent, "room.joined") as {
      event?: string;
      roomId?: string;
      playerId?: string;
    };
    expect(joined.roomId).toBe(created.roomId);
    expect(joined.playerId).toBe("player2");

    const gameStart1 = findEvent(player1.sent, "game.start") as {
      state?: { phase?: string };
    };
    expect(gameStart1.state?.phase).toBe("playing");

    const gameStart2 = findEvent(player2.sent, "game.start") as {
      state?: { phase?: string };
    };
    expect(gameStart2.state?.phase).toBe("playing");
  });
});
