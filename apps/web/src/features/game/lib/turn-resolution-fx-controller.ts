import type { TurnResultDTO } from "@pkg/shared/schemas";
import {
  createTurnResolutionFxRuntime,
  decideTurnHistoryFx,
  type TurnResolutionTimeline,
} from "@/features/game/lib/turn-resolution-fx";

export type TurnResolutionFxPhase = "idle" | "sequence" | "final";

export interface ActiveTurnResolutionFx {
  id: number;
  result: TurnResultDTO;
  timeline: TurnResolutionTimeline;
  reducedMotion: boolean;
}

export interface TurnResolutionFxControllerState {
  isInitialized: boolean;
  previousLength: number;
  phase: TurnResolutionFxPhase;
  activeFx: ActiveTurnResolutionFx | null;
}

interface TurnHistoryUpdateInput {
  turnHistory: TurnResultDTO[];
  prefersReducedMotion: boolean;
}

export function createInitialTurnResolutionFxControllerState(): TurnResolutionFxControllerState {
  return {
    isInitialized: false,
    previousLength: 0,
    phase: "idle",
    activeFx: null,
  };
}

export function reduceTurnHistoryUpdate(
  current: TurnResolutionFxControllerState,
  input: TurnHistoryUpdateInput,
): TurnResolutionFxControllerState {
  const currentLength = input.turnHistory.length;
  const decision = decideTurnHistoryFx({
    isInitialized: current.isInitialized,
    previousLength: current.previousLength,
    currentLength,
  });

  const baseState: TurnResolutionFxControllerState = {
    ...current,
    isInitialized: true,
    previousLength: currentLength,
  };

  if (!current.isInitialized) {
    return baseState;
  }

  if (decision === "skip_multiple") {
    return {
      ...baseState,
      phase: "idle",
      activeFx: null,
    };
  }

  if (decision !== "start_latest") {
    return baseState;
  }

  const latestResult = input.turnHistory.at(-1);
  if (!latestResult) {
    return baseState;
  }

  const runtime = createTurnResolutionFxRuntime(
    latestResult,
    0,
    input.prefersReducedMotion,
  );

  return {
    ...baseState,
    phase: "sequence",
    activeFx: {
      id: currentLength,
      result: latestResult,
      timeline: runtime.timeline,
      reducedMotion: input.prefersReducedMotion,
    },
  };
}

export function reducePhaseCompletion(
  current: TurnResolutionFxControllerState,
  completedPhase: Exclude<TurnResolutionFxPhase, "idle">,
): TurnResolutionFxControllerState {
  if (!current.activeFx) {
    return current;
  }

  if (completedPhase === "sequence" && current.phase === "sequence") {
    return {
      ...current,
      phase: "final",
    };
  }

  if (completedPhase === "final" && current.phase === "final") {
    return {
      ...current,
      phase: "idle",
      activeFx: null,
    };
  }

  return current;
}
