import type { BoardState, PlayerId } from "@pkg/shared/schemas";

/**
 * MCTS Node in the game tree
 *
 * The MCTS tree has this structure:
 * [Decision Node]  CPU chooses: N candidates (top-N cells from move-generator)
 *       ↓
 * [Chance Node]    P(N): random placement among N candidates
 *                  P(1-N): no stone placed, turn switches
 *       ↓
 * [Decision Node]  Opponent's turn ...
 *
 * A "move" in the MCTS tree = choose count N (1–5) → use the top-N ranked cells as candidates
 * MCTS chooses only the count N, NOT which cells (that's handled stochastically in rollout)
 */
export interface MctsNode {
  // Tree structure
  parent: MctsNode | null;
  children: MctsNode[]; // children[i] corresponds to count = i+1 (1..5)

  // Move that led to this node
  /** How many candidates were submitted when creating this node (null for root) */
  candidateCount: number | null;

  // Board state at this node
  /** The board state at this node */
  board: BoardState;
  /** Whose turn it is at this node */
  currentPlayer: PlayerId;

  // MCTS statistics
  /** Number of times this node has been visited */
  visits: number;
  /** Number of wins from the perspective of the parent player */
  wins: number;

  // Expansion state
  /** Candidate counts not yet expanded (initially [1,2,3,4,5]) */
  untriedCounts: number[];
}

/**
 * Factory function to create a new MCTS node
 *
 * @param board - The board state at this node
 * @param currentPlayer - Whose turn it is at this node
 * @param parent - The parent node (null for root)
 * @param candidateCount - How many candidates were submitted (null for root)
 * @returns A new MCTS node with initialized statistics and expansion state
 */
export function createMctsNode(
  board: BoardState,
  currentPlayer: PlayerId,
  parent: MctsNode | null,
  candidateCount: number | null,
): MctsNode {
  return {
    parent,
    children: [],
    candidateCount,
    board,
    currentPlayer,
    visits: 0,
    wins: 0,
    untriedCounts: [1, 2, 3, 4, 5],
  };
}
