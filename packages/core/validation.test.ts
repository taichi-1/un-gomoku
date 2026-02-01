import { describe, expect, test } from "bun:test";
import { BOARD_SIZE } from "@pkg/shared/constants";
import { createEmptyBoard } from "./board";
import { isEmpty, isInBounds, isValidCandidate } from "./validation";

describe("isInBounds", () => {
  test("should return true for valid coordinates", () => {
    expect(isInBounds({ x: 0, y: 0 })).toBe(true);
    expect(isInBounds({ x: 7, y: 7 })).toBe(true);
    expect(isInBounds({ x: BOARD_SIZE - 1, y: BOARD_SIZE - 1 })).toBe(true);
  });

  test("should return false for out-of-bounds coordinates", () => {
    expect(isInBounds({ x: -1, y: 0 })).toBe(false);
    expect(isInBounds({ x: 0, y: -1 })).toBe(false);
    expect(isInBounds({ x: BOARD_SIZE, y: 0 })).toBe(false);
    expect(isInBounds({ x: 0, y: BOARD_SIZE })).toBe(false);
  });
});

describe("isEmpty", () => {
  test("should return true for empty cells", () => {
    const board = createEmptyBoard();
    expect(isEmpty(board, { x: 0, y: 0 })).toBe(true);
  });

  test("should return false for occupied cells", () => {
    const board = createEmptyBoard();
    const row = board[0];
    if (row) row[0] = "player1";
    expect(isEmpty(board, { x: 0, y: 0 })).toBe(false);
  });
});

describe("isValidCandidate", () => {
  test("should return true for valid empty cell in bounds", () => {
    const board = createEmptyBoard();
    expect(isValidCandidate(board, { x: 7, y: 7 })).toBe(true);
  });

  test("should return false for out-of-bounds coordinates", () => {
    const board = createEmptyBoard();
    expect(isValidCandidate(board, { x: -1, y: 0 })).toBe(false);
  });

  test("should return false for occupied cells", () => {
    const board = createEmptyBoard();
    const row = board[7];
    if (row) row[7] = "player1";
    expect(isValidCandidate(board, { x: 7, y: 7 })).toBe(false);
  });
});
