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
                  <StoneIcon playerId="player1" className="h-3.5 w-3.5" />
                  <span>{t("common.player.player1")}</span>
                </div>
              </th>
              <th className="px-2 py-1.5 text-left font-medium text-(--text-normal)">
                <div className="flex items-center gap-1.5">
                  <StoneIcon playerId="player2" className="h-3.5 w-3.5" />
                  <span>{t("common.player.player2")}</span>
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
                {resolveResultLabel("player1")}
              </td>
              <td className="px-2 py-2 font-semibold text-(--text-strong)">
                {resolveResultLabel("player2")}
              </td>
            </tr>
            <tr className="border-b border-(--table-divider)">
              <th className="px-2 py-2 text-left font-medium text-(--text-muted)">
                {t("game.luckFeedback.expectedDelta")}
              </th>
              <td className="px-2 py-2 text-(--text-normal)">
                <div className="flex flex-col">
                  <span>
                    {formatSignedPercentage(feedback.player1.luckDeltaRate)}
                  </span>
                  <span className="text-[11px] text-(--text-muted)">
                    {t(
                      `game.luckFeedback.label.${feedback.player1.luckLabelKey}`,
                    )}
                  </span>
                </div>
              </td>
              <td className="px-2 py-2 text-(--text-normal)">
                <div className="flex flex-col">
                  <span>
                    {formatSignedPercentage(feedback.player2.luckDeltaRate)}
                  </span>
                  <span className="text-[11px] text-(--text-muted)">
                    {t(
                      `game.luckFeedback.label.${feedback.player2.luckLabelKey}`,
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
                {feedback.player1.successCount} / {feedback.player1.totalTurns}{" "}
                ({formatSuccessPercentage(feedback.player1.successRate)})
              </td>
              <td className="px-2 py-2 text-(--text-normal)">
                {feedback.player2.successCount} / {feedback.player2.totalTurns}{" "}
                ({formatSuccessPercentage(feedback.player2.successRate)})
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
