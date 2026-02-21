import { describe, expect, test } from "bun:test";
import { resolvePlayingInfoCandidateCount } from "./playing-info-candidate-count";

describe("resolvePlayingInfoCandidateCount", () => {
  test("keeps previous candidate count while turn-history sync is pending", () => {
    expect(
      resolvePlayingInfoCandidateCount({
        currentCandidateCount: 0,
        lastTurnCandidateCount: 3,
        hasActiveFx: false,
        hasPendingTurnHistorySync: true,
      }),
    ).toBe(3);
  });

  test("keeps previous candidate count while fx is active", () => {
    expect(
      resolvePlayingInfoCandidateCount({
        currentCandidateCount: 0,
        lastTurnCandidateCount: 5,
        hasActiveFx: true,
        hasPendingTurnHistorySync: false,
      }),
    ).toBe(5);
  });

  test("falls back to current count after fx completes", () => {
    expect(
      resolvePlayingInfoCandidateCount({
        currentCandidateCount: 1,
        lastTurnCandidateCount: 4,
        hasActiveFx: false,
        hasPendingTurnHistorySync: false,
      }),
    ).toBe(1);
  });
});
