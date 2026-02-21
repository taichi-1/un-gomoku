import { SUCCESS_PROBABILITY } from "@pkg/shared/constants";
import type { TurnResultDTO } from "@pkg/shared/schemas";

export type LuckLabelKey =
  | "veryLucky"
  | "lucky"
  | "expected"
  | "unlucky"
  | "veryUnlucky";

export interface PlayerLuckFeedback {
  totalTurns: number;
  successCount: number;
  expectedSuccess: number;
  luckDelta: number;
  luckDeltaRate: number;
  successRate: number;
  luckLabelKey: LuckLabelKey;
}

export interface LuckFeedback {
  player1: PlayerLuckFeedback;
  player2: PlayerLuckFeedback;
}

interface PlayerLuckAccumulator {
  totalTurns: number;
  successCount: number;
  expectedSuccess: number;
  varianceSum: number;
}

const INITIAL_ACCUMULATOR: PlayerLuckAccumulator = {
  totalTurns: 0,
  successCount: 0,
  expectedSuccess: 0,
  varianceSum: 0,
};

export function resolveLuckLabelKeyFromZScore(zScore: number): LuckLabelKey {
  if (zScore >= 1.2) {
    return "veryLucky";
  }
  if (zScore >= 0.4) {
    return "lucky";
  }
  if (zScore > -0.4) {
    return "expected";
  }
  if (zScore > -1.2) {
    return "unlucky";
  }
  return "veryUnlucky";
}

function finalizePlayerLuckFeedback(
  accumulator: PlayerLuckAccumulator,
): PlayerLuckFeedback {
  const luckDelta = accumulator.successCount - accumulator.expectedSuccess;
  const luckDeltaRate =
    accumulator.totalTurns > 0
      ? ((accumulator.successCount - accumulator.expectedSuccess) /
          accumulator.totalTurns) *
        100
      : 0;
  const zScore =
    accumulator.varianceSum > 0
      ? luckDelta / Math.sqrt(accumulator.varianceSum)
      : 0;

  return {
    totalTurns: accumulator.totalTurns,
    successCount: accumulator.successCount,
    expectedSuccess: accumulator.expectedSuccess,
    luckDelta,
    luckDeltaRate,
    successRate:
      accumulator.totalTurns > 0
        ? accumulator.successCount / accumulator.totalTurns
        : 0,
    luckLabelKey: resolveLuckLabelKeyFromZScore(zScore),
  };
}

export function calculateLuckFeedback(
  turnHistory: TurnResultDTO[],
): LuckFeedback {
  const player1 = { ...INITIAL_ACCUMULATOR };
  const player2 = { ...INITIAL_ACCUMULATOR };

  for (const turn of turnHistory) {
    const accumulator = turn.player === "player1" ? player1 : player2;
    const probability = SUCCESS_PROBABILITY[turn.candidates.length] ?? 0;

    accumulator.totalTurns += 1;
    if (turn.success) {
      accumulator.successCount += 1;
    }
    accumulator.expectedSuccess += probability;
    accumulator.varianceSum += probability * (1 - probability);
  }

  return {
    player1: finalizePlayerLuckFeedback(player1),
    player2: finalizePlayerLuckFeedback(player2),
  };
}
