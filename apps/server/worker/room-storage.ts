import { createInitialGameState } from "@pkg/core/game-state";
import { ROOM_STORAGE_KEY, ROOM_TTL_MS } from "./config";
import { logEvent } from "./logging";
import { toPlayerTokenRecord } from "./room-utils";
import type { GameRoomRuntime, StoredRoomRecord } from "./runtime-types";

export async function restoreFromStorage(
  runtime: GameRoomRuntime,
): Promise<void> {
  const stored =
    await runtime.state.storage.get<StoredRoomRecord>(ROOM_STORAGE_KEY);
  if (!stored) {
    return;
  }
  if (stored.expiresAt && stored.expiresAt <= Date.now()) {
    await runtime.state.storage.delete(ROOM_STORAGE_KEY);
    return;
  }

  runtime.room.id = stored.roomId;
  runtime.room.state = stored.state;
  runtime.room.tokens.clear();
  if (stored.tokens.player1) {
    runtime.room.tokens.set("player1", stored.tokens.player1);
  }
  if (stored.tokens.player2) {
    runtime.room.tokens.set("player2", stored.tokens.player2);
  }
  runtime.room.candidateDrafts = { player1: [], player2: [] };
  runtime.room.emptyAt = stored.emptyAt;
  runtime.updatedAt = stored.updatedAt;
  runtime.expiresAt = stored.expiresAt;
  runtime.roomExists = true;
}

export async function persistRoomState(
  runtime: GameRoomRuntime,
): Promise<void> {
  if (!runtime.roomExists || !runtime.room.id) {
    return;
  }

  runtime.updatedAt = Date.now();
  const record: StoredRoomRecord = {
    roomId: runtime.room.id,
    state: runtime.room.state,
    tokens: toPlayerTokenRecord(runtime.room.tokens),
    updatedAt: runtime.updatedAt,
    emptyAt: runtime.room.emptyAt,
    expiresAt: runtime.expiresAt,
  };
  await runtime.state.storage.put(ROOM_STORAGE_KEY, record);
}

export async function clearRoomState(runtime: GameRoomRuntime): Promise<void> {
  await runtime.state.storage.delete(ROOM_STORAGE_KEY);
  if (typeof runtime.state.storage.deleteAlarm === "function") {
    await runtime.state.storage.deleteAlarm();
  }

  runtime.room.id = "";
  runtime.room.players.clear();
  runtime.room.state = createInitialGameState();
  runtime.room.tokens.clear();
  runtime.room.candidateDrafts = { player1: [], player2: [] };
  runtime.room.emptyAt = null;
  runtime.expiresAt = null;
  runtime.updatedAt = Date.now();
  runtime.roomExists = false;
}

export async function clearExpiry(runtime: GameRoomRuntime): Promise<void> {
  runtime.room.emptyAt = null;
  runtime.expiresAt = null;
  if (typeof runtime.state.storage.deleteAlarm === "function") {
    await runtime.state.storage.deleteAlarm();
  }
}

export async function scheduleExpiry(runtime: GameRoomRuntime): Promise<void> {
  runtime.room.emptyAt = Date.now();
  runtime.expiresAt = runtime.room.emptyAt + ROOM_TTL_MS;
  await runtime.state.storage.setAlarm(runtime.expiresAt);
}

export async function handleAlarm(runtime: GameRoomRuntime): Promise<void> {
  if (
    !runtime.roomExists ||
    runtime.room.players.size > 0 ||
    !runtime.expiresAt
  ) {
    return;
  }
  if (Date.now() < runtime.expiresAt) {
    await runtime.state.storage.setAlarm(runtime.expiresAt);
    return;
  }

  const expiredRoomId = runtime.room.id;
  await clearRoomState(runtime);
  logEvent({
    event: "room.expired",
    roomId: expiredRoomId,
    playerId: null,
    result: "ok",
  });
}
