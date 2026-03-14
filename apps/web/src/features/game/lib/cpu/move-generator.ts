/**
 * Generates and ranks candidate cells for the CPU to consider.
 *
 * Opening positions are handled separately so the CPU can submit multiple
 * central candidates instead of collapsing to a single opening move.
 */

import { BOARD_SIZE } from "@pkg/shared/constants";
import type { BoardState, Coordinate, PlayerId } from "@pkg/shared/schemas";
import type { CpuConfig } from "./config";
import { scoreCellPlacement } from "./evaluation";

const RADIUS = 2;

export function generateCandidateCells(
  board: BoardState,
  player: PlayerId,
  config: CpuConfig,
): Coordinate[] {
  if (isBoardEmpty(board)) {
    return generateOpeningCells(config.maxCandidateCells);
  }

  const occupied: Coordinate[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y]?.[x] != null) {
        occupied.push({ x, y });
      }
    }
  }

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

  const scored = cells.map((coord) => ({
    coord,
    score: scoreCellPlacement(board, coord, player, config),
  }));
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, config.maxCandidateCells).map((entry) => entry.coord);
}

function generateOpeningCells(maxCells: number): Coordinate[] {
  const center = Math.floor(BOARD_SIZE / 2);
  const cells: Coordinate[] = [];

  for (let y = center - 1; y <= center + 1; y++) {
    for (let x = center - 1; x <= center + 1; x++) {
      cells.push({ x, y });
    }
  }

  cells.sort((a, b) => {
    const distanceA = Math.abs(a.x - center) + Math.abs(a.y - center);
    const distanceB = Math.abs(b.x - center) + Math.abs(b.y - center);
    if (distanceA !== distanceB) {
      return distanceA - distanceB;
    }
    if (a.y !== b.y) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });

  return cells.slice(0, maxCells);
}

function isBoardEmpty(board: BoardState): boolean {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y]?.[x] != null) return false;
    }
  }
  return true;
}
