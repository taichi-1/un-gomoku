// ===== Game Constants =====

/** The size of the game board (15x15 grid) */
export const BOARD_SIZE = 15;

/** Maximum number of candidate positions a player can select per turn */
export const MAX_CANDIDATES = 5;

/** Number of consecutive stones required to win */
export const WIN_LENGTH = 5;

/**
 * Success probability based on number of candidates selected
 * - 1 position -> 50% success
 * - 2 positions -> 60% success
 * - 3 positions -> 70% success
 * - 4 positions -> 80% success
 * - 5 positions -> 90% success
 */
export const SUCCESS_PROBABILITY: Record<number, number> = {
  1: 0.5,
  2: 0.6,
  3: 0.7,
  4: 0.8,
  5: 0.9,
};
