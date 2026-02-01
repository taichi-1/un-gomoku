import { describe, expect, test } from "bun:test";
import { createEmptyBoard } from "./board";
import { checkWinAt, findWinner } from "./win-detection";

describe("checkWinAt", () => {
  test("should detect horizontal win", () => {
    const board = createEmptyBoard();
    const row = board[7];
    if (row) {
      for (let x = 0; x < 5; x++) {
        row[x] = "player1";
      }
    }
    expect(checkWinAt(board, { x: 2, y: 7 }, "player1")).toBe(true);
  });

  test("should detect vertical win", () => {
    const board = createEmptyBoard();
    for (let y = 0; y < 5; y++) {
      const row = board[y];
      if (row) row[7] = "player2";
    }
    expect(checkWinAt(board, { x: 7, y: 2 }, "player2")).toBe(true);
  });

  test("should detect diagonal win (down-right)", () => {
    const board = createEmptyBoard();
    for (let i = 0; i < 5; i++) {
      const row = board[i];
      if (row) row[i] = "player1";
    }
    expect(checkWinAt(board, { x: 2, y: 2 }, "player1")).toBe(true);
  });

  test("should detect diagonal win (up-right)", () => {
    const board = createEmptyBoard();
    for (let i = 0; i < 5; i++) {
      const row = board[4 - i];
      if (row) row[i] = "player1";
    }
    expect(checkWinAt(board, { x: 2, y: 2 }, "player1")).toBe(true);
  });

  test("should return false for 4 in a row", () => {
    const board = createEmptyBoard();
    const row = board[7];
    if (row) {
      for (let x = 0; x < 4; x++) {
        row[x] = "player1";
      }
    }
    expect(checkWinAt(board, { x: 2, y: 7 }, "player1")).toBe(false);
  });
});

describe("findWinner", () => {
  test("should find winner when there is one", () => {
    const board = createEmptyBoard();
    const row = board[0];
    if (row) {
      for (let x = 0; x < 5; x++) {
        row[x] = "player1";
      }
    }
    expect(findWinner(board)).toBe("player1");
  });

  test("should return null when no winner", () => {
    const board = createEmptyBoard();
    expect(findWinner(board)).toBeNull();
  });
});
