import { resolveTurn } from "@pkg/core/turn";
import { isValidCandidate } from "@pkg/core/validation";
import type { Coordinate } from "@pkg/shared/schemas";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyCandidateSelection } from "@/features/game/lib/candidate";
import type {
  GameController,
  GameSessionSnapshot,
} from "@/features/game/types/game-session";
import { markTutorialSeen } from "@/features/tutorial/lib/tutorial-progress";
import {
  createOpponentTurn1,
  createOpponentTurn2,
  createScriptedRandom,
  createStepRandom,
  createTutorialGameState,
  getPhaseStep,
  getSubmitBlock,
  isSelectableInStep,
  resolveSettledPhase,
  TUTORIAL_WIN_CELL,
  type TutorialPhase,
  type TutorialSubmitBlock,
} from "@/features/tutorial/lib/tutorial-script";

/** Presentation pacing for the scripted opponent (slightly slower than easy CPU). */
const OPPONENT_TIMING = {
  thinkingDelayMs: 700,
  candidateSelectionIntervalMs: 450,
  postSelectionPauseMs: 650,
} as const;

interface TutorialSessionState {
  phase: TutorialPhase;
  snapshot: GameSessionSnapshot;
  submitBlock: TutorialSubmitBlock | null;
}

function createInitialTutorialState(): TutorialSessionState {
  return {
    phase: "intro",
    submitBlock: null,
    snapshot: {
      mode: "cpu",
      roomId: null,
      shareUrl: null,
      myPlayerId: "player1",
      gameState: createTutorialGameState(),
      selectedCandidates: [],
      opponentCandidates: [],
      status: "connected",
      statusMessage: null,
    },
  };
}

export interface TutorialSession {
  controller: GameController;
  phase: TutorialPhase;
  submitBlock: TutorialSubmitBlock | null;
  /** Pulse the winning cell until the learner has it selected. */
  highlightWinCell: boolean;
  /** Dismiss the intro splash and begin step 1. */
  start: () => void;
  /** Acknowledge an explanation beat and hand the turn to the opponent. */
  advance: () => void;
  /** Mark the tutorial as seen when leaving early (navigation is the caller's job). */
  skip: () => void;
  /** Report that turn-resolution animations have caught up with the history. */
  notifyFxIdle: (settledTurnCount: number) => void;
}

