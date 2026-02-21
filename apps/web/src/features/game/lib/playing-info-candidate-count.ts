interface ResolvePlayingInfoCandidateCountInput {
  currentCandidateCount: number;
  lastTurnCandidateCount: number | null;
  hasActiveFx: boolean;
  hasPendingTurnHistorySync: boolean;
}

export function resolvePlayingInfoCandidateCount(
  input: ResolvePlayingInfoCandidateCountInput,
): number {
  if (
    (input.hasActiveFx || input.hasPendingTurnHistorySync) &&
    input.lastTurnCandidateCount !== null
  ) {
    return input.lastTurnCandidateCount;
  }

  return input.currentCandidateCount;
}
