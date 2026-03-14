/**
 * CPU archetype configuration.
 *
 * The archetype-based system replaces the old style×risk approach.
 * Each archetype has different UCB1 exploration constants and decisiveness thresholds.
 *
 * Difficulty levels provide the base time budget, depth limits, and UI timings.
 * Archetypes modulate the exploration strategy and decisiveness behavior.
 */

export type CpuDifficulty = "easy" | "medium" | "hard";

export type CpuTurnOrder = "first" | "second" | "random";

export type CpuArchetype = "attacker" | "guardian" | "gambler";

export interface CpuConfig {
  /** Playing archetype (how the CPU behaves strategically). */
  archetype: CpuArchetype;
  /** Difficulty level (time budget and search scope). */
  difficulty: CpuDifficulty;
  /** Time budget for MCTS search in milliseconds. */
  maxTimeMs: number;
  /** UCB1 exploration constant (higher = more exploration, lower = more exploitation). */
  explorationC: number;
  /** Maximum rollout depth before partial evaluation. */
  rolloutDepthLimit: number;
  /** Upper bound on candidate cells the move generator returns. */
  maxCandidateCells: number;
  /** Score gap threshold for gambler archetype to trigger 1-candidate bet (future use). */
  decisiveThreshold: number;
  /** Post-animation lingering pause in ms before CPU starts picking candidates (余韻). */
  thinkingDelayMs: number;
  /** Interval in ms between each CPU candidate appearing one-by-one. */
  candidateSelectionIntervalMs: number;
  /** Pause in ms after all candidates are shown, before turn resolution. */
  postSelectionPauseMs: number;
}

export const ARCHETYPE_CONFIGS: Record<
  CpuArchetype,
  {
    explorationC: number;
    decisiveThreshold: number;
  }
> = {
  attacker: {
    explorationC: 1.2,
    decisiveThreshold: 0,
  },
  guardian: {
    explorationC: 0.7,
    decisiveThreshold: 0,
  },
  gambler: {
    explorationC: 1.8,
    decisiveThreshold: 0.8,
  },
};

export const CPU_CONFIGS: Record<
  CpuDifficulty,
  Omit<CpuConfig, "archetype" | "explorationC" | "decisiveThreshold">
> = {
  easy: {
    difficulty: "easy",
    maxTimeMs: 300,
    rolloutDepthLimit: 20,
    maxCandidateCells: 10,
    thinkingDelayMs: 600,
    candidateSelectionIntervalMs: 350,
    postSelectionPauseMs: 400,
  },
  medium: {
    difficulty: "medium",
    maxTimeMs: 800,
    rolloutDepthLimit: 40,
    maxCandidateCells: 14,
    thinkingDelayMs: 800,
    candidateSelectionIntervalMs: 300,
    postSelectionPauseMs: 450,
  },
  hard: {
    difficulty: "hard",
    maxTimeMs: 1800,
    rolloutDepthLimit: 60,
    maxCandidateCells: 18,
    thinkingDelayMs: 1000,
    candidateSelectionIntervalMs: 250,
    postSelectionPauseMs: 500,
  },
};
