/**
 * Generates and ranks candidate cells for the CPU to consider.
 *
 * Only cells within a short radius of existing stones are "relevant",
 * which reduces the 225-cell board to a manageable 20-40 cells in mid-game.
 */

import { BOARD_SIZE } from "@pkg/shared/constants";
import type { BoardState, Coordinate, PlayerId } from "@pkg/shared/schemas";
import { scoreCellPlacement } from "./evaluation";

/** Neighbourhood expansion radius around occupied cells. */
const RADIUS = 2;

/**
 * Returns a ranked list of empty cells near existing stones.
 * The list is sorted by heuristic quality (best first) and capped at `maxCells`.
 */
export function generateCandidateCells(
  board: BoardState,
  player: PlayerId,
  maxCells: number,
  attackWeight: number,
  defenseWeight: number,
): Coordinate[] {
  // Special case: empty board → centre cell
  if (isBoardEmpty(board)) {
    const center = Math.floor(BOARD_SIZE / 2);
    return [{ x: center, y: center }];
  }

  // Collect occupied positions
  const occupied: Coordinate[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y]?.[x] != null) {
        occupied.push({ x, y });
      }
    }
  }

  // Expand neighbourhood and collect unique empty cells
  const seen = new Set<number>();
  const cells: Coordinate[] = [];

  for (const { x: ox, y: oy } of occupied) {
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const nx = ox + dx;
        const ny = oy + dy;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue;
        if (board[ny]?.[nx] != null) continue;

        const key = ny * BOARD_SIZE + nx;
        if (seen.has(key)) continue;
        seen.add(key);
        cells.push({ x: nx, y: ny });
      }
    }
  }

  // Rank by placement potential and cap
  const scored = cells.map((coord) => ({
    coord,
    score: scoreCellPlacement(
      board,
      coord,
      player,
      attackWeight,
      defenseWeight,
    ),
  }));
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxCells).map((s) => s.coord);
}

function isBoardEmpty(board: BoardState): boolean {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y]?.[x] != null) return false;
    }
  }
  return true;
}
