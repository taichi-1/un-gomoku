import { describe, expect, test } from "bun:test";
import { placeStone } from "@pkg/core/board";
import { createInitialGameState } from "@pkg/core/game-state";
import type { Room } from "../types";
import { processTurn, validateTurnContext } from "./game.service";

function createTestRoom(): Room {
  return {
    id: "TEST01",
    players: new Map(),
    state: createInitialGameState(),
    tokens: new Map(),
    pendingUndo: null,
    emptyAt: null,
  };
}

describe("validateTurnContext", () => {
  test("returns error when room is undefined", () => {
    const result = validateTurnContext(undefined, "player1", [{ x: 0, y: 0 }]);
    expect("kind" in result).toBe(true);
    if ("kind" in result) {
      expect(result.kind).toBe("room_not_found");
      expect(result.message).toBe("Room not found");
    }
  });

  test("returns error when playerId is null", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    const result = validateTurnContext(room, null, [{ x: 0, y: 0 }]);
    expect("kind" in result).toBe(true);
    if ("kind" in result) {
      expect(result.kind).toBe("not_in_room");
    }
  });

  test("returns error when phase is not playing", () => {
    const room = createTestRoom();
    room.state.phase = "waiting";
    const result = validateTurnContext(room, "player1", [{ x: 0, y: 0 }]);
    expect("kind" in result).toBe(true);
    if ("kind" in result) {
      expect(result.kind).toBe("game_not_in_progress");
    }
  });

  test("returns error when not player's turn", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    room.state.currentPlayer = "player2";
    const result = validateTurnContext(room, "player1", [{ x: 0, y: 0 }]);
    expect("kind" in result).toBe(true);
    if ("kind" in result) {
      expect(result.kind).toBe("not_your_turn");
    }
  });

  test("returns error for invalid candidate count", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    const result = validateTurnContext(room, "player1", []);
    expect("kind" in result).toBe(true);
    if ("kind" in result) {
      expect(result.kind).toBe("invalid_candidate_count");
    }
  });

  test("returns error for invalid candidate position", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    room.state.board = placeStone(room.state.board, { x: 0, y: 0 }, "player1");
    const result = validateTurnContext(room, "player1", [{ x: 0, y: 0 }]);
    expect("kind" in result).toBe(true);
    if ("kind" in result) {
      expect(result.kind).toBe("invalid_candidate_position");
    }
  });

  test("returns context when valid", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    const result = validateTurnContext(room, "player1", [{ x: 0, y: 0 }]);
    expect("room" in result).toBe(true);
    if ("room" in result) {
      expect(result.room).toBe(room);
      expect(result.playerId).toBe("player1");
      expect(result.candidates).toEqual([{ x: 0, y: 0 }]);
    }
  });
});

describe("processTurn", () => {
  test("on success: places stone and switches turn (deterministic)", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    const candidates = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    // random 0.4 < 0.6 (2 candidates) => success; random 0 for select => index 0
    processTurn({ room, playerId: "player1", candidates }, () => 0.4);
    expect(room.state.board[0]?.[0]).toBe("player1");
    expect(room.state.currentPlayer).toBe("player2");
    expect(room.state.phase).toBe("playing");
    expect(room.state.turnHistory).toHaveLength(1);
  });

  test("on failure: switches turn without placing stone", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    const candidates = [{ x: 0, y: 0 }];
    // random 0.6 >= 0.5 (1 candidate) => failure
    processTurn({ room, playerId: "player1", candidates }, () => 0.6);
    expect(room.state.board[0]?.[0]).toBe(null);
    expect(room.state.currentPlayer).toBe("player2");
    expect(room.state.turnHistory).toHaveLength(1);
  });

  test("on win: sets phase to finished and winner", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    // Place 4 stones in a row for player1
    for (let x = 0; x < 4; x++) {
      room.state.board = placeStone(room.state.board, { x, y: 0 }, "player1");
    }
    const candidates = [{ x: 4, y: 0 }];
    // success + select index 0
    processTurn({ room, playerId: "player1", candidates }, () => 0);
    expect((room.state as { phase: string }).phase).toBe("finished");
    expect(room.state.winner).toBe("player1");
    expect(room.state.turnHistory).toHaveLength(1);
  });
});
