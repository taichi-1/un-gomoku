/**
 * Board -> network input planes.
 *
 * Mirrors ml/src/ungomoku_ml/encoding.py exactly; parity is pinned by
 * features.test.ts against ml/tests/fixtures/encoding-vectors.json:
 * - planes (inPlanes, 15, 15) flattened as (plane, y, x)
 * - plane 0: stones of the player to move, plane 1: opponent, plane 2: ones
 * - feature set v2 (inPlanes = 5) adds tactical masks:
 *   plane 3: empty cells where the mover wins immediately
 *   plane 4: empty cells where the opponent wins immediately (block cells)
 */

import { winningCellsFlat } from "./tactics";
import { CELLS, EMPTY, otherStone } from "./types";

export const PLANES_V1 = 3;
export const PLANES_V2 = 5;
export const PLANE_SIZE = CELLS;

export function encodeBoard(
  board: Int8Array,
  toMove: number,
  inPlanes: number = PLANES_V1,
): Float32Array {
  const planes = new Float32Array(inPlanes * CELLS);
  const opponent = otherStone(toMove);
  for (let i = 0; i < CELLS; i++) {
    const stone = board[i];
    if (stone === toMove) {
      planes[i] = 1;
    } else if (stone === opponent) {
      planes[PLANE_SIZE + i] = 1;
    }
    planes[2 * PLANE_SIZE + i] = 1;
  }
  if (inPlanes >= PLANES_V2) {
    for (const cell of winningCellsFlat(board, toMove)) {
      planes[3 * PLANE_SIZE + cell] = 1;
    }
    for (const cell of winningCellsFlat(board, opponent)) {
      planes[4 * PLANE_SIZE + cell] = 1;
    }
  }
  return planes;
}

export function legalCells(board: Int8Array): number[] {
  const cells: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    if (board[i] === EMPTY) cells.push(i);
  }
  return cells;
}
