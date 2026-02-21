import type { TurnResultDTO } from "@pkg/shared/schemas";
import { useCallback, useEffect, useState } from "react";
import {
  type ActiveTurnResolutionFx,
  createInitialTurnResolutionFxControllerState,
  reducePhaseCompletion,
  reduceTurnHistoryUpdate,
  type TurnResolutionFxControllerState,
  type TurnResolutionFxPhase,
} from "@/features/game/lib/turn-resolution-fx-controller";

export interface UseTurnResolutionFxResult {
  activeFx: ActiveTurnResolutionFx | null;
  phase: TurnResolutionFxPhase;
  interactionLocked: boolean;
  hasPendingTurnHistorySync: boolean;
  onPhaseComplete: (phase: Exclude<TurnResolutionFxPhase, "idle">) => void;
}

function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return reducedMotion;
}

export function useTurnResolutionFx(
  turnHistory: TurnResultDTO[],
): UseTurnResolutionFxResult {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [state, setState] = useState<TurnResolutionFxControllerState>(
    createInitialTurnResolutionFxControllerState,
  );

  useEffect(() => {
    setState((current) =>
      reduceTurnHistoryUpdate(current, {
        turnHistory,
        prefersReducedMotion,
      }),
    );
  }, [turnHistory, prefersReducedMotion]);

  const onPhaseComplete = useCallback(
    (completedPhase: Exclude<TurnResolutionFxPhase, "idle">) => {
      setState((current) => reducePhaseCompletion(current, completedPhase));
    },
    [],
  );

  return {
    activeFx: state.activeFx,
    phase: state.phase,
    interactionLocked: state.phase !== "idle" && state.activeFx !== null,
    hasPendingTurnHistorySync:
      state.isInitialized && state.previousLength !== turnHistory.length,
    onPhaseComplete,
  };
}
