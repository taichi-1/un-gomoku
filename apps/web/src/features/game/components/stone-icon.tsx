import type { PlayerId } from "@pkg/shared/schemas";
import { Circle } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

type StoneTone = "solid" | "preview";

interface StoneIconProps {
  playerId: PlayerId;
  blackPlayer?: PlayerId;
  className?: string;
  tone?: StoneTone;
}

export function StoneIcon({
  playerId,
  blackPlayer = "player1",
  className,
  tone = "solid",
}: StoneIconProps) {
  const isBlackStone = playerId === blackPlayer;
  const isPreview = tone === "preview";

  const strokeColor = isBlackStone
    ? isPreview
      ? "rgba(26, 22, 17, 0.68)"
      : "var(--stone-black-stroke)"
    : isPreview
      ? "rgba(215, 202, 188, 0.98)"
      : "var(--stone-white-stroke)";

  const fillColor = isBlackStone
    ? isPreview
      ? "rgba(7, 6, 5, 0.36)"
      : "var(--stone-black-fill)"
    : isPreview
      ? "rgba(244, 239, 230, 0.66)"
      : "var(--stone-white-fill)";

  const highlightColor = isBlackStone
    ? isPreview
      ? "rgba(255, 240, 220, 0.1)"
      : "var(--stone-black-highlight)"
    : isPreview
      ? "rgba(255, 255, 255, 0.42)"
      : "var(--stone-white-highlight)";

  const secondaryHighlightColor = isBlackStone
    ? isPreview
      ? "rgba(255, 248, 235, 0.08)"
      : "rgba(255, 245, 228, 0.14)"
    : isPreview
      ? "rgba(255, 255, 255, 0.55)"
      : "rgba(255, 255, 255, 0.74)";

  const lowlightColor = isBlackStone
    ? isPreview
      ? "rgba(0, 0, 0, 0.2)"
      : "rgba(0, 0, 0, 0.34)"
    : isPreview
      ? "rgba(134, 113, 86, 0.18)"
      : "rgba(134, 113, 86, 0.26)";

  const stoneShadow = isBlackStone
    ? isPreview
      ? "drop-shadow(0 0.8px 1px rgba(0,0,0,0.36))"
      : "drop-shadow(0 1px 1.2px rgba(0,0,0,0.48))"
    : isPreview
      ? "drop-shadow(0 0.8px 1px rgba(80,63,38,0.2))"
      : "drop-shadow(0 1px 1.3px rgba(80,63,38,0.3))";

  return (
    <div
      className={cn("relative h-[82%] w-[82%]", className)}
      style={{ opacity: isPreview ? 0.9 : 1, filter: stoneShadow }}
    >
      <Circle
        className="h-full w-full"
        strokeWidth={isPreview ? 1.8 : 2}
        color={strokeColor}
        fill={fillColor}
      />
      <span
        className="pointer-events-none absolute left-[18%] top-[14%] h-[28%] w-[34%] rounded-full blur-[0.6px]"
        style={{ backgroundColor: highlightColor }}
      />
      <span
        className="pointer-events-none absolute left-[35%] top-[22%] h-[14%] w-[18%] rounded-full blur-[0.4px]"
        style={{ backgroundColor: secondaryHighlightColor }}
      />
      <span
        className="pointer-events-none absolute bottom-[14%] left-[24%] h-[18%] w-[50%] rounded-full blur-[0.8px]"
        style={{ backgroundColor: lowlightColor }}
      />
    </div>
  );
}

interface NumberedStoneIconProps {
  playerId: PlayerId;
  blackPlayer?: PlayerId;
  number: number;
  className?: string;
  stoneClassName?: string;
  numberClassName?: string;
  numberStyle?: CSSProperties;
  tone?: StoneTone;
}

export function NumberedStoneIcon({
  playerId,
  blackPlayer = "player1",
  number,
  className,
  stoneClassName,
  numberClassName,
  numberStyle,
  tone = "preview",
}: NumberedStoneIconProps) {
  const numberColorClass =
    playerId === blackPlayer
      ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)]"
      : "text-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.42)]";

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center",
        className,
      )}
    >
      <StoneIcon
        playerId={playerId}
        blackPlayer={blackPlayer}
        tone={tone}
        className={stoneClassName}
      />
      <span
        className={cn(
          "pointer-events-none absolute select-none font-semibold leading-none",
          numberColorClass,
          numberClassName,
        )}
        style={numberStyle}
      >
        {number}
      </span>
    </div>
  );
}
