import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const RECAP_KEYS = [
  "tutorial.complete.recap1",
  "tutorial.complete.recap2",
  "tutorial.complete.recap3",
] as const;

interface TutorialCompleteCardProps {
  onPlayCpu: () => void;
  onBackToTitle: () => void;
}

/** Replaces the playing info panel once the tutorial game is won. */
export function TutorialCompleteCard({
  onPlayCpu,
  onBackToTitle,
}: TutorialCompleteCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="game-status-surface w-full">
      <CardContent className="flex flex-col gap-3 p-4">
        <h2 className="text-center font-display text-base font-semibold text-(--text-strong) sm:text-lg">
          {t("tutorial.complete.title")}
        </h2>
        <ul className="space-y-1.5">
          {RECAP_KEYS.map((key) => (
            <li
              key={key}
              className="flex items-start gap-1.5 text-xs text-(--text-normal) sm:text-sm"
            >
              <Check
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--accent-gold-1)"
                aria-hidden="true"
              />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="local"
            className="flex-1"
            onClick={onPlayCpu}
          >
            {t("tutorial.complete.playCpu")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onBackToTitle}
          >
            {t("tutorial.complete.backToTitle")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
