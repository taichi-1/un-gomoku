import { describe, expect, test } from "bun:test";
import { checkWinAtFlat, runSearch, type SearchOptions } from "./search";
import { CELLS, cellIndex, type Evaluate, otherStone } from "./types";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OPTIONS: SearchOptions = {
  maxChildren: 32,
  mRootCells: 8,
  simulations: 32,
  passSimulations: 2,
  cPuct: 1.5,
  rootNoiseScale: 0, // deterministic arms in tests
  deadlineMs: 60_000,
  qNoise: 0,
  topCellDropout: 0,
  forceTactics: true,
};

function winsAt(board: Int8Array, cell: number, stone: number): boolean {
  board[cell] = stone;
  const won = checkWinAtFlat(board, cell, stone);
  board[cell] = 0;
  return won;
}

/**
 * One-ply tactical oracle (mirror of ml/tests/test_mcts.py): sees immediate
 * wins/threats only, mimicking a weakly trained net. The planes input is
 * decoded back to a board (plane0 = mover stones, plane1 = opponent stones).
 */
const tacticalOracle: Evaluate = async (planesBatch) => {
  const logits: Float32Array[] = [];
  const values: number[] = [];
  for (const planes of planesBatch) {
    // Reconstruct an absolute board with mover=1, opponent=2.
    const board = new Int8Array(CELLS);
    for (let i = 0; i < CELLS; i++) {
      if (planes[i] === 1) board[i] = 1;
      else if (planes[225 + i] === 1) board[i] = 2;
    }
    const mover = 1;
    const opponent = otherStone(mover);
    const cellLogits = new Float32Array(CELLS).fill(-2);
    let moverCanWin = false;
    let opponentCanWin = false;
    for (let i = 0; i < CELLS; i++) {
      if (board[i] !== 0) continue;
      const x = i % 15;
      const y = Math.floor(i / 15);
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        for (let dx = -1; dx <= 1 && !near; dx++) {
          const cx = x + dx;
          const cy = y + dy;
          if (
            cx >= 0 &&
            cx < 15 &&
            cy >= 0 &&
            cy < 15 &&
            board[cy * 15 + cx] !== 0
          ) {
            near = true;
          }
        }
      }
      if (near) cellLogits[i] = 1;
      if (winsAt(board, i, mover)) {
        cellLogits[i] = 3;
        moverCanWin = true;
      } else if (winsAt(board, i, opponent)) {
        cellLogits[i] = 3;
        opponentCanWin = true;
      }
    }
    logits.push(cellLogits);
    values.push(moverCanWin ? 0.9 : opponentCanWin ? -0.7 : 0);
  }
  return { logits, values };
};

function emptyBoard(): Int8Array {
  return new Int8Array(CELLS);
}

describe("runSearch", () => {
  test("leads with the single winning cell", async () => {
    const board = emptyBoard();
    for (const x of [3, 4, 5, 6]) board[cellIndex(x, 7)] = 1;
    board[cellIndex(2, 7)] = 2; // one end blocked
    const move = await runSearch(
      board,
      1,
      OPTIONS,
      tacticalOracle,
      mulberry32(5),
    );
    // The winning cell must lead the subset. Trailing cells are legitimate:
    // non-winning placements keep the four alive, so k=1 and k=3 have
    // near-identical EV under the oracle's values.
    expect(move.cells[0]).toBe(cellIndex(7, 7));
    expect(move.rootValue).toBeGreaterThan(0.5);
  });

  test("offers both winning cells of an open four", async () => {
    const board = emptyBoard();
    for (const x of [3, 4, 5, 6]) board[cellIndex(x, 7)] = 1;
    const move = await runSearch(
      board,
      1,
      OPTIONS,
      tacticalOracle,
      mulberry32(5),
    );
    expect(move.cells.slice(0, 2).sort()).toEqual(
      [cellIndex(2, 7), cellIndex(7, 7)].sort(),
    );
  });

  test("blocks the opponent's four", async () => {
    const board = emptyBoard();
    for (const x of [3, 4, 5, 6]) board[cellIndex(x, 7)] = 2;
    board[cellIndex(2, 7)] = 1;
    const move = await runSearch(
      board,
      1,
      OPTIONS,
      tacticalOracle,
      mulberry32(5),
    );
    expect(move.cells[0]).toBe(cellIndex(7, 7));
    expect(move.rootValue).toBeLessThan(0);
  });

  test("expired deadline still returns a legal move", async () => {
    const board = emptyBoard();
    board[cellIndex(7, 7)] = 2;
    const move = await runSearch(
      board,
      1,
      { ...OPTIONS, deadlineMs: 0 },
      tacticalOracle,
      mulberry32(1),
    );
    expect(move.cells.length).toBeGreaterThanOrEqual(1);
    expect(move.cells.length).toBeLessThanOrEqual(5);
    for (const cell of move.cells) {
      expect(board[cell]).toBe(0);
    }
  });

  test("blocks via forced cells even with a tactics-blind net", async () => {
    // Proximity-only policy, constant zero value: no tactical knowledge.
    const blindOracle: Evaluate = async (planesBatch) => ({
      logits: planesBatch.map((planes) => {
        const cellLogits = new Float32Array(CELLS).fill(-2);
        for (let i = 0; i < CELLS; i++) {
          if (planes[i] === 1 || planes[225 + i] === 1) continue;
          const x = i % 15;
          const y = Math.floor(i / 15);
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const j = (y + dy) * 15 + (x + dx);
              if (
                x + dx >= 0 &&
                x + dx < 15 &&
                y + dy >= 0 &&
                y + dy < 15 &&
                (planes[j] === 1 || planes[225 + j] === 1)
              ) {
                cellLogits[i] = 1;
              }
            }
          }
        }
        return cellLogits;
      }),
      values: planesBatch.map(() => 0),
    });

    const board = emptyBoard();
    for (const x of [3, 4, 5, 6]) board[cellIndex(x, 7)] = 2;
    board[cellIndex(2, 7)] = 1;
    const move = await runSearch(board, 1, OPTIONS, blindOracle, mulberry32(5));
    expect(move.cells[0]).toBe(cellIndex(7, 7));
  });

  test("is deterministic for a fixed seed", async () => {
    const board = emptyBoard();
    board[cellIndex(7, 7)] = 1;
    board[cellIndex(8, 8)] = 2;
    const a = await runSearch(
      board.slice(),
      2,
      OPTIONS,
      tacticalOracle,
      mulberry32(9),
    );
    const b = await runSearch(
      board.slice(),
      2,
      OPTIONS,
      tacticalOracle,
      mulberry32(9),
    );
    expect(a.cells).toEqual(b.cells);
  });
});
