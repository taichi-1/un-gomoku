import { createInitialGameState } from "@pkg/core/game-state";
import { resolveTurn } from "@pkg/core/turn";
import { isValidCandidate, validateCandidates } from "@pkg/core/validation";
import type { Coordinate, PlayerId } from "@pkg/shared/schemas";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { gameSessionQueryKey } from "@/app/query-keys";
import {
  CPU_TURN_TIMINGS,
  type CpuDifficulty,
  type CpuTurnOrder,
  EngineCancelledError,
  getEngineClient,
} from "@/features/game/lib/ai";
import {
  applyCandidateSelection,
  hasDuplicateCandidates,
} from "@/features/game/lib/candidate";
import type {
  GameController,
  GameSessionSnapshot,
} from "@/features/game/types/game-session";

/** Estimated duration of the player's turn resolution animation in ms. */
const ANIMATION_ESTIMATED_MS = 1600;

function createCpuQueryKey(difficulty: CpuDifficulty, turnOrder: CpuTurnOrder) {
  return [...gameSessionQueryKey("cpu", difficulty), turnOrder] as const;
}

function createInitialCpuSnapshot(
  turnOrder: CpuTurnOrder,
  difficulty: CpuDifficulty,
): GameSessionSnapshot {
  const initialState = createInitialGameState();
  const blackPlayer: PlayerId = "player1";
  const humanPlayer: PlayerId =
    turnOrder === "first"
      ? "player1"
      : turnOrder === "second"
        ? "player2"
        : Math.random() < 0.5
          ? "player1"
          : "player2";

  return {
    mode: "cpu",
    roomId: null,
    shareUrl: null,
    myPlayerId: humanPlayer,
    gameState: {
      ...initialState,
      phase: "playing",
      blackPlayer,
      currentPlayer: blackPlayer,
    },
    selectedCandidates: [],
    opponentCandidates: [],
    status: "connected",
    statusMessage: null,
    cpuInfo: { difficulty },
  };
}

