/**
 * NN engine types. Inside the engine, boards are flat Int8Array(225) in
 * row-major order (index = y * 15 + x) with 0 = empty, 1 = player1,
 * 2 = player2 — mirroring ml/src/ungomoku_ml (rules/board.py, encoding.py).
 */

import { BOARD_SIZE } from "@pkg/shared/constants";
import type { BoardState, PlayerId } from "@pkg/shared/schemas";

export type CpuDifficulty = "easy" | "medium" | "hard";

export type CpuTurnOrder = "first" | "second" | "random";

export const CELLS = BOARD_SIZE * BOARD_SIZE;

export const EMPTY = 0;
export type StoneValue = 0 | 1 | 2;

export function cellIndex(x: number, y: number): number {
  return y * BOARD_SIZE + x;
}

export function cellXY(index: number): { x: number; y: number } {
  return { x: index % BOARD_SIZE, y: Math.floor(index / BOARD_SIZE) };
}

export function playerToStone(player: PlayerId): 1 | 2 {
  return player === "player1" ? 1 : 2;
}

export function otherStone(stone: number): 1 | 2 {
  return stone === 1 ? 2 : 1;
}

export function flattenBoard(board: BoardState): Int8Array {
  const flat = new Int8Array(CELLS);
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row = board[y];
    if (!row) continue;
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = row[x];
      flat[cellIndex(x, y)] =
        cell === "player1" ? 1 : cell === "player2" ? 2 : 0;
    }
  }
  return flat;
}

/** Result of one engine move decision: candidate cells, best-first. */
export interface EngineMove {
  cells: number[];
  /** Search value estimate in [-1, 1] from the mover's perspective. */
  rootValue: number;
  /** Net evaluations spent (instrumentation). */
  evalCount: number;
  /** Wall-clock the search took, in ms. */
  thinkMs: number;
}

/** One position awaiting evaluation. */
export interface EvalRequest {
  board: Int8Array;
  toMove: number;
}

/**
 * Batched network evaluation, injected so tests never need ORT. The
 * evaluator encodes boards itself (it alone knows the model's feature-plane
 * count).
 */
export type Evaluate = (requests: EvalRequest[]) => Promise<{
  /** One Float32Array(225) of policy logits per input. */
  logits: Float32Array[];
  /** One value in [-1, 1] per input. */
  values: number[];
}>;

export type RandomFn = () => number;
