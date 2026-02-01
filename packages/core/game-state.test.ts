import { describe, expect, test } from "bun:test";
import { BOARD_SIZE } from "@pkg/shared/constants";
import { createEmptyBoard } from "./board";
import {
  createInitialGameState,
  getNextPlayer,
  isBoardFull,
} from "./game-state";

describe("createInitialGameState", () => {
  test("should create initial game state correctly", () => {
    const state = createInitialGameState();
    expect(state.currentPlayer).toBe("player1");
    expect(state.phase).toBe("waiting");
    expect(state.winner).toBeNull();
    expect(state.isDraw).toBe(false);
    expect(state.turnHistory).toEqual([]);
    expect(state.board.length).toBe(BOARD_SIZE);
  });
});

describe("isBoardFull", () => {
  test("should return false for empty board", () => {
    const board = createEmptyBoard();
    expect(isBoardFull(board)).toBe(false);
  });

  test("should return false for partially filled board", () => {
    const board = createEmptyBoard();
    const row = board[0];
    if (row) row[0] = "player1";
    expect(isBoardFull(board)).toBe(false);
  });

  test("should return true for completely filled board", () => {
    const board = createEmptyBoard();
    for (let y = 0; y < BOARD_SIZE; y++) {
      const row = board[y];
      if (row) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          row[x] = x % 2 === 0 ? "player1" : "player2";
        }
      }
    }
    expect(isBoardFull(board)).toBe(true);
  });
});

describe("getNextPlayer", () => {
  test("should return player2 when current is player1", () => {
    expect(getNextPlayer("player1")).toBe("player2");
  });

  test("should return player1 when current is player2", () => {
    expect(getNextPlayer("player2")).toBe("player1");
  });
});
