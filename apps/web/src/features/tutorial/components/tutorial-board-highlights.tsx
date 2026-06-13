import { BOARD_SIZE } from "@pkg/shared/constants";
import type { Coordinate } from "@pkg/shared/schemas";
import { motion, useReducedMotion } from "motion/react";

const GRID_STYLE = {
  gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
  padding: "calc(var(--board-size) / 32)",
} as const;

interface TutorialBoardHighlightsProps {
  cells: readonly Coordinate[];
}

/**
 * Pulsing rings over board cells the learner should look at. Aligned with
 * BoardGrid/TurnResolutionOverlay through the same grid template + padding.
 */
export function TutorialBoardHighlights({
  cells,
}: TutorialBoardHighlightsProps) {
  const reducedMotion = useReducedMotion();

  if (cells.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 grid"
      style={GRID_STYLE}
      aria-hidden="true"
    >
      {cells.map((cell) => (
        <div
          key={`${cell.x}:${cell.y}`}
          className="relative flex items-center justify-center"
          style={{ gridColumnStart: cell.x + 1, gridRowStart: cell.y + 1 }}
        >
          <motion.div
            className="absolute inset-[6%] rounded-full border-2 border-[rgba(208,161,90,0.95)]"
            animate={
              reducedMotion
                ? { opacity: 0.9 }
                : {
                    scale: [1, 1.16, 1],
                    opacity: [0.95, 0.5, 0.95],
                    boxShadow: [
                      "0 0 5px 1px rgba(208,161,90,0.45)",
                      "0 0 14px 4px rgba(208,161,90,0.8)",
                      "0 0 5px 1px rgba(208,161,90,0.45)",
                    ],
                  }
            }
            transition={
              reducedMotion
                ? undefined
                : { duration: 1.3, repeat: Infinity, ease: "easeInOut" }
            }
          />
        </div>
      ))}
    </div>
  );
}
