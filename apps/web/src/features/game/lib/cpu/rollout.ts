/**
 * MCTS rollout (simulation) phase.
 *
 * Plays out a game from the given board state using archetype-specific
 * candidate-count policies, returning a score from the CPU's perspective.
 */

import { placeStone } from "@pkg/core/board";
import { getNextPlayer } from "@pkg/core/game-state";
import { checkWinAt } from "@pkg/core/win-detection";
import { BOARD_SIZE, SUCCESS_PROBABILITY } from "@pkg/shared/constants";
import type { BoardState, PlayerId } from "@pkg/shared/schemas";
import type { CpuConfig } from "./config";
import {
  detectDecisiveMoment,
  evaluateBoard,
  longestSequence,
  WIN_SCORE,
} from "./evaluation";
import { generateCandidateCells } from "./move-generator";

// ── Internal helpers ──

function isBoardFull(board: BoardState): boolean {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y]?.[x] == null) return false;
    }
  }
  return true;
}

/**
 * Determines the candidate count N for a single rollout step based on the CPU archetype.
 */
function pickCandidateCount(
  board: BoardState,
  currentPlayer: PlayerId,
  config: CpuConfig,
): number {
  switch (config.archetype) {
    case "attacker": {
      const longest = longestSequence(board, currentPlayer);
      if (longest >= 3) {
        // Bias toward fewer candidates (aggressive exploitation)
        return Math.random() < 0.5 ? 1 : 2;
      } else {
        return Math.random() < 0.5 ? 3 : 4;
      }
    }

    case "guardian": {
      // Always prefer higher counts (more conservative / defensive)
      return Math.random() < 0.5 ? 4 : 5;
    }

    case "gambler": {
      const { type } = detectDecisiveMoment(board, currentPlayer);
      if (type !== null) {
        // Decisive moment detected — bet everything on one candidate
        return 1;
      }
      // Otherwise pick randomly from {3, 4, 5}
      const roll = Math.random();
      if (roll < 1 / 3) return 3;
      if (roll < 2 / 3) return 4;
      return 5;
    }
  }
}

// ── Public API ──

/**
 * Runs a single MCTS rollout simulation from the given board state.
 *
 * @param board - Current board state at the start of rollout
 * @param currentPlayer - The player whose turn it is
 * @param cpuPlayer - The CPU player (perspective for scoring)
 * @param config - CPU configuration (archetype, depth limits, etc.)
 * @param depthLimit - Maximum number of moves to simulate
 * @returns +1 (CPU wins), -1 (CPU loses), 0 (draw/inconclusive)
 */
export function runRollout(
  board: BoardState,
  currentPlayer: PlayerId,
  cpuPlayer: PlayerId,
  config: CpuConfig,
  depthLimit: number,
): number {
  let currentBoard = board;
  let player = currentPlayer;
  let depth = depthLimit;

  while (depth > 0) {
    // Terminal: board full
    if (isBoardFull(currentBoard)) return 0;

    // Determine candidate count N for this step
    const n = pickCandidateCount(currentBoard, player, config);

    // Get top-N candidate cells
    const candidates = generateCandidateCells(
      currentBoard,
      player,
      config.maxCandidateCells,
    ).slice(0, n);

    // No candidates available — stuck (draw)
    if (candidates.length === 0) return 0;

    // Probabilistic outcome based on count
    const prob = SUCCESS_PROBABILITY[candidates.length] ?? 0.7;

    if (Math.random() < prob) {
      // Success: pick a random cell from candidates and place stone
      const cell = candidates[Math.floor(Math.random() * candidates.length)];
      if (!cell) return 0;

      const newBoard = placeStone(currentBoard, cell, player);

      // Check for win
      if (checkWinAt(newBoard, cell, player)) {
        return player === cpuPlayer ? 1 : -1;
      }

      currentBoard = newBoard;
    }
    // Failure: no stone placed, turn passes

    player = getNextPlayer(player);
    depth--;
  }

  // Depth limit reached — evaluate board heuristically
  const score = evaluateBoard(currentBoard, cpuPlayer);
  if (score > 0) return Math.min(1, score / WIN_SCORE);
  if (score < 0) return Math.max(-1, score / WIN_SCORE);
  return 0;
}