export function useCpuGameSession(
  difficulty: CpuDifficulty,
  turnOrder: CpuTurnOrder,
): GameController {
  const queryClient = useQueryClient();
  const cpuTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Bumped on rematch/unmount so in-flight async engine results are discarded.
  const cpuEpochRef = useRef(0);

  const queryKey = createCpuQueryKey(difficulty, turnOrder);

  const { data: snapshot } = useQuery({
    queryKey,
    queryFn: async () => createInitialCpuSnapshot(turnOrder, difficulty),
    initialData: () => createInitialCpuSnapshot(turnOrder, difficulty),
  });

  const setSnapshot = useCallback(
    (updater: (current: GameSessionSnapshot) => GameSessionSnapshot): void => {
      queryClient.setQueryData<GameSessionSnapshot>(queryKey, (current) =>
        updater(current ?? createInitialCpuSnapshot(turnOrder, difficulty)),
      );
    },
    [queryClient, queryKey, turnOrder, difficulty],
  );

  const clearCpuTimers = useCallback(() => {
    for (const t of cpuTimersRef.current) {
      clearTimeout(t);
    }
    cpuTimersRef.current = [];
  }, []);

  // Pre-load ORT + model while the player thinks about their first move.
  useEffect(() => {
    getEngineClient()
      .warmUp()
      .catch(() => {
        // Errors surface (with emergency fallback) when a move is requested.
      });
  }, []);

  // ── Staged candidate reveal + turn resolution ──

  const scheduleCpuResolution = useCallback(
    (
      cpuPlayer: PlayerId,
      candidates: Coordinate[],
      cpuTurnStartTime: number,
    ) => {
      const pacing = CPU_TURN_TIMINGS[difficulty];
      const elapsed = Date.now() - cpuTurnStartTime;
      const animationWait = Math.max(0, ANIMATION_ESTIMATED_MS - elapsed);
      const totalDelay = animationWait + pacing.thinkingDelayMs;

      // After animation + 余韻 delay, start showing candidates one-by-one
      const startTimer = setTimeout(() => {
        for (let i = 0; i < candidates.length; i++) {
          const selectionTimer = setTimeout(() => {
            setSnapshot((s) => ({
              ...s,
              opponentCandidates: candidates.slice(0, i + 1),
            }));
          }, i * pacing.candidateSelectionIntervalMs);
          cpuTimersRef.current.push(selectionTimer);
        }

        // After all candidates shown + postSelectionPauseMs, resolve the turn
        const resolveDelay =
          (candidates.length - 1) * pacing.candidateSelectionIntervalMs +
          pacing.postSelectionPauseMs;

        const resolveTimer = setTimeout(() => {
          setSnapshot((s) => {
            const gs = s.gameState;
            if (gs.phase !== "playing") return s;
            if (gs.currentPlayer === s.myPlayerId) return s;

            const { nextState, result } = resolveTurn(
              gs,
              cpuPlayer,
              candidates,
            );
            return {
              ...s,
              gameState: {
                ...nextState,
                turnHistory: [...gs.turnHistory, result],
              },
              selectedCandidates: [],
              opponentCandidates: [],
              status: result.success ? "connected" : "turnFailedOpponent",
              statusMessage: null,
            };
          });
        }, resolveDelay);

        cpuTimersRef.current.push(resolveTimer);
      }, totalDelay);

      cpuTimersRef.current.push(startTimer);
    },
    [setSnapshot, difficulty],
  );

  // ── Run CPU turn (async engine in a Web Worker) ──

  const runCpuTurn = useCallback(
    (cpuTurnStartTime: number) => {
      const current = queryClient.getQueryData<GameSessionSnapshot>(queryKey);
      if (!current) return;
      const { gameState, myPlayerId } = current;
      if (gameState.phase !== "playing") return;
      if (gameState.currentPlayer === myPlayerId) return;

      const cpuPlayer = gameState.currentPlayer;
      const epoch = cpuEpochRef.current;
      getEngineClient()
        .computeMove(gameState.board, cpuPlayer, difficulty)
        .then(({ candidates }) => {
          if (cpuEpochRef.current !== epoch) return;
          if (candidates.length === 0) return;
          scheduleCpuResolution(cpuPlayer, candidates, cpuTurnStartTime);
        })
        .catch((error) => {
          if (!(error instanceof EngineCancelledError)) {
            console.error("[cpu] engine move failed", error);
          }
        });
    },
    [queryClient, queryKey, difficulty, scheduleCpuResolution],
  );

  // ── Auto-trigger CPU turn when it's CPU's turn ──

  const isCpuTurn =
    snapshot.gameState.phase === "playing" &&
    snapshot.myPlayerId !== null &&
    snapshot.gameState.currentPlayer !== snapshot.myPlayerId;

  const cpuScheduledRef = useRef(false);
  const cpuTurnStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isCpuTurn) {
      cpuScheduledRef.current = false;
      return;
    }
    if (cpuScheduledRef.current) return;
    cpuScheduledRef.current = true;
    cpuTurnStartTimeRef.current = Date.now();

    setSnapshot((current) => ({
      ...current,
      status: "cpuThinking",
      statusMessage: null,
    }));

    runCpuTurn(cpuTurnStartTimeRef.current);
  }, [isCpuTurn, setSnapshot, runCpuTurn]);

  // Cancel timers and discard in-flight engine results on unmount.
  useEffect(() => {
    return () => {
      clearCpuTimers();
      cpuEpochRef.current += 1;
      getEngineClient().cancelAll();
      // Allow the trigger effect to reschedule after a StrictMode simulated
      // unmount: the epoch bump above discards the in-flight move, so without
      // this reset a CPU-first game would soft-lock on "cpuThinking" in dev.
      cpuScheduledRef.current = false;
    };
  }, [clearCpuTimers]);

  // ── Human interaction ──

  const setCandidateSelection = useCallback(
    (coord: Coordinate, shouldSelect: boolean) => {
      setSnapshot((current) => {
        if (current.gameState.phase !== "playing") return current;
        if (current.gameState.currentPlayer !== current.myPlayerId) {
          return current;
        }
        if (!isValidCandidate(current.gameState.board, coord)) return current;

        const selectedCandidates = applyCandidateSelection(
          current.selectedCandidates,
          coord,
          shouldSelect,
        );

        if (selectedCandidates === current.selectedCandidates) return current;

        return {
          ...current,
          selectedCandidates,
          status: "connected",
          statusMessage: null,
        };
      });
    },
    [setSnapshot],
  );

  const submitCandidates = useCallback(() => {
    setSnapshot((current) => {
      if (
        current.gameState.phase !== "playing" ||
        current.selectedCandidates.length === 0
      ) {
        return current;
      }
      if (current.gameState.currentPlayer !== current.myPlayerId) {
        return current;
      }

      if (hasDuplicateCandidates(current.selectedCandidates)) {
        return {
          ...current,
          status: "error",
          statusMessage: "Duplicate candidates are not allowed",
        };
      }

      const validation = validateCandidates(
        current.gameState.board,
        current.selectedCandidates,
      );
      if (!validation.ok) {
        return {
          ...current,
          status: "error",
          statusMessage:
            validation.error === "invalid_candidate_count"
              ? "Invalid candidate count"
              : "Invalid candidate position",
        };
      }

      const { nextState, result } = resolveTurn(
        current.gameState,
        current.gameState.currentPlayer,
        current.selectedCandidates,
      );

      return {
        ...current,
        gameState: {
          ...nextState,
          turnHistory: [...current.gameState.turnHistory, result],
        },
        selectedCandidates: [],
        opponentCandidates: [],
        status: result.success ? "connected" : "turnFailedSelf",
        statusMessage: null,
      };
    });
  }, [setSnapshot]);

  const canInteract =
    snapshot.gameState.phase === "playing" &&
    snapshot.gameState.currentPlayer === snapshot.myPlayerId &&
    snapshot.status !== "cpuThinking";

  const rematch = useCallback(() => {
    clearCpuTimers();
    cpuEpochRef.current += 1;
    getEngineClient().cancelAll();
    queryClient.setQueryData(
      queryKey,
      createInitialCpuSnapshot(turnOrder, difficulty),
    );
  }, [clearCpuTimers, queryClient, queryKey, turnOrder, difficulty]);

  return {
    snapshot,
    canInteract,
    setCandidateSelection,
    submitCandidates,
    rematch,
  };
}
