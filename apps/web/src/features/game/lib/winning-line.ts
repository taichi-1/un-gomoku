import { BOARD_SIZE, WIN_LENGTH } from "@pkg/shared/constants";
import type { BoardState, Coordinate, PlayerId } from "@pkg/shared/schemas";

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

function getCell(board: BoardState, x: number, y: number) {
  if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) {
    return undefined;
  }
  return board[y]?.[x];
}

/**
 * Returns the contiguous winning line through the last placed stone,
 * or null when that stone does not complete a five-in-a-row.
 */
export function findWinningLine(
  board: BoardState,
  origin: Coordinate,
  player: PlayerId,
): Coordinate[] | null {
  if (getCell(board, origin.x, origin.y) !== player) {
    return null;
  }

  for (const [dx, dy] of DIRECTIONS) {
    const line: Coordinate[] = [{ x: origin.x, y: origin.y }];

    for (const sign of [1, -1]) {
      for (let step = 1; ; step++) {
        const x = origin.x + dx * step * sign;
        const y = origin.y + dy * step * sign;
        if (getCell(board, x, y) !== player) {
          break;
        }
        line.push({ x, y });
      }
    }

    if (line.length >= WIN_LENGTH) {
      return line;
    }
  }

  return null;
}
