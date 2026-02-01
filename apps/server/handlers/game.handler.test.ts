import { describe, expect, test } from "bun:test";
import { placeStone } from "@pkg/core/board";
import type { ServerWebSocket } from "bun";
import { createRoom, getRoom } from "../services";
import type { WebSocketData } from "../types";
import { handleSubmitCandidates } from "./game.handler";

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

describe("handleSubmitCandidates", () => {
  test("sends GAME_ERROR for invalid candidate count", () => {
    const { ws, sent } = createFakeWs();
    createRoom(ws);
    const room = getRoom(ws.data.roomId ?? "");
    if (!room) throw new Error("room not found");
    room.state.phase = "playing";

    handleSubmitCandidates(ws, []);

    const msg = sent.at(-1) as { event?: string; message?: string };
    expect(msg.event).toBe("game.error");
    expect(msg.message).toBe("Must select 1-5 candidates");
  });

  test("sends GAME_ERROR for invalid candidate position", () => {
    const { ws, sent } = createFakeWs();
    createRoom(ws);
    const room = getRoom(ws.data.roomId ?? "");
    if (!room) throw new Error("room not found");
    room.state.phase = "playing";
    room.state.board = placeStone(room.state.board, { x: 0, y: 0 }, "player1");

    handleSubmitCandidates(ws, [{ x: 0, y: 0 }]);

    const msg = sent.at(-1) as { event?: string; message?: string };
    expect(msg.event).toBe("game.error");
    expect(msg.message).toBe("Invalid candidate position");
  });
});
