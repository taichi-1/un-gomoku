import { describe, expect, test } from "bun:test";
import { resolveCandidateSoundAction } from "./use-candidate-sound-effects";

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

  test("plays remove tones only for 5->4->3->2->1", () => {
    const actions = [
      resolveCandidateSoundAction(5, 4),
      resolveCandidateSoundAction(4, 3),
      resolveCandidateSoundAction(3, 2),
      resolveCandidateSoundAction(2, 1),
    ];

    expect(actions).toEqual([
      { type: "deselect", countBeforeRemove: 5 },
      { type: "deselect", countBeforeRemove: 4 },
      { type: "deselect", countBeforeRemove: 3 },
      { type: "deselect", countBeforeRemove: 2 },
    ]);
  });

  test("stays silent for multi-step jumps and full clear", () => {
    expect(resolveCandidateSoundAction(0, 4)).toBeNull();
    expect(resolveCandidateSoundAction(5, 0)).toBeNull();
    expect(resolveCandidateSoundAction(1, 0)).toBeNull();
    expect(resolveCandidateSoundAction(2, 5)).toBeNull();
    expect(resolveCandidateSoundAction(4, 1)).toBeNull();
  });
});
