import { describe, expect, test } from "bun:test";
import { placeStone } from "./board";
import { createInitialGameState } from "./game-state";
import { resolveTurn } from "./turn";

describe("resolveTurn", () => {
  test("on success: places stone and switches turn", () => {
    const state = { ...createInitialGameState(), phase: "playing" as const };
    const candidates = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    const { nextState, result } = resolveTurn(
      state,
      "player1",
      candidates,
      () => 0.4,
    );
    expect(nextState.board[0]?.[0]).toBe("player1");
    expect(nextState.currentPlayer).toBe("player2");
    expect(result.success).toBe(true);
    expect(result.placedPosition).toEqual({ x: 0, y: 0 });
  });

  test("on failure: switches turn without placing stone", () => {
    const state = { ...createInitialGameState(), phase: "playing" as const };
    const candidates = [{ x: 0, y: 0 }];
    const { nextState, result } = resolveTurn(
      state,
      "player1",
      candidates,
      () => 0.6,
    );
    expect(nextState.board[0]?.[0]).toBe(null);
    expect(nextState.currentPlayer).toBe("player2");
    expect(result.success).toBe(false);
  });

  test("on win: sets phase to finished and winner", () => {
    let state = { ...createInitialGameState(), phase: "playing" as const };
    for (let x = 0; x < 4; x++) {
      state = {
        ...state,
        board: placeStone(state.board, { x, y: 0 }, "player1"),
      };
    }
    const { nextState, result } = resolveTurn(
      state,
      "player1",
      [{ x: 4, y: 0 }],
      () => 0,
    );
    expect(nextState.phase).toBe("finished");
    expect(nextState.winner).toBe("player1");
    expect(result.gameOver).toBe(true);
  });

  test("on draw: sets phase to finished and isDraw", () => {
    const state = { ...createInitialGameState(), phase: "playing" as const };
    for (let y = 0; y < state.board.length; y++) {
      const row = state.board[y];
      if (!row) continue;
      for (let x = 0; x < row.length; x++) {
        row[x] = "player2";
      }
    }
    const row0 = state.board[0];
    if (row0) row0[0] = null;
    const { nextState, result } = resolveTurn(
      state,
      "player1",
      [{ x: 0, y: 0 }],
      () => 0,
    );
    expect(nextState.phase).toBe("finished");
    expect(nextState.isDraw).toBe(true);
    expect(result.gameOver).toBe(true);
    expect(result.winner).toBe(null);
  });
});
