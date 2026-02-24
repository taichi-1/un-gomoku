import { createInitialGameState } from "@pkg/core/game-state";
import type { GameRoomRuntime } from "./runtime-types";

export class FakeDurableObjectStorage {
  private readonly map = new Map<string, unknown>();
  public alarmAt: number | Date | null = null;
  public deleteAlarmCalls = 0;

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: string): Promise<number> {
    const deleted = this.map.delete(key);
    return deleted ? 1 : 0;
  }

  async setAlarm(scheduledTime: number | Date): Promise<void> {
    this.alarmAt = scheduledTime;
  }

  async deleteAlarm(): Promise<void> {
    this.deleteAlarmCalls += 1;
    this.alarmAt = null;
  }
}

interface CreateTestRuntimeOptions {
  storage?: FakeDurableObjectStorage;
  webSockets?: WebSocket[];
}

export function createTestRuntime(options: CreateTestRuntimeOptions = {}): {
  runtime: GameRoomRuntime;
  storage: FakeDurableObjectStorage;
} {
  const storage = options.storage ?? new FakeDurableObjectStorage();
  const webSockets = options.webSockets ?? [];
  const runtime: GameRoomRuntime = {
    state: {
      storage,
      acceptWebSocket: () => undefined,
      getWebSockets: () => webSockets,
    },
    room: {
      id: "",
      players: new Map(),
      state: createInitialGameState(),
      candidateDrafts: { player1: [], player2: [] },
      tokens: new Map(),
      emptyAt: null,
    },
    sockets: new Map(),
    roomExists: false,
    expiresAt: null,
    updatedAt: Date.now(),
  };
  return { runtime, storage };
}
