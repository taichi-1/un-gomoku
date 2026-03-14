import { createInitialGameState } from "@pkg/core/game-state";
import { resolveTurn } from "@pkg/core/turn";
import { isValidCandidate, validateCandidates } from "@pkg/core/validation";
import type { Coordinate, PlayerId } from "@pkg/shared/schemas";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { gameSessionQueryKey } from "@/app/query-keys";
import {
  applyCandidateSelection,
  hasDuplicateCandidates,
} from "@/features/game/lib/candidate";
import {
  CPU_CONFIGS,
  CPU_PERSONA_CONFIGS,
  type CpuDifficulty,
  type CpuPersona,
  type CpuTurnOrder,
  computeBestMove,
} from "@/features/game/lib/cpu";
import type {
  GameController,
  GameSessionSnapshot,
} from "@/features/game/types/game-session";

/** Estimated duration of the player's turn resolution animation in ms. */
const ANIMATION_ESTIMATED_MS = 1600;

function createCpuQueryKey(
  difficulty: CpuDifficulty,
  turnOrder: CpuTurnOrder,
  persona: CpuPersona,
) {
  return [
    ...gameSessionQueryKey("cpu", difficulty),
    turnOrder,
    persona,
  ] as const;
}

function createInitialCpuSnapshot(
  turnOrder: CpuTurnOrder,
  difficulty: CpuDifficulty,
  persona: CpuPersona,
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
    cpuInfo: { difficulty, persona },
  };
}

export function useCpuGameSession(
  difficulty: CpuDifficulty,
  turnOrder: CpuTurnOrder,
  persona: CpuPersona,
): GameController {
  const queryClient = useQueryClient();
  const cpuTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const queryKey = createCpuQueryKey(difficulty, turnOrder, persona);

  const { data: snapshot } = useQuery({
    queryKey,
    queryFn: async () =>
      createInitialCpuSnapshot(turnOrder, difficulty, persona),
    initialData: () => createInitialCpuSnapshot(turnOrder, difficulty, persona),
  });

  const setSnapshot = useCallback(
    (updater: (current: GameSessionSnapshot) => GameSessionSnapshot): void => {
      queryClient.setQueryData<GameSessionSnapshot>(queryKey, (current) =>
        updater(
          current ?? createInitialCpuSnapshot(turnOrder, difficulty, persona),
        ),
      );
    },
    [queryClient, queryKey, turnOrder, difficulty, persona],
  );

  const clearCpuTimers = useCallback(() => {
    for (const t of cpuTimersRef.current) {
      clearTimeout(t);
    }
    cpuTimersRef.current = [];
  }, []);

  // ── Run CPU turn with staged candidate selection ──

  const runCpuTurn = useCallback(
    (cpuTurnStartTime: number) => {
      // Snapshot read outside setSnapshot to compute candidates synchronously
      const current = queryClient.getQueryData<GameSessionSnapshot>(queryKey);
      if (!current) return;
      const { gameState, myPlayerId } = current;
      if (gameState.phase !== "playing") return;
      if (gameState.currentPlayer === myPlayerId) return;

      const cpuPlayer = gameState.currentPlayer;
      const config = {
        ...CPU_CONFIGS[difficulty],
        ...CPU_PERSONA_CONFIGS[persona],
      };
      const { candidates } = computeBestMove(
        gameState.board,
        cpuPlayer,
        config,
      );
      if (candidates.length === 0) return;

      const elapsed = Date.now() - cpuTurnStartTime;
      const animationWait = Math.max(0, ANIMATION_ESTIMATED_MS - elapsed);
      const totalDelay = animationWait + config.thinkingDelayMs;

      // After animation + 余韻 delay, start showing candidates one-by-one
      const startTimer = setTimeout(() => {
        for (let i = 0; i < candidates.length; i++) {
          const selectionTimer = setTimeout(() => {
            setSnapshot((s) => ({
              ...s,
              opponentCandidates: candidates.slice(0, i + 1),
            }));
          }, i * config.candidateSelectionIntervalMs);
          cpuTimersRef.current.push(selectionTimer);
        }

        // After all candidates shown + postSelectionPauseMs, resolve the turn
        const resolveDelay =
          (candidates.length - 1) * config.candidateSelectionIntervalMs +
          config.postSelectionPauseMs;

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
    [queryClient, queryKey, difficulty, persona, setSnapshot],
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
    queryClient.setQueryData(
      queryKey,
      createInitialCpuSnapshot(turnOrder, difficulty, persona),
    );
  }, [clearCpuTimers, queryClient, queryKey, turnOrder, difficulty, persona]);

  return {
    snapshot,
    canInteract,
    setCandidateSelection,
    submitCandidates,
    rematch,
  };
}
