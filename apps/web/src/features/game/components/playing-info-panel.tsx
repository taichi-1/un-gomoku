import { MAX_CANDIDATES, SUCCESS_PROBABILITY } from "@pkg/shared/constants";
import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { GameController } from "@/features/game/types/game-session";

interface PlayingInfoPanelProps {
  controller: GameController;
  displaySelectedCount: number;
}

export function PlayingInfoPanel({
  controller,
  displaySelectedCount,
}: PlayingInfoPanelProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const { snapshot, canInteract, submitCandidates } = controller;

  const successRate = Math.round(
    (SUCCESS_PROBABILITY[displaySelectedCount] ?? 0) * 100,
  );
  const successRateMotionValue = useMotionValue(successRate);
  const [displayedSuccessRate, setDisplayedSuccessRate] = useState(successRate);

  useMotionValueEvent(successRateMotionValue, "change", (latest) => {
    if (shouldReduceMotion) {
      return;
    }

    setDisplayedSuccessRate((previous) => {
      const next = Math.round(latest);
      return next === previous ? previous : next;
    });
  });

  useEffect(() => {
    if (shouldReduceMotion || successRate === 0) {
      successRateMotionValue.set(successRate);
      setDisplayedSuccessRate(successRate);
      return;
    }

    const controls = animate(successRateMotionValue, successRate, {
      duration: 0.24,
      ease: "easeOut",
    });

    return () => {
      controls.stop();
    };
  }, [successRate, shouldReduceMotion, successRateMotionValue]);

  const candidateValue = `${displaySelectedCount} / ${MAX_CANDIDATES}`;
  const successRateValue = `${
    shouldReduceMotion ? successRate : displayedSuccessRate
  }%`;
  const cpuInfoValue =
    snapshot.mode === "cpu" && snapshot.cpuInfo
      ? `${t(`game.cpuDifficultyDisplay.${snapshot.cpuInfo.difficulty}`)} \u00b7 ${t(`game.cpuPersonaDisplay.${snapshot.cpuInfo.persona}`)}`
      : null;

  return (
    <Card className="game-status-surface w-full">
      <CardContent className="game-status-content flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
            <dl className="min-w-0 grid gap-0.5 sm:flex sm:items-baseline sm:gap-1.5">
              <dt className="text-xs font-medium text-(--text-muted) sm:text-sm">
                {t("game.candidateLabel")}
              </dt>
              <dd className="m-0 flex items-baseline gap-1 text-sm text-(--text-normal)">
                <span
                  aria-hidden="true"
                  className="hidden text-xs text-(--text-muted) sm:inline"
                >
                  :
                </span>
                <span>{candidateValue}</span>
              </dd>
            </dl>
            <dl className="min-w-0 grid gap-0.5 sm:flex sm:items-baseline sm:gap-1.5">
              <dt className="text-xs font-medium text-(--text-muted) sm:text-sm">
                {t("game.successRateLabel")}
              </dt>
              <dd className="m-0 flex items-baseline gap-1 text-sm text-(--text-normal)">
                <span
                  aria-hidden="true"
                  className="hidden text-xs text-(--text-muted) sm:inline"
                >
                  :
                </span>
                <span>{successRateValue}</span>
              </dd>
            </dl>
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full sm:ml-auto sm:min-w-36 sm:w-auto sm:shrink-0"
            onClick={submitCandidates}
            disabled={
              !canInteract ||
              snapshot.selectedCandidates.length === 0 ||
              snapshot.gameState.phase !== "playing"
            }
          >
            {t("game.submit")}
          </Button>
        </div>
        {cpuInfoValue ? (
          <dl className="min-w-0">
            <dt className="sr-only">{t("common.cpuTurn")}</dt>
            <dd className="m-0 text-xs text-(--text-muted)">{cpuInfoValue}</dd>
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );
}
