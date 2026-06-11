/** Flat-board win detection and tactical cell scanning (mirrors ml rules). */

import { BOARD_SIZE, WIN_LENGTH } from "@pkg/shared/constants";
import { CELLS, cellXY, EMPTY } from "./types";

const DIRECTIONS: [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/** Win check on a flat board; mirrors packages/core/win-detection.ts. */
export function checkWinAtFlat(
  board: Int8Array,
  cell: number,
  stone: number,
): boolean {
  const { x, y } = cellXY(cell);
  for (const [dx, dy] of DIRECTIONS) {
    let count = 1;
    for (let i = 1; i < WIN_LENGTH; i++) {
      const cx = x + dx * i;
      const cy = y + dy * i;
      if (
        cx < 0 ||
        cx >= BOARD_SIZE ||
        cy < 0 ||
        cy >= BOARD_SIZE ||
        board[cy * BOARD_SIZE + cx] !== stone
      ) {
        break;
      }
      count++;
    }
    for (let i = 1; i < WIN_LENGTH; i++) {
      const cx = x - dx * i;
      const cy = y - dy * i;
      if (
        cx < 0 ||
        cx >= BOARD_SIZE ||
        cy < 0 ||
        cy >= BOARD_SIZE ||
        board[cy * BOARD_SIZE + cx] !== stone
      ) {
        break;
      }
      count++;
    }
    if (count >= WIN_LENGTH) return true;
  }
  return false;
}

export function isBoardFullFlat(board: Int8Array): boolean {
  for (let i = 0; i < CELLS; i++) {
    if (board[i] === EMPTY) return false;
  }
  return true;
}

/** Empty cells where placing `stone` wins immediately. */
export function winningCellsFlat(board: Int8Array, stone: number): number[] {
  const wins: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    if (board[i] !== EMPTY) continue;
    board[i] = stone;
    if (checkWinAtFlat(board, i, stone)) wins.push(i);
    board[i] = EMPTY;
  }
  return wins;
}

const MAX_FORCING_CANDIDATES = 12;

/** Cells that would create at least one NEW winning cell, with their counts. */
function threatCreatingCells(
  board: Int8Array,
  stone: number,
): Map<number, number> {
  const before = new Set(winningCellsFlat(board, stone));
  const out = new Map<number, number>();
  for (let cell = 0; cell < CELLS; cell++) {
    if (board[cell] !== EMPTY) continue;
    board[cell] = stone;
    let created = 0;
    for (const w of winningCellsFlat(board, stone)) {
      if (!before.has(w)) created++;
    }
    board[cell] = EMPTY;
    if (created > 0) out.set(cell, created);
  }
  return out;
}

function forcedWinAfter(
  board: Int8Array,
  stone: number,
  depth: number,
  opponent: number,
): boolean {
  if (depth <= 0) return false;
  if (winningCellsFlat(board, stone).length > 0) return true;
  const threats = threatCreatingCells(board, stone);
  const candidates = [...threats.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_FORCING_CANDIDATES);
  for (const [cell] of candidates) {
    board[cell] = stone;
    const wins = winningCellsFlat(board, stone);
    let found = false;
    if (wins.length >= 2) {
      found = true;
    } else if (wins.length === 1) {
      const w = wins[0] as number;
      board[w] = opponent;
      if (
        winningCellsFlat(board, opponent).length === 0 &&
        forcedWinAfter(board, stone, depth - 1, opponent)
      ) {
        found = true;
      }
      board[w] = EMPTY;
    }
    board[cell] = EMPTY;
    if (found) return true;
  }
  return false;
}

/**
 * Empty cells initiating a forced win within `depth` forcing moves —
 * win-now cells, double-threat cells (depth 1), and deeper forcing chains.
 * Conservative: a forced block that creates a counter-threat aborts the
 * line. Mirrors ml rules/solver.py forcing_win_cells. Root-only cost.
 */
export function forcingWinCellsFlat(
  board: Int8Array,
  stone: number,
  depth: number,
): number[] {
  if (depth <= 0) return [];
  const opponent = stone === 1 ? 2 : 1;
  const out = new Set<number>(winningCellsFlat(board, stone));
  const threats = threatCreatingCells(board, stone);
  const candidates = [...threats.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_FORCING_CANDIDATES);
  for (const [cell] of candidates) {
    if (out.has(cell)) continue;
    board[cell] = stone;
    const wins = winningCellsFlat(board, stone);
    if (wins.length >= 2) {
      out.add(cell);
    } else if (wins.length === 1 && depth >= 2) {
      const w = wins[0] as number;
      board[w] = opponent;
      if (
        winningCellsFlat(board, opponent).length === 0 &&
        forcedWinAfter(board, stone, depth - 1, opponent)
      ) {
        out.add(cell);
      }
      board[w] = EMPTY;
    }
    board[cell] = EMPTY;
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Empty cells where placing `stone` yields two or more simultaneous winning
 * cells (a double threat — almost unstoppable next turn). Root-only cost:
 * one full scan per move. Mirrors ml rules/tactics.py double_threat_cells.
 */
export function doubleThreatCellsFlat(
  board: Int8Array,
  stone: number,
): number[] {
  const before = new Set(winningCellsFlat(board, stone));
  const result: number[] = [];
  for (let cell = 0; cell < CELLS; cell++) {
    if (board[cell] !== EMPTY) continue;
    board[cell] = stone;
    let threats = 0;
    let created = false;
    for (let w = 0; w < CELLS && (threats < 2 || !created); w++) {
      if (board[w] !== EMPTY) continue;
      board[w] = stone;
      if (checkWinAtFlat(board, w, stone)) {
        threats++;
        if (!before.has(w)) created = true;
      }
      board[w] = EMPTY;
    }
    board[cell] = EMPTY;
    // Must create at least one NEW threat and end with two simultaneously
    // (positions with two pre-existing wins are the forced-win logic's job).
    if (threats >= 2 && created) result.push(cell);
  }
  return result;
}
