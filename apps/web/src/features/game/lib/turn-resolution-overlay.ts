import type { Coordinate } from "@pkg/shared/schemas";
import type {
  ActiveTurnResolutionFx,
  TurnResolutionFxPhase,
} from "@/features/game/lib/turn-resolution-fx-controller";

export interface OverlayCandidate {
  coord: Coordinate;
  rank: number;
}

function findCandidateIndex(
  candidates: Coordinate[],
  target: Coordinate,
): number {
  return candidates.findIndex(
    (candidate) => candidate.x === target.x && candidate.y === target.y,
  );
}

export function getSequenceOverlayCandidates(
  activeFx: ActiveTurnResolutionFx,
): OverlayCandidate[] {
  return activeFx.result.candidates.map((coord, index) => ({
    coord,
    rank: index + 1,
  }));
}

export function getPlacedCandidateIndex(
  activeFx: ActiveTurnResolutionFx,
): number | null {
  if (!activeFx.result.success || !activeFx.result.placedPosition) {
    return null;
  }

  const index = findCandidateIndex(
    activeFx.result.candidates,
    activeFx.result.placedPosition,
  );
  return index >= 0 ? index : null;
}

export function getFinalOverlayCandidates(
  activeFx: ActiveTurnResolutionFx,
): OverlayCandidate[] {
  if (!activeFx.result.success) {
    return getSequenceOverlayCandidates(activeFx);
  }

  const placed = activeFx.result.placedPosition;
  if (!placed) {
    return [];
  }

  const placedIndex = getPlacedCandidateIndex(activeFx);

  return [
    {
      coord: placed,
      rank: placedIndex !== null ? placedIndex + 1 : 1,
    },
  ];
}

export function shouldRenderOverlay(phase: TurnResolutionFxPhase): boolean {
  return phase !== "idle";
}
