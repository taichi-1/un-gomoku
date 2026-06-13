import type { PlayerId } from "@pkg/shared/schemas";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StoneIcon } from "@/features/game/components/stone-icon";
import {
  calculateLuckFeedback,
  type LuckLabelKey,
} from "@/features/game/lib/luck-feedback";
import type { GameController } from "@/features/game/types/game-session";
import { cn } from "@/lib/cn";

const FORTUNE_STAMP: Record<LuckLabelKey, string> = {
  veryLucky: "大吉",
  lucky: "吉",
  expected: "平",
  unlucky: "凶",
  veryUnlucky: "大凶",
};

const FORTUNE_TONE: Record<LuckLabelKey, string> = {
  veryLucky: "text-(--accent-gold-1)",
  lucky: "text-(--accent-gold-1)",
  expected: "text-(--text-muted)",
  unlucky: "text-(--accent-crimson-1)",
  veryUnlucky: "text-(--accent-crimson-1)",
};

function getOtherPlayerId(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

function formatSignedCount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded >= 0 ? "+" : "-";
  return `${sign}${Math.abs(rounded).toFixed(1)}`;
}

interface FinishedInfoPanelProps {
  controller: GameController;
}

export function FinishedInfoPanel({ controller }: FinishedInfoPanelProps) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const { snapshot } = controller;
  const gameState = snapshot.gameState;
  const viewerId = snapshot.mode === "local" ? null : snapshot.myPlayerId;
  const winner = gameState.isDraw ? null : gameState.winner;

  const feedback = calculateLuckFeedback(gameState.turnHistory);

  const stoneName = (playerId: PlayerId): string =>
    t(
      playerId === gameState.blackPlayer
        ? "common.stone.black"
        : "common.stone.white",
    );

  const panelName = (playerId: PlayerId): string => {
    if (viewerId === null) {
      return stoneName(playerId);
    }
    if (playerId === viewerId) {
      return t("game.result.you");
    }
    return t(
      snapshot.mode === "cpu"
        ? "game.result.opponent.cpu"
        : "game.result.opponent.online",
    );
  };

  const headline = !winner
    ? { text: t("game.result.headline.draw"), tone: "text-(--text-normal)" }
    : viewerId === null
      ? {
          text: t("game.result.headline.stoneWin", {
            player: stoneName(winner),
          }),
          tone: "text-(--accent-gold-1)",
        }
      : winner === viewerId
        ? {
            text: t("game.result.headline.win"),
            tone: "text-(--accent-gold-1)",
          }
        : {
            text: t("game.result.headline.lose"),
            tone: "text-(--accent-crimson-1)",
          };

  const slipPlayerIds: PlayerId[] =
    viewerId !== null
      ? [viewerId, getOtherPlayerId(viewerId)]
      : [gameState.blackPlayer, getOtherPlayerId(gameState.blackPlayer)];

  return (
    <Card className="game-status-surface w-full">
      <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
        <h2
          className={cn(
            "m-0 text-center font-display text-xl tracking-wider sm:text-2xl",
            headline.tone,
          )}
        >
          {headline.text}
        </h2>

        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[11px] text-(--text-muted)">
            {t("game.result.fortuneTitle")}
          </span>
          <div className="flex w-full justify-center gap-2.5">
            {slipPlayerIds.map((playerId) => {
              const grade = feedback[playerId].luckLabelKey;
              const caption = t(`game.result.fortuneCaption.${grade}`);
              return (
                <div
                  key={playerId}
                  className="flex min-w-0 max-w-[9.5rem] flex-1 flex-col items-center gap-1.5 rounded-md border border-(--border-1) bg-(--surface-2) px-2 pb-2 pt-2.5"
                >
                  <div className="flex w-full items-center justify-center gap-1 text-[11px] text-(--text-muted)">
                    <StoneIcon
                      playerId={playerId}
                      blackPlayer={gameState.blackPlayer}
                      className="h-3 w-3 shrink-0"
                    />
                    <span className="truncate">{panelName(playerId)}</span>
                  </div>
                  <div
                    className={cn(
                      "flex min-h-14 items-center justify-center py-1 font-display text-[1.55rem] leading-none [writing-mode:vertical-rl]",
                      FORTUNE_TONE[grade],
                    )}
                  >
                    {FORTUNE_STAMP[grade]}
                  </div>
                  <span className="text-[10px] text-(--text-muted)">
                    {caption}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {controller.rematch && (
          <Button
            className="w-full"
            onClick={() => void controller.rematch?.()}
          >
            {t("game.rematch")}
          </Button>
        )}

        <button
          type="button"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((current) => !current)}
          className="mx-auto flex items-center gap-1 text-[11px] text-(--text-muted) transition-colors hover:text-(--text-normal)"
        >
          {showDetails ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
          {t("game.result.details.toggle")}
        </button>

        {showDetails && (
          <table className="w-full table-fixed border-collapse text-xs">
            <thead>
              <tr className="border-b border-(--border-1)">
                <th className="w-[32%] px-2 py-1.5 text-left" />
                {slipPlayerIds.map((playerId) => (
                  <th
                    key={playerId}
                    className="px-2 py-1.5 text-left font-medium text-(--text-normal)"
                  >
                    <div className="flex items-center gap-1.5">
                      <StoneIcon
                        playerId={playerId}
                        blackPlayer={gameState.blackPlayer}
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      <span className="truncate">{panelName(playerId)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-(--table-divider)">
                <th className="px-2 py-2 text-left font-medium text-(--text-muted)">
                  {t("game.result.details.success")}
                </th>
                {slipPlayerIds.map((playerId) => (
                  <td key={playerId} className="px-2 py-2 text-(--text-normal)">
                    {feedback[playerId].successCount} /{" "}
                    {feedback[playerId].totalTurns} (
                    {Math.round(feedback[playerId].successRate * 100)}%)
                  </td>
                ))}
              </tr>
              <tr className="border-b border-(--table-divider)">
                <th className="px-2 py-2 text-left font-medium text-(--text-muted)">
                  {t("game.result.details.expected")}
                </th>
                {slipPlayerIds.map((playerId) => (
                  <td key={playerId} className="px-2 py-2 text-(--text-normal)">
                    {feedback[playerId].expectedSuccess.toFixed(1)}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="px-2 py-2 text-left font-medium text-(--text-muted)">
                  {t("game.result.details.delta")}
                </th>
                {slipPlayerIds.map((playerId) => (
                  <td key={playerId} className="px-2 py-2 text-(--text-normal)">
                    {formatSignedCount(feedback[playerId].luckDelta)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
