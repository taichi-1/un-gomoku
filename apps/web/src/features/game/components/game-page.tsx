import { type CSSProperties, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/app-header";
import { GameBoard } from "@/features/game/components/game-board";
import { GameInfoPanel } from "@/features/game/components/game-info-panel";
import { TurnStatusRow } from "@/features/game/components/turn-status-row";
import { useTurnResolutionFx } from "@/features/game/hooks/use-turn-resolution-fx";
import { shouldShowFinishedResult } from "@/features/game/lib/finished-result-visibility";
import { resolvePlayingInfoCandidateCount } from "@/features/game/lib/playing-info-candidate-count";
import { resolveTurnIndicatorPlayer } from "@/features/game/lib/turn-indicator-player";
import type { GameController } from "@/features/game/types/game-session";

const boardSizeStyle = {
  "--board-size":
    "clamp(220px, min(calc(100dvh - 290px), calc(100vw - 20px)), 760px)",
} as CSSProperties;

interface GamePageProps {
  controller: GameController;
}

export function GamePage({ controller }: GamePageProps) {
  const { t } = useTranslation();
  const { snapshot } = controller;
  const rules = useMemo(
    () => [
      t("settings.rule1"),
      t("settings.rule2"),
      t("settings.rule3"),
      t("settings.rule4"),
    ],
    [t],
  );
  const {
    activeFx,
    phase,
    interactionLocked,
    hasPendingTurnHistorySync,
    onPhaseComplete,
  } = useTurnResolutionFx(snapshot.gameState.turnHistory);

  const effectiveController = useMemo<GameController>(
    () => ({
      ...controller,
      canInteract: controller.canInteract && !interactionLocked,
    }),
    [controller, interactionLocked],
  );

  const showFinishedResult = shouldShowFinishedResult({
    gamePhase: snapshot.gameState.phase,
    fxPhase: phase,
    hasActiveFx: activeFx !== null,
    hasPendingTurnHistorySync,
  });
  const displayTurnPlayer = resolveTurnIndicatorPlayer({
    currentPlayer: snapshot.gameState.currentPlayer,
    lastTurnPlayer: snapshot.gameState.turnHistory.at(-1)?.player ?? null,
    hasActiveFx: activeFx !== null,
    hasPendingTurnHistorySync,
  });
  const displaySelectedCount = resolvePlayingInfoCandidateCount({
    currentCandidateCount: snapshot.selectedCandidates.length,
    lastTurnCandidateCount:
      snapshot.gameState.turnHistory.at(-1)?.candidates.length ?? null,
    hasActiveFx: activeFx !== null,
    hasPendingTurnHistorySync,
  });

  return (
    <main className="h-dvh w-full overflow-hidden p-3 sm:p-4">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3 sm:gap-4">
        <AppHeader showBrand rules={rules} />

        <div
          className="flex min-h-0 flex-1 flex-col items-center justify-start gap-3 pt-1.5 sm:justify-center sm:gap-6 sm:pt-0"
          style={boardSizeStyle}
        >
          <div
            className="flex flex-col gap-3.5"
            style={{ width: "var(--board-size)" }}
          >
            <TurnStatusRow
              snapshot={snapshot}
              showFinishedResult={showFinishedResult}
              displayPlayerId={displayTurnPlayer}
            />
            <GameBoard
              controller={effectiveController}
              activeFx={activeFx}
              phase={phase}
              onPhaseComplete={onPhaseComplete}
            />
          </div>
          <div style={{ width: "var(--board-size)" }}>
            <GameInfoPanel
              controller={effectiveController}
              showFinishedResult={showFinishedResult}
              displaySelectedCount={displaySelectedCount}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
