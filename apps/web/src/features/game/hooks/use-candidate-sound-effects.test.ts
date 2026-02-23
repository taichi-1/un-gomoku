import { describe, expect, test } from "bun:test";
import {
  resolveCandidateSoundAction,
  shouldSilenceCandidateSoundOnAutoClear,
} from "./use-candidate-sound-effects";

describe("use-candidate-sound-effects", () => {
  test("plays selection tones for 0->1->2->3->4->5", () => {
    const actions = [
      resolveCandidateSoundAction(0, 1),
      resolveCandidateSoundAction(1, 2),
      resolveCandidateSoundAction(2, 3),
      resolveCandidateSoundAction(3, 4),
      resolveCandidateSoundAction(4, 5),
    ];

    expect(actions).toEqual([
      { type: "select", count: 1 },
      { type: "select", count: 2 },
      { type: "select", count: 3 },
      { type: "select", count: 4 },
      { type: "select", count: 5 },
    ]);
  });

  test("plays remove tones for 5->4->3->2->1->0", () => {
    const actions = [
      resolveCandidateSoundAction(5, 4),
      resolveCandidateSoundAction(4, 3),
      resolveCandidateSoundAction(3, 2),
      resolveCandidateSoundAction(2, 1),
      resolveCandidateSoundAction(1, 0),
    ];

    expect(actions).toEqual([
      { type: "deselect", countBeforeRemove: 5 },
      { type: "deselect", countBeforeRemove: 4 },
      { type: "deselect", countBeforeRemove: 3 },
      { type: "deselect", countBeforeRemove: 2 },
      { type: "deselect", countBeforeRemove: 1 },
    ]);
  });

  test("stays silent for multi-step jumps", () => {
    expect(resolveCandidateSoundAction(0, 4)).toBeNull();
    expect(resolveCandidateSoundAction(5, 0)).toBeNull();
    expect(resolveCandidateSoundAction(2, 5)).toBeNull();
    expect(resolveCandidateSoundAction(4, 1)).toBeNull();
  });
});

describe("shouldSilenceCandidateSoundOnAutoClear", () => {
  test("returns true when turn submission clears candidates", () => {
    expect(
      shouldSilenceCandidateSoundOnAutoClear({
        previousCount: 1,
        nextCount: 0,
        previousTurnHistoryLength: 4,
        nextTurnHistoryLength: 5,
      }),
    ).toBe(true);
  });

  test("returns false when last candidate is manually deselected", () => {
    expect(
      shouldSilenceCandidateSoundOnAutoClear({
        previousCount: 1,
        nextCount: 0,
        previousTurnHistoryLength: 4,
        nextTurnHistoryLength: 4,
      }),
    ).toBe(false);
  });

  test("returns false when count does not transition to empty", () => {
    expect(
      shouldSilenceCandidateSoundOnAutoClear({
        previousCount: 2,
        nextCount: 1,
        previousTurnHistoryLength: 4,
        nextTurnHistoryLength: 5,
      }),
    ).toBe(false);
  });
});
