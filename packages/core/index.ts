import {
  BOARD_SIZE,
  type BoardState,
  type CellState,
  type Coordinate,
  type GameStateDTO,
  type PlayerId,
  WIN_LENGTH,
} from "@pkg/shared";

// ===== Board Functions =====

export function createEmptyBoard(): BoardState {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from<CellState>({ length: BOARD_SIZE }).fill(null),
  );
}

export function createInitialGameState(): GameStateDTO {
  return {
    board: createEmptyBoard(),
    currentPlayer: "player1",
    phase: "waiting",
    winner: null,
    isDraw: false,
  };
}

// ===== Validation Functions =====

export function isInBounds(coord: Coordinate): boolean {
  return (
    coord.x >= 0 && coord.x < BOARD_SIZE && coord.y >= 0 && coord.y < BOARD_SIZE
  );
}

export function isEmpty(board: BoardState, coord: Coordinate): boolean {
  const row = board[coord.y];
  if (!row) return false;
  return row[coord.x] === null;
}

export function isValidCandidate(
  board: BoardState,
  coord: Coordinate,
): boolean {
  return isInBounds(coord) && isEmpty(board, coord);
}

// ===== Board Manipulation =====

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

// ===== Win Detection =====

const DIRECTIONS: [number, number][] = [
  [1, 0], // horizontal
  [0, 1], // vertical
  [1, 1], // diagonal down-right
  [1, -1], // diagonal up-right
];

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
      const nx = coord.x + dx * i;
      const ny = coord.y + dy * i;
      const row = board[ny];
      if (
        nx >= 0 &&
        nx < BOARD_SIZE &&
        ny >= 0 &&
        ny < BOARD_SIZE &&
        row &&
        row[nx] === player
      ) {
        count++;
      } else {
        break;
      }
    }

    // Check negative direction
    for (let i = 1; i < WIN_LENGTH; i++) {
      const nx = coord.x - dx * i;
      const ny = coord.y - dy * i;
      const row = board[ny];
      if (
        nx >= 0 &&
        nx < BOARD_SIZE &&
        ny >= 0 &&
        ny < BOARD_SIZE &&
        row &&
        row[nx] === player
      ) {
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

// ===== Game State Functions =====

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

export function getNextPlayer(currentPlayer: PlayerId): PlayerId {
  return currentPlayer === "player1" ? "player2" : "player1";
}
