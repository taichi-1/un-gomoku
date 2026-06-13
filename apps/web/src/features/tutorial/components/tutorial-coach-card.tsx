import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";

const STEP_DOTS = [1, 2, 3] as const;

interface TutorialCoachCardProps {
  stepNumber: 1 | 2 | 3;
  message: string;
  /** Render the message with emphasis (hint after a blocked submit). */
  emphasized: boolean;
  /** Label of the advance button, or null to hide it. */
  actionLabel: string | null;
  onAction: () => void;
  onSkip: () => void;
}

export function TutorialCoachCard({
  stepNumber,
  message,
  emphasized,
  actionLabel,
  onAction,
  onSkip,
}: TutorialCoachCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="game-status-surface w-full">
      <CardContent className="game-status-content flex items-center gap-2.5 sm:gap-3">
        <div
          className="flex shrink-0 flex-col items-center gap-1"
          aria-hidden="true"
        >
          {STEP_DOTS.map((dot) => (
            <span
              key={dot}
              className={cn(
                "size-1.5 rounded-full",
                dot <= stepNumber ? "bg-(--accent-gold-1)" : "bg-(--border-1)",
              )}
            />
          ))}
        </div>
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "min-h-15 flex-1 self-center text-xs leading-relaxed sm:min-h-10 sm:text-sm",
            emphasized
              ? "font-medium text-(--accent-gold-1)"
              : "text-(--text-normal)",
          )}
        >
          {message}
        </p>
        {actionLabel ? (
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        ) : null}
        <button
          type="button"
          onClick={onSkip}
          className="-m-1.5 shrink-0 self-start p-1.5 text-[11px] text-(--text-muted) underline-offset-2 hover:underline"
        >
          {t("tutorial.coach.skip")}
        </button>
      </CardContent>
    </Card>
  );
}
