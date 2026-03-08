import { useMemo } from "react";
import { BoardGrid } from "@/features/game/components/board-grid";
import { TurnResolutionOverlay } from "@/features/game/components/turn-resolution-overlay";
import { coordinateKey } from "@/features/game/lib/candidate";
import type {
  ActiveTurnResolutionFx,
  TurnResolutionFxPhase,
} from "@/features/game/lib/turn-resolution-fx-controller";
import type { GameController } from "@/features/game/types/game-session";

interface GameBoardProps {
  controller: GameController;
  activeFx: ActiveTurnResolutionFx | null;
  phase: TurnResolutionFxPhase;
  onPhaseComplete: (phase: Exclude<TurnResolutionFxPhase, "idle">) => void;
}

export function GameBoard({
  controller,
  activeFx,
  phase,
  onPhaseComplete,
}: GameBoardProps) {
  const { snapshot, canInteract, setCandidateSelection } = controller;

  const hideStoneKey = useMemo(() => {
    if (
      phase !== "sequence" ||
      !activeFx?.result.success ||
      !activeFx.result.placedPosition
    ) {
      return null;
    }

    return coordinateKey(activeFx.result.placedPosition);
  }, [activeFx, phase]);

  return (
    <div className="flex w-full items-center justify-center">
      <div className="relative">
        <BoardGrid
          snapshot={snapshot}
          canInteract={canInteract}
          setCandidateSelection={setCandidateSelection}
          hideStoneKey={hideStoneKey}
        />
        <TurnResolutionOverlay
          activeFx={activeFx}
          phase={phase}
          onPhaseComplete={onPhaseComplete}
          blackPlayer={snapshot.gameState.blackPlayer}
        />
      </div>
    </div>
  );
}
