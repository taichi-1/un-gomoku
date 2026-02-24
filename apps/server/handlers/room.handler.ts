import { WS_EVENTS } from "@pkg/shared/events";
import {
  createRoom,
  getOpponentPlayerId,
  joinRoom,
  removePlayer,
  startGame,
} from "../services";
import type { GameSocket } from "../types";
import { broadcastToRoom, broadcastToRoomExcept, sendMessage } from "../utils";

export function handleRoomCreate(ws: GameSocket): void {
  const { roomId, playerId, playerToken } = createRoom(ws);
  sendMessage(ws, {
    event: WS_EVENTS.ROOM_CREATED,
    roomId,
    playerId,
    playerToken,
  });
}

export function handleRoomJoin(
  ws: GameSocket,
  roomId: string,
  playerToken?: string,
  random: () => number = Math.random,
): void {
  const result = joinRoom(ws, roomId, playerToken);
  if (!result.success) {
    sendMessage(ws, {
      event: WS_EVENTS.ROOM_ERROR,
      message: result.error,
    });
    return;
  }
  sendMessage(ws, {
    event: WS_EVENTS.ROOM_JOINED,
    roomId,
    playerId: result.playerId,
    playerToken: result.playerToken,
  });
  if (result.isReconnect) {
    sendMessage(ws, {
      event: WS_EVENTS.GAME_STATE,
      state: result.room.state,
    });
    for (const draftPlayerId of ["player1", "player2"] as const) {
      broadcastToRoom(result.room, {
        event: WS_EVENTS.GAME_CANDIDATE_DRAFT_UPDATED,
        playerId: draftPlayerId,
        candidates: result.room.candidateDrafts[draftPlayerId],
      });
    }
    const opponentId = getOpponentPlayerId(result.playerId);
    if (result.room.players.has(opponentId)) {
      broadcastToRoomExcept(result.room, result.playerId, {
        event: WS_EVENTS.ROOM_OPPONENT_ONLINE,
        playerId: result.playerId,
      });
    }
    return;
  }

  startGame(result.room, random);
  broadcastToRoom(result.room, {
    event: WS_EVENTS.GAME_START,
    state: result.room.state,
  });
}

export function handleDisconnect(ws: GameSocket): void {
  const result = removePlayer(ws);
  if (!result) return;
  if (result.room.players.size > 0) {
    broadcastToRoom(result.room, {
      event: WS_EVENTS.ROOM_OPPONENT_OFFLINE,
      playerId: result.playerId,
    });
  }
}