export function useTutorialSession(): TutorialSession {
  const [state, setState] = useState<TutorialSessionState>(
    createInitialTutorialState,
  );
  const opponentTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const snapshotRef = useRef(state.snapshot);
  useEffect(() => {
    snapshotRef.current = state.snapshot;
  });

  const setCandidateSelection = useCallback(
    (coord: Coordinate, shouldSelect: boolean) => {
      setState((current) => {
        const step = getPhaseStep(current.phase);
        if (!step) return current;
        const { snapshot } = current;
        if (snapshot.gameState.phase !== "playing") return current;
        if (snapshot.gameState.currentPlayer !== "player1") return current;
        if (!isValidCandidate(snapshot.gameState.board, coord)) return current;
        if (shouldSelect && !isSelectableInStep(step, coord)) {
          // Step 1 locks selection to the win cell — tell the learner instead
          // of silently ignoring the tap.
          return current.submitBlock === "winCellOnly"
            ? current
            : { ...current, submitBlock: "winCellOnly" };
        }

        const selectedCandidates = applyCandidateSelection(
          snapshot.selectedCandidates,
          coord,
          shouldSelect,
        );
        if (selectedCandidates === snapshot.selectedCandidates) return current;

        return {
          ...current,
          submitBlock: null,
          snapshot: { ...snapshot, selectedCandidates },
        };
      });
    },
    [],
  );

  const submitCandidates = useCallback(() => {
    setState((current) => {
      const step = getPhaseStep(current.phase);
      if (!step) return current;
      const { snapshot } = current;
      if (
        snapshot.gameState.phase !== "playing" ||
        snapshot.gameState.currentPlayer !== "player1" ||
        snapshot.selectedCandidates.length === 0
      ) {
        return current;
      }

      const submitBlock = getSubmitBlock(step, snapshot.selectedCandidates);
      if (submitBlock) {
        return { ...current, submitBlock };
      }

      const { nextState, result } = resolveTurn(
        snapshot.gameState,
        snapshot.gameState.currentPlayer,
        snapshot.selectedCandidates,
        createStepRandom(step, snapshot.selectedCandidates),
      );

      return {
        ...current,
        submitBlock: null,
        snapshot: {
          ...snapshot,
          gameState: {
            ...nextState,
            turnHistory: [...snapshot.gameState.turnHistory, result],
          },
          selectedCandidates: [],
          opponentCandidates: [],
          status: result.success ? "connected" : "turnFailedSelf",
          statusMessage: null,
        },
      };
    });
  }, []);

  const notifyFxIdle = useCallback((settledTurnCount: number) => {
    setState((current) => {
      if (current.snapshot.gameState.turnHistory.length !== settledTurnCount) {
        return current;
      }
      const phase = resolveSettledPhase(current.phase, settledTurnCount);
      if (phase === current.phase) return current;
      return { ...current, phase };
    });
  }, []);

  const start = useCallback(() => {
    setState((current) =>
      current.phase === "intro" ? { ...current, phase: "step1" } : current,
    );
  }, []);

  const advance = useCallback(() => {
    setState((current) => {
      if (current.phase === "step1Fail") {
        return { ...current, phase: "white1" };
      }
      if (current.phase === "step2Success") {
        return { ...current, phase: "white2" };
      }
      return current;
    });
  }, []);

  const skip = useCallback(() => {
    markTutorialSeen();
  }, []);

  const { phase } = state;

  useEffect(() => {
    if (phase === "done") {
      markTutorialSeen();
    }
  }, [phase]);

  // Scripted opponent: reveal candidates one-by-one, then resolve with the
  // pre-scripted roll (mirrors useCpuGameSession's staged reveal).
  useEffect(() => {
    if (phase !== "white1" && phase !== "white2") {
      return;
    }

    setState((current) => ({
      ...current,
      snapshot: {
        ...current.snapshot,
        status: "cpuThinking",
        statusMessage: null,
      },
    }));

    const thinkingTimer = setTimeout(() => {
      const turn =
        phase === "white1"
          ? createOpponentTurn1()
          : createOpponentTurn2(snapshotRef.current.gameState.board);

      turn.candidates.forEach((_, index) => {
        const revealTimer = setTimeout(() => {
          setState((current) => ({
            ...current,
            snapshot: {
              ...current.snapshot,
              opponentCandidates: turn.candidates.slice(0, index + 1),
            },
          }));
        }, index * OPPONENT_TIMING.candidateSelectionIntervalMs);
        opponentTimersRef.current.push(revealTimer);
      });

      const resolveDelay =
        (turn.candidates.length - 1) *
          OPPONENT_TIMING.candidateSelectionIntervalMs +
        OPPONENT_TIMING.postSelectionPauseMs;
      const resolveTimer = setTimeout(() => {
        setState((current) => {
          const { snapshot } = current;
          if (snapshot.gameState.phase !== "playing") return current;
          if (snapshot.gameState.currentPlayer !== "player2") return current;

          // Fresh roll queue per invocation: StrictMode runs updaters twice.
          const { nextState, result } = resolveTurn(
            snapshot.gameState,
            "player2",
            turn.candidates,
            createScriptedRandom(turn.rolls),
          );

          return {
            ...current,
            snapshot: {
              ...snapshot,
              gameState: {
                ...nextState,
                turnHistory: [...snapshot.gameState.turnHistory, result],
              },
              selectedCandidates: [],
              opponentCandidates: [],
              status: result.success ? "connected" : "turnFailedOpponent",
              statusMessage: null,
            },
          };
        });
      }, resolveDelay);
      opponentTimersRef.current.push(resolveTimer);
    }, OPPONENT_TIMING.thinkingDelayMs);
    opponentTimersRef.current.push(thinkingTimer);

    return () => {
      for (const timer of opponentTimersRef.current) {
        clearTimeout(timer);
      }
      opponentTimersRef.current = [];
    };
  }, [phase]);

  const step = getPhaseStep(state.phase);
  const canInteract =
    step !== null && state.snapshot.gameState.phase === "playing";

  const highlightWinCell =
    step !== null &&
    !state.snapshot.selectedCandidates.some(
      (coord) =>
        coord.x === TUTORIAL_WIN_CELL.x && coord.y === TUTORIAL_WIN_CELL.y,
    );

  const controller = useMemo<GameController>(
    () => ({
      snapshot: state.snapshot,
      canInteract,
      setCandidateSelection,
      submitCandidates,
    }),
    [state.snapshot, canInteract, setCandidateSelection, submitCandidates],
  );

  return {
    controller,
    phase: state.phase,
    submitBlock: state.submitBlock,
    highlightWinCell,
    start,
    advance,
    skip,
    notifyFxIdle,
  };
}
