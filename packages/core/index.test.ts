import { describe, expect, test } from "bun:test";
import { BOARD_SIZE } from "@pkg/shared";
import {
  checkWinAt,
  createEmptyBoard,
  createInitialGameState,
  findWinner,
  getNextPlayer,
  isBoardFull,
  isEmpty,
  isInBounds,
  isValidCandidate,
  placeStone,
} from "./index";

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

describe("createInitialGameState", () => {
  test("should create initial game state correctly", () => {
    const state = createInitialGameState();
    expect(state.currentPlayer).toBe("player1");
    expect(state.phase).toBe("waiting");
    expect(state.winner).toBeNull();
    expect(state.isDraw).toBe(false);
    expect(state.board.length).toBe(BOARD_SIZE);
  });
});

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
