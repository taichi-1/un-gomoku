import { useEffect, useRef } from "react";
import {
  type CandidateCount,
  isCandidateCount,
} from "@/features/game/sound/game-sound-config";
import {
  playCandidateByCount,
  playCandidateRemoveByCount,
} from "@/features/game/sound/game-sound-player";

export type CandidateSoundAction =
  | { type: "select"; count: CandidateCount }
  | { type: "deselect"; countBeforeRemove: CandidateCount };

export function resolveCandidateSoundAction(
  previousCount: number,
  nextCount: number,
): CandidateSoundAction | null {
  if (previousCount > 0 && nextCount === 0) {
    return null;
  }

  const delta = nextCount - previousCount;

  if (delta === 1 && isCandidateCount(nextCount)) {
    return {
      type: "select",
      count: nextCount,
    };
  }

  if (delta === -1 && isCandidateCount(previousCount)) {
    return {
      type: "deselect",
      countBeforeRemove: previousCount,
    };
  }

  return null;
}

export function useCandidateSoundEffects(selectedCandidateCount: number): void {
  const previousCountRef = useRef<number | null>(null);

  useEffect(() => {
    const previousCount = previousCountRef.current;

    if (previousCount === null) {
      previousCountRef.current = selectedCandidateCount;
      return;
    }

    const action = resolveCandidateSoundAction(
      previousCount,
      selectedCandidateCount,
    );

    if (action?.type === "select") {
      playCandidateByCount(action.count);
    } else if (action?.type === "deselect") {
      playCandidateRemoveByCount(action.countBeforeRemove);
    }

    previousCountRef.current = selectedCandidateCount;
  }, [selectedCandidateCount]);
}
