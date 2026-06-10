/**
 * CPU difficulty and persona configuration.
 *
 * The CPU now uses a single persona axis:
 * - attacker: pushes its own initiative
 * - defender: prioritizes not losing
 * - gambler: narrows candidates only when there is a real forcing line
 */

export type CpuDifficulty = "easy" | "medium" | "hard";

export type CpuTurnOrder = "first" | "second" | "random";

export type CpuPersona = "attacker" | "defender" | "gambler";

export type CpuSituation =
  | "immediateWin"
  | "mustBlockWin"
  | "attackReach"
  | "blockReach"
  | "neutral";

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
  /** CPU persona. */
  persona: CpuPersona;
  /** Weight applied to CPU's own score in evaluation (higher = more aggressive). */
  attackWeight: number;
  /** Weight applied to opponent's score in evaluation (higher = more defensive). */
  defenseWeight: number;
  /** Preference over candidate count choices by tactical situation. */
  candidateCountBias: Record<CpuSituation, CandidateCountBias>;
  /** Extra penalty on high failure-risk choices (higher = safer play). */
  riskAversion: number;
  /** Emphasis on immediate threat/opportunity terms during board evaluation. */
  threatBlockWeight: number;
  /** Value of having more stones on the board than the opponent. */
  stoneAdvantageWeight: number;
}

export const CPU_CONFIGS: Record<
  CpuDifficulty,
  Omit<
    CpuConfig,
    | "persona"
    | "attackWeight"
    | "defenseWeight"
    | "candidateCountBias"
    | "riskAversion"
    | "threatBlockWeight"
    | "stoneAdvantageWeight"
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

export const CPU_PERSONA_CONFIGS: Record<
  CpuPersona,
  Omit<
    CpuConfig,
    | "searchDepth"
    | "maxCandidateCells"
    | "evaluationNoise"
    | "thinkingDelayMs"
    | "candidateSelectionIntervalMs"
    | "postSelectionPauseMs"
  >
> = {
  attacker: {
    persona: "attacker",
    attackWeight: 1.32,
    defenseWeight: 1.04,
    threatBlockWeight: 1.18,
    riskAversion: 0.26,
    stoneAdvantageWeight: 1_800,
    candidateCountBias: {
      immediateWin: [11_000, 5_000, 1_500, -1_500, -4_000],
      mustBlockWin: [9_000, 4_200, 1_200, -1_600, -4_200],
      attackReach: [2_400, 4_500, 4_800, 2_800, 600],
      blockReach: [1_000, 2_200, 2_900, 2_100, 900],
      neutral: [200, 1_400, 2_800, 4_400, 5_600],
    },
  },
  defender: {
    persona: "defender",
    attackWeight: 1.02,
    defenseWeight: 1.4,
    threatBlockWeight: 1.6,
    riskAversion: 0.52,
    stoneAdvantageWeight: 2_100,
    candidateCountBias: {
      immediateWin: [10_000, 4_500, 1_000, -1_800, -4_500],
      mustBlockWin: [13_000, 5_200, 600, -2_600, -6_000],
      attackReach: [500, 1_800, 3_000, 4_200, 4_800],
      blockReach: [2_400, 4_000, 4_600, 3_000, 1_200],
      neutral: [600, 1_800, 3_600, 5_400, 7_000],
    },
  },
  gambler: {
    persona: "gambler",
    attackWeight: 1.26,
    defenseWeight: 0.98,
    threatBlockWeight: 1.02,
    riskAversion: 0.1,
    stoneAdvantageWeight: 1_600,
    candidateCountBias: {
      immediateWin: [14_000, 5_500, -500, -4_000, -7_000],
      mustBlockWin: [8_000, 2_200, -1_200, -3_500, -6_200],
      attackReach: [7_000, 4_500, 1_400, -1_800, -4_600],
      blockReach: [400, 1_600, 2_900, 2_500, 1_000],
      neutral: [400, 1_800, 3_600, 4_000, 3_200],
    },
  },
};
