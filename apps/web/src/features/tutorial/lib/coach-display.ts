import { MAX_CANDIDATES } from "@pkg/shared/constants";
import type { TutorialPhase, TutorialSubmitBlock } from "./tutorial-script";

export interface TutorialCoachInput {
  phase: TutorialPhase;
  /** A turn-resolution animation is running (or about to). */
  fxBusy: boolean;
  /** The winning placement has landed and the finished result is visible. */
  finished: boolean;
  selectedCount: number;
  winCellSelected: boolean;
  submitBlock: TutorialSubmitBlock | null;
}

export interface TutorialCoachDisplay {
  messageKey: string;
  /** Hint after a blocked submit — rendered with emphasis. */
  emphasized: boolean;
  /** Show the "next" button that advances past an explanation beat. */
  showNext: boolean;
  stepNumber: 1 | 2 | 3;
}

function resolveStepNumber(phase: TutorialPhase): 1 | 2 | 3 {
  switch (phase) {
    case "step2":
    case "step2Success":
    case "white2":
      return 2;
    case "step3":
    case "done":
      return 3;
    default:
      return 1;
  }
}

export function resolveTutorialCoachDisplay(
  input: TutorialCoachInput,
): TutorialCoachDisplay {
  const stepNumber = resolveStepNumber(input.phase);
  const display = (
    messageKey: string,
    options?: { emphasized?: boolean; showNext?: boolean },
  ): TutorialCoachDisplay => ({
    messageKey,
    emphasized: options?.emphasized ?? false,
    showNext: options?.showNext ?? false,
    stepNumber,
  });

  if (input.finished || input.phase === "done") {
    return display("tutorial.coach.done");
  }
  if (input.phase === "white1" || input.phase === "white2") {
    return display(`tutorial.coach.${input.phase}`);
  }
  if (input.fxBusy) {
    return display("tutorial.coach.resolving");
  }
  if (input.submitBlock) {
    return display(`tutorial.hint.${input.submitBlock}`, { emphasized: true });
  }

  switch (input.phase) {
    case "intro":
    case "step1":
      return display(
        input.selectedCount === 0
          ? "tutorial.coach.step1Select"
          : "tutorial.coach.step1Submit",
      );
    case "step1Fail":
      return display("tutorial.coach.step1Fail", { showNext: true });
    case "step2":
      return display(
        input.winCellSelected && input.selectedCount >= MAX_CANDIDATES
          ? "tutorial.coach.step2Ready"
          : "tutorial.coach.step2Select",
      );
    case "step2Success":
      return display("tutorial.coach.step2Success", { showNext: true });
    case "step3":
      return display(
        input.winCellSelected
          ? "tutorial.coach.step3Ready"
          : "tutorial.coach.step3Select",
      );
    default:
      return display("tutorial.coach.done");
  }
}
