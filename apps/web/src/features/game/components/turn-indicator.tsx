import type { PlayerId } from "@pkg/shared/schemas";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { StoneIcon } from "@/features/game/components/stone-icon";
import type { GameSessionSnapshot } from "@/features/game/types/game-session";

interface TurnIndicatorProps {
  snapshot: GameSessionSnapshot;
  showFinishedResult: boolean;
  displayPlayerId: PlayerId;
}

export function resolveTurnIndicatorDisplay({
  snapshot,
  showFinishedResult,
  displayPlayerId,
  t,
}: {
  snapshot: GameSessionSnapshot;
  showFinishedResult: boolean;
  displayPlayerId: PlayerId;
  t: (key: string, options?: Record<string, unknown>) => string;
}): {
  label: string;
  indicatorStonePlayer: PlayerId | null;
} {
  const { gameState } = snapshot;
  const winner = gameState.winner;
  const isFinished = gameState.phase === "finished" && showFinishedResult;

  if (snapshot.mode === "online") {
    if (snapshot.status === "error") {
      return {
        label: snapshot.statusMessage ?? t("status.error"),
        indicatorStonePlayer: null,
      };
    }

    if (snapshot.status === "disconnected") {
      return {
        label: snapshot.statusMessage ?? t("status.disconnected"),
        indicatorStonePlayer: null,
      };
    }

    if (snapshot.status === "connecting") {
      return {
        label: snapshot.statusMessage ?? t("status.connecting"),
        indicatorStonePlayer: null,
      };
    }

    if (snapshot.status === "waiting") {
      return {
        label: snapshot.statusMessage ?? t("status.waiting"),
        indicatorStonePlayer: null,
      };
    }

    if (snapshot.status === "opponentOffline") {
      return {
        label: snapshot.statusMessage ?? t("status.opponentOffline"),
        indicatorStonePlayer: null,
      };
    }
  }

  if (isFinished) {
    if (!winner || gameState.isDraw) {
      return {
        label: t("game.finishedDrawIndicator"),
        indicatorStonePlayer: null,
      };
    }
    return {
      label: t("game.finishedWinnerIndicator", {
        player: t(`common.player.${winner}`),
      }),
      indicatorStonePlayer: winner,
    };
  }

  if (snapshot.mode === "local") {
    return {
      label: t("common.playerTurn", {
        player: t(`common.player.${displayPlayerId}`),
      }),
      indicatorStonePlayer: displayPlayerId,
    };
  }

  const perspectivePlayerId = snapshot.myPlayerId ?? gameState.currentPlayer;
  return {
    label:
      displayPlayerId === perspectivePlayerId
        ? t("common.yourTurn")
        : t("common.opponentTurn"),
    indicatorStonePlayer: displayPlayerId,
  };
}

export function TurnIndicator({
  snapshot,
  showFinishedResult,
  displayPlayerId,
}: TurnIndicatorProps) {
  const { t } = useTranslation();
  const { label, indicatorStonePlayer } = resolveTurnIndicatorDisplay({
    snapshot,
    showFinishedResult,
    displayPlayerId,
    t,
  });

  return (
    <Card className="game-status-surface w-fit">
      <CardContent className="game-status-content flex items-center gap-1.5">
        {indicatorStonePlayer ? (
          <StoneIcon
            playerId={indicatorStonePlayer}
            className="size-3.5 shrink-0"
          />
        ) : null}
        <span className="game-status-label text-(--text-normal)">{label}</span>
      </CardContent>
    </Card>
  );
}
