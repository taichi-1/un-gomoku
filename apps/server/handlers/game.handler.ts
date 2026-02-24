import { WS_EVENTS } from "@pkg/shared/events";
import type { Coordinate } from "@pkg/shared/schemas";
import {
  getRoom,
  processTurn,
  updateCandidateDraft,
  validateDraftUpdateContext,
  validateTurnContext,
} from "../services";
import type { GameSocket } from "../types";
import { sendMessage } from "../utils";

export function handleUpdateCandidateDraft(
  ws: GameSocket,
  candidates: Coordinate[],
): void {
  const room = getRoom(ws.data.roomId ?? "");
  const validation = validateDraftUpdateContext(
    room,
    ws.data.playerId,
    candidates,
  );
  if ("kind" in validation) {
    sendMessage(ws, {
      event: WS_EVENTS.GAME_ERROR,
      message: validation.message,
    });
    return;
  }
  updateCandidateDraft(validation);
}

export function handleSubmitCandidates(
  ws: GameSocket,
  candidates: Coordinate[],
): void {
  const room = getRoom(ws.data.roomId ?? "");
  const validation = validateTurnContext(room, ws.data.playerId, candidates);
  if ("kind" in validation) {
    sendMessage(ws, {
      event: WS_EVENTS.GAME_ERROR,
      message: validation.message,
    });
    return;
  }
  processTurn(validation);
}
