/**
 * CPU difficulty configuration.
 *
 * Adjust numbers here to tune AI behaviour per difficulty level.
 * Every other CPU module reads from this file — no magic numbers elsewhere.
 */

export type CpuDifficulty = "easy" | "medium" | "hard";

export type CpuTurnOrder = "first" | "second" | "random";

export type CpuStyle = "rush" | "balanced" | "guard";

export type CpuRisk = "safe" | "balanced" | "bold";

/** Bias added to evaluation by candidate count index 1..5. */
export type CandidateCountBias = readonly [
  number,
  number,
  number,
  number,
  number,
];

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
  /** Weight applied to CPU's own score in evaluation (higher = more aggressive). */
  attackWeight: number;
  /** Weight applied to opponent's score in evaluation (higher = more defensive). */
  defenseWeight: number;
  /** Preference over candidate count choices (index 0 == 1 candidate, 4 == 5 candidates). */
  candidateCountBias: CandidateCountBias;
  /** Extra penalty on high failure-risk choices (higher = safer play). */
  riskAversion: number;
  /** Emphasis on immediate threat/opportunity terms during board evaluation. */
  threatBlockWeight: number;
}

export const CPU_CONFIGS: Record<
  CpuDifficulty,
  Omit<
    CpuConfig,
    | "attackWeight"
    | "defenseWeight"
    | "candidateCountBias"
    | "riskAversion"
    | "threatBlockWeight"
  >
> = {
  easy: {
    searchDepth: 1,
    maxCandidateCells: 10,
    evaluationNoise: 0.35,
    thinkingDelayMs: 600,
    candidateSelectionIntervalMs: 350,
    postSelectionPauseMs: 400,
  },
  medium: {
    searchDepth: 2,
    maxCandidateCells: 14,
    evaluationNoise: 0.08,
    thinkingDelayMs: 800,
    candidateSelectionIntervalMs: 300,
    postSelectionPauseMs: 450,
  },
  hard: {
    searchDepth: 3,
    maxCandidateCells: 18,
    evaluationNoise: 0,
    thinkingDelayMs: 1000,
    candidateSelectionIntervalMs: 250,
    postSelectionPauseMs: 500,
  },
};

export const CPU_STYLE_CONFIGS: Record<
  CpuStyle,
  {
    attackWeight: number;
    defenseWeight: number;
    threatBlockWeight: number;
  }
> = {
  rush: {
    attackWeight: 1.4,
    defenseWeight: 0.9,
    threatBlockWeight: 0.95,
  },
  balanced: {
    attackWeight: 1.08,
    defenseWeight: 1.15,
    threatBlockWeight: 1.25,
  },
  guard: {
    attackWeight: 0.86,
    defenseWeight: 1.45,
    threatBlockWeight: 1.6,
  },
};

export const CPU_RISK_CONFIGS: Record<
  CpuRisk,
  {
    candidateCountBias: CandidateCountBias;
    riskAversion: number;
  }
> = {
  safe: {
    candidateCountBias: [-3_000, -1_500, 1_000, 3_000, 5_000],
    riskAversion: 0.72,
  },
  balanced: {
    candidateCountBias: [1_000, 1_800, 2_000, 1_500, 800],
    riskAversion: 0.35,
  },
  bold: {
    candidateCountBias: [6_000, 3_200, 1_000, -1_000, -2_600],
    riskAversion: 0.12,
  },
};
