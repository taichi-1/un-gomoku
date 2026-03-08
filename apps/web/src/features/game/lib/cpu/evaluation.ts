/**
 * Board evaluation heuristic for Gomoku.
 *
 * Scans every consecutive run of same-colour stones on the board,
 * classifies by length + open ends, and sums a pattern score table.
 */

import { getNextPlayer } from "@pkg/core/game-state";
import { BOARD_SIZE } from "@pkg/shared/constants";
import type { BoardState, PlayerId } from "@pkg/shared/schemas";

// ── Direction vectors (only "positive" half — we count backward from each run start) ──

const DIRECTIONS: readonly [number, number][] = [
  [1, 0], // horizontal
  [0, 1], // vertical
  [1, 1], // diagonal ↘
  [1, -1], // diagonal ↗
];

// ── Pattern score table ──
// Index: [count][openEnds]  (count capped at 5, openEnds 0/1/2)

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

// ── Per-player score (sum of all pattern scores) ──

function scoreForPlayer(board: BoardState, player: PlayerId): number {
  let total = 0;
  forEachRun(board, player, ({ count, openEnds }) => {
    total += patternScore(count, openEnds);
  });
  return total;
}

function scoreThreatsForPlayer(board: BoardState, player: PlayerId): number {
  let total = 0;
  forEachRun(board, player, ({ count, openEnds }) => {
    if (count >= 5) {
      total += 220_000;
      return;
    }
    if (count === 4 && openEnds === 2) {
      total += 95_000;
      return;
    }
    if (count === 4 && openEnds === 1) {
      total += 52_000;
      return;
    }
    if (count === 3 && openEnds === 2) {
      total += 13_000;
    }
  });
  return total;
}

// ── Public API ──

export const WIN_SCORE = 1_000_000;

/**
 * Evaluates the board from `cpuPlayer`'s perspective.
 * Positive = CPU advantage, negative = opponent advantage.
 */
export function evaluateBoard(
  board: BoardState,
  cpuPlayer: PlayerId,
  noise: number,
  attackWeight: number,
  defenseWeight: number,
  threatBlockWeight: number,
): number {
  const opponent = getNextPlayer(cpuPlayer);
  const cpuScore = scoreForPlayer(board, cpuPlayer);
  const oppScore = scoreForPlayer(board, opponent);
  const cpuThreat = scoreThreatsForPlayer(board, cpuPlayer);
  const oppThreat = scoreThreatsForPlayer(board, opponent);

  const raw =
    cpuScore * attackWeight -
    oppScore * defenseWeight +
    (cpuThreat - oppThreat) * threatBlockWeight;

  if (noise === 0) return raw;
  return raw * (1 + (Math.random() - 0.5) * noise);
}

/**
 * Fast single-cell score used for move ordering.
 * Considers how placing a stone at `coord` would contribute to patterns
 * for both the player (offence) and the opponent (defence).
 */
export function scoreCellPlacement(
  board: BoardState,
  coord: { x: number; y: number },
  player: PlayerId,
  attackWeight: number,
  defenseWeight: number,
  threatBlockWeight: number,
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
    (blocksWin ? WIN_SCORE * 0.65 * threatBlockWeight : 0);

  return offence * attackWeight + defence * defenseWeight + tactical;
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

function wouldCreateWinByPlacement(
  board: BoardState,
  coord: { x: number; y: number },
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
