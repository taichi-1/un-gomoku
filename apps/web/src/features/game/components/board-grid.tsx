import { BOARD_SIZE } from "@pkg/shared/constants";
import type { Coordinate, PlayerId } from "@pkg/shared/schemas";
import { memo, useMemo } from "react";
import {
  NumberedStoneIcon,
  StoneIcon,
} from "@/features/game/components/stone-icon";
import { useBoardSelection } from "@/features/game/hooks/use-board-selection";
import { coordinateKey } from "@/features/game/lib/candidate";
import type { GameSessionSnapshot } from "@/features/game/types/game-session";
import { cn } from "@/lib/cn";

const STAR_POINTS = new Set([
  "3,3",
  "3,7",
  "3,11",
  "7,3",
  "7,7",
  "7,11",
  "11,3",
  "11,7",
  "11,11",
]);

function listCoordinates(): Coordinate[] {
  const coords: Coordinate[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      coords.push({ x, y });
    }
  }
  return coords;
}

function createCandidateRankMap(candidates: Coordinate[]): Map<string, number> {
  return new Map(
    candidates.map((coord, index) => [coordinateKey(coord), index + 1]),
  );
}

function getOpponentPlayerId(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

interface BoardGridProps {
  snapshot: GameSessionSnapshot;
  canInteract: boolean;
  setCandidateSelection: (coord: Coordinate, shouldSelect: boolean) => void;
  hideStoneKey: string | null;
}

export const BoardGrid = memo(function BoardGrid({
  snapshot,
  canInteract,
  setCandidateSelection,
  hideStoneKey,
}: BoardGridProps) {
  const coordinates = useMemo(() => listCoordinates(), []);
  const selectedRankMap = useMemo(
    () => createCandidateRankMap(snapshot.selectedCandidates),
    [snapshot.selectedCandidates],
  );
  const opponentRankMap = useMemo(
    () => createCandidateRankMap(snapshot.opponentCandidates),
    [snapshot.opponentCandidates],
  );
  const ownCandidatePlayerId =
    snapshot.myPlayerId ?? snapshot.gameState.currentPlayer;
  const opponentCandidatePlayerId = getOpponentPlayerId(ownCandidatePlayerId);

  const {
    handleCellPointerDown,
    handleBoardPointerMove,
    handleBoardPointerUp,
    handleBoardPointerCancel,
    handleBoardLostPointerCapture,
  } = useBoardSelection({
    canInteract,
    selectedCandidates: snapshot.selectedCandidates,
    isCellSelectable: (coord) => {
      const row = snapshot.gameState.board[coord.y];
      return row?.[coord.x] === null;
    },
    setCandidateSelection,
  });

  return (
    <div
      className="relative grid select-none rounded-xl"
      onPointerMove={handleBoardPointerMove}
      onPointerUp={handleBoardPointerUp}
      onPointerCancel={handleBoardPointerCancel}
      onLostPointerCapture={handleBoardLostPointerCapture}
      style={{
        width: "var(--board-size)",
        height: "var(--board-size)",
        touchAction: "none",
        gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        background: [
          "repeating-linear-gradient(93deg, transparent 0%, transparent 94%, rgba(103,64,24,0.09) 94%, rgba(103,64,24,0.09) 100%)",
          "repeating-linear-gradient(87deg, transparent 0%, transparent 96%, rgba(145,88,33,0.06) 96%, rgba(145,88,33,0.06) 100%)",
          "linear-gradient(165deg, var(--board-wood-1) 0%, var(--board-wood-2) 30%, var(--board-wood-3) 60%, var(--board-wood-4) 100%)",
        ].join(", "),
        boxShadow: [
          "0 0 0 5px var(--board-frame-1)",
          "0 0 0 9px var(--board-frame-2)",
          "0 0 0 10px var(--board-frame-3)",
          "0 16px 38px rgba(0,0,0,0.44)",
          "inset 0 1px 2px rgba(255,238,210,0.2)",
          "inset 0 -1px 2px rgba(48,28,10,0.36)",
        ].join(", "),
        padding: "calc(var(--board-size) / 32)",
      }}
    >
      {coordinates.map((coord) => {
        const row = snapshot.gameState.board[coord.y];
        const cellState = row?.[coord.x] ?? null;
        const key = coordinateKey(coord);
        const visibleCellState = hideStoneKey === key ? null : cellState;
        const ownCandidateRank = selectedRankMap.get(key);
        const opponentCandidateRank = opponentRankMap.get(key);
        const candidateStone =
          visibleCellState !== null
            ? null
            : ownCandidateRank !== undefined
              ? { playerId: ownCandidatePlayerId, number: ownCandidateRank }
              : opponentCandidateRank !== undefined
                ? {
                    playerId: opponentCandidatePlayerId,
                    number: opponentCandidateRank,
                  }
                : null;
        const hasCandidateStone = candidateStone !== null;
        const isStarPoint = STAR_POINTS.has(`${coord.x},${coord.y}`);

        return (
          <button
            key={key}
            type="button"
            data-board-cell="true"
            data-x={coord.x}
            data-y={coord.y}
            onPointerDown={(event) => handleCellPointerDown(coord, event)}
            className={cn(
              "group relative flex items-center justify-center",
              "bg-transparent",
              visibleCellState === null && canInteract
                ? "cursor-pointer"
                : "cursor-default",
            )}
          >
            {/* Horizontal line segment */}
            <div
              className="absolute top-1/2 h-px pointer-events-none"
              style={{
                left: coord.x === 0 ? "50%" : "0",
                right: coord.x === BOARD_SIZE - 1 ? "50%" : "0",
                background: "rgba(26,18,12,0.55)",
                transform: "translateY(-50%)",
              }}
            />
            {/* Vertical line segment */}
            <div
              className="absolute left-1/2 w-px pointer-events-none"
              style={{
                top: coord.y === 0 ? "50%" : "0",
                bottom: coord.y === BOARD_SIZE - 1 ? "50%" : "0",
                background: "rgba(26,18,12,0.55)",
                transform: "translateX(-50%)",
              }}
            />
            {visibleCellState === null && canInteract ? (
              <div className="pointer-events-none absolute size-[65%] rounded-full bg-[rgba(208,161,90,0.25)] opacity-0 transition-opacity group-hover:opacity-100" />
            ) : null}
            {isStarPoint && visibleCellState === null && !hasCandidateStone ? (
              <div className="pointer-events-none absolute size-[18%] rounded-full bg-[rgba(24,16,10,0.58)]" />
            ) : null}
            {visibleCellState ? (
              <StoneIcon
                playerId={visibleCellState}
                blackPlayer={snapshot.gameState.blackPlayer}
              />
            ) : null}
            {candidateStone ? (
              <NumberedStoneIcon
                playerId={candidateStone.playerId}
                blackPlayer={snapshot.gameState.blackPlayer}
                number={candidateStone.number}
                className="pointer-events-none"
                numberStyle={{ fontSize: "calc(var(--board-size) / 46)" }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
