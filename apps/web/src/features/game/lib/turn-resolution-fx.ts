import type { TurnResultDTO } from "@pkg/shared/schemas";

const MIN_TOTAL_MS = 1000;
const MAX_TOTAL_MS = 1500;
const BASE_TOTAL_MS = 850;
const PER_CANDIDATE_MS = 90;
const SEQUENCE_RATIO = 0.72;

const REDUCED_MOTION_TOTAL_MS = 480;
const REDUCED_MOTION_SEQUENCE_MS = 180;

export interface TurnResolutionTimeline {
  totalMs: number;
  sequenceMs: number;
  finalMs: number;
  stepMs: number;
}

export interface TurnResolutionFxRuntime {
  result: TurnResultDTO;
  startedAtMs: number;
  timeline: TurnResolutionTimeline;
  reducedMotion: boolean;
}

export interface TurnResolutionFxState {
  result: TurnResultDTO;
  phase: "sequence" | "final";
  sequenceVisibleCount: number;
  sequenceActiveIndex: number | null;
  showFailureMarkers: boolean;
  showBoardMissFlash: boolean;
}

export type TurnHistoryFxDecision = "none" | "start_latest" | "skip_multiple";

interface TurnHistoryFxDecisionInput {
  isInitialized: boolean;
  previousLength: number;
  currentLength: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createTurnResolutionTimeline(
  candidateCount: number,
  reducedMotion = false,
): TurnResolutionTimeline {
  const safeCandidateCount = Math.max(1, candidateCount);

  if (reducedMotion) {
    const totalMs = REDUCED_MOTION_TOTAL_MS;
    const sequenceMs = REDUCED_MOTION_SEQUENCE_MS;
    const finalMs = totalMs - sequenceMs;

    return {
      totalMs,
      sequenceMs,
      finalMs,
      stepMs: sequenceMs / safeCandidateCount,
    };
  }

  const totalMs = clamp(
    BASE_TOTAL_MS + PER_CANDIDATE_MS * safeCandidateCount,
    MIN_TOTAL_MS,
    MAX_TOTAL_MS,
  );
  const sequenceMs = Math.round(totalMs * SEQUENCE_RATIO);
  const finalMs = totalMs - sequenceMs;

  return {
    totalMs,
    sequenceMs,
    finalMs,
    stepMs: sequenceMs / safeCandidateCount,
  };
}

export function createTurnResolutionFxRuntime(
  result: TurnResultDTO,
  startedAtMs: number,
  reducedMotion = false,
): TurnResolutionFxRuntime {
  return {
    result,
    startedAtMs,
    timeline: createTurnResolutionTimeline(
      result.candidates.length,
      reducedMotion,
    ),
    reducedMotion,
  };
}

export function getTurnResolutionFxState(
  runtime: TurnResolutionFxRuntime,
  nowMs: number,
): TurnResolutionFxState | null {
  const elapsedMs = Math.max(0, nowMs - runtime.startedAtMs);
  if (elapsedMs >= runtime.timeline.totalMs) {
    return null;
  }

  const candidateCount = Math.max(1, runtime.result.candidates.length);

  if (elapsedMs < runtime.timeline.sequenceMs) {
    const stepIndex = Math.min(
      candidateCount - 1,
      Math.floor(elapsedMs / runtime.timeline.stepMs),
    );

    return {
      result: runtime.result,
      phase: "sequence",
      sequenceVisibleCount: stepIndex + 1,
      sequenceActiveIndex: stepIndex,
      showFailureMarkers: false,
      showBoardMissFlash: false,
    };
  }

  return {
    result: runtime.result,
    phase: "final",
    sequenceVisibleCount: runtime.result.success ? 0 : candidateCount,
    sequenceActiveIndex: null,
    showFailureMarkers: !runtime.result.success,
    showBoardMissFlash: !runtime.result.success,
  };
}

export function decideTurnHistoryFx(
  input: TurnHistoryFxDecisionInput,
): TurnHistoryFxDecision {
  if (!input.isInitialized) {
    return "none";
  }

  const delta = input.currentLength - input.previousLength;
  if (delta === 1) {
    return "start_latest";
  }
  if (delta > 1) {
    return "skip_multiple";
  }

  return "none";
}

export function isTurnResolutionInteractionLocked(
  fxState: TurnResolutionFxState | null,
): boolean {
  return fxState !== null;
}
