/**
 * Presentation pacing for CPU turns (lifted from the legacy cpu/config.ts so
 * the staged candidate-reveal UX is unchanged). Pure UI: independent of the
 * engine's compute budget.
 */

import type { CpuDifficulty } from "./types";

export interface CpuTurnTiming {
  /** Post-animation lingering pause before the CPU starts picking (余韻). */
  thinkingDelayMs: number;
  /** Interval between each CPU candidate appearing one-by-one. */
  candidateSelectionIntervalMs: number;
  /** Pause after all candidates are shown, before turn resolution. */
  postSelectionPauseMs: number;
}

export const CPU_TURN_TIMINGS: Record<CpuDifficulty, CpuTurnTiming> = {
  easy: {
    thinkingDelayMs: 600,
    candidateSelectionIntervalMs: 350,
    postSelectionPauseMs: 400,
  },
  medium: {
    thinkingDelayMs: 800,
    candidateSelectionIntervalMs: 300,
    postSelectionPauseMs: 450,
  },
  hard: {
    thinkingDelayMs: 1000,
    candidateSelectionIntervalMs: 250,
    postSelectionPauseMs: 500,
  },
};
