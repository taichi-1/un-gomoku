import type { Coordinate } from "@pkg/shared/schemas";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StoneIcon } from "@/features/game/components/stone-icon";

const DEMO_GRID_SIZE = 5;
const PATTERN_INTERVAL_MS = 2100;

interface DemoPattern {
  directionKey: string;
  cells: Coordinate[];
}

const ROW_PATTERN: DemoPattern = {
  directionKey: "tutorial.intro.directionRow",
  cells: Array.from({ length: DEMO_GRID_SIZE }, (_, i) => ({ x: i, y: 2 })),
};

const COLUMN_PATTERN: DemoPattern = {
  directionKey: "tutorial.intro.directionColumn",
  cells: Array.from({ length: DEMO_GRID_SIZE }, (_, i) => ({ x: 2, y: i })),
};

const DIAGONAL_PATTERN: DemoPattern = {
  directionKey: "tutorial.intro.directionDiagonal",
  cells: Array.from({ length: DEMO_GRID_SIZE }, (_, i) => ({ x: i, y: i })),
};

const DEMO_PATTERNS = [ROW_PATTERN, COLUMN_PATTERN, DIAGONAL_PATTERN] as const;

interface TutorialIntroOverlayProps {
  onStart: () => void;
  onSkip: () => void;
}

/**
 * Splash shown before the tutorial: the win condition in one sentence plus a
 * looping five-in-a-row demo that cycles row → column → diagonal.
 */
export function TutorialIntroOverlay({
  onStart,
  onSkip,
}: TutorialIntroOverlayProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const titleId = useId();
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const [patternIndex, setPatternIndex] = useState(0);

  useEffect(() => {
    startButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setPatternIndex((current) => (current + 1) % DEMO_PATTERNS.length);
    }, PATTERN_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const pattern =
    DEMO_PATTERNS[patternIndex % DEMO_PATTERNS.length] ?? ROW_PATTERN;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(10,7,4,0.62)] p-4 backdrop-blur-[2px]"
    >
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="space-y-1 text-center">
            <h2
              id={titleId}
              className="font-display text-xl font-bold text-(--text-strong) sm:text-2xl"
            >
              {t("tutorial.intro.title")}
            </h2>
            <p className="text-xs text-(--text-muted) sm:text-sm">
              {t("tutorial.intro.body")}
            </p>
          </div>

          <div
            className="mx-auto grid aspect-square w-44 rounded-md sm:w-52"
            style={{
              gridTemplateColumns: `repeat(${DEMO_GRID_SIZE}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${DEMO_GRID_SIZE}, minmax(0, 1fr))`,
              background:
                "linear-gradient(165deg, var(--board-wood-1), var(--board-wood-3))",
              boxShadow:
                "0 0 0 3px var(--board-frame-2), 0 8px 18px rgba(0,0,0,0.3)",
              padding: "7%",
            }}
            aria-hidden="true"
          >
            {Array.from({ length: DEMO_GRID_SIZE * DEMO_GRID_SIZE }, (_, i) => {
              const x = i % DEMO_GRID_SIZE;
              const y = Math.floor(i / DEMO_GRID_SIZE);
              const stoneOrder = pattern.cells.findIndex(
                (cell) => cell.x === x && cell.y === y,
              );
              return (
                <div
                  key={`${x}:${y}`}
                  className="relative flex items-center justify-center"
                >
                  <div
                    className="absolute top-1/2 h-px -translate-y-1/2 bg-[rgba(26,18,12,0.55)]"
                    style={{
                      left: x === 0 ? "50%" : 0,
                      right: x === DEMO_GRID_SIZE - 1 ? "50%" : 0,
                    }}
                  />
                  <div
                    className="absolute left-1/2 w-px -translate-x-1/2 bg-[rgba(26,18,12,0.55)]"
                    style={{
                      top: y === 0 ? "50%" : 0,
                      bottom: y === DEMO_GRID_SIZE - 1 ? "50%" : 0,
                    }}
                  />
                  {stoneOrder >= 0 ? (
                    <motion.div
                      key={`stone-${patternIndex}-${x}-${y}`}
                      className="flex h-full w-full items-center justify-center"
                      initial={
                        reducedMotion ? false : { scale: 0.3, opacity: 0 }
                      }
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: reducedMotion ? 0 : stoneOrder * 0.1,
                        duration: 0.18,
                        ease: "easeOut",
                      }}
                    >
                      <StoneIcon playerId="player1" />
                    </motion.div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <p className="text-center text-sm font-medium text-(--accent-gold-1)">
            {t(pattern.directionKey)}
          </p>

          <div className="flex flex-col gap-2">
            <Button
              ref={startButtonRef}
              type="button"
              variant="local"
              className="w-full"
              onClick={onStart}
            >
              {t("tutorial.intro.start")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={onSkip}
            >
              {t("tutorial.intro.skip")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
