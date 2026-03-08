/**
 * Expectiminimax search for probabilistic Gomoku.
 *
 * Tree structure per ply:
 *   MAX/MIN node  →  chooses candidate count N (1-5)
 *   CHANCE node   →  P(N) success (random placement among N cells)
 *                    + (1-P(N)) failure (turn switches, board unchanged)
 *
 * Alpha-beta pruning is applied at MAX/MIN nodes.
 * CHANCE nodes compute the full weighted average (branching ≤ 6).
 */

import { placeStone } from "@pkg/core/board";
import { getNextPlayer } from "@pkg/core/game-state";
import { checkWinAt } from "@pkg/core/win-detection";
import { MAX_CANDIDATES, SUCCESS_PROBABILITY } from "@pkg/shared/constants";
import type { BoardState, Coordinate, PlayerId } from "@pkg/shared/schemas";
import type { CpuConfig } from "./config";
import { evaluateBoard, WIN_SCORE } from "./evaluation";
import { generateCandidateCells } from "./move-generator";

// ── Public API ──

export interface CpuMoveResult {
  candidates: Coordinate[];
}

/**
 * Computes the best candidates for the CPU to submit this turn.
 */
export function computeBestMove(
  board: BoardState,
  cpuPlayer: PlayerId,
  config: CpuConfig,
): CpuMoveResult {
  const rankedCells = generateCandidateCells(
    board,
    cpuPlayer,
    config.maxCandidateCells,
  );

  if (rankedCells.length === 0) {
    return { candidates: [] };
  }

  // Single cell available — no choice
  if (rankedCells.length === 1) {
    return { candidates: rankedCells };
  }

  let bestValue = -Infinity;
  let bestCount = 1;

  const maxCount = Math.min(MAX_CANDIDATES, rankedCells.length);

  for (let n = 1; n <= maxCount; n++) {
    const subset = rankedCells.slice(0, n);
    const ev = chanceNode(
      board,
      config.searchDepth,
      cpuPlayer,
      cpuPlayer,
      subset,
      -Infinity,
      Infinity,
      config,
    );

    if (ev > bestValue) {
      bestValue = ev;
      bestCount = n;
    }
  }

  return { candidates: rankedCells.slice(0, bestCount) };
}

// ── CHANCE node ──

function chanceNode(
  board: BoardState,
  depth: number,
  currentPlayer: PlayerId,
  cpuPlayer: PlayerId,
  candidates: Coordinate[],
  alpha: number,
  beta: number,
  config: CpuConfig,
): number {
  const n = candidates.length;
  const successProb = SUCCESS_PROBABILITY[n] ?? 0.5;
  const failureProb = 1 - successProb;

  // ── Failure branch: no stone placed, turn switches ──
  let failureValue: number;
  if (depth <= 1) {
    failureValue = evaluateBoard(board, cpuPlayer, config.evaluationNoise);
  } else {
    const nextPlayer = getNextPlayer(currentPlayer);
    const nextIsMax = nextPlayer === cpuPlayer;
    failureValue = nextIsMax
      ? maxNode(board, depth - 1, nextPlayer, cpuPlayer, alpha, beta, config)
      : minNode(board, depth - 1, nextPlayer, cpuPlayer, alpha, beta, config);
  }

  // ── Success branches: one candidate placed at random ──
  let successSum = 0;
  for (const candidate of candidates) {
    const nextBoard = placeStone(board, candidate, currentPlayer);

    // Check for win
    if (checkWinAt(nextBoard, candidate, currentPlayer)) {
      const winVal = currentPlayer === cpuPlayer ? WIN_SCORE : -WIN_SCORE;
      successSum += winVal;
      continue;
    }

    if (depth <= 1) {
      successSum += evaluateBoard(nextBoard, cpuPlayer, config.evaluationNoise);
      continue;
    }

    const nextPlayer = getNextPlayer(currentPlayer);
    const nextIsMax = nextPlayer === cpuPlayer;
    const val = nextIsMax
      ? maxNode(
          nextBoard,
          depth - 1,
          nextPlayer,
          cpuPlayer,
          alpha,
          beta,
          config,
        )
      : minNode(
          nextBoard,
          depth - 1,
          nextPlayer,
          cpuPlayer,
          alpha,
          beta,
          config,
        );
    successSum += val;
  }

  const successAvg = successSum / n;
  return successProb * successAvg + failureProb * failureValue;
}

// ── MAX node (CPU's turn) ──

function maxNode(
  board: BoardState,
  depth: number,
  currentPlayer: PlayerId,
  cpuPlayer: PlayerId,
  alpha: number,
  beta: number,
  config: CpuConfig,
): number {
  const cells = generateCandidateCells(
    board,
    currentPlayer,
    config.maxCandidateCells,
  );
  if (cells.length === 0) {
    return evaluateBoard(board, cpuPlayer, config.evaluationNoise);
  }

  let best = -Infinity;
  const maxCount = Math.min(MAX_CANDIDATES, cells.length);

  for (let n = 1; n <= maxCount; n++) {
    const subset = cells.slice(0, n);
    const ev = chanceNode(
      board,
      depth,
      currentPlayer,
      cpuPlayer,
      subset,
      alpha,
      beta,
      config,
    );

    if (ev > best) best = ev;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break; // beta cutoff
  }

  return best;
}

// ── MIN node (opponent's turn) ──

function minNode(
  board: BoardState,
  depth: number,
  currentPlayer: PlayerId,
  cpuPlayer: PlayerId,
  alpha: number,
  beta: number,
  config: CpuConfig,
): number {
  const cells = generateCandidateCells(
    board,
    currentPlayer,
    config.maxCandidateCells,
  );
  if (cells.length === 0) {
    return evaluateBoard(board, cpuPlayer, config.evaluationNoise);
  }

  let best = Infinity;
  const maxCount = Math.min(MAX_CANDIDATES, cells.length);

  for (let n = 1; n <= maxCount; n++) {
    const subset = cells.slice(0, n);
    const ev = chanceNode(
      board,
      depth,
      currentPlayer,
      cpuPlayer,
      subset,
      alpha,
      beta,
      config,
    );

    if (ev < best) best = ev;
    if (best < beta) beta = best;
    if (alpha >= beta) break; // alpha cutoff
  }

  return best;
}
