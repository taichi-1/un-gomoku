/**
 * Board evaluation heuristic for Gomoku.
 *
 * Lightweight terminal/threat detection used by MCTS rollout and move ordering.
 */

import { getNextPlayer } from "@pkg/core/game-state";
import { BOARD_SIZE } from "@pkg/shared/constants";
import type { BoardState, Coordinate, PlayerId } from "@pkg/shared/schemas";

// ── Direction vectors (only "positive" half — we count backward from each run start) ──

const DIRECTIONS: readonly [number, number][] = [
  [1, 0], // horizontal
  [0, 1], // vertical
  [1, 1], // diagonal ↘
  [1, -1], // diagonal ↗
];

// ── Pattern score table ──
// Index: [count][openEnds]  (count capped at 5, openEnds 0/1/2)
// Note: PATTERN_SCORE and patternScore serve scoreCellPlacement move-ordering
// exclusively, not board evaluation.

const PATTERN_SCORE: readonly (readonly number[])[] = [
  /*0*/ [0, 0, 0],
  /*1*/ [0, 2, 12],
  /*2*/ [0, 16, 64],
  /*3*/ [0, 200, 1_100],
  /*4*/ [0, 6_000, 130_000],
  /*5*/ [1_000_000, 1_000_000, 1_000_000],
];

function patternScore(count: number, openEnds: number): number {
  if (count >= 5) return 1_000_000;
  return PATTERN_SCORE[count]?.[openEnds] ?? 0;
}

// ── Helpers ──

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function cellAt(board: BoardState, x: number, y: number): string | null {
  return board[y]?.[x] ?? null;
}

interface RunInfo {
  count: number;
  openEnds: number;
}

function forEachRun(
  board: BoardState,
  player: PlayerId,
  iteratee: (run: RunInfo) => void,
): void {
  for (const [dx, dy] of DIRECTIONS) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (cellAt(board, x, y) !== player) continue;

        // Only process if this cell is the START of a run in this direction
        const prevX = x - dx;
        const prevY = y - dy;
        if (inBounds(prevX, prevY) && cellAt(board, prevX, prevY) === player) {
          continue;
        }

        // Count consecutive stones in the positive direction
        let count = 0;
        let cx = x;
        let cy = y;
        while (inBounds(cx, cy) && cellAt(board, cx, cy) === player) {
          count++;
          cx += dx;
          cy += dy;
        }

        // Determine open ends
        let openEnds = 0;
        // End after the run
        if (inBounds(cx, cy) && cellAt(board, cx, cy) === null) {
          openEnds++;
        }
        // End before the run
        if (inBounds(prevX, prevY) && cellAt(board, prevX, prevY) === null) {
          openEnds++;
        }

        iteratee({ count, openEnds });
      }
    }
  }
}

// ── Internal helpers ──

/**
 * Returns the maximum consecutive run length found for player on the board.
 */
export function longestSequence(board: BoardState, player: PlayerId): number {
  let max = 0;
  forEachRun(board, player, ({ count }) => {
    if (count > max) max = count;
  });
  return max;
}

/**
 * Scores how a cell contributes to patterns in one direction for one player.
 */
function lineScore(
  board: BoardState,
  coord: { x: number; y: number },
  dx: number,
  dy: number,
  player: PlayerId,
): number {
  // Count consecutive stones in positive direction
  let positive = 0;
  let cx = coord.x + dx;
  let cy = coord.y + dy;
  while (inBounds(cx, cy) && cellAt(board, cx, cy) === player) {
    positive++;
    cx += dx;
    cy += dy;
  }
  const positiveOpen = inBounds(cx, cy) && cellAt(board, cx, cy) === null;

  // Count consecutive stones in negative direction
  let negative = 0;
  cx = coord.x - dx;
  cy = coord.y - dy;
  while (inBounds(cx, cy) && cellAt(board, cx, cy) === player) {
    negative++;
    cx -= dx;
    cy -= dy;
  }
  const negativeOpen = inBounds(cx, cy) && cellAt(board, cx, cy) === null;

  const count = positive + negative + 1; // +1 for the cell itself
  let openEnds = 0;
  if (positiveOpen) openEnds++;
  if (negativeOpen) openEnds++;

  return patternScore(count, openEnds);
}

// ── Public API ──

export const WIN_SCORE = 1_000_000;

/**
 * Lightweight board evaluation for rollout termination.
 * Returns CPU's longest sequence advantage over opponent (scaled by 100).
 *
 * Note: This function is intended for MCTS rollout termination only,
 * not for expectiminimax leaf node evaluation.
 */
