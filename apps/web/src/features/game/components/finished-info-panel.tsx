import type { GameStateDTO } from "@pkg/shared/schemas";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { StoneIcon } from "@/features/game/components/stone-icon";
import { calculateLuckFeedback } from "@/features/game/lib/luck-feedback";

interface FinishedInfoPanelProps {
  gameState: GameStateDTO;
}

export function FinishedInfoPanel({ gameState }: FinishedInfoPanelProps) {
  const { t } = useTranslation();
  const feedback = calculateLuckFeedback(gameState.turnHistory);
  const blackPlayerId = gameState.blackPlayer;
  const whitePlayerId = blackPlayerId === "player1" ? "player2" : "player1";

  const formatSignedPercentage = (value: number): string => {
    const rounded = Math.round(value * 10) / 10;
    const sign = rounded >= 0 ? "+" : "-";
    return `${sign}${Math.abs(rounded).toFixed(1)}%`;
  };

  const formatSuccessPercentage = (value: number): string =>
    `${(value * 100).toFixed(1)}%`;

  const resolveResultLabel = (playerId: "player1" | "player2"): string => {
    if (gameState.isDraw) {
      return t("game.luckFeedback.draw");
    }
    if (gameState.winner === playerId) {
      return t("game.luckFeedback.win");
    }
    return t("game.luckFeedback.lose");
  };

  return (
    <Card className="game-status-surface w-full">
      <CardContent className="game-status-content">
        <table className="w-full table-fixed border-collapse text-xs">
          <thead>
            <tr className="border-b border-(--border-1)">
              <th className="w-[32%] px-2 py-1.5 text-left" />
              <th className="px-2 py-1.5 text-left font-medium text-(--text-normal)">
                <div className="flex items-center gap-1.5">
                  <StoneIcon
                    playerId={blackPlayerId}
                    blackPlayer={blackPlayerId}
                    className="h-3.5 w-3.5"
                  />
                  <span>{t("common.stone.black")}</span>
                </div>
              </th>
              <th className="px-2 py-1.5 text-left font-medium text-(--text-normal)">
                <div className="flex items-center gap-1.5">
                  <StoneIcon
                    playerId={whitePlayerId}
                    blackPlayer={blackPlayerId}
                    className="h-3.5 w-3.5"
                  />
                  <span>{t("common.stone.white")}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-(--table-divider)">
              <th className="px-2 py-2 text-left font-medium text-(--text-muted)">
                {t("game.luckFeedback.result")}
              </th>
              <td className="px-2 py-2 font-semibold text-(--text-strong)">
                {resolveResultLabel(blackPlayerId)}
              </td>
              <td className="px-2 py-2 font-semibold text-(--text-strong)">
                {resolveResultLabel(whitePlayerId)}
              </td>
            </tr>
            <tr className="border-b border-(--table-divider)">
              <th className="px-2 py-2 text-left font-medium text-(--text-muted)">
                {t("game.luckFeedback.expectedDelta")}
              </th>
              <td className="px-2 py-2 text-(--text-normal)">
                <div className="flex flex-col">
                  <span>
                    {formatSignedPercentage(
                      feedback[blackPlayerId].luckDeltaRate,
                    )}
                  </span>
                  <span className="text-[11px] text-(--text-muted)">
                    {t(
                      `game.luckFeedback.label.${feedback[blackPlayerId].luckLabelKey}`,
                    )}
                  </span>
                </div>
              </td>
              <td className="px-2 py-2 text-(--text-normal)">
                <div className="flex flex-col">
                  <span>
                    {formatSignedPercentage(
                      feedback[whitePlayerId].luckDeltaRate,
                    )}
                  </span>
                  <span className="text-[11px] text-(--text-muted)">
                    {t(
                      `game.luckFeedback.label.${feedback[whitePlayerId].luckLabelKey}`,
                    )}
                  </span>
                </div>
              </td>
            </tr>
            <tr>
              <th className="px-2 py-2 text-left font-medium text-(--text-muted)">
                {t("game.luckFeedback.successCount")}
              </th>
              <td className="px-2 py-2 text-(--text-normal)">
                {feedback[blackPlayerId].successCount} /{" "}
                {feedback[blackPlayerId].totalTurns} (
                {formatSuccessPercentage(feedback[blackPlayerId].successRate)})
              </td>
              <td className="px-2 py-2 text-(--text-normal)">
                {feedback[whitePlayerId].successCount} /{" "}
                {feedback[whitePlayerId].totalTurns} (
                {formatSuccessPercentage(feedback[whitePlayerId].successRate)})
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
