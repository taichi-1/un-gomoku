import { describe, expect, test } from "bun:test";
import { BOARD_SIZE } from "@pkg/shared/constants";
import { createEmptyBoard, placeStone } from "./board";

describe("createEmptyBoard", () => {
  test("should create a board with correct dimensions", () => {
    const board = createEmptyBoard();
    expect(board.length).toBe(BOARD_SIZE);
    expect(board[0]?.length).toBe(BOARD_SIZE);
  });

  test("should create a board with all null cells", () => {
    const board = createEmptyBoard();
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        expect(board[y]?.[x]).toBeNull();
      }
    }
  });
});

describe("placeStone", () => {
  test("should place stone and return new board", () => {
    const board = createEmptyBoard();
    const newBoard = placeStone(board, { x: 7, y: 7 }, "player1");

    expect(newBoard[7]?.[7]).toBe("player1");
    expect(board[7]?.[7]).toBeNull(); // original unchanged
  });

  test("should not mutate original board", () => {
    const board = createEmptyBoard();
    placeStone(board, { x: 0, y: 0 }, "player2");
    expect(board[0]?.[0]).toBeNull();
  });
});
