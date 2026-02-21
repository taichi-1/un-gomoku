import { describe, expect, test } from "bun:test";
import { placeStone } from "@pkg/core/board";
import { createInitialGameState } from "@pkg/core/game-state";
import type { Room } from "../types";
import {
  processTurn,
  updateCandidateDraft,
  validateDraftUpdateContext,
  validateTurnContext,
} from "./game.service";

function createTestRoom(): Room {
  return {
    id: "TEST01",
    players: new Map(),
    state: createInitialGameState(),
    candidateDrafts: { player1: [], player2: [] },
    tokens: new Map(),
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

  test("returns error for duplicate candidates", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    const result = validateTurnContext(room, "player1", [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]);
    expect("kind" in result).toBe(true);
    if ("kind" in result) {
      expect(result.kind).toBe("duplicate_candidates");
    }
  });

  test("returns error when submit candidates do not match latest draft", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    room.candidateDrafts.player1 = [{ x: 0, y: 0 }];
    const result = validateTurnContext(room, "player1", [{ x: 1, y: 1 }]);
    expect("kind" in result).toBe(true);
    if ("kind" in result) {
      expect(result.kind).toBe("submit_candidates_mismatch");
    }
  });

  test("returns context when valid", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    room.candidateDrafts.player1 = [{ x: 0, y: 0 }];
    const result = validateTurnContext(room, "player1", [{ x: 0, y: 0 }]);
    expect("room" in result).toBe(true);
    if ("room" in result) {
      expect(result.room).toBe(room);
      expect(result.playerId).toBe("player1");
      expect(result.candidates).toEqual([{ x: 0, y: 0 }]);
    }
  });

  test("returns context when submit candidates match draft in different order", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    room.candidateDrafts.player1 = [
      { x: 1, y: 1 },
      { x: 0, y: 0 },
    ];
    const result = validateTurnContext(room, "player1", [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect("room" in result).toBe(true);
    if ("room" in result) {
      expect(result.room).toBe(room);
      expect(result.playerId).toBe("player1");
      expect(result.candidates).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]);
    }
  });
});

describe("validateDraftUpdateContext", () => {
  test("accepts empty draft candidates", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    const result = validateDraftUpdateContext(room, "player1", []);
    expect("room" in result).toBe(true);
    if ("room" in result) {
      expect(result.candidates).toEqual([]);
    }
  });

  test("returns error for too many candidates", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    const result = validateDraftUpdateContext(room, "player1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 5, y: 0 },
    ]);
    expect("kind" in result).toBe(true);
    if ("kind" in result) {
      expect(result.kind).toBe("invalid_candidate_count");
    }
  });

  test("returns error for duplicate candidates", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    const result = validateDraftUpdateContext(room, "player1", [
      { x: 2, y: 2 },
      { x: 2, y: 2 },
    ]);
    expect("kind" in result).toBe(true);
    if ("kind" in result) {
      expect(result.kind).toBe("duplicate_candidates");
    }
  });
});

describe("updateCandidateDraft", () => {
  test("stores candidate draft in input order", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    const validation = validateDraftUpdateContext(room, "player1", [
      { x: 3, y: 3 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
    if ("kind" in validation) {
      throw new Error(validation.message);
    }

    updateCandidateDraft(validation);

    expect(room.candidateDrafts.player1).toEqual([
      { x: 3, y: 3 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
  });
});

describe("processTurn", () => {
  test("on success: places stone and switches turn (deterministic)", () => {
    const room = createTestRoom();
    room.state.phase = "playing";
    room.candidateDrafts.player1 = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
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
    expect(room.candidateDrafts.player1).toEqual([]);
    expect(room.candidateDrafts.player2).toEqual([]);
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
