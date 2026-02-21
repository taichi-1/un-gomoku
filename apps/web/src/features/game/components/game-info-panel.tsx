import { FinishedInfoPanel } from "@/features/game/components/finished-info-panel";
import { PlayingInfoPanel } from "@/features/game/components/playing-info-panel";
import type { GameController } from "@/features/game/types/game-session";

interface GameInfoPanelProps {
  controller: GameController;
  showFinishedResult: boolean;
  displaySelectedCount: number;
}

export function GameInfoPanel({
  controller,
  showFinishedResult,
  displaySelectedCount,
}: GameInfoPanelProps) {
  const { snapshot } = controller;

  if (showFinishedResult && snapshot.gameState.phase === "finished") {
    return <FinishedInfoPanel gameState={snapshot.gameState} />;
  }

  return (
    <PlayingInfoPanel
      controller={controller}
      displaySelectedCount={displaySelectedCount}
    />
  );
}
