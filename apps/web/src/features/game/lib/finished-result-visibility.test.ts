import { describe, expect, test } from "bun:test";
import { shouldShowFinishedResult } from "./finished-result-visibility";

describe("shouldShowFinishedResult", () => {
  test("returns false while fx is running even if game is finished", () => {
    expect(
      shouldShowFinishedResult({
        gamePhase: "finished",
        fxPhase: "final",
        hasActiveFx: true,
        hasPendingTurnHistorySync: false,
      }),
    ).toBe(false);
  });

  test("returns false while turn-history sync is pending", () => {
    expect(
      shouldShowFinishedResult({
        gamePhase: "finished",
        fxPhase: "idle",
        hasActiveFx: false,
        hasPendingTurnHistorySync: true,
      }),
    ).toBe(false);
  });

  test("returns true after fx completes and sync settles", () => {
    expect(
      shouldShowFinishedResult({
        gamePhase: "finished",
        fxPhase: "idle",
        hasActiveFx: false,
        hasPendingTurnHistorySync: false,
      }),
    ).toBe(true);
  });

  test("returns false when game is still playing", () => {
    expect(
      shouldShowFinishedResult({
        gamePhase: "playing",
        fxPhase: "idle",
        hasActiveFx: false,
        hasPendingTurnHistorySync: false,
      }),
    ).toBe(false);
  });
});
