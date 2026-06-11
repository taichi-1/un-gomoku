import { describe, expect, test } from "bun:test";
import {
  doubleThreatCellsFlat,
  forcingWinCellsFlat,
  winningCellsFlat,
} from "./tactics";
import { CELLS, cellIndex } from "./types";

describe("doubleThreatCellsFlat", () => {
  test("open three: both extensions create double threats", () => {
    const board = new Int8Array(CELLS);
    for (const x of [5, 6, 7]) board[cellIndex(x, 7)] = 1;
    const threats = doubleThreatCellsFlat(board, 1);
    expect(threats).toContain(cellIndex(4, 7));
    expect(threats).toContain(cellIndex(8, 7));
    expect(doubleThreatCellsFlat(board, 2)).toEqual([]);
  });

  test("blocked three creates no double threat", () => {
    const board = new Int8Array(CELLS);
    for (const x of [5, 6, 7]) board[cellIndex(x, 7)] = 1;
    board[cellIndex(4, 7)] = 2;
    expect(doubleThreatCellsFlat(board, 1)).toEqual([]);
  });

  test("forcing solver: open three found at depth 1, empty board has none", () => {
    const board = new Int8Array(CELLS);
    for (const x of [5, 6, 7]) board[cellIndex(x, 7)] = 1;
    const depth1 = forcingWinCellsFlat(board, 1, 1);
    expect(depth1).toContain(cellIndex(4, 7));
    expect(depth1).toContain(cellIndex(8, 7));
    expect(forcingWinCellsFlat(new Int8Array(CELLS), 1, 3)).toEqual([]);
  });

  test("forcing solver: split three initiates a deep forced win", () => {
    const board = new Int8Array(CELLS);
    for (const x of [5, 6]) board[cellIndex(x, 7)] = 1;
    for (const y of [5, 6]) board[cellIndex(7, y)] = 1;
    board[cellIndex(9, 7)] = 1;
    board[cellIndex(0, 0)] = 2;
    board[cellIndex(14, 14)] = 2;
    const copy = board.slice();
    const cells = forcingWinCellsFlat(board, 1, 3);
    expect(cells).toContain(cellIndex(7, 7));
    expect([...board]).toEqual([...copy]); // board restored
  });

  test("board is left unmodified", () => {
    const board = new Int8Array(CELLS);
    for (const x of [5, 6, 7]) board[cellIndex(x, 7)] = 1;
    const copy = board.slice();
    doubleThreatCellsFlat(board, 1);
    winningCellsFlat(board, 1);
    expect([...board]).toEqual([...copy]);
  });
});
