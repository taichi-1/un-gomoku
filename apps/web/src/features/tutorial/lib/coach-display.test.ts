import { describe, expect, test } from "bun:test";
import {
  resolveTutorialCoachDisplay,
  type TutorialCoachInput,
} from "./coach-display";

function input(overrides: Partial<TutorialCoachInput>): TutorialCoachInput {
  return {
    phase: "step1",
    fxBusy: false,
    finished: false,
    selectedCount: 0,
    winCellSelected: false,
    submitBlock: null,
    ...overrides,
  };
}

describe("resolveTutorialCoachDisplay", () => {
  test("step 1 walks from select to submit", () => {
    expect(resolveTutorialCoachDisplay(input({})).messageKey).toBe(
      "tutorial.coach.step1Select",
    );
    expect(
      resolveTutorialCoachDisplay(
        input({ selectedCount: 1, winCellSelected: true }),
      ).messageKey,
    ).toBe("tutorial.coach.step1Submit");
  });

  test("resolution animation shows the rolling message", () => {
    expect(
      resolveTutorialCoachDisplay(input({ fxBusy: true })).messageKey,
    ).toBe("tutorial.coach.resolving");
  });

  test("opponent phases keep their message even mid-animation", () => {
    expect(
      resolveTutorialCoachDisplay(input({ phase: "white1", fxBusy: true }))
        .messageKey,
    ).toBe("tutorial.coach.white1");
    expect(
      resolveTutorialCoachDisplay(input({ phase: "white2" })).messageKey,
    ).toBe("tutorial.coach.white2");
  });

  test("explanation beats show the next button", () => {
    const fail = resolveTutorialCoachDisplay(input({ phase: "step1Fail" }));
    expect(fail.messageKey).toBe("tutorial.coach.step1Fail");
    expect(fail.showNext).toBe(true);

    const success = resolveTutorialCoachDisplay(
      input({ phase: "step2Success" }),
    );
    expect(success.messageKey).toBe("tutorial.coach.step2Success");
    expect(success.showNext).toBe(true);
  });

  test("hints take precedence and are emphasized", () => {
    const hint = resolveTutorialCoachDisplay(
      input({ phase: "step2", submitBlock: "needFive" }),
    );
    expect(hint.messageKey).toBe("tutorial.hint.needFive");
    expect(hint.emphasized).toBe(true);

    const stepOneHint = resolveTutorialCoachDisplay(
      input({ phase: "step1", submitBlock: "winCellOnly" }),
    );
    expect(stepOneHint.messageKey).toBe("tutorial.hint.winCellOnly");
    expect(stepOneHint.emphasized).toBe(true);
  });

  test("step 2 becomes ready with five candidates including the win cell", () => {
    expect(
      resolveTutorialCoachDisplay(
        input({ phase: "step2", selectedCount: 3, winCellSelected: true }),
      ).messageKey,
    ).toBe("tutorial.coach.step2Select");
    expect(
      resolveTutorialCoachDisplay(
        input({ phase: "step2", selectedCount: 5, winCellSelected: true }),
      ).messageKey,
    ).toBe("tutorial.coach.step2Ready");
  });

  test("step 3 becomes ready once the win cell is selected", () => {
    expect(
      resolveTutorialCoachDisplay(input({ phase: "step3", selectedCount: 0 }))
        .messageKey,
    ).toBe("tutorial.coach.step3Select");
    expect(
      resolveTutorialCoachDisplay(
        input({ phase: "step3", selectedCount: 1, winCellSelected: true }),
      ).messageKey,
    ).toBe("tutorial.coach.step3Ready");
  });

  test("finishing shows the done message regardless of phase", () => {
    expect(
      resolveTutorialCoachDisplay(
        input({ phase: "step3", finished: true, fxBusy: false }),
      ).messageKey,
    ).toBe("tutorial.coach.done");
    expect(
      resolveTutorialCoachDisplay(input({ phase: "done" })).messageKey,
    ).toBe("tutorial.coach.done");
  });

  test("step numbers follow the phase", () => {
    expect(resolveTutorialCoachDisplay(input({})).stepNumber).toBe(1);
    expect(
      resolveTutorialCoachDisplay(input({ phase: "white1" })).stepNumber,
    ).toBe(1);
    expect(
      resolveTutorialCoachDisplay(input({ phase: "step2" })).stepNumber,
    ).toBe(2);
    expect(
      resolveTutorialCoachDisplay(input({ phase: "white2" })).stepNumber,
    ).toBe(2);
    expect(
      resolveTutorialCoachDisplay(input({ phase: "step3" })).stepNumber,
    ).toBe(3);
    expect(
      resolveTutorialCoachDisplay(input({ phase: "done" })).stepNumber,
    ).toBe(3);
  });
});
