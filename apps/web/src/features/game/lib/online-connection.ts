import { WS_EVENTS } from "@pkg/shared/events";
import { parseServerMessage } from "@pkg/shared/schemas";
import {
  applyOnlineServerMessage,
  type SnapshotSetter,
} from "@/features/game/lib/online-message-handler";
import {
  clearRoomAuth,
  getRoomAuth,
  saveRoomAuth,
} from "@/lib/room-auth-storage";
import { buildRoomShareUrl, getWebSocketEndpoint } from "@/lib/ws-endpoint";

interface StartOnlineConnectionOptions {
  roomId: string;
  setSnapshot: SnapshotSetter;
  setSocket: (socket: WebSocket | null) => void;
  roomFullRetryDelayMs?: number;
  scheduleTimeout?: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>;
}

export function startOnlineConnection(
  options: StartOnlineConnectionOptions,
): () => void {
  const { roomId, setSnapshot, setSocket } = options;
  const roomFullRetryDelayMs = options.roomFullRetryDelayMs ?? 150;
  const scheduleTimeout =
    options.scheduleTimeout ??
    ((callback: () => void, delayMs: number) => setTimeout(callback, delayMs));
  let active = true;
  let ws: WebSocket | null = null;

  const auth = getRoomAuth(roomId);
  let joinToken: string | undefined = auth?.playerToken;
  let retriedWithoutToken = false;
  let retriedAfterRoomFull = false;
  let roomFullRetryTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRoomFullRetryTimer = (): void => {
    if (!roomFullRetryTimer) {
      return;
    }
    clearTimeout(roomFullRetryTimer);
    roomFullRetryTimer = null;
  };

  const initTimeoutId = scheduleTimeout(() => {
    if (!active) {
      return;
    }
    ws = new WebSocket(getWebSocketEndpoint(roomId));
    setSocket(ws);

    const sendJoinMessage = (token?: string): void => {
      ws?.send(
        JSON.stringify({
          event: WS_EVENTS.ROOM_JOIN,
          roomId,
          ...(token ? { playerToken: token } : {}),
        }),
      );
    };

    ws.onopen = () => {
      if (!active) {
        return;
      }

      setSnapshot((current) => ({
        ...current,
        status: "connecting",
        statusMessage: null,
      }));
      sendJoinMessage(joinToken);
    };

    ws.onmessage = (event) => {
      if (!active) {
        return;
      }

      let json: unknown;
      try {
        json = JSON.parse(String(event.data));
      } catch {
        return;
      }

      const parsed = parseServerMessage(json);
      if (!parsed.success) {
        return;
      }

      const message = parsed.output;

      if (message.event === WS_EVENTS.ROOM_JOINED) {
        saveRoomAuth(message.roomId, {
          playerId: message.playerId,
          playerToken: message.playerToken,
        });

        setSnapshot((current) => ({
          ...current,
          roomId: message.roomId,
          shareUrl: buildRoomShareUrl(message.roomId),
          myPlayerId: message.playerId,
          status:
            current.gameState.phase === "waiting" ? "waiting" : "connected",
          statusMessage: null,
        }));
        return;
      }

      if (message.event === WS_EVENTS.ROOM_ERROR) {
        if (
          message.message === "Invalid token" &&
          joinToken &&
          !retriedWithoutToken
        ) {
          clearRoomAuth(roomId);
          joinToken = undefined;
          retriedWithoutToken = true;
          sendJoinMessage(undefined);
          return;
        }
        if (
          message.message === "Room is full" &&
          joinToken &&
          !retriedAfterRoomFull
        ) {
          retriedAfterRoomFull = true;
          clearRoomFullRetryTimer();
          roomFullRetryTimer = scheduleTimeout(() => {
            if (!active || ws?.readyState !== WebSocket.OPEN) {
              return;
            }
            sendJoinMessage(joinToken);
          }, roomFullRetryDelayMs);
          return;
        }

        setSnapshot((current) => ({
          ...current,
          status: "error",
          statusMessage: message.message,
        }));
        return;
      }

      applyOnlineServerMessage(message, setSnapshot);
    };

    ws.onerror = () => {
      if (!active) {
        return;
      }
      setSnapshot((current) => ({
        ...current,
        status: "error",
        statusMessage: "Connection error",
      }));
    };

    ws.onclose = () => {
      clearRoomFullRetryTimer();
      setSocket(null);
      if (!active) {
        return;
      }

      setSnapshot((current) => {
        if (current.status === "error") {
          return current;
        }

        return {
          ...current,
          status: "disconnected",
        };
      });
    };
  }, 0);

  return () => {
    active = false;
    clearTimeout(initTimeoutId);
    clearRoomFullRetryTimer();
    if (ws) {
      ws.close();
      setSocket(null);
    }
  };
}
