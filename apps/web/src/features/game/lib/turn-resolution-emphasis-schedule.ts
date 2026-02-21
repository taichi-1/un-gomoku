export type EmphasisStopBeats = "none" | "last_two_long";

export interface TurnResolutionEmphasisStep {
  stepIndex: number;
  candidateIndex: number;
  rank: number;
  lap: number;
  isActive: boolean;
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface TurnResolutionEmphasisSchedule {
  steps: TurnResolutionEmphasisStep[];
  totalSteps: number;
  totalDurationMs: number;
}

interface CreateTurnResolutionEmphasisScheduleInput {
  candidateCount: number;
  lapCount: number;
  sequenceMs: number;
  stopBeats?: EmphasisStopBeats;
  stopCandidateIndex?: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createTurnResolutionEmphasisSchedule(
  input: CreateTurnResolutionEmphasisScheduleInput,
): TurnResolutionEmphasisSchedule {
  const stopBeats = input.stopBeats ?? "last_two_long";
  const safeCandidateCount = Math.max(1, input.candidateCount);
  const safeLapCount = Math.max(1, input.lapCount);
  const baseSequenceMs = Math.max(0, input.sequenceMs);
  const baseTotalSteps = safeCandidateCount * safeLapCount;
  const normalizedStopCandidateIndex =
    typeof input.stopCandidateIndex === "number" &&
    input.stopCandidateIndex >= 0 &&
    input.stopCandidateIndex < safeCandidateCount
      ? input.stopCandidateIndex
      : null;
  const lastBaseCandidateIndex = (baseTotalSteps - 1) % safeCandidateCount;
  const extraStepsNeeded =
    normalizedStopCandidateIndex === null
      ? 0
      : (normalizedStopCandidateIndex -
          lastBaseCandidateIndex +
          safeCandidateCount) %
        safeCandidateCount;
  const totalSteps = baseTotalSteps + extraStepsNeeded;
  const baseStepMs = baseSequenceMs / Math.max(1, baseTotalSteps);
  const sequenceMs = baseStepMs * totalSteps;

  const weights = Array.from({ length: totalSteps }, () => 1);

  if (stopBeats === "last_two_long" && totalSteps >= 2) {
    weights[totalSteps - 2] = (weights[totalSteps - 2] ?? 1) * 1.55;
    weights[totalSteps - 1] = (weights[totalSteps - 1] ?? 1) * 1.9;
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const safeTotalWeight = Math.max(0.0001, totalWeight);

  let elapsedMs = 0;
  const steps = Array.from({ length: totalSteps }, (_, stepIndex) => {
    const isLast = stepIndex === totalSteps - 1;
    const durationMs = isLast
      ? Math.max(0, sequenceMs - elapsedMs)
      : (sequenceMs * (weights[stepIndex] ?? 1)) / safeTotalWeight;
    const startMs = elapsedMs;
    const endMs = clamp(startMs + durationMs, startMs, sequenceMs);
    const candidateIndex = stepIndex % safeCandidateCount;

    elapsedMs = endMs;

    return {
      stepIndex,
      candidateIndex,
      rank: candidateIndex + 1,
      lap: Math.floor(stepIndex / safeCandidateCount) + 1,
      isActive:
        safeCandidateCount === 1 && totalSteps > 1 ? stepIndex % 2 === 0 : true,
      startMs,
      endMs,
      durationMs: endMs - startMs,
    };
  });

  return {
    steps,
    totalSteps,
    totalDurationMs: sequenceMs,
  };
}
