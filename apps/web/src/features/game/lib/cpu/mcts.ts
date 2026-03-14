/**
 * MCTS (Monte Carlo Tree Search) core algorithm.
 *
 * Determines the best number of candidates (N) for the CPU to submit
 * by running MCTS within a time budget.
 */

import { placeStone } from "@pkg/core/board";
import { getNextPlayer } from "@pkg/core/game-state";
import { SUCCESS_PROBABILITY } from "@pkg/shared/constants";
import type { BoardState, Coordinate, PlayerId } from "@pkg/shared/schemas";
import type { CpuConfig } from "./config";
import { generateCandidateCells } from "./move-generator";
import { createMctsNode, type MctsNode } from "./node";
import { runRollout } from "./rollout";

// ── Public types ──

export interface CpuMoveResult {
  candidates: Coordinate[];
}

// ── UCB1 selection ──

/**
 * Computes UCB1 score for a node.
 * Unvisited nodes return Infinity so they are always explored first.
 * Note: This is only called on non-root nodes, so parent is always non-null.
 */
function ucb1(node: MctsNode, explorationC: number): number {
  if (node.visits === 0) return Infinity;
  const exploitation = node.wins / node.visits;
  const exploration =
    explorationC * Math.sqrt(Math.log(node.parent?.visits) / node.visits);
  return exploitation + exploration;
}

/**
 * Selects a leaf node by walking the tree, always choosing the child
 * with the highest UCB1 score. Stops at nodes that still have untried counts.
 */
function select(root: MctsNode, explorationC: number): MctsNode {
  let node = root;
  while (node.untriedCounts.length === 0 && node.children.length > 0) {
    const firstChild = node.children[0];
    if (!firstChild) {
      break;
    }

    let best = firstChild;
    let bestScore = ucb1(best, explorationC);
    for (let i = 1; i < node.children.length; i++) {
      const child = node.children[i];
      if (!child) {
        continue;
      }

      const score = ucb1(child, explorationC);
      if (score > bestScore) {
        bestScore = score;
        best = child;
      }
    }
    node = best;
  }
  return node;
}

/**
 * Expands the node by picking a random untried count, creating a child node.
 * Simulates the probabilistic chance outcome based on the count.
 */
function expand(node: MctsNode, config: CpuConfig): MctsNode {
  const idx = Math.floor(Math.random() * node.untriedCounts.length);
  const count = node.untriedCounts[idx];
  if (count === undefined) {
    return node;
  }

  // Remove the chosen count from untried list
  node.untriedCounts.splice(idx, 1);

  // Get fresh candidate cells for this node's board/player
  const candidates = generateCandidateCells(
    node.board,
    node.currentPlayer,
    config.maxCandidateCells,
  ).slice(0, count);

  // Simulate probabilistic chance outcome
  const prob = SUCCESS_PROBABILITY[count] ?? 0.5;
  let childBoard = node.board;
  if (candidates.length > 0 && Math.random() < prob) {
    const cell = candidates[Math.floor(Math.random() * candidates.length)];
    if (cell) {
      childBoard = placeStone(node.board, cell, node.currentPlayer);
    }
  }
  // Failure case: childBoard stays as node.board, turn passes

  const child = createMctsNode(
    childBoard,
    getNextPlayer(node.currentPlayer),
    node,
    count,
  );
  node.children.push(child);
  return child;
}

/**
 * Backpropagates the rollout result up the tree.
 * Wins are tracked from the perspective of the player who will move at each node.
 */
function backpropagate(
  node: MctsNode,
  result: number,
  cpuPlayer: PlayerId,
): void {
  let current: MctsNode | null = node;
  while (current !== null) {
    current.visits += 1;
    // Win from this node's perspective: is the result favorable for the player moving here?
    const fromCpuPerspective = current.currentPlayer === cpuPlayer;
    current.wins += fromCpuPerspective
      ? result > 0
        ? 1
        : 0
      : result < 0
        ? 1
        : 0;
    current = current.parent;
  }
}

// ── Public API ──

/**
 * Computes the best move for the CPU using MCTS within the time budget.
 *
 * @param board - Current board state
 * @param cpuPlayer - The CPU's player ID
 * @param config - CPU configuration including time budget and exploration constant
 * @returns The ranked candidate cells (top-N) chosen by MCTS
 */
export function computeBestMove(
  board: BoardState,
  cpuPlayer: PlayerId,
  config: CpuConfig,
): CpuMoveResult {
  // 1. Generate ranked candidate cells
  const rankedCells = generateCandidateCells(
    board,
    cpuPlayer,
    config.maxCandidateCells,
  );

  // 2. Edge case: no candidates
  if (rankedCells.length === 0) {
    return { candidates: [] };
  }

  // 3. Edge case: only one candidate available
  if (rankedCells.length === 1) {
    return { candidates: rankedCells };
  }

  // 4. Create root node for current board state
  const root = createMctsNode(board, cpuPlayer, null, null);

  // 5. Run MCTS until time budget exhausted (check every 50 iterations)
  const deadline = Date.now() + config.maxTimeMs;
  let iterations = 0;

  do {
    // Selection: walk tree to a promising node
    const selected = select(root, config.explorationC);

    let rolloutNode: MctsNode;

    if (selected.untriedCounts.length > 0) {
      // Expansion: create a new child for an untried count
      rolloutNode = expand(selected, config);
    } else {
      // Fully expanded leaf — rollout from here
      rolloutNode = selected;
    }

    // Simulation: run rollout from the node's board state
    const result = runRollout(
      rolloutNode.board,
      rolloutNode.currentPlayer,
      cpuPlayer,
      config,
      config.rolloutDepthLimit,
    );

    // Backpropagation
    backpropagate(rolloutNode, result, cpuPlayer);

    iterations++;
    // Check time budget every 50 iterations to avoid expensive Date.now() calls
  } while (iterations % 50 !== 0 || Date.now() < deadline);

  // 6. Choose the count N with the most visits among root's children
  let bestCount = 3; // fallback if no children
  if (root.children.length > 0) {
    const firstChild = root.children[0];
    if (!firstChild) {
      return { candidates: rankedCells.slice(0, bestCount) };
    }

    let bestChild = firstChild;
    for (let i = 1; i < root.children.length; i++) {
      const child = root.children[i];
      if ((child?.visits ?? 0) > bestChild.visits && child) {
        bestChild = child;
      }
    }
    // candidateCount is the count chosen — clamp to valid range
    bestCount = Math.max(1, Math.min(5, bestChild.candidateCount ?? 3));
  }

  // 7. Return top-bestCount cells
  return { candidates: rankedCells.slice(0, bestCount) };
}
