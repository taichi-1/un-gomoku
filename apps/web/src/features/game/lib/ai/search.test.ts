import { describe, expect, test } from "bun:test";
import { runSearch, type SearchOptions } from "./search";
import { checkWinAtFlat } from "./tactics";
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
  solverDepth: 3,
};

function winsAt(board: Int8Array, cell: number, stone: number): boolean {
  board[cell] = stone;
  const won = checkWinAtFlat(board, cell, stone);
  board[cell] = 0;
  return won;
}

function nearStones(board: Int8Array, cell: number): boolean {
  const x = cell % 15;
  const y = Math.floor(cell / 15);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = x + dx;
      const cy = y + dy;
      if (
        cx >= 0 &&
        cx < 15 &&
        cy >= 0 &&
        cy < 15 &&
        board[cy * 15 + cx] !== 0
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * One-ply tactical oracle (mirror of ml/tests/test_mcts.py): sees immediate
 * wins/threats only, mimicking a weakly trained net.
 */
const tacticalOracle: Evaluate = async (requests) => {
  const logits: Float32Array[] = [];
  const values: number[] = [];
  for (const { board, toMove } of requests) {
    const opponent = otherStone(toMove);
    const cellLogits = new Float32Array(CELLS).fill(-2);
    let moverCanWin = false;
    let opponentCanWin = false;
    for (let i = 0; i < CELLS; i++) {
      if (board[i] !== 0) continue;
      if (nearStones(board, i)) cellLogits[i] = 1;
      if (winsAt(board, i, toMove)) {
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

/** Proximity-only policy, constant zero value: no tactical knowledge. */
const blindOracle: Evaluate = async (requests) => ({
  logits: requests.map(({ board }) => {
    const cellLogits = new Float32Array(CELLS).fill(-2);
    for (let i = 0; i < CELLS; i++) {
      if (board[i] === 0 && nearStones(board, i)) cellLogits[i] = 1;
    }
    return cellLogits;
  }),
  values: requests.map(() => 0),
});

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

  test("blocks via forced cells even with a tactics-blind net", async () => {
    const board = emptyBoard();
    for (const x of [3, 4, 5, 6]) board[cellIndex(x, 7)] = 2;
    board[cellIndex(2, 7)] = 1;
    const move = await runSearch(board, 1, OPTIONS, blindOracle, mulberry32(5));
    expect(move.cells[0]).toBe(cellIndex(7, 7));
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
