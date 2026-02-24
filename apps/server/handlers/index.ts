import { WS_EVENTS } from "@pkg/shared/events";
import type { ClientMessage } from "@pkg/shared/schemas";
import type { GameSocket } from "../types";
import {
  handleSubmitCandidates,
  handleUpdateCandidateDraft,
} from "./game.handler";
import { handleRoomCreate, handleRoomJoin } from "./room.handler";

export {
  handleSubmitCandidates,
  handleUpdateCandidateDraft,
} from "./game.handler";
export {
  handleDisconnect,
  handleRoomCreate,
  handleRoomJoin,
} from "./room.handler";

export function routeMessage(ws: GameSocket, data: ClientMessage): void {
  switch (data.event) {
    case WS_EVENTS.ROOM_CREATE:
      handleRoomCreate(ws);
      break;
    case WS_EVENTS.ROOM_JOIN:
      handleRoomJoin(ws, data.roomId, data.playerToken);
      break;
    case WS_EVENTS.GAME_UPDATE_CANDIDATE_DRAFT:
      handleUpdateCandidateDraft(ws, data.candidates);
      break;
    case WS_EVENTS.GAME_SUBMIT_CANDIDATES:
      handleSubmitCandidates(ws, data.candidates);
      break;
  }
}
