/**
 * Board -> network input planes.
 *
 * Mirrors ml/src/ungomoku_ml/encoding.py exactly; parity is pinned by
 * features.test.ts against ml/tests/fixtures/encoding-vectors.json:
 * - planes (3, 15, 15) flattened as (plane, y, x)
 * - plane 0: stones of the player to move, plane 1: opponent, plane 2: ones
 */

import { CELLS, EMPTY, otherStone } from "./types";

export const PLANES = 3;
export const PLANE_SIZE = CELLS;
export const INPUT_SIZE = PLANES * CELLS;

export function encodeBoard(board: Int8Array, toMove: number): Float32Array {
  const planes = new Float32Array(INPUT_SIZE);
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
  return planes;
}

export function legalCells(board: Int8Array): number[] {
  const cells: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    if (board[i] === EMPTY) cells.push(i);
  }
  return cells;
}
