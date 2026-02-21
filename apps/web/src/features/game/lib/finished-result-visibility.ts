import type { GameStateDTO } from "@pkg/shared/schemas";
import type { TurnResolutionFxPhase } from "@/features/game/lib/turn-resolution-fx-controller";

interface FinishedResultVisibilityInput {
  gamePhase: GameStateDTO["phase"];
  fxPhase: TurnResolutionFxPhase;
  hasActiveFx: boolean;
  hasPendingTurnHistorySync: boolean;
}

export function shouldShowFinishedResult(
  input: FinishedResultVisibilityInput,
): boolean {
  return (
    input.gamePhase === "finished" &&
    input.fxPhase === "idle" &&
    !input.hasActiveFx &&
    !input.hasPendingTurnHistorySync
  );
}
