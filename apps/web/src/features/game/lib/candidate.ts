import { MAX_CANDIDATES } from "@pkg/shared/constants";
import type { Coordinate } from "@pkg/shared/schemas";

export function coordinateKey(coord: Coordinate): string {
  return `${coord.x}:${coord.y}`;
}

export function isSameCoordinate(left: Coordinate, right: Coordinate): boolean {
  return left.x === right.x && left.y === right.y;
}

export function hasCoordinate(
  coords: Coordinate[],
  target: Coordinate,
): boolean {
  return coords.some((coord) => isSameCoordinate(coord, target));
}

export function hasDuplicateCandidates(candidates: Coordinate[]): boolean {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = coordinateKey(candidate);
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }
  return false;
}

export function applyCandidateSelection(
  candidates: Coordinate[],
  coord: Coordinate,
  shouldSelect: boolean,
): Coordinate[] {
  const exists = hasCoordinate(candidates, coord);

  if (shouldSelect) {
    if (exists || candidates.length >= MAX_CANDIDATES) {
      return candidates;
    }
    return [...candidates, coord];
  }

  if (!exists) {
    return candidates;
  }

  return candidates.filter((candidate) => !isSameCoordinate(candidate, coord));
}
