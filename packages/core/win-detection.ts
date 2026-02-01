import { BOARD_SIZE, WIN_LENGTH } from "@pkg/shared/constants";
import type {
  BoardState,
  CellState,
  Coordinate,
  PlayerId,
} from "@pkg/shared/schemas";

/**
 * Direction vectors for checking win conditions.
 * Each tuple represents [dx, dy] for:
 * - Horizontal (right)
 * - Vertical (down)
 * - Diagonal (down-right)
 * - Diagonal (up-right)
 */
const DIRECTIONS: [number, number][] = [
  [1, 0], // horizontal
  [0, 1], // vertical
  [1, 1], // diagonal down-right
  [1, -1], // diagonal up-right
];

/**
 * Safely retrieves the cell state at the given coordinates.
 * Returns undefined if the coordinates are out of bounds.
 *
 * @param board - The current board state
 * @param x - The x coordinate
 * @param y - The y coordinate
 * @returns The cell state at (x, y) or undefined if out of bounds
 */
function getCell(
  board: BoardState,
  x: number,
  y: number,
): CellState | undefined {
  if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) {
    return undefined;
  }
  return board[y]?.[x];
}

/**
 * Checks if placing a stone at the given coordinate results in a win for the player.
 * Checks all four directions (horizontal, vertical, and both diagonals).
 *
 * @param board - The current board state (should include the newly placed stone)
 * @param coord - The coordinate of the last placed stone
 * @param player - The player who placed the stone
 * @returns true if the player has WIN_LENGTH or more stones in a row
 */
export function checkWinAt(
  board: BoardState,
  coord: Coordinate,
  player: PlayerId,
): boolean {
  for (const [dx, dy] of DIRECTIONS) {
    if (dx === undefined || dy === undefined) continue;
    let count = 1;

    // Check positive direction
    for (let i = 1; i < WIN_LENGTH; i++) {
      const cell = getCell(board, coord.x + dx * i, coord.y + dy * i);
      if (cell === player) {
        count++;
      } else {
        break;
      }
    }

    // Check negative direction
    for (let i = 1; i < WIN_LENGTH; i++) {
      const cell = getCell(board, coord.x - dx * i, coord.y - dy * i);
      if (cell === player) {
        count++;
      } else {
        break;
      }
    }

    if (count >= WIN_LENGTH) {
      return true;
    }
  }
  return false;
}

/**
 * Scans the entire board to find a winner.
 * Checks every cell that contains a stone to see if it's part of a winning line.
 *
 * @param board - The current board state
 * @returns The winning player ID, or null if no winner found
 */
export function findWinner(board: BoardState): PlayerId | null {
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row = board[y];
    if (!row) continue;
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = row[x];
      if (
        cell !== null &&
        cell !== undefined &&
        checkWinAt(board, { x, y }, cell)
      ) {
        return cell;
      }
    }
  }
  return null;
}
