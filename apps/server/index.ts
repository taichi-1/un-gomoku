import { placeStone } from "@pkg/core/board";
import {
  createInitialGameState,
  getNextPlayer,
  isBoardFull,
} from "@pkg/core/game-state";
import { isValidCandidate } from "@pkg/core/validation";
import { checkWinAt } from "@pkg/core/win-detection";
import { MAX_CANDIDATES, SUCCESS_PROBABILITY } from "@pkg/shared/constants";
import { WS_EVENTS } from "@pkg/shared/events";
import {
  type Coordinate,
  type GameStateDTO,
  type PlayerId,
  parseClientMessage,
  type ServerMessage,
} from "@pkg/shared/schemas";
import type { ServerWebSocket } from "bun";

// ===== Room Management =====

interface Room {
  id: string;
  players: Map<ServerWebSocket<WebSocketData>, PlayerId>;
  state: GameStateDTO;
}

interface WebSocketData {
  roomId: string | null;
  playerId: PlayerId | null;
}

const rooms = new Map<string, Room>();

export function generateRoomId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function sendMessage(
  ws: ServerWebSocket<WebSocketData>,
  message: ServerMessage,
): void {
  ws.send(JSON.stringify(message));
}

function broadcastToRoom(room: Room, message: ServerMessage): void {
  const data = JSON.stringify(message);
  for (const playerWs of room.players.keys()) {
    playerWs.send(data);
  }
}

// ===== Game Logic =====

export function calculateSuccess(candidateCount: number): boolean {
  const probability = SUCCESS_PROBABILITY[candidateCount];
  if (probability === undefined) {
    return false;
  }
  return Math.random() < probability;
}

export function selectRandomCandidate(candidates: Coordinate[]): Coordinate {
  const index = Math.floor(Math.random() * candidates.length);
  const candidate = candidates[index];
  if (!candidate) {
    throw new Error("No candidates available");
  }
  return candidate;
}

function handleSubmitCandidates(
  ws: ServerWebSocket<WebSocketData>,
  candidates: Coordinate[],
): void {
  const { roomId, playerId } = ws.data;
  if (!roomId || !playerId) {
    sendMessage(ws, {
      event: WS_EVENTS.GAME_ERROR,
      message: "Not in a room",
    });
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    sendMessage(ws, {
      event: WS_EVENTS.GAME_ERROR,
      message: "Room not found",
    });
    return;
  }

  if (room.state.phase !== "playing") {
    sendMessage(ws, {
      event: WS_EVENTS.GAME_ERROR,
      message: "Game not in progress",
    });
    return;
  }

  if (room.state.currentPlayer !== playerId) {
    sendMessage(ws, {
      event: WS_EVENTS.GAME_ERROR,
      message: "Not your turn",
    });
    return;
  }

  if (candidates.length < 1 || candidates.length > MAX_CANDIDATES) {
    sendMessage(ws, {
      event: WS_EVENTS.GAME_ERROR,
      message: `Must select 1-${MAX_CANDIDATES} candidates`,
    });
    return;
  }

  // Validate all candidates
  for (const coord of candidates) {
    if (!isValidCandidate(room.state.board, coord)) {
      sendMessage(ws, {
        event: WS_EVENTS.GAME_ERROR,
        message: "Invalid candidate position",
      });
      return;
    }
  }

  // Calculate success/failure
  const success = calculateSuccess(candidates.length);

  if (success) {
    // Select random position and place stone
    const placedPosition = selectRandomCandidate(candidates);
    room.state.board = placeStone(room.state.board, placedPosition, playerId);

    // Check for win
    if (checkWinAt(room.state.board, placedPosition, playerId)) {
      room.state.phase = "finished";
      room.state.winner = playerId;

      broadcastToRoom(room, {
        event: WS_EVENTS.GAME_TURN_RESULT,
        result: {
          success: true,
          placedPosition,
          candidates,
          player: playerId,
          gameOver: true,
          winner: playerId,
        },
        state: room.state,
      });
      return;
    }

    // Check for draw
    if (isBoardFull(room.state.board)) {
      room.state.phase = "finished";
      room.state.isDraw = true;

      broadcastToRoom(room, {
        event: WS_EVENTS.GAME_TURN_RESULT,
        result: {
          success: true,
          placedPosition,
          candidates,
          player: playerId,
          gameOver: true,
          winner: null,
        },
        state: room.state,
      });
      return;
    }

    // Continue game
    room.state.currentPlayer = getNextPlayer(playerId);

    broadcastToRoom(room, {
      event: WS_EVENTS.GAME_TURN_RESULT,
      result: {
        success: true,
        placedPosition,
        candidates,
        player: playerId,
        gameOver: false,
        winner: null,
      },
      state: room.state,
    });
  } else {
    // Failure - turn passes to opponent (no stone placed)
    room.state.currentPlayer = getNextPlayer(playerId);

    broadcastToRoom(room, {
      event: WS_EVENTS.GAME_TURN_RESULT,
      result: {
        success: false,
        placedPosition: null,
        candidates,
        player: playerId,
        gameOver: false,
        winner: null,
      },
      state: room.state,
    });
  }
}

