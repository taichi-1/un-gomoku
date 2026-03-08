import { createInitialGameState } from "@pkg/core/game-state";
import { resolveTurn } from "@pkg/core/turn";
import { isValidCandidate, validateCandidates } from "@pkg/core/validation";
import type { Coordinate } from "@pkg/shared/schemas";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { gameSessionQueryKey } from "@/app/query-keys";
import {
  applyCandidateSelection,
  hasDuplicateCandidates,
} from "@/features/game/lib/candidate";
import type {
  GameController,
  GameSessionSnapshot,
} from "@/features/game/types/game-session";

const LOCAL_QUERY_KEY = gameSessionQueryKey("local", null);

function createInitialLocalSnapshot(): GameSessionSnapshot {
  const initialState = createInitialGameState();
  const blackPlayer = Math.random() < 0.5 ? "player1" : "player2";

  return {
    mode: "local",
    roomId: null,
    shareUrl: null,
    myPlayerId: null,
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
  };
}

export function useLocalGameSession(): GameController {
  const queryClient = useQueryClient();

  const { data: snapshot } = useQuery({
    queryKey: LOCAL_QUERY_KEY,
    queryFn: async () => createInitialLocalSnapshot(),
    initialData: createInitialLocalSnapshot,
  });

  const setSnapshot = useCallback(
    (updater: (current: GameSessionSnapshot) => GameSessionSnapshot): void => {
      queryClient.setQueryData<GameSessionSnapshot>(
        LOCAL_QUERY_KEY,
        (current) => updater(current ?? createInitialLocalSnapshot()),
      );
    },
    [queryClient],
  );

  const setCandidateSelection = useCallback(
    (coord: Coordinate, shouldSelect: boolean) => {
      setSnapshot((current) => {
        if (current.gameState.phase !== "playing") {
          return current;
        }
        if (!isValidCandidate(current.gameState.board, coord)) {
          return current;
        }

        const selectedCandidates = applyCandidateSelection(
          current.selectedCandidates,
          coord,
          shouldSelect,
        );

        if (selectedCandidates === current.selectedCandidates) {
          return current;
        }

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

  const canInteract = snapshot.gameState.phase === "playing";

  const rematch = useCallback(() => {
    queryClient.setQueryData(LOCAL_QUERY_KEY, createInitialLocalSnapshot());
  }, [queryClient]);

  return {
    snapshot,
    canInteract,
    setCandidateSelection,
    submitCandidates,
    rematch,
  };
}
