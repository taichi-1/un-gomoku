import { describe, expect, test } from "bun:test";
import { BOARD_SIZE } from "@pkg/shared/constants";
import type { BoardState, Coordinate, PlayerId } from "@pkg/shared/schemas";
import { findWinningLine } from "./winning-line";

function createBoard(stones: Array<[Coordinate, PlayerId]>): BoardState {
  const board: BoardState = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );
  for (const [coord, player] of stones) {
    const row = board[coord.y];
    if (row) {
      row[coord.x] = player;
    }
  }
  return board;
}

function sortLine(line: Coordinate[]): Coordinate[] {
  return [...line].sort((a, b) => a.x - b.x || a.y - b.y);
}

describe("findWinningLine", () => {
  test("finds a horizontal line through a middle stone", () => {
    const stones: Array<[Coordinate, PlayerId]> = Array.from(
      { length: 5 },
      (_, index) => [{ x: 3 + index, y: 7 }, "player1" as PlayerId],
    );
    const board = createBoard(stones);

    const line = findWinningLine(board, { x: 5, y: 7 }, "player1");

    expect(line).not.toBeNull();
    expect(sortLine(line ?? [])).toEqual(
      Array.from({ length: 5 }, (_, index) => ({ x: 3 + index, y: 7 })),
    );
  });

  test("finds a diagonal up-right line", () => {
    const stones: Array<[Coordinate, PlayerId]> = Array.from(
      { length: 5 },
      (_, index) => [{ x: 2 + index, y: 10 - index }, "player2" as PlayerId],
    );
    const board = createBoard(stones);

    const line = findWinningLine(board, { x: 6, y: 6 }, "player2");

    expect(line).not.toBeNull();
    expect(line).toHaveLength(5);
  });

  test("includes all contiguous stones of an overline", () => {
    const stones: Array<[Coordinate, PlayerId]> = Array.from(
      { length: 6 },
      (_, index) => [{ x: 4, y: 2 + index }, "player1" as PlayerId],
    );
    const board = createBoard(stones);

    const line = findWinningLine(board, { x: 4, y: 4 }, "player1");

    expect(line).toHaveLength(6);
  });

  test("returns null when only four are in a row", () => {
    const stones: Array<[Coordinate, PlayerId]> = Array.from(
      { length: 4 },
      (_, index) => [{ x: 3 + index, y: 7 }, "player1" as PlayerId],
    );
    const board = createBoard(stones);

    expect(findWinningLine(board, { x: 3, y: 7 }, "player1")).toBeNull();
  });

  test("returns null when the origin does not hold the player's stone", () => {
    const board = createBoard([[{ x: 0, y: 0 }, "player2"]]);

    expect(findWinningLine(board, { x: 0, y: 0 }, "player1")).toBeNull();
    expect(findWinningLine(board, { x: 5, y: 5 }, "player1")).toBeNull();
  });

  test("ignores opponent stones interrupting the line", () => {
    const board = createBoard([
      [{ x: 3, y: 7 }, "player1"],
      [{ x: 4, y: 7 }, "player1"],
      [{ x: 5, y: 7 }, "player2"],
      [{ x: 6, y: 7 }, "player1"],
      [{ x: 7, y: 7 }, "player1"],
      [{ x: 8, y: 7 }, "player1"],
    ]);

    expect(findWinningLine(board, { x: 7, y: 7 }, "player1")).toBeNull();
  });
});
