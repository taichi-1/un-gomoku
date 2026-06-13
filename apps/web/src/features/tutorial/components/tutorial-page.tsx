import type { Coordinate } from "@pkg/shared/schemas";
import { useNavigate } from "@tanstack/react-router";
import { type CSSProperties, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/app-header";
import { GameBoard } from "@/features/game/components/game-board";
import { PlayingInfoPanel } from "@/features/game/components/playing-info-panel";
import { TurnStatusRow } from "@/features/game/components/turn-status-row";
import { useCandidateSoundEffects } from "@/features/game/hooks/use-candidate-sound-effects";
import { useGameEndSoundEffects } from "@/features/game/hooks/use-game-end-sound-effects";
import { useTurnResolutionFx } from "@/features/game/hooks/use-turn-resolution-fx";
import { shouldShowFinishedResult } from "@/features/game/lib/finished-result-visibility";
import { resolvePlayingInfoCandidateCount } from "@/features/game/lib/playing-info-candidate-count";
import { resolveTurnIndicatorPlayer } from "@/features/game/lib/turn-indicator-player";
import type { GameController } from "@/features/game/types/game-session";
import { TutorialBoardHighlights } from "@/features/tutorial/components/tutorial-board-highlights";
import { TutorialCoachCard } from "@/features/tutorial/components/tutorial-coach-card";
import { TutorialCompleteCard } from "@/features/tutorial/components/tutorial-complete-card";
import { TutorialIntroOverlay } from "@/features/tutorial/components/tutorial-intro-overlay";
import { useTutorialSession } from "@/features/tutorial/hooks/use-tutorial-session";
import { resolveTutorialCoachDisplay } from "@/features/tutorial/lib/coach-display";
import { TUTORIAL_WIN_CELL } from "@/features/tutorial/lib/tutorial-script";

// Same as GamePage's sizing, minus extra vertical budget for the coach card.
const boardSizeStyle = {
  "--board-size":
    "clamp(220px, min(calc(100vw - 20px), calc(100dvh - 360px)), 680px)",
} as CSSProperties;

export function TutorialPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    controller,
    phase,
    submitBlock,
    highlightWinCell,
    start,
    advance,
    skip,
    notifyFxIdle,
  } = useTutorialSession();
  const { snapshot } = controller;
  const turnHistory = snapshot.gameState.turnHistory;

  useCandidateSoundEffects(
    snapshot.selectedCandidates.length,
    turnHistory.length,
  );
  useCandidateSoundEffects(
    snapshot.opponentCandidates.length,
    turnHistory.length,
  );

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
    phase: fxPhase,
    interactionLocked,
    hasPendingTurnHistorySync,
    onPhaseComplete,
  } = useTurnResolutionFx(turnHistory);

  const fxBusy = activeFx !== null || hasPendingTurnHistorySync;
  useEffect(() => {
    if (!fxBusy) {
      notifyFxIdle(turnHistory.length);
    }
  }, [fxBusy, turnHistory.length, notifyFxIdle]);

  const effectiveController = useMemo<GameController>(
    () => ({
      ...controller,
      canInteract: controller.canInteract && !interactionLocked,
    }),
    [controller, interactionLocked],
  );

  const showFinishedResult = shouldShowFinishedResult({
    gamePhase: snapshot.gameState.phase,
    fxPhase,
    hasActiveFx: activeFx !== null,
    hasPendingTurnHistorySync,
  });
  useGameEndSoundEffects({
    showFinishedResult,
    gamePhase: snapshot.gameState.phase,
    turnHistory,
  });

  const displayTurnPlayer = resolveTurnIndicatorPlayer({
    currentPlayer: snapshot.gameState.currentPlayer,
    lastTurnPlayer: turnHistory.at(-1)?.player ?? null,
    hasActiveFx: activeFx !== null,
    hasPendingTurnHistorySync,
  });

  const displaySelectedCount = resolvePlayingInfoCandidateCount({
    currentCandidateCount: snapshot.selectedCandidates.length,
    lastTurnCandidateCount: turnHistory.at(-1)?.candidates.length ?? null,
    hasActiveFx: activeFx !== null,
    hasPendingTurnHistorySync,
  });

  const finished =
    snapshot.gameState.phase === "finished" && showFinishedResult;

  const coach = resolveTutorialCoachDisplay({
    phase,
    fxBusy,
    finished,
    selectedCount: snapshot.selectedCandidates.length,
    winCellSelected: snapshot.selectedCandidates.some(
      (coord) =>
        coord.x === TUTORIAL_WIN_CELL.x && coord.y === TUTORIAL_WIN_CELL.y,
    ),
    submitBlock,
  });

  const highlightCells = useMemo<Coordinate[]>(
    () => (highlightWinCell && !fxBusy && !finished ? [TUTORIAL_WIN_CELL] : []),
    [highlightWinCell, fxBusy, finished],
  );

  const handleSkip = () => {
    skip();
    void navigate({ to: "/" });
  };

  return (
    <main className="min-h-dvh w-full p-3 sm:p-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:gap-4">
        <AppHeader showBrand rules={rules} />

        <div
          className="flex flex-col items-center gap-3 pt-1.5 sm:gap-4 sm:pt-0"
          style={boardSizeStyle}
        >
          <div
            className="flex flex-col gap-3"
            style={{ width: "var(--board-size)" }}
          >
            <TurnStatusRow
              snapshot={snapshot}
              showFinishedResult={showFinishedResult}
              displayPlayerId={displayTurnPlayer}
              hasActiveFx={activeFx !== null}
            />
            <TutorialCoachCard
              stepNumber={coach.stepNumber}
              message={t(coach.messageKey)}
              emphasized={coach.emphasized}
              actionLabel={coach.showNext ? t("tutorial.coach.next") : null}
              onAction={advance}
              onSkip={handleSkip}
            />
            <div className="relative">
              <GameBoard
                controller={effectiveController}
                activeFx={activeFx}
                phase={fxPhase}
                onPhaseComplete={onPhaseComplete}
                showFinishedResult={showFinishedResult}
              />
              <TutorialBoardHighlights cells={highlightCells} />
            </div>
          </div>
          <div style={{ width: "var(--board-size)" }}>
            {finished ? (
              <TutorialCompleteCard
                onPlayCpu={() => {
                  void navigate({
                    to: "/cpu",
                    search: { difficulty: "easy", turnOrder: "first" },
                  });
                }}
                onBackToTitle={() => {
                  void navigate({ to: "/" });
                }}
              />
            ) : (
              <PlayingInfoPanel
                controller={effectiveController}
                displaySelectedCount={displaySelectedCount}
              />
            )}
          </div>
        </div>
      </div>

      {phase === "intro" ? (
        <TutorialIntroOverlay onStart={start} onSkip={handleSkip} />
      ) : null}
    </main>
  );
}
