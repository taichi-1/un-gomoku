import { SUCCESS_PROBABILITY } from "./constants";
import type { Coordinate } from "./schemas";

/** Random function returning [0, 1). Defaults to Math.random. */
export type RandomFn = () => number;

/**
 * Determines if stone placement succeeds based on candidate count and probability.
 *
 * @param candidateCount - Number of candidates (1-5)
 * @param random - Optional random function for testing (default: Math.random)
 */
export function calculateSuccess(
  candidateCount: number,
  random: RandomFn = Math.random,
): boolean {
  const probability = SUCCESS_PROBABILITY[candidateCount];
  if (probability === undefined) {
    return false;
  }
  return random() < probability;
}

/**
 * Selects one candidate at random from the array.
 *
 * @param candidates - Array of coordinates
 * @param random - Optional random function for testing (default: Math.random)
 */
export function selectRandomCandidate(
  candidates: Coordinate[],
  random: RandomFn = Math.random,
): Coordinate {
  const index = Math.floor(random() * candidates.length);
  const candidate = candidates[index];
  if (!candidate) {
    throw new Error("No candidates available");
  }
  return candidate;
}
