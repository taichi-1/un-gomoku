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

interface ShouldSilenceCandidateSoundOnAutoClearInput {
  previousCount: number;
  nextCount: number;
  previousTurnHistoryLength: number;
  nextTurnHistoryLength: number;
}

export function shouldSilenceCandidateSoundOnAutoClear(
  input: ShouldSilenceCandidateSoundOnAutoClearInput,
): boolean {
  return (
    input.previousCount > 0 &&
    input.nextCount === 0 &&
    input.previousTurnHistoryLength !== input.nextTurnHistoryLength
  );
}

export function resolveCandidateSoundAction(
  previousCount: number,
  nextCount: number,
): CandidateSoundAction | null {
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

export function useCandidateSoundEffects(
  selectedCandidateCount: number,
  turnHistoryLength: number,
): void {
  const previousCountRef = useRef<number | null>(null);
  const previousTurnHistoryLengthRef = useRef<number | null>(null);

  useEffect(() => {
    const previousCount = previousCountRef.current;
    const previousTurnHistoryLength = previousTurnHistoryLengthRef.current;

    if (previousCount === null || previousTurnHistoryLength === null) {
      previousCountRef.current = selectedCandidateCount;
      previousTurnHistoryLengthRef.current = turnHistoryLength;
      return;
    }

    const shouldSilenceSound = shouldSilenceCandidateSoundOnAutoClear({
      previousCount,
      nextCount: selectedCandidateCount,
      previousTurnHistoryLength,
      nextTurnHistoryLength: turnHistoryLength,
    });

    const action = shouldSilenceSound
      ? null
      : resolveCandidateSoundAction(previousCount, selectedCandidateCount);

    if (action?.type === "select") {
      playCandidateByCount(action.count);
    } else if (action?.type === "deselect") {
      playCandidateRemoveByCount(action.countBeforeRemove);
    }

    previousCountRef.current = selectedCandidateCount;
    previousTurnHistoryLengthRef.current = turnHistoryLength;
  }, [selectedCandidateCount, turnHistoryLength]);
}