// ===== WebSocket Server =====

const server = Bun.serve<WebSocketData>({
  port: 3000,
  fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, {
        data: {
          roomId: null,
          playerId: null,
        },
      });
      if (upgraded) {
        return undefined;
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    return new Response("un-gomoku server", { status: 200 });
  },
  websocket: {
    open() {
      console.log("Client connected");
    },
    message(ws, message) {
      let json: unknown;
      try {
        json = JSON.parse(message.toString());
      } catch {
        sendMessage(ws, {
          event: WS_EVENTS.GAME_ERROR,
          message: "Invalid JSON",
        });
        return;
      }

      const result = parseClientMessage(json);
      if (!result.success) {
        const issue = result.issues[0];
        sendMessage(ws, {
          event: WS_EVENTS.GAME_ERROR,
          message: `Validation error: ${issue?.message ?? "Unknown error"}`,
        });
        return;
      }

      const data = result.output;

      try {
        switch (data.event) {
          case WS_EVENTS.ROOM_CREATE: {
            const roomId = generateRoomId();
            const room: Room = {
              id: roomId,
              players: new Map(),
              state: createInitialGameState(),
            };
            room.players.set(ws, "player1");
            rooms.set(roomId, room);

            ws.data.roomId = roomId;
            ws.data.playerId = "player1";

            sendMessage(ws, {
              event: WS_EVENTS.ROOM_CREATED,
              roomId,
              playerId: "player1",
            });
            break;
          }

          case WS_EVENTS.ROOM_JOIN: {
            const room = rooms.get(data.roomId);
            if (!room) {
              sendMessage(ws, {
                event: WS_EVENTS.ROOM_ERROR,
                message: "Room not found",
              });
              return;
            }

            if (room.players.size >= 2) {
              sendMessage(ws, {
                event: WS_EVENTS.ROOM_ERROR,
                message: "Room is full",
              });
              return;
            }

            room.players.set(ws, "player2");
            ws.data.roomId = data.roomId;
            ws.data.playerId = "player2";

            sendMessage(ws, {
              event: WS_EVENTS.ROOM_JOINED,
              roomId: data.roomId,
              playerId: "player2",
            });

            // Start the game
            room.state.phase = "playing";
            broadcastToRoom(room, {
              event: WS_EVENTS.GAME_START,
              state: room.state,
            });
            break;
          }

          case WS_EVENTS.GAME_SUBMIT_CANDIDATES: {
            handleSubmitCandidates(ws, data.candidates);
            break;
          }
        }
      } catch (error) {
        console.error("Error processing message:", error);
        sendMessage(ws, {
          event: WS_EVENTS.GAME_ERROR,
          message: "Error processing message",
        });
      }
    },
    close(ws) {
      console.log("Client disconnected");

      const { roomId } = ws.data;
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          room.players.delete(ws);
          if (room.players.size === 0) {
            rooms.delete(roomId);
          }
        }
      }
    },
  },
});

console.log(`Server running on http://localhost:${server.port}`);
