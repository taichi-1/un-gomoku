import { BOARD_SIZE } from "@pkg/shared/constants";
import type {
  BoardState,
  CellState,
  Coordinate,
  PlayerId,
} from "@pkg/shared/schemas";

/**
 * Creates an empty game board.
 * All cells are initialized to null (empty).
 *
 * @returns A BOARD_SIZE x BOARD_SIZE 2D array filled with null values
 */
export function createEmptyBoard(): BoardState {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from<CellState>({ length: BOARD_SIZE }).fill(null),
  );
}

/**
 * Places a stone on the board for the specified player.
 * Returns a new board without mutating the original.
 *
 * @param board - The current board state
 * @param coord - The coordinate where the stone should be placed
 * @param player - The player placing the stone
 * @returns A new board with the stone placed at the specified position
 */
export function placeStone(
  board: BoardState,
  coord: Coordinate,
  player: PlayerId,
): BoardState {
  const newBoard = board.map((row) => [...row]);
  const row = newBoard[coord.y];
  if (row) {
    row[coord.x] = player;
  }
  return newBoard;
}

/**
 * Removes a stone from the board at the specified position.
 * Returns a new board without mutating the original.
 *
 * @param board - The current board state
 * @param coord - The coordinate where the stone should be removed
 * @returns A new board with the stone removed
 */
export function removeStone(board: BoardState, coord: Coordinate): BoardState {
  const newBoard = board.map((row) => [...row]);
  const row = newBoard[coord.y];
  if (row) {
    row[coord.x] = null;
  }
  return newBoard;
}
