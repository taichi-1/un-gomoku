import { placeStone } from "@pkg/core/board";
import { createInitialGameState } from "@pkg/core/game-state";
import { isEmpty } from "@pkg/core/validation";
import { MAX_CANDIDATES } from "@pkg/shared/constants";
import type { RandomFn } from "@pkg/shared/random";
import type { BoardState, Coordinate, GameStateDTO } from "@pkg/shared/schemas";

/**
 * Scripted scenario for the interactive tutorial.
 *
 * The board starts mid-game so the very first action can be "win in one
 * move": black (the learner) has four in a down-right diagonal whose lower
 * end is blocked, leaving TUTORIAL_WIN_CELL as the only winning placement.
 * Every random roll is pre-scripted so the luck mechanic is demonstrated
 * deterministically: a guaranteed miss first, then a guaranteed hit that
 * lands away from the aimed cell, and finally the winning hit.
 */

/** The only cell that completes black's preset diagonal (the other end is blocked). */
export const TUTORIAL_WIN_CELL: Coordinate = { x: 9, y: 9 };

/** Black's preset stones: four in a down-right diagonal. */
export const TUTORIAL_PRESET_BLACK: readonly Coordinate[] = [
  { x: 5, y: 5 },
  { x: 6, y: 6 },
  { x: 7, y: 7 },
  { x: 8, y: 8 },
];

/** White's preset stones: (4,4) blocks the diagonal's other end; the rest start a row. */
export const TUTORIAL_PRESET_WHITE: readonly Coordinate[] = [
  { x: 4, y: 4 },
  { x: 9, y: 5 },
  { x: 10, y: 5 },
];

function isSameCoordinate(left: Coordinate, right: Coordinate): boolean {
  return left.x === right.x && left.y === right.y;
}

export function createTutorialGameState(): GameStateDTO {
  const initial = createInitialGameState();
  let board = initial.board;
  for (const coord of TUTORIAL_PRESET_BLACK) {
    board = placeStone(board, coord, "player1");
  }
  for (const coord of TUTORIAL_PRESET_WHITE) {
    board = placeStone(board, coord, "player2");
  }
  return { ...initial, board, phase: "playing" };
}

// ── Scripted rolls ──

/** Fails the success roll for any candidate count (max probability is 0.9). */
const MISS_ROLL = 0.99;
/** Passes the success roll for any candidate count (min probability is 0.5). */
const HIT_ROLL = 0.01;

/** Sequential pre-scripted rolls; throws when exhausted (a scripting bug). */
export function createScriptedRandom(rolls: readonly number[]): RandomFn {
  let index = 0;
  return () => {
    const roll = rolls[index];
    if (roll === undefined) {
      throw new Error("tutorial random script exhausted");
    }
    index += 1;
    return roll;
  };
}

/** Roll that makes selectRandomCandidate pick exactly `index` out of `count`. */
export function rollForCandidateIndex(index: number, count: number): number {
  return (index + 0.5) / count;
}

/** A turn that always misses: nothing is placed and the turn passes. */
export function createMissRandom(): RandomFn {
  return createScriptedRandom([MISS_ROLL]);
}

/** A turn that always hits and lands exactly on `target` (must be a candidate). */
export function createHitRandomAt(
  candidates: readonly Coordinate[],
  target: Coordinate,
): RandomFn {
  const index = candidates.findIndex((coord) =>
    isSameCoordinate(coord, target),
  );
  if (index < 0) {
    throw new Error("tutorial target is not among the candidates");
  }
  return createScriptedRandom([
    HIT_ROLL,
    rollForCandidateIndex(index, candidates.length),
  ]);
}

/** A turn that always hits but lands on the last candidate that is NOT `avoided`. */
export function createHitRandomAvoiding(
  candidates: readonly Coordinate[],
  avoided: Coordinate,
): RandomFn {
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    if (candidate && !isSameCoordinate(candidate, avoided)) {
      return createScriptedRandom([
        HIT_ROLL,
        rollForCandidateIndex(index, candidates.length),
      ]);
    }
  }
  throw new Error("tutorial needs a candidate other than the avoided cell");
}

// ── Tutorial flow ──

export type TutorialPhase =
  | "intro"
  | "step1"
  | "step1Fail"
  | "white1"
  | "step2"
  | "step2Success"
  | "white2"
  | "step3"
  | "done";

