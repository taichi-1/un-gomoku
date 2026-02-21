import type { TurnResolutionTimeline } from "@/features/game/lib/turn-resolution-fx";
import type { TurnResolutionFxPhase } from "@/features/game/lib/turn-resolution-fx-controller";

export interface TurnResolutionDisplaySpec {
  totalMs: number;
  sequenceMs: number;
  finalMs: number;
  lapCount: number;
  totalSteps: number;
  inactiveOpacity: number;
  activeOpacity: number;
  inactiveScale: number;
  activeScale: number;
  focusRingScale: number;
  finalEntryMs: number;
  phaseFadeMs: number;
}

interface CreateTurnResolutionDisplaySpecInput {
  timeline: TurnResolutionTimeline;
  candidateCount: number;
  reducedMotion: boolean;
}

interface SchedulePhaseCompletionTimerInput {
  phase: Exclude<TurnResolutionFxPhase, "idle">;
  durationMs: number;
  onPhaseComplete: (phase: Exclude<TurnResolutionFxPhase, "idle">) => void;
  scheduleTimeout?: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof globalThis.setTimeout>;
  clearScheduledTimeout?: (
    timeoutId: ReturnType<typeof globalThis.setTimeout>,
  ) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const NORMAL_TOTAL_MS = 1450;
const NORMAL_SEQUENCE_MS = 1170;
const NORMAL_FINAL_MS = 280;
const REDUCED_TOTAL_MS = 1000;
const REDUCED_SEQUENCE_MS = 760;
const REDUCED_FINAL_MS = 240;
const MIN_CANDIDATES = 1;
const MAX_CANDIDATES = 5;

export function createTurnResolutionDisplaySpec(
  input: CreateTurnResolutionDisplaySpecInput,
): TurnResolutionDisplaySpec {
  const { timeline, reducedMotion } = input;
  const safeCandidateCount = clamp(
    input.candidateCount,
    MIN_CANDIDATES,
    MAX_CANDIDATES,
  );
  const totalMs = reducedMotion ? REDUCED_TOTAL_MS : NORMAL_TOTAL_MS;
  const sequenceMs = reducedMotion ? REDUCED_SEQUENCE_MS : NORMAL_SEQUENCE_MS;
  const finalMs = reducedMotion ? REDUCED_FINAL_MS : NORMAL_FINAL_MS;

  const lapCount = reducedMotion
    ? 1
    : clamp(
        Math.round(sequenceMs / (safeCandidateCount * 95)),
        MIN_CANDIDATES + 1,
        MAX_CANDIDATES,
      );
  const totalSteps = safeCandidateCount * lapCount;
  const timelineScale = clamp(
    timeline.totalMs / (timeline.sequenceMs + timeline.finalMs || 1),
    0.8,
    1.2,
  );

  return {
    totalMs,
    sequenceMs,
    finalMs,
    lapCount,
    totalSteps,
    inactiveOpacity: reducedMotion ? 0.45 : 0.28,
    activeOpacity: 1,
    inactiveScale: reducedMotion ? 0.99 : 0.97,
    activeScale: reducedMotion ? 1.02 : 1.06,
    focusRingScale: reducedMotion ? 1.06 : 1.12,
    finalEntryMs: clamp(finalMs * 0.74, 120, 240),
    phaseFadeMs: (reducedMotion ? 0.05 : 0.08) * timelineScale,
  };
}

export function schedulePhaseCompletionTimer(
  input: SchedulePhaseCompletionTimerInput,
): () => void {
  const scheduleTimeout =
    input.scheduleTimeout ??
    ((callback: () => void, delayMs: number) =>
      globalThis.setTimeout(callback, delayMs));
  const clearScheduledTimeout =
    input.clearScheduledTimeout ??
    ((timeoutId: ReturnType<typeof globalThis.setTimeout>) => {
      globalThis.clearTimeout(
        timeoutId as Parameters<typeof globalThis.clearTimeout>[0],
      );
    });
  let finished = false;

  const timeoutId = scheduleTimeout(
    () => {
      if (finished) {
        return;
      }
      finished = true;
      input.onPhaseComplete(input.phase);
    },
    Math.max(0, input.durationMs),
  );

  return () => {
    if (finished) {
      return;
    }
    finished = true;
    clearScheduledTimeout(timeoutId);
  };
}
