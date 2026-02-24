import { isValidCandidate } from "@pkg/core/validation";
import { WS_EVENTS } from "@pkg/shared/events";
import type { Coordinate } from "@pkg/shared/schemas";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { gameSessionQueryKey } from "@/app/query-keys";
import { applyCandidateSelection } from "@/features/game/lib/candidate";
import {
  createDraftSyncThrottle,
  type DraftSyncThrottle,
} from "@/features/game/lib/draft-sync-throttle";
import { startOnlineConnection } from "@/features/game/lib/online-connection";
import {
  canInteractOnlineSnapshot,
  createInitialOnlineSnapshot,
  normalizeRoomId,
} from "@/features/game/lib/online-session";
import type {
  GameController,
  GameSessionSnapshot,
} from "@/features/game/types/game-session";

const DRAFT_SYNC_INTERVAL_MS = 100;

export function useOnlineGameSession(rawRoomId: string): GameController {
  const roomId = useMemo(() => normalizeRoomId(rawRoomId), [rawRoomId]);
  const queryKey = useMemo(
    () => gameSessionQueryKey("online", roomId),
    [roomId],
  );

  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const draftSyncRef = useRef<DraftSyncThrottle | null>(null);

  const { data: snapshot } = useQuery({
    queryKey,
    queryFn: async () => createInitialOnlineSnapshot(roomId),
    initialData: () => createInitialOnlineSnapshot(roomId),
  });

  const setSnapshot = useCallback(
    (updater: (current: GameSessionSnapshot) => GameSessionSnapshot): void => {
      queryClient.setQueryData<GameSessionSnapshot>(queryKey, (current) =>
        updater(current ?? createInitialOnlineSnapshot(roomId)),
      );
    },
    [queryClient, queryKey, roomId],
  );

  const setSnapshotRef = useRef(setSnapshot);
  setSnapshotRef.current = setSnapshot;

  const sendMessage = useCallback((payload: unknown): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  useEffect(() => {
    const draftSync = createDraftSyncThrottle({
      intervalMs: DRAFT_SYNC_INTERVAL_MS,
      send: (candidates) =>
        sendMessage({
          event: WS_EVENTS.GAME_UPDATE_CANDIDATE_DRAFT,
          candidates,
        }),
    });
    draftSyncRef.current = draftSync;
    return () => {
      draftSync.dispose();
      if (draftSyncRef.current === draftSync) {
        draftSyncRef.current = null;
      }
    };
  }, [sendMessage]);

  useEffect(() => {
    return startOnlineConnection({
      roomId,
      setSnapshot: (updater) => setSnapshotRef.current(updater),
      setSocket: (socket) => {
        wsRef.current = socket;
      },
    });
  }, [roomId]);

  const setCandidateSelection = useCallback(
    (coord: Coordinate, shouldSelect: boolean) => {
      let nextCandidates: Coordinate[] | null = null;

      setSnapshot((current) => {
        if (!canInteractOnlineSnapshot(current)) {
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

        nextCandidates = selectedCandidates;

        return {
          ...current,
          selectedCandidates,
        };
      });

      if (!nextCandidates) {
        return;
      }

      const draftSync = draftSyncRef.current;
      if (!draftSync) {
        sendMessage({
          event: WS_EVENTS.GAME_UPDATE_CANDIDATE_DRAFT,
          candidates: nextCandidates,
        });
        return;
      }

      draftSync.enqueue(nextCandidates);
    },
    [sendMessage, setSnapshot],
  );

  const submitCandidates = useCallback(() => {
    const current =
      queryClient.getQueryData<GameSessionSnapshot>(queryKey) ?? snapshot;
    if (
      !current ||
      !canInteractOnlineSnapshot(current) ||
      current.selectedCandidates.length === 0
    ) {
      return;
    }

    draftSyncRef.current?.flush();
    const sent = sendMessage({
      event: WS_EVENTS.GAME_SUBMIT_CANDIDATES,
      candidates: current.selectedCandidates,
    });
    if (!sent) {
      setSnapshot((prev) => ({
        ...prev,
        status: "error",
        statusMessage: "Connection lost. Reconnecting...",
      }));
    }
  }, [queryClient, queryKey, sendMessage, setSnapshot, snapshot]);

  return {
    snapshot,
    canInteract: canInteractOnlineSnapshot(snapshot),
    setCandidateSelection,
    submitCandidates,
  };
}