export type TutorialStepId = "step1" | "step2" | "step3";

/**
 * Hint keys shown in the coach card. The first two come from a blocked
 * submit; "winCellOnly" is set when a step-1 tap on a non-target cell is
 * rejected at selection time.
 */
export type TutorialSubmitBlock = "needFive" | "needWinCell" | "winCellOnly";

/** The learner-actionable step for a phase, if any. */
export function getPhaseStep(phase: TutorialPhase): TutorialStepId | null {
  if (phase === "step1" || phase === "step2" || phase === "step3") {
    return phase;
  }
  return null;
}

/**
 * Phase progression once a turn's resolution animation has settled.
 * `settledTurnCount` is the turn-history length the animation caught up with.
 */
export function resolveSettledPhase(
  phase: TutorialPhase,
  settledTurnCount: number,
): TutorialPhase {
  switch (phase) {
    case "step1":
      return settledTurnCount >= 1 ? "step1Fail" : phase;
    case "white1":
      return settledTurnCount >= 2 ? "step2" : phase;
    case "step2":
      return settledTurnCount >= 3 ? "step2Success" : phase;
    case "white2":
      return settledTurnCount >= 4 ? "step3" : phase;
    case "step3":
      return settledTurnCount >= 5 ? "done" : phase;
    default:
      return phase;
  }
}

/** In step 1 only the winning cell may be picked; later steps are free. */
export function isSelectableInStep(
  step: TutorialStepId,
  coord: Coordinate,
): boolean {
  return step !== "step1" || isSameCoordinate(coord, TUTORIAL_WIN_CELL);
}

/** Why the current selection may not be submitted yet (null = good to go). */
export function getSubmitBlock(
  step: TutorialStepId,
  candidates: readonly Coordinate[],
): TutorialSubmitBlock | null {
  if (step === "step2" && candidates.length < MAX_CANDIDATES) {
    return "needFive";
  }
  const hasWinCell = candidates.some((coord) =>
    isSameCoordinate(coord, TUTORIAL_WIN_CELL),
  );
  if (!hasWinCell) {
    return "needWinCell";
  }
  return null;
}

/** The pre-scripted roll for each learner step. */
export function createStepRandom(
  step: TutorialStepId,
  candidates: readonly Coordinate[],
): RandomFn {
  switch (step) {
    case "step1":
      return createMissRandom();
    case "step2":
      return createHitRandomAvoiding(candidates, TUTORIAL_WIN_CELL);
    case "step3":
      return createHitRandomAt(candidates, TUTORIAL_WIN_CELL);
  }
}

// ── Scripted opponent ──

/**
 * Rolls are kept as plain values (not a stateful RandomFn) so consumers can
 * build a fresh queue per resolution attempt — React StrictMode invokes state
 * updaters twice, and a shared queue would run dry on the second call.
 */
export interface TutorialOpponentTurn {
  candidates: Coordinate[];
  rolls: readonly number[];
}

/**
 * Opponent turn 1: white aims at the learner's winning cell first, but the
 * scripted roll lands on white's own row instead — luck cuts both ways.
 */
export function createOpponentTurn1(): TutorialOpponentTurn {
  const candidates: Coordinate[] = [
    { ...TUTORIAL_WIN_CELL },
    { x: 11, y: 5 },
    { x: 8, y: 5 },
  ];
  return {
    candidates,
    rolls: [HIT_ROLL, rollForCandidateIndex(1, candidates.length)],
  };
}

const OPPONENT_TURN_2_BACKUP_CELLS: readonly Coordinate[] = [
  { x: 12, y: 5 },
  { x: 8, y: 5 },
  { x: 12, y: 6 },
  { x: 3, y: 4 },
];

/**
 * Opponent turn 2: white tries the winning cell again plus a backup that is
 * still empty (the learner's step-2 stone may sit anywhere), and misses —
 * failures hit both sides.
 */
export function createOpponentTurn2(board: BoardState): TutorialOpponentTurn {
  const backup = OPPONENT_TURN_2_BACKUP_CELLS.find((coord) =>
    isEmpty(board, coord),
  );
  const candidates: Coordinate[] = backup
    ? [{ ...TUTORIAL_WIN_CELL }, { ...backup }]
    : [{ ...TUTORIAL_WIN_CELL }];
  return { candidates, rolls: [MISS_ROLL] };
}
