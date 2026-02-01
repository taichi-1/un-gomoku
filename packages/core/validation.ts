import { BOARD_SIZE, MAX_CANDIDATES } from "@pkg/shared/constants";
import type { BoardState, Coordinate } from "@pkg/shared/schemas";

/**
 * Checks if a coordinate is within the board boundaries.
 *
 * @param coord - The coordinate to check
 * @returns true if the coordinate is within [0, BOARD_SIZE) for both x and y
 */
export function isInBounds(coord: Coordinate): boolean {
  return (
    coord.x >= 0 && coord.x < BOARD_SIZE && coord.y >= 0 && coord.y < BOARD_SIZE
  );
}

/**
 * Checks if a cell at the given coordinate is empty.
 *
 * @param board - The current board state
 * @param coord - The coordinate to check
 * @returns true if the cell is empty (null), false if occupied or invalid
 */
export function isEmpty(board: BoardState, coord: Coordinate): boolean {
  const row = board[coord.y];
  if (!row) return false;
  return row[coord.x] === null;
}

/**
 * Checks if a coordinate is a valid candidate for stone placement.
 * A valid candidate must be within bounds and the cell must be empty.
 *
 * @param board - The current board state
 * @param coord - The coordinate to validate
 * @returns true if the coordinate is valid for placing a stone
 */
export function isValidCandidate(
  board: BoardState,
  coord: Coordinate,
): boolean {
  return isInBounds(coord) && isEmpty(board, coord);
}

export type CandidateValidationError =
  | "invalid_candidate_count"
  | "invalid_candidate_position";

export type CandidateValidationResult =
  | { ok: true }
  | { ok: false; error: CandidateValidationError };

/**
 * Validates the candidate list for a turn against count and board positions.
 *
 * @param board - The current board state
 * @param candidates - Candidate coordinates submitted by the player
 * @returns Validation result with error kind when invalid
 */
export function validateCandidates(
  board: BoardState,
  candidates: Coordinate[],
): CandidateValidationResult {
  if (candidates.length < 1 || candidates.length > MAX_CANDIDATES) {
    return { ok: false, error: "invalid_candidate_count" };
  }
  for (const coord of candidates) {
    if (!isValidCandidate(board, coord)) {
      return { ok: false, error: "invalid_candidate_position" };
    }
  }
  return { ok: true };
}
