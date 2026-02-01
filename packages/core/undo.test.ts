import { describe, expect, test } from "bun:test";
import { createInitialGameState } from "./game-state";
import { resolveTurn } from "./turn";
import { undoLastTurn } from "./undo";

describe("undoLastTurn", () => {
  test("returns error when history is empty", () => {
    const state = { ...createInitialGameState(), phase: "playing" as const };
    const result = undoLastTurn(state);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("no_history");
  });

  test("returns error when game is finished", () => {
    const state = { ...createInitialGameState(), phase: "finished" as const };
    const result = undoLastTurn(state);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("game_finished");
  });

  test("undoes a successful turn by removing the placed stone", () => {
    const state = { ...createInitialGameState(), phase: "playing" as const };
    const { nextState, result } = resolveTurn(
      state,
      "player1",
      [{ x: 0, y: 0 }],
      () => 0,
    );
    const withHistory = { ...nextState, turnHistory: [result] };
    const undoResult = undoLastTurn(withHistory);

    expect(undoResult.ok).toBe(true);
    if (!undoResult.nextState) throw new Error("missing nextState");
    expect(undoResult.nextState.board[0]?.[0]).toBeNull();
    expect(undoResult.nextState.currentPlayer).toBe("player1");
    expect(undoResult.nextState.turnHistory).toHaveLength(0);
  });

  test("undoes a failed turn without changing the board", () => {
    const state = { ...createInitialGameState(), phase: "playing" as const };
    const { nextState, result } = resolveTurn(
      state,
      "player1",
      [{ x: 0, y: 0 }],
      () => 0.6,
    );
    const withHistory = { ...nextState, turnHistory: [result] };
    const undoResult = undoLastTurn(withHistory);

    expect(undoResult.ok).toBe(true);
    if (!undoResult.nextState) throw new Error("missing nextState");
    expect(undoResult.nextState.board[0]?.[0]).toBeNull();
    expect(undoResult.nextState.currentPlayer).toBe("player1");
    expect(undoResult.nextState.turnHistory).toHaveLength(0);
  });
});