export function evaluateBoard(board: BoardState, cpuPlayer: PlayerId): number {
  const opponent = getNextPlayer(cpuPlayer);
  return (
    longestSequence(board, cpuPlayer) * 100 -
    longestSequence(board, opponent) * 100
  );
}

/**
 * Detects if `player` or their opponent has an "open 4-in-a-row"
 * (4 consecutive stones with at least one open end that can extend to 5).
 *
 * Returns:
 * - `{ type: "cpu_wins", cell }` if `player` has open 4 → cell completes to 5
 * - `{ type: "must_block", cell }` if opponent has open 4 → cell blocks them
 * - `{ type: null, cell: null }` if neither
 *
 * If both: cpu_wins takes priority.
 *
 * Note: If the opponent has a double-open-4 (both ends open), the returned
 * cell blocks only one end — the position is unblockable. However, the function
 * still returns the best-effort block cell for move ordering purposes.
 */
export function detectDecisiveMoment(
  board: BoardState,
  player: PlayerId,
): { type: "cpu_wins" | "must_block" | null; cell: Coordinate | null } {
  const opponent = getNextPlayer(player);

  const cpuWinCell = findOpen4Cell(board, player);
  if (cpuWinCell !== null) {
    return { type: "cpu_wins", cell: cpuWinCell };
  }

  const blockCell = findOpen4Cell(board, opponent);
  if (blockCell !== null) {
    return { type: "must_block", cell: blockCell };
  }

  return { type: null, cell: null };
}

/**
 * Finds the empty cell that would complete an open-4 run to 5 for the given player.
 * Returns the coordinate of that empty cell, or null if no such run exists.
 */
function findOpen4Cell(
  board: BoardState,
  player: PlayerId,
): Coordinate | null {
  for (const [dx, dy] of DIRECTIONS) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (cellAt(board, x, y) !== player) continue;

        // Only process if this cell is the START of a run in this direction
        const prevX = x - dx;
        const prevY = y - dy;
        if (inBounds(prevX, prevY) && cellAt(board, prevX, prevY) === player) {
          continue;
        }

        // Count consecutive stones in the positive direction
        let count = 0;
        let cx = x;
        let cy = y;
        while (inBounds(cx, cy) && cellAt(board, cx, cy) === player) {
          count++;
          cx += dx;
          cy += dy;
        }

        if (count !== 4) continue;

        // Check open ends — if either end is an empty cell, that's our decisive cell
        // End after the run (cx, cy is already past the last stone)
        if (inBounds(cx, cy) && cellAt(board, cx, cy) === null) {
          return { x: cx, y: cy };
        }
        // End before the run
        if (inBounds(prevX, prevY) && cellAt(board, prevX, prevY) === null) {
          return { x: prevX, y: prevY };
        }
      }
    }
  }
  return null;
}

/**
 * Fast single-cell score used for move ordering.
 * Considers how placing a stone at `coord` would contribute to patterns
 * for both the player (offence) and the opponent (defence).
 * Uses fixed weights (1.0) internally.
 */
export function scoreCellPlacement(
  board: BoardState,
  coord: Coordinate,
  player: PlayerId,
): number {
  const opponent = getNextPlayer(player);
  let offence = 0;
  let defence = 0;

  for (const [dx, dy] of DIRECTIONS) {
    offence += lineScore(board, coord, dx, dy, player);
    defence += lineScore(board, coord, dx, dy, opponent);
  }

  const createsWin = wouldCreateWinByPlacement(board, coord, player);
  const blocksWin = wouldCreateWinByPlacement(board, coord, opponent);
  const tactical =
    (createsWin ? WIN_SCORE * 0.85 : 0) +
    (blocksWin ? WIN_SCORE * 0.65 : 0);

  return offence + defence + tactical;
}

/**
 * Returns true if placing `player`'s stone at `coord` would create 5-in-a-row.
 */
export function wouldCreateWinByPlacement(
  board: BoardState,
  coord: Coordinate,
  player: PlayerId,
): boolean {
  if (!inBounds(coord.x, coord.y) || cellAt(board, coord.x, coord.y) !== null) {
    return false;
  }

  for (const [dx, dy] of DIRECTIONS) {
    let count = 1;

    let cx = coord.x + dx;
    let cy = coord.y + dy;
    while (inBounds(cx, cy) && cellAt(board, cx, cy) === player) {
      count++;
      cx += dx;
      cy += dy;
    }

    cx = coord.x - dx;
    cy = coord.y - dy;
    while (inBounds(cx, cy) && cellAt(board, cx, cy) === player) {
      count++;
      cx -= dx;
      cy -= dy;
    }

    if (count >= 5) {
      return true;
    }
  }

  return false;
}
