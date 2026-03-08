/**
 * CPU difficulty configuration.
 *
 * Adjust numbers here to tune AI behaviour per difficulty level.
 * Every other CPU module reads from this file — no magic numbers elsewhere.
 */

export type CpuDifficulty = "easy" | "medium" | "hard";

export type CpuTurnOrder = "first" | "second" | "random";

export interface CpuConfig {
  /** How many half-turns the search tree explores (1 = my move only). */
  searchDepth: number;
  /** Upper bound on candidate cells the move generator returns. */
  maxCandidateCells: number;
  /** Noise multiplied into the evaluation score (0 = perfect, higher = chaotic). */
  evaluationNoise: number;
  /** Post-animation lingering pause in ms before CPU starts picking candidates (余韻). */
  thinkingDelayMs: number;
  /** Interval in ms between each CPU candidate appearing one-by-one. */
  candidateSelectionIntervalMs: number;
  /** Pause in ms after all candidates are shown, before turn resolution. */
  postSelectionPauseMs: number;
}

export const CPU_CONFIGS: Record<CpuDifficulty, CpuConfig> = {
  easy: {
    searchDepth: 1,
    maxCandidateCells: 8,
    evaluationNoise: 0.4,
    thinkingDelayMs: 600,
    candidateSelectionIntervalMs: 350,
    postSelectionPauseMs: 400,
  },
  medium: {
    searchDepth: 2,
    maxCandidateCells: 12,
    evaluationNoise: 0.1,
    thinkingDelayMs: 800,
    candidateSelectionIntervalMs: 300,
    postSelectionPauseMs: 450,
  },
  hard: {
    searchDepth: 3,
    maxCandidateCells: 15,
    evaluationNoise: 0,
    thinkingDelayMs: 1000,
    candidateSelectionIntervalMs: 250,
    postSelectionPauseMs: 500,
  },
};
