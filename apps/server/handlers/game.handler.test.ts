import { describe, expect, test } from "bun:test";
import { placeStone } from "@pkg/core/board";
import type { ServerWebSocket } from "bun";
import { createRoom, getRoom, joinRoom } from "../services";
import type { WebSocketData } from "../types";
import {
  handleSubmitCandidates,
  handleUpdateCandidateDraft,
} from "./game.handler";

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

  test("sends GAME_ERROR when submit does not match latest draft", () => {
    const { ws, sent } = createFakeWs();
    createRoom(ws);
    const room = getRoom(ws.data.roomId ?? "");
    if (!room) throw new Error("room not found");
    room.state.phase = "playing";
    room.candidateDrafts.player1 = [{ x: 1, y: 1 }];

    handleSubmitCandidates(ws, [{ x: 2, y: 2 }]);

    const msg = sent.at(-1) as { event?: string; message?: string };
    expect(msg.event).toBe("game.error");
    expect(msg.message).toBe("Submit candidates do not match latest draft");
    expect(room.state.turnHistory).toHaveLength(0);
  });
});

describe("handleUpdateCandidateDraft", () => {
  test("broadcasts draft in input order to all players", () => {
    const player1 = createFakeWs();
    const player2 = createFakeWs();
    const { roomId } = createRoom(player1.ws);
    joinRoom(player2.ws, roomId);

    const room = getRoom(roomId);
    if (!room) throw new Error("room not found");
    room.state.phase = "playing";
    room.state.currentPlayer = "player1";

    handleUpdateCandidateDraft(player1.ws, [
      { x: 2, y: 2 },
      { x: 1, y: 1 },
    ]);

    const sent1 = player1.sent.at(-1) as {
      event?: string;
      playerId?: string;
      candidates?: unknown[];
    };
    expect(sent1.event).toBe("game.candidateDraftUpdated");
    expect(sent1.playerId).toBe("player1");
    expect(sent1.candidates).toEqual([
      { x: 2, y: 2 },
      { x: 1, y: 1 },
    ]);

    const sent2 = player2.sent.at(-1) as {
      event?: string;
      playerId?: string;
      candidates?: unknown[];
    };
    expect(sent2.event).toBe("game.candidateDraftUpdated");
    expect(sent2.playerId).toBe("player1");
    expect(sent2.candidates).toEqual([
      { x: 2, y: 2 },
      { x: 1, y: 1 },
    ]);
  });

  test("sends GAME_ERROR for duplicate candidates", () => {
    const { ws, sent } = createFakeWs();
    createRoom(ws);
    const room = getRoom(ws.data.roomId ?? "");
    if (!room) throw new Error("room not found");
    room.state.phase = "playing";

    handleUpdateCandidateDraft(ws, [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]);

    const msg = sent.at(-1) as { event?: string; message?: string };
    expect(msg.event).toBe("game.error");
    expect(msg.message).toBe("Duplicate candidates are not allowed");
  });
});
