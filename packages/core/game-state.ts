import { BOARD_SIZE } from "@pkg/shared/constants";
import type { BoardState, GameStateDTO, PlayerId } from "@pkg/shared/schemas";
import { createEmptyBoard } from "./board";

/**
 * Creates the initial game state with an empty board.
 * The game starts with player1's turn in the "waiting" phase.
 *
 * @returns The initial GameStateDTO with empty board and default values
 */
export function createInitialGameState(): GameStateDTO {
  return {
    board: createEmptyBoard(),
    currentPlayer: "player1",
    phase: "waiting",
    winner: null,
    isDraw: false,
    turnHistory: [],
  };
}

/**
 * Checks if the board is completely filled with stones.
 * Used to detect draw conditions.
 *
 * @param board - The current board state
 * @returns true if all cells are occupied, false otherwise
 */
export function isBoardFull(board: BoardState): boolean {
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row = board[y];
    if (!row) continue;
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (row[x] === null) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Returns the opponent of the current player.
 *
 * @param currentPlayer - The current player's ID
 * @returns The opponent's player ID
 */
export function getNextPlayer(currentPlayer: PlayerId): PlayerId {
  return currentPlayer === "player1" ? "player2" : "player1";
}
