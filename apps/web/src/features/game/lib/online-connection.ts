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
  reconnectInitialDelayMs?: number;
  reconnectMaxDelayMs?: number;
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
  const reconnectInitialDelayMs = options.reconnectInitialDelayMs ?? 400;
  const reconnectMaxDelayMs = options.reconnectMaxDelayMs ?? 5000;
  const scheduleTimeout =
    options.scheduleTimeout ??
    ((callback: () => void, delayMs: number) => setTimeout(callback, delayMs));
  let active = true;
  let ws: WebSocket | null = null;
  let reconnectDelayMs = reconnectInitialDelayMs;

  const auth = getRoomAuth(roomId);
  let joinToken: string | undefined = auth?.playerToken;
  let retriedWithoutToken = false;
  let retriedAfterRoomFull = false;
  let roomFullRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRoomFullRetryTimer = (): void => {
    if (!roomFullRetryTimer) {
      return;
    }
    clearTimeout(roomFullRetryTimer);
    roomFullRetryTimer = null;
  };

  const clearReconnectTimer = (): void => {
    if (!reconnectTimer) {
      return;
    }
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const setConnectingSnapshot = (): void => {
    setSnapshot((current) => ({
      ...current,
      status: "connecting",
      statusMessage: null,
    }));
  };

  const scheduleReconnect = (): void => {
    if (!active || reconnectTimer) {
      return;
    }
    setConnectingSnapshot();
    const delayMs = reconnectDelayMs;
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, reconnectMaxDelayMs);
    reconnectTimer = scheduleTimeout(() => {
      reconnectTimer = null;
      if (!active) {
        return;
      }
      connect();
    }, delayMs);
  };

  const sendJoinMessage = (socket: WebSocket, playerToken?: string): void => {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(
      JSON.stringify({
        event: WS_EVENTS.ROOM_JOIN,
        roomId,
        ...(playerToken ? { playerToken } : {}),
      }),
    );
  };

  const connect = (): void => {
    if (!active) {
      return;
    }
    clearRoomFullRetryTimer();

    const socket = new WebSocket(getWebSocketEndpoint(roomId));
    ws = socket;
    setSocket(socket);

    socket.onopen = () => {
      if (!active || ws !== socket) {
        return;
      }
      setConnectingSnapshot();
      sendJoinMessage(socket, joinToken);
    };

    socket.onmessage = (event) => {
      if (!active || ws !== socket) {
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
        reconnectDelayMs = reconnectInitialDelayMs;
        clearReconnectTimer();
        retriedAfterRoomFull = false;
        joinToken = message.playerToken;
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
          sendJoinMessage(socket, undefined);
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
            if (
              !active ||
              ws !== socket ||
              socket.readyState !== WebSocket.OPEN
            ) {
              return;
            }
            sendJoinMessage(socket, joinToken);
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

    socket.onerror = () => {
      if (!active || ws !== socket) {
        return;
      }
      setSnapshot((current) => ({
        ...current,
        status: "error",
        statusMessage: "Connection error",
      }));
    };

    socket.onclose = () => {
      if (ws !== socket) {
        return;
      }
      clearRoomFullRetryTimer();
      ws = null;
      setSocket(null);
      if (!active) {
        return;
      }
      scheduleReconnect();
    };
  };

  const initTimeoutId = scheduleTimeout(() => {
    connect();
  }, 0);

  return () => {
    active = false;
    clearTimeout(initTimeoutId);
    clearRoomFullRetryTimer();
    clearReconnectTimer();
    if (ws) {
      const socket = ws;
      ws = null;
      socket.close();
      setSocket(null);
    }
  };
}
