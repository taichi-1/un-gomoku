import type { GameStateDTO, TurnResultDTO } from "@pkg/shared/schemas";
import { useEffect, useRef } from "react";
import { playGameEnd } from "@/features/game/sound/game-sound-player";

interface ResolveGameEndSoundPlayKeyInput {
  previousShowFinishedResult: boolean;
  showFinishedResult: boolean;
  gamePhase: GameStateDTO["phase"];
  turnHistory: TurnResultDTO[];
}

export function resolveGameEndSoundPlayKey(
  input: ResolveGameEndSoundPlayKeyInput,
): string | null {
  if (input.previousShowFinishedResult || !input.showFinishedResult) {
    return null;
  }

  if (input.gamePhase !== "finished") {
    return null;
  }

  const latestTurn = input.turnHistory.at(-1);
  if (!latestTurn?.gameOver) {
    return null;
  }

  return `end:${input.turnHistory.length}:${latestTurn.winner ?? "draw"}`;
}

interface UseGameEndSoundEffectsInput {
  showFinishedResult: boolean;
  gamePhase: GameStateDTO["phase"];
  turnHistory: TurnResultDTO[];
}

export function useGameEndSoundEffects(
  input: UseGameEndSoundEffectsInput,
): void {
  const previousShowFinishedResultRef = useRef<boolean | null>(null);

  useEffect(() => {
    const previousShowFinishedResult = previousShowFinishedResultRef.current;

    if (previousShowFinishedResult === null) {
      previousShowFinishedResultRef.current = input.showFinishedResult;
      return;
    }

    const playKey = resolveGameEndSoundPlayKey({
      previousShowFinishedResult,
      showFinishedResult: input.showFinishedResult,
      gamePhase: input.gamePhase,
      turnHistory: input.turnHistory,
    });

    if (playKey) {
      playGameEnd(playKey);
    }

    previousShowFinishedResultRef.current = input.showFinishedResult;
  }, [input.gamePhase, input.showFinishedResult, input.turnHistory]);
}
