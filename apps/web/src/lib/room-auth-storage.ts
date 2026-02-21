import type { PlayerId } from "@pkg/shared/schemas";

const ROOM_AUTH_STORAGE_KEY = "ungomoku.room_auth.v1";

export interface RoomAuth {
  playerId: PlayerId;
  playerToken: string;
}

type RoomAuthRecord = Record<string, RoomAuth>;

function readAuthRecord(): RoomAuthRecord {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(ROOM_AUTH_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed as RoomAuthRecord;
  } catch {
    return {};
  }
}

function writeAuthRecord(record: RoomAuthRecord): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      ROOM_AUTH_STORAGE_KEY,
      JSON.stringify(record),
    );
  } catch {
    return;
  }
}

function normalizeRoomId(roomId: string): string {
  return roomId.trim().toUpperCase();
}

export function getRoomAuth(roomId: string): RoomAuth | null {
  const record = readAuthRecord();
  return record[normalizeRoomId(roomId)] ?? null;
}

export function saveRoomAuth(roomId: string, auth: RoomAuth): void {
  const record = readAuthRecord();
  record[normalizeRoomId(roomId)] = auth;
  writeAuthRecord(record);
}

export function clearRoomAuth(roomId: string): void {
  const record = readAuthRecord();
  delete record[normalizeRoomId(roomId)];
  writeAuthRecord(record);
}
